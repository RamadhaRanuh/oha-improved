/**
 * Smoke ganks and counter-gank teleports (flag `roam`; asked for after the S1 playtests).
 *
 * Smoke gank (team plan, one VM per team so all bots share it):
 *   - From GANK_START to GANK_END, at most once per GANK_COOLDOWN s.
 *   - Target: a visible enemy hero, at least TOWER_GAP from enemy towers,
 *     with no other enemy hero seen near it.
 *   - Squad: up to SQUAD_MAX healthy allies within SQUAD_RADIUS of the target, not retreating or
 *     channeling; needs SQUAD_MIN.
 *   - gather: the squad meets at a point GATHER_BACK toward our base from the target. When SQUAD_MIN
 *     are there, whoever has a Smoke of Deceit uses it (no smoke: they go anyway). GATHER_TIMEOUT
 *     without enough: abort.
 *   - go: walk to the target's last seen spot and attack it when seen. Ends when it dies, is lost for
 *     LOST_TIME s, after GO_TIMEOUT s, or when the squad is outnumbered.
 *
 * Counter-gank TP (per bot): an ally near one of our towers is fighting TP_ENEMIES or more enemy heroes;
 * a healthy bot far away with a TP scroll ready teleports to that tower, up to TP_MAX per ally, when
 * the defenders would then not be outnumbered.
 *
 * Debug (Utils.DebugMode):
 *   GANK team=2 t=812 start target=npc_dota_hero_luna squad=axe,puck,earthshaker
 *   GANK team=2 t=826 smoke by=npc_dota_hero_crystal_maiden here=3
 *   GANK team=2 t=851 end result=kill dur=39
 *   TPHELP team=2 hero=npc_dota_hero_puck t=1020 ally=npc_dota_hero_axe enemies=2 defenders=1 dist=7400
 */
import { BotMode, Item, Tower, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import { DesireTier } from "./desire_tiers";
import * as TpCancel from "./tpcancel";

// ---- smoke gank tunables
const GANK_START = 10 * 60;
const GANK_END = 40 * 60;
const GANK_COOLDOWN = 180;
const TOWER_GAP = 1800;
const TARGET_ALONE = 1500;
const SQUAD_MIN = 3;
const SQUAD_MAX = 4;
const SQUAD_RADIUS = 5000;
const SQUAD_HP = 0.6;
const GATHER_BACK = 2000;
const GATHER_RADIUS = 700;
const GATHER_TIMEOUT = 20;
const LOST_TIME = 8;
const GO_TIMEOUT = 40;
const ENGAGE_RADIUS = 1000;
// Hard cap: in 9089765175 the end log threw on the stale target handle, so the plan never ended and the
// squad (Jugg, ES, CM) stayed in team roam for 3 minutes. Whatever happens, a plan ends after this.
const MAX_LIFE = GATHER_TIMEOUT + GO_TIMEOUT + 15;

// ---- counter-gank TP tunables
const TP_START = 3 * 60;
const TP_ENEMIES = 2;
const TP_FIGHT_RADIUS = 1000;
const TP_TOWER_RADIUS = 1600;
const TP_MIN_DIST = 3500;
const TP_HP = 0.6;
const TP_MAX = 2;
const TP_ALLY_COOLDOWN = 30;
const TP_AFTER = 3; // keep the desire this long after landing
export const TP_DESIRE = 0.9; // a channel must not be cut by another mode

const TOWERS: Tower[] = [
    Tower.Top1, Tower.Top2, Tower.Top3, Tower.Mid1, Tower.Mid2, Tower.Mid3, Tower.Bot1, Tower.Bot2, Tower.Bot3, Tower.Base1, Tower.Base2,
];

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Short(unit: Unit): string {
    return unit.GetUnitName().replace("npc_dota_hero_", "");
}

function Log(text: string): void {
    if (Utils.DebugMode) print(`GANK team=${GetTeam()} t=${Math.floor(DotaTime())} ${text}`);
}

function LiveTower(team: number, id: Tower): Unit | null {
    const t = GetTower(team, id);
    if (t === null || t === undefined || t.IsNull() || !t.IsAlive()) return null;
    return t;
}

function NearTower(team: number, loc: Vector, radius: number): Unit | null {
    for (const id of TOWERS) {
        const t = LiveTower(team, id);
        if (t !== null && Dist(t.GetLocation(), loc) < radius) return t;
    }
    return null;
}

function Allies(): Unit[] {
    return GetUnitList(UnitType.AlliedHeroes).filter(
        h => h !== null && !h.IsNull() && h.IsAlive() && !h.IsIllusion() && !jmz.IsMeepoClone(h)
    );
}

function Enemies(loc: Vector, radius: number): Unit[] {
    return jmz.GetEnemiesNearLoc(loc, radius);
}

function Free(h: Unit, minHp: number): boolean {
    const mode = h.GetActiveMode();
    return (
        jmz.GetHP(h) >= minHp &&
        mode !== BotMode.Retreat &&
        mode !== BotMode.EvasiveManeuvers &&
        !h.IsChanneling() &&
        !jmz.CanNotUseAction(h)
    );
}

// ---------------------------------------------------------------------------------------------
// Smoke gank

interface GankPlan {
    target: Unit; // never call methods on it without IsNull(): out of vision the handle goes stale
    targetName: string;
    targetId: number;
    squad: Unit[];
    gather: Vector;
    phase: "gather" | "go";
    startAt: number;
    goAt: number;
    smoked: boolean;
    lastLoc: Vector;
}
let gank: GankPlan | null = null;
let gankEndAt = -999;
let gankCheckAt = -999;

function InSquad(bot: Unit): boolean {
    return gank !== null && gank.squad.some(h => h === bot);
}

function EndGank(result: string): void {
    if (gank === null) return;
    const g = gank;
    gank = null; // first, so a failing log cannot keep the plan alive
    gankEndAt = DotaTime();
    Log(`end result=${result} dur=${Math.floor(DotaTime() - g.startAt)} target=${g.targetName}`);
}

function FindGank(): void {
    const now = DotaTime();
    if (now < GANK_START || now > GANK_END || now - gankEndAt < GANK_COOLDOWN) return;
    if (jmz.IsInLaningPhase()) return;
    const ourAncient = GetAncient(GetTeam()).GetLocation();
    for (const enemy of GetUnitList(UnitType.EnemyHeroes)) {
        if (!jmz.IsValidHero(enemy) || jmz.IsSuspiciousIllusion(enemy)) continue;
        const loc = enemy.GetLocation();
        if (NearTower(GetOpposingTeam(), loc, TOWER_GAP) !== null) continue;
        if (Enemies(loc, TARGET_ALONE).length > 1) continue;
        const squad = Allies()
            .filter(h => Free(h, SQUAD_HP) && Dist(h.GetLocation(), loc) < SQUAD_RADIUS)
            .sort((a, b) => Dist(a.GetLocation(), loc) - Dist(b.GetLocation(), loc))
            .slice(0, SQUAD_MAX);
        if (squad.length < SQUAD_MIN) continue;
        const back = Math.max(Dist(loc, ourAncient), 1);
        const gather = Vector(loc.x + ((ourAncient.x - loc.x) / back) * GATHER_BACK, loc.y + ((ourAncient.y - loc.y) / back) * GATHER_BACK, loc.z);
        gank = { target: enemy, targetName: Short(enemy), targetId: enemy.GetPlayerID(), squad, gather, phase: "gather", startAt: now, goAt: -1, smoked: false, lastLoc: loc };
        Log(`start target=${Short(enemy)} squad=${squad.map(h => Short(h)).join(",")} gather=${Math.floor(gather.x)},${Math.floor(gather.y)}`);
        return;
    }
}

/** Update the plan (once per 0.3 s for the team). */
function UpdateGank(): void {
    const now = DotaTime();
    if (now - gankCheckAt < 0.3) return;
    gankCheckAt = now;
    if (gank === null) {
        FindGank();
        return;
    }
    const g = gank;
    if (now - g.startAt > MAX_LIFE) {
        EndGank("max_life");
        return;
    }
    g.squad = g.squad.filter(h => !h.IsNull() && h.IsAlive() && jmz.GetHP(h) > 0.3);
    if (!IsHeroAlive(g.targetId)) {
        EndGank("kill");
        return;
    }
    const info = GetHeroLastSeenInfo(g.targetId);
    const seen = info !== null && info !== undefined ? info[0] : undefined;
    if (seen !== undefined && seen.time_since_seen < 1) g.lastLoc = seen.location;
    if (g.phase === "gather") {
        const here = g.squad.filter(h => Dist(h.GetLocation(), g.gather) <= GATHER_RADIUS);
        if (here.length >= Math.min(SQUAD_MIN, g.squad.length) && g.squad.length >= SQUAD_MIN) {
            g.phase = "go";
            g.goAt = now;
            UseSmoke(here);
            return;
        }
        if (now - g.startAt > GATHER_TIMEOUT || g.squad.length < SQUAD_MIN) EndGank("no_gather");
        return;
    }
    // go
    if (seen !== undefined && seen.time_since_seen > LOST_TIME && now - g.goAt > LOST_TIME) {
        EndGank("lost");
        return;
    }
    if (now - g.goAt > GO_TIMEOUT) {
        EndGank("timeout");
        return;
    }
    const centre = g.squad.length > 0 ? g.squad[0].GetLocation() : g.lastLoc;
    if (Enemies(centre, 1400).length > g.squad.filter(h => Dist(h.GetLocation(), centre) < 1400).length) EndGank("outnumbered");
}

function UseSmoke(here: Unit[]): void {
    if (gank === null) return;
    for (const h of here) {
        for (let slot = 0; slot <= 5; slot++) {
            const item = h.GetItemInSlot(slot);
            if (item !== null && item !== undefined && item.GetName() === "item_smoke_of_deceit" && jmz.CanCastAbility(item)) {
                h.Action_UseAbility(item as any);
                gank.smoked = true;
                Log(`smoke by=${h.GetUnitName()} here=${here.length}`);
                return;
            }
        }
    }
    Log(`go no_smoke here=${here.length}`);
}

/** HIGH while this bot is in a running smoke gank, else 0. */
export function GankDesire(bot: Unit): number {
    UpdateGank();
    if (gank === null || !InSquad(bot) || !bot.IsAlive()) return 0;
    if (DotaTime() - gank.startAt > MAX_LIFE) return 0;
    return DesireTier.HIGH;
}

export function GankThink(bot: Unit): void {
    if (gank === null || jmz.CanNotUseAction(bot)) return;
    const g = gank;
    if (g.phase === "gather") {
        if (Dist(bot.GetLocation(), g.gather) > GATHER_RADIUS / 2) bot.Action_MoveToLocation(g.gather);
        return;
    }
    const t = g.target;
    if (!t.IsNull() && t.CanBeSeen() && t.IsAlive() && Dist(bot.GetLocation(), t.GetLocation()) < ENGAGE_RADIUS + 600) {
        bot.Action_AttackUnit(t, false);
        return;
    }
    bot.Action_MoveToLocation(g.lastLoc);
}

// ---------------------------------------------------------------------------------------------
// Counter-gank TP

interface TpState {
    ally: Unit | null;
    castAt: number;
    landAt: number;
    dest: Vector;
}
const tpStates: Record<string, TpState> = {};
const tpResponders: Record<number, number[]> = {}; // ally player id -> responder cast times
const tpAllyAt: Record<number, number> = {};

function TpStateOf(bot: Unit): TpState {
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    let s = tpStates[key];
    if (s === undefined) {
        s = { ally: null, castAt: -999, landAt: -999, dest: Vector(0, 0, 0) };
        tpStates[key] = s;
    }
    return s;
}

function TpScroll(bot: Unit): Item | null {
    const item = bot.GetItemInSlot(15);
    if (item !== null && item !== undefined && item.GetName() === "item_tpscroll" && jmz.CanCastAbility(item)) return item;
    return null;
}

/** An ally under a gank near our tower that this bot can TP to: [ally, tower]. */
function FindTp(bot: Unit): [Unit, Unit] | null {
    const now = DotaTime();
    for (const ally of Allies()) {
        if (ally === bot) continue;
        const id = ally.GetPlayerID();
        if (tpAllyAt[id] !== undefined && now - tpAllyAt[id] < TP_ALLY_COOLDOWN && (tpResponders[id] ?? []).length >= TP_MAX) continue;
        if (!ally.WasRecentlyDamagedByAnyHero(2)) continue;
        const loc = ally.GetLocation();
        const enemies = Enemies(loc, TP_FIGHT_RADIUS).length;
        if (enemies < TP_ENEMIES) continue;
        const tower = NearTower(GetTeam(), loc, TP_TOWER_RADIUS);
        if (tower === null) continue;
        if (Dist(bot.GetLocation(), tower.GetLocation()) < TP_MIN_DIST) continue;
        const defenders = Allies().filter(h => Dist(h.GetLocation(), loc) < TP_FIGHT_RADIUS + 400).length;
        const coming = tpAllyAt[id] !== undefined && now - tpAllyAt[id] < TP_ALLY_COOLDOWN ? (tpResponders[id] ?? []).length : 0;
        if (defenders + coming + 1 < enemies) continue; // even with us, still outnumbered
        return [ally, tower];
    }
    return null;
}

/** TP_DESIRE while this bot is teleporting to help (and just after), else 0. */
export function TpDesire(bot: Unit): number {
    const s = TpStateOf(bot);
    const now = DotaTime();
    if (s.ally !== null) {
        if (bot.IsChanneling()) return TP_DESIRE;
        if (now - s.castAt < 0.5) return TP_DESIRE; // the channel has not started yet
        if (Dist(bot.GetLocation(), s.dest) > 1500) {
            // Not there: the TP was cancelled (behavior/tpcancel) or interrupted.
            s.ally = null;
            return 0;
        }
        if (s.landAt < 0) s.landAt = now;
        if (now - s.landAt < TP_AFTER && now - s.castAt < 10) return TP_DESIRE;
        s.ally = null;
        return 0;
    }
    if (now < TP_START || !bot.IsAlive() || bot.IsIllusion() || !Free(bot, TP_HP)) return 0;
    if (Enemies(bot.GetLocation(), 1400).length > 0) return 0;
    const tp = TpScroll(bot);
    if (tp === null) return 0;
    const found = FindTp(bot);
    if (found === null) return 0;
    const ally = found[0];
    const tower = found[1];
    const id = ally.GetPlayerID();
    // Land on the ally's side of the tower.
    const tl = tower.GetLocation();
    const al = ally.GetLocation();
    const d = Math.max(Dist(tl, al), 1);
    const target = Vector(tl.x + ((al.x - tl.x) / d) * Math.min(300, d), tl.y + ((al.y - tl.y) / d) * Math.min(300, d), tl.z);
    if (TpCancel.Blocked(bot, tp.GetName(), target)) return 0;
    if (tpAllyAt[id] === undefined || now - tpAllyAt[id] >= TP_ALLY_COOLDOWN) {
        tpAllyAt[id] = now;
        tpResponders[id] = [];
    }
    tpResponders[id].push(now);
    s.ally = ally;
    s.castAt = now;
    s.landAt = -1;
    s.dest = target;
    bot.Action_UseAbilityOnLocation(tp, target);
    TpCancel.Record(bot, target);
    if (Utils.DebugMode) {
        print(
            `TPHELP team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(now)} ally=${ally.GetUnitName()} enemies=${Enemies(al, TP_FIGHT_RADIUS).length} defenders=${Allies().filter(h => Dist(h.GetLocation(), al) < TP_FIGHT_RADIUS + 400).length} dist=${Math.floor(Dist(bot.GetLocation(), tl))}`
        );
    }
    return TP_DESIRE;
}

export function TpActive(bot: Unit): boolean {
    return TpStateOf(bot).ally !== null;
}

/** While channeling: nothing (any order cuts the TP). After landing: go hit the nearest attacker. */
export function TpThink(bot: Unit): void {
    const s = TpStateOf(bot);
    if (s.ally === null || bot.IsChanneling() || jmz.CanNotUseAction(bot)) return;
    if (DotaTime() - s.castAt < 0.5) return; // the cast order has not started yet
    const ally = s.ally;
    if (ally.IsNull() || !ally.IsAlive()) return;
    const enemies = Enemies(ally.GetLocation(), TP_FIGHT_RADIUS);
    if (enemies.length > 0) bot.Action_AttackUnit(enemies[0], false);
    else bot.Action_MoveToLocation(ally.GetLocation());
}
