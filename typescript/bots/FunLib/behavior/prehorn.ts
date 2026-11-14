/**
 * Pre-horn plans (flag `humanfeel`; asked for after the S1 playtests).
 *
 * Plain OHA does the same thing every game before the horn: two fixed spots per role group, then the
 * same rune at -10. A human learns that in two games. Here the team draws one plan per game, so all
 * five bots act together, and each bot gets its own spot jitter and timing:
 *
 * - standard (any mode): the usual spots, jittered up to SPOT_JITTER, a random time out of the
 *   fountain and a random time to walk to the rune.
 * - feint: first stand at the other role group's spot (seen by the enemy), switch to the real spot
 *   at a random time between FEINT_SWITCH_MIN and FEINT_SWITCH_MAX.
 * - bounty: positions 3, 4 and 5 wait next to the enemy-side bounty rune and take it at 0:00; they
 *   leave for lane by BOUNTY_END. Positions 1 and 2 play standard.
 * - ambush: positions 1, 4 and 5 hide beside our safe lane at the river, where the enemy offlaner walks in, and
 *   attack a lone hero; they give up at AMBUSH_END, or as soon as our first creep wave reaches them
 *   (WAVE_RADIUS) and no fight has started, so the carry is there for the first last hits.
 *   Positions 2 and 3 play standard.
 * - block: position 4 blocks the enemy safe-lane small or medium camp (spawn box from behavior/camps),
 *   so neutrals do not spawn there and the enemy safe lane cannot pull. Everyone else plays standard.
 *   - Sentry (the way humans do it): buy a sentry in the fountain, walk there before the horn, place it
 *     on the box centre from up to SENTRY_CAST away, then play standard. It keeps blocking every minute
 *     until the enemy finds it. No sentry by SENTRY_DEADLINE (no gold, too far): the body block below.
 *   - Body block: at the horn walk to the camp and stand in the box from BLOCK_STAND to BLOCK_END, so
 *     the first neutrals (1:00) do not spawn. Logs whether it worked.
 *
 * Safety: a bot drops its plan when visible enemies near it outnumber allies; aggressive plans are
 * never drawn in turbo; one plan per game, so at most one aggressive plan.
 *
 * Debug (Utils.DebugMode):
 *   PREHORN team=2 plan=ambush roll=0.81
 *   PREHORN team=2 hero=npc_dota_hero_lion pos=5 plan=ambush role=hide spot=5120,-6210 out=-78 leave=-
 *   PREHORN team=2 hero=npc_dota_hero_lion result=engaged t=-12 target=npc_dota_hero_axe
 */
import { BotScriptEnums, Lane, Rune, Team, Tower, Unit, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import * as Rng from "./rng";
import { DesireTier } from "./desire_tiers";
import { Camp, Camps } from "./camps";

type PlanName = "standard" | "feint" | "bounty" | "ambush" | "block";
type Role = "standard" | "feint" | "steal" | "hide" | "block";

// Plan weights (tunable). Turbo always plays standard.
const WEIGHTS: [PlanName, number][] = [
    ["standard", 0.3],
    ["feint", 0.2],
    ["bounty", 0.15],
    ["ambush", 0.15],
    ["block", 0.2],
];
const SPOT_JITTER = 500;
const OUT_MIN = -88; // leave the fountain at a random time in [OUT_MIN, OUT_MAX] (tunable)
const OUT_MAX = -65;
const LEAVE_MIN = -22; // walk to the rune at a random time in [LEAVE_MIN, LEAVE_MAX] (plain OHA: -10)
const LEAVE_MAX = -6;
const FEINT_SWITCH_MIN = -40;
const FEINT_SWITCH_MAX = -25;
const BOUNTY_END = 15; // steal or not, go to lane by then
const BOUNTY_WAIT_OFFSET = 300; // wait this far from the rune, toward our side
const AMBUSH_END = 20; // nobody came: go to lane
const ENGAGED_END = 35; // a fight started before AMBUSH_END may run until this
const AMBUSH_TOWER_GAP = 1600; // hide at least this far from every enemy tower
const AMBUSH_SIDE = 350; // step off the lane toward our jungle
const SPOT_REACHED = 250;
const WAVE_RADIUS = 1000; // ambush: our lane creeps this close to a hider ends the wait
const SEE_RADIUS = 1200; // engage enemies this close to the hiding spot
const CHASE_RADIUS = 1800; // stop chasing this far from the spot
const TOWER_DANGER = 950; // never chase under an enemy tower
const COUNT_RADIUS = 1200; // outnumbered check
const MOVE_EVERY = 0.4;
const BLOCK_STAND = 50; // be inside the box from x:50 (the box must be occupied at the spawn second)
const BLOCK_END = 62; // the first neutrals spawn at 1:00; check at 1:02, then go to lane
const SENTRY = "item_ward_sentry";
const SENTRY_CAST = 400; // cast from this far (cast range 500)
const SENTRY_DEADLINE = -3; // not placed by then: body block after the horn
const ENEMY_TOWER_SAFE = 850; // never stand this close to an enemy tower to place it

// Plain OHA's spots (mode_rune_generic.lua X.GetGoOutLocation): safe-lane group (1, 5), mid group (2, 3, 4).
const SPOTS: Record<number, { safe: Vector[]; mid: Vector[] }> = {
    [Team.Radiant]: {
        safe: [Vector(526, -3893, 256), Vector(1999, -4838, 256)],
        mid: [Vector(-3456, 649, 256), Vector(-1945, 60, 128)],
    },
    [Team.Dire]: {
        safe: [Vector(-1051, 3384, 256), Vector(-2415, 4641, 256)],
        mid: [Vector(2734, -1155, 256), Vector(1142, -337, 128)],
    },
};
// Only the two bounty runes plain OHA uses (mode_rune_generic.lua nRuneList): RUNE_BOUNTY_3/4 may not
// exist in the game, and an unknown rune id could make GetRuneSpawnLocation fail.
const BOUNTIES: Rune[] = [Rune.Bounty1, Rune.Bounty2];
const ENEMY_TOWERS: Tower[] = [Tower.Top1, Tower.Mid1, Tower.Bot1, Tower.Top2, Tower.Mid2, Tower.Bot2];

interface PrehornState {
    role: Role;
    done: boolean;
    spot: Vector; // where to stand before the horn (or hide)
    decoy: Vector | null; // feint: where to stand first
    switchAt: number;
    outAt: number;
    leaveAt: number;
    runeOffset: Vector;
    rune: Rune | null; // steal: the rune to take
    target: Unit | null; // hide / steal: the hero being fought
    camp: Camp | null; // block: the camp to block
    buyTried: boolean;
    castFrom: Vector | null; // block: where to stand to place the sentry
    sentryCharges: number; // block: charges when the cast order was given (-1: not cast yet)
    sentryCastAt: number;
    sentryFailed: boolean;
    engagedAt: number;
    lastMoveTime: number;
}
const states: Record<string, PrehornState> = {};
let plan: PlanName | null = null;

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Toward(from: Vector, to: Vector, distance: number): Vector {
    const d = Math.max(Dist(from, to), 1);
    return Vector(from.x + ((to.x - from.x) / d) * distance, from.y + ((to.y - from.y) / d) * distance, from.z);
}

function Add(a: Vector, b: Vector): Vector {
    return Vector(a.x + b.x, a.y + b.y, a.z);
}

function Log(text: string): void {
    if (Utils.DebugMode) print(`PREHORN team=${GetTeam()} ${text}`);
}

function Fmt(v: Vector): string {
    return `${Math.floor(v.x)},${Math.floor(v.y)}`;
}

/** The team's plan, drawn once per game (one VM per team, so all five bots share it). */
export function Plan(): PlanName {
    if (plan !== null) return plan;
    plan = "standard";
    let roll = 0;
    if (!jmz.IsModeTurbo()) {
        roll = Rng.Float(0, 1);
        let acc = 0;
        for (const entry of WEIGHTS) {
            acc += entry[1];
            if (roll < acc) {
                plan = entry[0];
                break;
            }
        }
    }
    Log(`plan=${plan} roll=${Math.floor(roll * 100) / 100}`);
    return plan;
}

function Jitter(v: Vector, radius: number): Vector {
    for (let i = 0; i < 4; i++) {
        const p = Add(v, Rng.Direction(Rng.Float(0, radius)));
        if (IsLocationPassable(p)) return p;
    }
    return v;
}

function StandardSpot(pos: number, other: boolean): Vector {
    const spots = SPOTS[GetTeam()];
    const safeGroup = pos === 1 || pos === 5;
    const list = safeGroup !== other ? spots.safe : spots.mid;
    return Jitter(list[Rng.Int(0, list.length - 1)], SPOT_JITTER);
}

function TowerUp(team: Team, id: Tower): Unit | null {
    const tower = GetTower(team, id);
    if (tower === null || tower === undefined || tower.IsNull() || !tower.IsAlive()) return null;
    return tower;
}

function NearEnemyTower(loc: Vector, radius: number): boolean {
    for (const id of ENEMY_TOWERS) {
        const tower = TowerUp(GetOpposingTeam(), id);
        if (tower !== null && Dist(tower.GetLocation(), loc) < radius) return true;
    }
    return false;
}

/** The enemy-side bounty rune: the valid spawn nearest the enemy ancient. */
function StealRune(): Rune | null {
    const enemyAncient = GetAncient(GetOpposingTeam()).GetLocation();
    let best: Rune | null = null;
    let bestDist = 99999;
    for (const rune of BOUNTIES) {
        const loc = GetRuneSpawnLocation(rune);
        if (loc === null || loc === undefined || Math.abs(loc.x) + Math.abs(loc.y) < 500) continue;
        const d = Dist(loc, enemyAncient);
        if (d < bestDist) {
            bestDist = d;
            best = rune;
        }
    }
    return best;
}

/**
 * Where the enemy offlaner walks in: plain OHA (and most humans) go from the river rune into the lane
 * where it crosses the river. So: the point on our safe lane about as far from both ancients (the
 * river crossing), at least AMBUSH_TOWER_GAP from every enemy tower, stepped AMBUSH_SIDE toward the
 * map centre.
 */
function AmbushSpot(): Vector | null {
    const lane = GetTeam() === Team.Radiant ? Lane.Bot : Lane.Top;
    const enemyAncient = GetAncient(GetOpposingTeam()).GetLocation();
    const ourAncient = GetAncient(GetTeam()).GetLocation();
    const candidates: Vector[] = [];
    for (let i = 1; i <= 19; i++) {
        const loc = GetLocationAlongLane(lane, i * 0.05);
        if (!NearEnemyTower(loc, AMBUSH_TOWER_GAP)) candidates.push(loc);
    }
    if (candidates.length === 0) return null;
    const river = (v: Vector) => Math.abs(Dist(v, enemyAncient) - Dist(v, ourAncient));
    candidates.sort((a, b) => river(a) - river(b));
    // One of the two best, so the spot is not the same every game.
    const loc = candidates[Rng.Int(0, Math.min(1, candidates.length - 1))];
    const toCentre = Vector(-loc.x, -loc.y, 0);
    const len = Math.max(Dist(toCentre, Vector(0, 0, 0)), 1);
    for (const side of [AMBUSH_SIDE, AMBUSH_SIDE / 2, 0]) {
        const p = Vector(loc.x + (toCentre.x / len) * side, loc.y + (toCentre.y / len) * side, loc.z);
        if (IsLocationPassable(p)) return p;
    }
    return loc;
}

let ambushSpot: Vector | null | undefined = undefined;

/** Block: the enemy small or medium camp nearest the enemy safe-lane tier 1 tower. */
function BlockCamp(): Camp | null {
    const enemy = GetOpposingTeam();
    // Safe lanes: Radiant bottom, Dire top.
    const tower = TowerUp(enemy, enemy === Team.Dire ? Tower.Top1 : Tower.Bot1);
    if (tower === null) return null;
    let best: Camp | null = null;
    let bestDist = 99999;
    for (const c of Camps()) {
        if (c.team !== enemy || (c.type !== "small" && c.type !== "medium")) continue;
        const d = Dist(c.centre, tower.GetLocation());
        if (d < bestDist) {
            bestDist = d;
            best = c;
        }
    }
    return best;
}

function StateOf(bot: Unit): PrehornState {
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    let s = states[key];
    if (s !== undefined) return s;
    const pos = jmz.GetPosition(bot);
    const p = Plan();
    let role: Role = p === "feint" ? "feint" : "standard";
    let spot = StandardSpot(pos, false);
    let rune: Rune | null = null;
    let camp: Camp | null = null;
    if (p === "block" && pos === 4) {
        camp = BlockCamp();
        if (camp !== null) role = "block"; // plays standard before the horn, so `spot` stays
    }
    if (p === "bounty" && (pos === 3 || pos === 4 || pos === 5)) {
        rune = StealRune();
        if (rune !== null) {
            role = "steal";
            const runeLoc = GetRuneSpawnLocation(rune);
            const ourAncient = GetAncient(GetTeam()).GetLocation();
            const back = Dist(runeLoc, ourAncient);
            spot = Jitter(
                Vector(
                    runeLoc.x + ((ourAncient.x - runeLoc.x) / back) * BOUNTY_WAIT_OFFSET,
                    runeLoc.y + ((ourAncient.y - runeLoc.y) / back) * BOUNTY_WAIT_OFFSET,
                    runeLoc.z
                ),
                120
            );
        }
    } else if (p === "ambush" && (pos === 1 || pos === 4 || pos === 5)) {
        if (ambushSpot === undefined) ambushSpot = AmbushSpot();
        if (ambushSpot !== null) {
            role = "hide";
            spot = Jitter(ambushSpot, 150);
        }
    }
    s = {
        role,
        done: false,
        spot,
        decoy: role === "feint" ? StandardSpot(pos, true) : null,
        switchAt: Rng.Float(FEINT_SWITCH_MIN, FEINT_SWITCH_MAX),
        outAt: role === "standard" || role === "feint" || role === "block" ? Rng.Float(OUT_MIN, OUT_MAX) : -999,
        leaveAt: Rng.Float(LEAVE_MIN, LEAVE_MAX),
        runeOffset: Rng.Direction(Rng.Float(0, 80)),
        rune,
        target: null,
        camp,
        buyTried: false,
        castFrom: null,
        sentryCharges: -1,
        sentryCastAt: -999,
        sentryFailed: false,
        engagedAt: -999,
        lastMoveTime: -999,
    };
    states[key] = s;
    const leave = role === "standard" || role === "feint" || role === "block" ? `${Math.floor(s.leaveAt)}` : "-";
    Log(
        `hero=${bot.GetUnitName()} pos=${pos} plan=${p} role=${role} spot=${Fmt(spot)}${camp !== null ? ` camp=${camp.type}@${Fmt(camp.centre)}` : ""}${s.decoy !== null ? ` decoy=${Fmt(s.decoy)} switch=${Math.floor(s.switchAt)}` : ""} out=${Math.floor(s.outAt)} leave=${leave}`
    );
    return s;
}

function End(bot: Unit, s: PrehornState, result: string): void {
    if (s.done) return;
    s.done = true;
    s.target = null;
    Log(`hero=${bot.GetUnitName()} role=${s.role} result=${result} t=${Math.floor(DotaTime())}`);
}

function Enemies(loc: Vector, radius: number): Unit[] {
    return jmz.GetEnemiesNearLoc(loc, radius).filter(e => jmz.IsValidHero(e) && !jmz.IsSuspiciousIllusion(e));
}

function Outnumbered(bot: Unit): boolean {
    const loc = bot.GetLocation();
    const enemies = Enemies(loc, COUNT_RADIUS).length;
    return enemies > 0 && enemies > jmz.GetAlliesNearLoc(loc, COUNT_RADIUS).length;
}

function Move(bot: Unit, s: PrehornState, loc: Vector): void {
    const now = DotaTime();
    if (now - s.lastMoveTime < MOVE_EVERY) return;
    s.lastMoveTime = now;
    bot.Action_MoveToLocation(loc);
}

/** The rune plain OHA sends this bot to after -10 (same choice, so lanes keep their rune). */
function OwnRune(bot: Unit): Rune {
    const lane = bot.GetAssignedLane();
    if (GetTeam() === Team.Radiant) return lane === Lane.Bot ? Rune.Bounty2 : Rune.Power1;
    return lane === Lane.Top ? Rune.Bounty1 : Rune.Power2;
}

/** The weakest visible enemy hero near `centre` that we can fight: as many allies as enemies around it. */
function PickTarget(centre: Vector): Unit | null {
    const enemies = Enemies(centre, SEE_RADIUS);
    if (enemies.length === 0) return null;
    if (jmz.GetAlliesNearLoc(centre, SEE_RADIUS + 300).length <= Enemies(centre, SEE_RADIUS + 500).length) return null;
    let best: Unit | null = null;
    for (const enemy of enemies) {
        if (NearEnemyTower(enemy.GetLocation(), TOWER_DANGER)) continue;
        if (best === null || enemy.GetHealth() < best.GetHealth()) best = enemy;
    }
    return best;
}

/** Ambush: our creep wave has reached this hider and no fight started (go last-hit instead). */
function WaveArrived(bot: Unit, s: PrehornState): boolean {
    if (s.role !== "hide" || s.engagedAt >= 0 || s.target !== null) return false;
    return bot.GetNearbyLaneCreeps(WAVE_RADIUS, false).length > 0;
}

/** Fight `s.target`, or pick one near `centre`. True while fighting. */
function Fight(bot: Unit, s: PrehornState, centre: Vector): boolean {
    const t = s.target;
    if (t !== null && (!jmz.IsValidHero(t) || Dist(t.GetLocation(), centre) > CHASE_RADIUS || NearEnemyTower(t.GetLocation(), TOWER_DANGER))) {
        Log(`hero=${bot.GetUnitName()} role=${s.role} fight_over t=${Math.floor(DotaTime())} target=${t.IsNull() ? "?" : t.GetUnitName()} alive=${!t.IsNull() && t.IsAlive()}`);
        s.target = null;
    }
    if (s.target === null) {
        const pick = PickTarget(centre);
        if (pick === null) return false;
        s.target = pick;
        if (s.engagedAt < 0) {
            s.engagedAt = DotaTime();
            Log(`hero=${bot.GetUnitName()} role=${s.role} result=engaged t=${Math.floor(DotaTime())} target=${pick.GetUnitName()}`);
        }
    }
    bot.Action_AttackUnit(s.target as Unit, false);
    return true;
}

/** Whether this bot's plan still runs. */
export function Active(bot: Unit): boolean {
    if (DotaTime() > BLOCK_END + 1) return false;
    const s = StateOf(bot);
    if (s.role !== "block" && DotaTime() > ENGAGED_END) return false;
    return !s.done;
}

function SentrySlot(bot: Unit): number {
    return bot.FindItemSlot(SENTRY);
}

function SentryCharges(bot: Unit): number {
    const slot = SentrySlot(bot);
    if (slot < 0) return 0;
    const item = bot.GetItemInSlot(slot);
    return item === null || item === undefined ? 0 : item.GetCurrentCharges();
}

/** Where to stand to place the sentry: SENTRY_CAST from the centre, passable, away from enemy towers, nearest us. */
function CastFrom(bot: Unit, centre: Vector): Vector | null {
    let best: Vector | null = null;
    let bestDist = 99999;
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 2 * Math.PI;
        const p = Vector(centre.x + Math.cos(a) * SENTRY_CAST, centre.y + Math.sin(a) * SENTRY_CAST, centre.z);
        if (!IsLocationPassable(p) || NearEnemyTower(p, ENEMY_TOWER_SAFE)) continue;
        const d = Dist(bot.GetLocation(), p);
        if (d < bestDist) {
            bestDist = d;
            best = p;
        }
    }
    return best;
}

function SentryFail(bot: Unit, s: PrehornState, reason: string): void {
    if (s.sentryFailed) return;
    s.sentryFailed = true;
    Log(`hero=${bot.GetUnitName()} role=block result=no_sentry_fallback reason=${reason} t=${Math.floor(DotaTime())}`);
}

/**
 * Block, before the horn: buy and place the sentry. True when it gave this tick's order (or waits);
 * false to play standard (after placing, or when it fell back to the body block).
 */
function SentryThink(bot: Unit, s: PrehornState, now: number): boolean {
    if (s.sentryFailed) return false;
    const c = s.camp as Camp;
    // Buy it in the fountain, as early as possible (OHA's starting items may spend the gold).
    if (!s.buyTried && SentrySlot(bot) < 0 && bot.DistanceFromFountain() < 900) {
        s.buyTried = true;
        if (bot.GetGold() >= GetItemCost(SENTRY)) bot.ActionImmediate_PurchaseItem(SENTRY);
        else {
            SentryFail(bot, s, `gold=${bot.GetGold()}`);
            return false;
        }
        return true;
    }
    if (s.sentryCharges >= 0) {
        // Cast order given: placed when a charge is gone.
        if (SentryCharges(bot) < s.sentryCharges) {
            End(bot, s, `sentry_placed at=${Fmt(c.centre)} camp=${c.type}`);
            return false;
        }
        if (now - s.sentryCastAt < 1.5) return true;
        s.sentryCharges = -1; // the order did not go through: try again
    }
    if (now >= SENTRY_DEADLINE) {
        SentryFail(bot, s, SentrySlot(bot) < 0 ? "none" : "not_placed");
        return false;
    }
    if (now < s.outAt) return true; // still in the fountain
    const slot = SentrySlot(bot);
    if (slot < 0) {
        SentryFail(bot, s, s.buyTried ? "buy_failed" : "none");
        return false;
    }
    // OHA's purchase code moves wards to the backpack every 3 s when not in ward mode: hold it off.
    (bot as any)._lastWardSwapTime = now + 5;
    if (slot >= 6 && slot <= 8) {
        let main = 5;
        for (let i = 0; i <= 5; i++) {
            if (bot.GetItemInSlot(i) === null || bot.GetItemInSlot(i) === undefined) {
                main = i;
                break;
            }
        }
        bot.ActionImmediate_SwapItems(slot, main);
        return true;
    }
    if (s.castFrom === null) {
        s.castFrom = CastFrom(bot, c.centre);
        if (s.castFrom === null) {
            SentryFail(bot, s, "no_cast_spot");
            return false;
        }
    }
    if (Dist(bot.GetLocation(), c.centre) <= SENTRY_CAST + 80) {
        const item = bot.GetItemInSlot(slot);
        if (item !== null && item !== undefined && jmz.CanCastAbility(item)) {
            s.sentryCharges = item.GetCurrentCharges();
            s.sentryCastAt = now;
            bot.Action_UseAbilityOnLocation(item, c.centre);
        }
        return true;
    }
    Move(bot, s, s.castFrom);
    return true;
}

/** Last time any bot's plan can still run (rune mode's Think gate). */
export const LAST_TIME = BLOCK_END + 1;

/** Block: at BLOCK_END, log whether the camp spawned. */
function BlockResult(bot: Unit, s: PrehornState): void {
    const c = s.camp as Camp;
    const neutrals = bot.GetNearbyNeutralCreeps(1200, true).filter(n => !n.IsNull() && n.IsAlive() && Dist(n.GetLocation(), c.centre) < 700).length;
    const inBox = Dist(bot.GetLocation(), c.centre) < 200;
    End(bot, s, `${neutrals === 0 ? "blocked" : "spawned"} neutrals=${neutrals} inBox=${inBox} camp=${c.type}`);
}

/**
 * HIGH after the horn while a steal or ambush still runs, else 0. Before the horn rune mode already
 * runs (its own MODERATE pre-game desire), so this stays 0 then and lets warding take its turn.
 */
export function Desire(bot: Unit): number {
    const now = DotaTime();
    if (now < 0 || now > BLOCK_END + 1 || !bot.IsAlive() || bot.IsIllusion()) return 0;
    const s = StateOf(bot);
    if (s.done || (s.role !== "steal" && s.role !== "hide" && s.role !== "block")) return 0;
    if (s.role === "block") {
        if (now > BLOCK_END) {
            BlockResult(bot, s);
            return 0;
        }
        if (Outnumbered(bot) || bot.WasRecentlyDamagedByAnyHero(1.5)) {
            End(bot, s, "block_danger");
            return 0;
        }
        return DesireTier.HIGH;
    }
    if (now > ENGAGED_END) return 0;
    if (Outnumbered(bot)) {
        End(bot, s, "outnumbered");
        return 0;
    }
    if (s.role === "steal" && now > BOUNTY_END) {
        End(bot, s, "steal_timeout");
        return 0;
    }
    if (s.role === "hide" && now > (s.engagedAt >= 0 ? ENGAGED_END : AMBUSH_END)) {
        End(bot, s, s.engagedAt >= 0 ? "fight_timeout" : "nobody_came");
        return 0;
    }
    if (WaveArrived(bot, s)) {
        End(bot, s, "wave_arrived");
        return 0;
    }
    return DesireTier.HIGH;
}

/** Runs from rune mode's Think. True when it gave this tick's order (or chose to idle). */
export function Think(bot: Unit): boolean {
    const now = DotaTime();
    if (now > BLOCK_END + 1 || jmz.CanNotUseAction(bot)) return false;
    const s = StateOf(bot);
    if (s.done || (s.role !== "block" && now > ENGAGED_END)) return false;
    // Hiding / waiting is not being stuck: OHA's idle check (J.CheckBotIdleState) cleared the ambush in
    // 9089765175 ("Relocating the idle bot" for Jugg and CM from 0:04 to 0:20).
    if (now >= 0 && s.role !== "standard" && s.role !== "feint") (bot as any).laningHoldUntil = now + 1;
    if (s.role === "block" && now >= 0) {
        const c = s.camp as Camp;
        if (now > BLOCK_END) {
            BlockResult(bot, s);
            return false;
        }
        if (Outnumbered(bot)) {
            End(bot, s, "block_danger");
            return false;
        }
        // Walk there right after the horn; stand on the box centre from BLOCK_STAND (small steps, like a human waiting).
        const target = now >= BLOCK_STAND - 5 ? c.centre : Toward(c.centre, bot.GetLocation(), 400);
        if (Dist(bot.GetLocation(), target) > 60) Move(bot, s, target);
        return true;
    }
    if (Outnumbered(bot)) {
        End(bot, s, "outnumbered");
        return false; // rune mode's own pre-game code walks back to the tower
    }

    if (s.role === "block" && now < 0 && SentryThink(bot, s, now)) return true;
    if (s.done) return false;
    if (s.role === "standard" || s.role === "feint" || s.role === "block") {
        if (now >= 0) {
            End(bot, s, "horn");
            return false;
        }
        if (now < s.outAt) return true; // still shopping / chatting in the fountain
        if (now >= s.leaveAt) {
            Move(bot, s, Add(GetRuneSpawnLocation(OwnRune(bot)), s.runeOffset));
            return true;
        }
        const target = s.role === "feint" && s.decoy !== null && now < s.switchAt ? s.decoy : s.spot;
        if (Dist(bot.GetLocation(), target) > SPOT_REACHED) Move(bot, s, target);
        else if (now - s.lastMoveTime > Rng.Float(1.5, 3.5)) Move(bot, s, Add(target, Rng.Direction(120)));
        return true;
    }

    if (s.role === "steal") {
        if (now > BOUNTY_END) {
            End(bot, s, "steal_timeout");
            return false;
        }
        const rune = s.rune as Rune;
        const runeLoc = GetRuneSpawnLocation(rune);
        if (Fight(bot, s, runeLoc)) return true;
        if (now >= 0) {
            const status = GetRuneStatus(rune);
            if (status === BotScriptEnums.RUNE_STATUS_AVAILABLE) {
                bot.Action_PickUpRune(rune);
                return true;
            }
            if (status === BotScriptEnums.RUNE_STATUS_MISSING && now > 1) {
                End(bot, s, "rune_gone");
                return false;
            }
        }
        if (Dist(bot.GetLocation(), s.spot) > SPOT_REACHED) Move(bot, s, s.spot);
        return true;
    }

    // hide
    if (now > (s.engagedAt >= 0 ? ENGAGED_END : AMBUSH_END)) {
        End(bot, s, s.engagedAt >= 0 ? "fight_timeout" : "nobody_came");
        return false;
    }
    if (now >= 0 && WaveArrived(bot, s)) {
        End(bot, s, "wave_arrived");
        return false;
    }
    if (Fight(bot, s, s.spot)) return true;
    if (Dist(bot.GetLocation(), s.spot) > SPOT_REACHED / 2) Move(bot, s, s.spot);
    return true;
}
