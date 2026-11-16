/**
 * Team grouping (flag `group`; spec section 8, asked for after human game 9089923826: Dire bots farmed,
 * defended two lanes, took runes and shopped one at a time while five humans moved together; 9 of 16
 * deaths after 15:00 had at most one ally near against 3-5 enemies).
 *
 * Decided once per UPDATE s for the whole team (one VM per team):
 *
 * 1. Defence (after laning; the team-level laning test is TeamLaning). For each lane, our lowest standing
 *    tower with 2+ enemy heroes seen within THREAT_RADIUS in the last SEEN s, or 1 while the tower is
 *    being hit, needs defenders: 1 hero -> 2, 2-3 -> 3, 4+ or a tier-3 tower -> every bot. They are
 *    picked by travel time (a ready TP scroll counts), meet GATHER_BACK behind the tower and go in once
 *    all but one have arrived, or after GATHER_WAIT s. Bots not picked stay out of that defence.
 *    (Replaces behavior/alone's "no lone defence" block, which kept the lone bot out but never sent help.)
 * 2. Push. After laning, the team pushes one lane together when it has an edge: PUSH_LEAD more heroes
 *    alive, WON_KILLS enemy deaths in WON_WINDOW s without one of ours, the Aegis, or after LATE_TIME with
 *    LATE_ENEMIES or fewer enemies alive. Members (bots at PUSH_MIN_HP+, not defending) gather behind our
 *    lane front first. Without a push, nobody pushes past LOW. High ground stays with behavior/siege.
 *    Ends when we are not ahead in heroes alive, 2 of ours die within 10 s, (once gathered) 3+ enemies are unseen for
 *    5 s while we lead by fewer than PUSH_LEAD, or after PUSH_MAX s.
 * 3. Regroup. After laning, once ENEMY_GROUP enemies were seen together in the last GROUP_MEMORY s, bots
 *    farther than REGROUP_RADIUS from the rally point walk to it, and their farm, runes, wards, shops and
 *    roaming are capped at LOW (behavior/arbiter Cap). The rally point is the push or defence gather point,
 *    else our first healthy core (by position) that is not retreating.
 *
 * Debug (Utils.DebugMode):
 *   GROUP team=3 t=930 defend lane=top start enemies=3 needed=3 ids=lina,warlock,undying
 *   GROUP team=3 t=936 defend lane=top gathered here=2/3
 *   GROUP team=3 t=1200 push lane=mid start why=lead2 ids=...
 *   GROUP team=3 t=1000 regroup start anchor=monkey_king
 */
import { BotMode, Lane, Tower, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import * as Brain from "./team_brain";
import * as Siege from "./siege";
import { DesireTier } from "./desire_tiers";
import { IsOn } from "./flags";

const UPDATE = 1;
// ---- defence (tunable)
const THREAT_RADIUS = 1600;
const SEEN = 3;
const DEFEND_HOLD = 8; // keep a defence this long after its enemies were last seen there
const DEFEND_MIN_HP = 0.4;
const GATHER_BACK = 1200;
const GATHER_RADIUS = 900;
const GATHER_WAIT = 6;
const TP_TIME = 4; // channel plus walking off the tower
const TP_MIN_DIST = 4000;
// ---- push (tunable)
const PUSH_LEAD = 2;
const WON_KILLS = 2;
const WON_WINDOW = 20;
const LATE_TIME = 30 * 60;
const LATE_ENEMIES = 3;
const PUSH_MIN_HP = 0.5;
const PUSH_GATHER_BACK = -1200;
const PUSH_GATHER_RADIUS = 1600;
const PUSH_GATHER_COUNT = 3;
const PUSH_GATHER_TIMEOUT = 20;
const PUSH_MAX = 120;
const PUSH_COOLDOWN = 20;
const STOP_UNSEEN = 3;
const STOP_UNSEEN_TIME = 5;
const STOP_DEATHS = 2;
const STOP_DEATH_WINDOW = 10;
export const PUSH_DESIRE = DesireTier.HIGH;
// ---- regroup (tunable)
const ENEMY_GROUP = 3;
const ENEMY_GROUP_LINK = 1500;
const GROUP_MEMORY = 20;
const REGROUP_RADIUS = 2500;
const REGROUP_ARRIVE = 1200;
const REGROUP_MIN_HP = 0.4;
// ---- caps
const LOW = DesireTier.LOW;
const CAP_KEEP = 0.9; // a capped mode above this is OHA running away (farm is also its run mode): keep it
const CAPPED: Record<number, boolean> = {
    [BotMode.Farm]: true,
    [BotMode.Rune]: true,
    [BotMode.Ward]: true,
    [BotMode.SecretShop]: true,
    [BotMode.SideShop]: true,
    [BotMode.Roam]: true,
};

const LANES = [Lane.Top, Lane.Mid, Lane.Bot];
const LANE_NAMES: Record<number, string> = { [Lane.Top]: "top", [Lane.Mid]: "mid", [Lane.Bot]: "bot" };
const LANE_TOWERS: Record<number, Tower[]> = {
    [Lane.Top]: [Tower.Top1, Tower.Top2, Tower.Top3],
    [Lane.Mid]: [Tower.Mid1, Tower.Mid2, Tower.Mid3],
    [Lane.Bot]: [Tower.Bot1, Tower.Bot2, Tower.Bot3],
};

interface Defence {
    lane: Lane;
    tier: number;
    loc: Vector;
    gather: Vector;
    needed: number;
    ids: number[];
    since: number;
    gathered: boolean;
    lastThreat: number;
    enemies: number;
}

interface Push {
    lane: Lane;
    ids: number[];
    since: number;
    gatherFrom: number; // gather timeout clock (held while most members are at Roshan)
    gathered: boolean;
    why: string;
}

let updatedAt = -999;
let laning = true; // team-level laning phase, set in Update()
let defences: Partial<Record<number, Defence>> = {};
let push: Push | null = null;
let pushEndedAt = -999;
let groupSeenAt = -999;
let regrouping = false;
let rally: Vector | null = null;
let anchorId = -1;
const enemyDeaths: number[] = [];
const allyDeaths: number[] = [];
const enemyAlive: Record<number, boolean> = {};
const allyAlive: Record<number, boolean> = {};
const moving: Record<number, boolean> = {}; // regroup walk in progress (arrival hysteresis)
const target: Record<number, Vector> = {};
const lastMove: Record<number, number> = {};

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Toward(from: Vector, to: Vector, distance: number): Vector {
    const d = Dist(from, to);
    if (d < 1) return from;
    return Vector(from.x + ((to.x - from.x) / d) * distance, from.y + ((to.y - from.y) / d) * distance, from.z);
}

function Short(u: Unit): string {
    return u.GetUnitName().replace("npc_dota_hero_", "");
}

function Log(text: string): void {
    if (Utils.DebugMode) print(`GROUP team=${GetTeam()} t=${Math.floor(DotaTime())} ${text}`);
}

/** Living allied heroes, people included (they count as present but are never assigned). */
function Allies(): Unit[] {
    return GetUnitList(UnitType.AlliedHeroes).filter(
        h => h !== null && !h.IsNull() && h.IsAlive() && !h.IsIllusion() && !jmz.IsMeepoClone(h)
    );
}

function Bots(): Unit[] {
    return Allies().filter(h => h.IsBot());
}

function ById(id: number): Unit | null {
    for (const a of Allies()) if (a.GetPlayerID() === id) return a;
    return null;
}

function Names(ids: number[]): string {
    return ids.map(id => {
        const u = ById(id);
        return u !== null ? Short(u) : `#${id}`;
    }).join(",");
}

function Centroid(units: Unit[]): Vector | null {
    if (units.length === 0) return null;
    let x = 0;
    let y = 0;
    for (const u of units) {
        x += u.GetLocation().x;
        y += u.GetLocation().y;
    }
    return Vector(x / units.length, y / units.length, 0);
}

function TpReady(bot: Unit): boolean {
    const tp = bot.GetItemInSlot(15);
    return tp !== null && tp !== undefined && tp.GetName() === "item_tpscroll" && jmz.CanCastAbility(tp);
}

function TravelTime(bot: Unit, loc: Vector): number {
    const d = Dist(bot.GetLocation(), loc);
    const walk = d / Math.max(bot.GetCurrentMovementSpeed(), 200);
    if (d > TP_MIN_DIST && TpReady(bot)) return Math.min(walk, TP_TIME);
    return walk;
}

/** Our lowest standing tower in a lane and its tier (1-3), or null. */
function LowestTower(team: number, lane: Lane): [Unit, number] | null {
    const list = LANE_TOWERS[lane];
    for (let i = 0; i < list.length; i++) {
        const t = GetTower(team, list[i]);
        if (t !== null && t !== undefined && !t.IsNull() && t.IsAlive()) return [t, i + 1];
    }
    return null;
}

// ---------------------------------------------------------------------------------------------
// Update

function TrackDeaths(now: number): void {
    for (const id of GetTeamPlayers(GetOpposingTeam())) {
        const alive = IsHeroAlive(id);
        if (enemyAlive[id] === true && !alive) enemyDeaths.push(now);
        enemyAlive[id] = alive;
    }
    for (const id of GetTeamPlayers(GetTeam())) {
        const alive = IsHeroAlive(id);
        if (allyAlive[id] === true && !alive) allyDeaths.push(now);
        allyAlive[id] = alive;
    }
    while (enemyDeaths.length > 0 && now - enemyDeaths[0] > 60) enemyDeaths.shift();
    while (allyDeaths.length > 0 && now - allyDeaths[0] > 60) allyDeaths.shift();
}

function CountSince(list: number[], now: number, window: number): number {
    return list.filter(t => now - t <= window).length;
}

/** Size of the largest group of enemies seen together in the last SEEN s. */
function EnemyGroupSize(): number {
    const pts: Vector[] = [];
    for (const e of Brain.Get().enemies) {
        if (e.alive && e.lastSeenLoc !== null && e.lastSeenAge <= SEEN) pts.push(e.lastSeenLoc);
    }
    let best = 0;
    const used = pts.map(() => false);
    for (let i = 0; i < pts.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        const group = [pts[i]];
        for (let k = 0; k < group.length; k++) {
            for (let j = 0; j < pts.length; j++) {
                if (!used[j] && Dist(group[k], pts[j]) <= ENEMY_GROUP_LINK) {
                    used[j] = true;
                    group.push(pts[j]);
                }
            }
        }
        best = Math.max(best, group.length);
    }
    return best;
}

/**
 * Laning phase for the whole team. jmz.IsInLaningPhase() reads GetBot()'s net worth between 10:00 and
 * 14:00, so it flipped with whichever bot ran Update() (regroup started and ended every second).
 * This uses the bots' average net worth instead.
 */
function TeamLaning(): boolean {
    const now = DotaTime();
    const turbo = jmz.IsModeTurbo();
    if (now < (turbo ? 480 : 600)) return true;
    if (now >= (turbo ? 600 : 840)) return false;
    const bots = Bots();
    if (bots.length === 0) return false;
    let nw = 0;
    for (const b of bots) nw += b.GetNetWorth();
    return nw / bots.length < 8000;
}

/** Our tower is under real pressure: hit by a hero or by creeps in the last 2 s. */
function TowerHit(tower: Unit): boolean {
    return tower.WasRecentlyDamagedByAnyHero(2) || tower.WasRecentlyDamagedByCreep(2);
}

function UpdateDefences(now: number): void {
    if (laning) {
        // Laners defend their own towers; one enemy near a T1 is just the lane.
        for (const lane of LANES) {
            const d = defences[lane];
            if (d !== undefined) Log(`defend lane=${LANE_NAMES[lane]} end why=laning dur=${Math.floor(now - d.since)}`);
        }
        defences = {};
        return;
    }
    const team = GetTeam();
    const fountain = jmz.GetTeamFountain();
    const threats: [Lane, number, Unit, number][] = [];
    for (const lane of LANES) {
        const low = LowestTower(team, lane);
        if (low === null) continue;
        let n = 0;
        for (const e of Brain.Get().enemies) {
            if (e.alive && e.lastSeenLoc !== null && e.lastSeenAge <= SEEN && Dist(e.lastSeenLoc, low[0].GetLocation()) <= THREAT_RADIUS) n++;
        }
        // A new defence needs 2+ enemies or the tower being hit; a running one stays while any enemy is near.
        const running = defences[lane] !== undefined;
        if (n > 0 && (running || n >= 2 || TowerHit(low[0]))) threats.push([lane, n, low[0], low[1]]);
    }
    // Drop defences whose threat is gone.
    for (const lane of LANES) {
        const d = defences[lane];
        if (d === undefined) continue;
        const live = threats.some(t => t[0] === lane);
        if (live) d.lastThreat = now;
        if (!live && now - d.lastThreat > DEFEND_HOLD) {
            Log(`defend lane=${LANE_NAMES[lane]} end dur=${Math.floor(now - d.since)} gathered=${d.gathered}`);
            delete defences[lane];
        }
    }
    threats.sort((a, b) => b[1] - a[1]);
    const bots = Bots().filter(b => jmz.GetHP(b) >= DEFEND_MIN_HP);
    const taken: Record<number, boolean> = {};
    for (const t of threats) {
        const [lane, enemies, tower, tier] = t;
        const needed = tier >= 3 || enemies >= 4 ? bots.length : enemies === 1 ? 2 : 3;
        const old = defences[lane];
        const loc = tower.GetLocation();
        // Keep the earlier picks that can still go, then add the fastest of the rest.
        const keep = old !== undefined ? old.ids.filter(id => !taken[id] && bots.some(b => b.GetPlayerID() === id)) : [];
        const rest = bots.filter(b => !taken[b.GetPlayerID()] && !keep.includes(b.GetPlayerID()));
        rest.sort((a, b) => TravelTime(a, loc) - TravelTime(b, loc));
        const ids = keep.slice(0, needed);
        for (const b of rest) {
            if (ids.length >= needed) break;
            ids.push(b.GetPlayerID());
        }
        for (const id of ids) taken[id] = true;
        if (ids.length === 0) {
            if (old !== undefined) {
                Log(`defend lane=${LANE_NAMES[lane]} end why=nobody dur=${Math.floor(now - old.since)}`);
                delete defences[lane];
            }
            continue;
        }
        if (old === undefined) {
            const d: Defence = {
                lane, tier, loc, gather: Toward(loc, fountain, GATHER_BACK), needed, ids, since: now, gathered: false, lastThreat: now, enemies,
            };
            defences[lane] = d;
            Log(`defend lane=${LANE_NAMES[lane]} start tier=${tier} enemies=${enemies} needed=${needed} ids=${Names(ids)}`);
        } else {
            if (old.needed !== needed || old.ids.join(",") !== ids.join(",")) {
                Log(`defend lane=${LANE_NAMES[lane]} update enemies=${enemies} needed=${needed} ids=${Names(ids)}`);
            }
            old.needed = needed;
            old.ids = ids;
            old.enemies = enemies;
            old.tier = tier;
        }
    }
    // Gathered: all but one of the defenders at the gather point (or at the tower), or waited long enough.
    for (const lane of LANES) {
        const d = defences[lane];
        if (d === undefined || d.gathered) continue;
        let here = 0;
        for (const id of d.ids) {
            const u = ById(id);
            if (u !== null && (Dist(u.GetLocation(), d.gather) <= GATHER_RADIUS || Dist(u.GetLocation(), d.loc) <= GATHER_RADIUS)) here++;
        }
        if (here >= Math.max(1, d.ids.length - 1) || now - d.since >= GATHER_WAIT) {
            d.gathered = true;
            Log(`defend lane=${LANE_NAMES[lane]} gathered here=${here}/${d.ids.length}`);
        }
    }
}

function PickPushLane(): Lane | null {
    const centre = Centroid(Bots());
    if (centre === null) return null;
    const enemy = GetOpposingTeam();
    let best: Lane | null = null;
    let bestScore = 1e9;
    for (const lane of LANES) {
        if (Siege.LaneAtHighGround(lane)) continue; // high ground belongs to behavior/siege
        const low = LowestTower(enemy, lane);
        if (low === null) continue;
        let score = Dist(centre, low[0].GetLocation());
        if (Dist(GetLaneFrontLocation(GetTeam(), lane, 0), low[0].GetLocation()) <= 1500) score -= 2000;
        if (score < bestScore) {
            bestScore = score;
            best = lane;
        }
    }
    return best;
}

function PushStartWhy(now: number): string | null {
    const allies = jmz.GetNumOfAliveHeroes(false);
    const enemies = jmz.GetNumOfAliveHeroes(true);
    if (allies - enemies >= PUSH_LEAD) return `lead${allies}v${enemies}`;
    // Only while still ahead: at even numbers the push ended 1 s later (9090005145: won_fight then numbers4v4).
    if (allies > enemies && CountSince(enemyDeaths, now, WON_WINDOW) >= WON_KILLS && CountSince(allyDeaths, now, WON_WINDOW) === 0) return "won_fight";
    if (jmz.DoesTeamHaveAegis() && allies >= enemies) return "aegis";
    if (now >= LATE_TIME && enemies <= LATE_ENEMIES && allies > enemies) return `late${allies}v${enemies}`;
    return null;
}

function PushStopWhy(now: number): string | null {
    const allies = jmz.GetNumOfAliveHeroes(false);
    const enemies = jmz.GetNumOfAliveHeroes(true);
    const aegis = jmz.DoesTeamHaveAegis();
    if (allies <= enemies && !(aegis && allies === enemies)) return `numbers${allies}v${enemies}`;
    if (CountSince(allyDeaths, now, STOP_DEATH_WINDOW) >= STOP_DEATHS) return "deaths";
    let unseen = 0;
    for (const e of Brain.Get().enemies) if (e.alive && e.lastSeenAge > STOP_UNSEEN_TIME) unseen++;
    // Only once gathered: enemies are often out of vision while we walk to the gather point.
    if (push!.gathered && unseen >= STOP_UNSEEN && allies - enemies < PUSH_LEAD && !aegis) return `unseen${unseen}`;
    if (now - push!.since > PUSH_MAX) return "time";
    if (Siege.CommitLane() !== null) return "siege";
    for (const lane of LANES) {
        const d = defences[lane];
        if (d !== undefined && d.needed >= Bots().length) return "defend";
    }
    return null;
}

function UpdatePush(now: number): void {
    if (push !== null) {
        const why = PushStopWhy(now);
        if (why !== null) {
            Log(`push lane=${LANE_NAMES[push.lane]} end why=${why} dur=${Math.floor(now - push.since)} gathered=${push.gathered}`);
            push = null;
            pushEndedAt = now;
            return;
        }
        // Members: keep those still healthy and not defending.
        push.ids = push.ids.filter(id => {
            const u = ById(id);
            return u !== null && jmz.GetHP(u) >= PUSH_MIN_HP * 0.6 && DefenceOf(id) === null;
        });
        if (!push.gathered) {
            const point = PushGather(push.lane);
            let here = 0;
            for (const id of push.ids) {
                const u = ById(id);
                if (u !== null && Dist(u.GetLocation(), point) <= PUSH_GATHER_RADIUS) here++;
            }
            // Taking Roshan first is fine: the gather clock waits while most members are at Roshan.
            let atRoshan = 0;
            for (const id of push.ids) {
                const u = ById(id);
                if (u !== null && u.GetActiveMode() === BotMode.Roshan) atRoshan++;
            }
            if (atRoshan * 2 > push.ids.length) push.gatherFrom = now;
            if (here >= Math.min(PUSH_GATHER_COUNT, push.ids.length) || now - push.gatherFrom > PUSH_GATHER_TIMEOUT) {
                push.gathered = true;
                Log(`push lane=${LANE_NAMES[push.lane]} gathered here=${here}/${push.ids.length}`);
            }
        }
        return;
    }
    if (laning || now - pushEndedAt < PUSH_COOLDOWN || Siege.CommitLane() !== null) return;
    const why = PushStartWhy(now);
    if (why === null) return;
    const lane = PickPushLane();
    if (lane === null) return;
    const ids = Bots()
        .filter(b => jmz.GetHP(b) >= PUSH_MIN_HP && DefenceOf(b.GetPlayerID()) === null)
        .map(b => b.GetPlayerID());
    if (ids.length < 2) return;
    push = { lane, ids, since: now, gatherFrom: now, gathered: false, why };
    Log(`push lane=${LANE_NAMES[lane]} start why=${why} ids=${Names(ids)}`);
}

function PushGather(lane: Lane): Vector {
    return GetLaneFrontLocation(GetTeam(), lane, PUSH_GATHER_BACK);
}

/** The first healthy core by position that is not retreating; else any healthy bot. */
function Anchor(): Unit | null {
    const bots = Bots().filter(b => jmz.GetHP(b) >= REGROUP_MIN_HP && b.GetActiveMode() !== BotMode.Retreat);
    let best: Unit | null = null;
    for (const b of bots) {
        if (best === null || jmz.GetPosition(b) < jmz.GetPosition(best)) best = b;
    }
    return best;
}

function UpdateRegroup(now: number): void {
    if (EnemyGroupSize() >= ENEMY_GROUP) groupSeenAt = now;
    // Behaviour flag `noregroup`: no regroup (walking to the rally point with farm capped at LOW). From 15:00 to
    // 35:00 in ev-group2 / ev-group3 regroup held about 261 s per game; the new team farmed 20-21% of the time
    // against plain OHA's 28%, gained 2.4-3k less net worth and died 19-20 times against 16.
    const want = !laning && now - groupSeenAt <= GROUP_MEMORY && !IsOn("noregroup");
    if (!want) {
        if (regrouping) Log("regroup end");
        regrouping = false;
        rally = null;
        anchorId = -1;
        return;
    }
    let point: Vector | null = null;
    let anchor: Unit | null = null;
    if (push !== null) point = PushGather(push.lane);
    if (point === null) {
        for (const lane of LANES) {
            const d = defences[lane];
            if (d !== undefined && (point === null || d.enemies >= 2)) point = d.gather;
        }
    }
    if (point === null) {
        anchor = Anchor();
        if (anchor !== null) point = anchor.GetLocation();
    }
    // No rally point (everyone dead or retreating): not regrouping. Logged only on a real start.
    if (!regrouping && point !== null) Log(`regroup start anchor=${anchor !== null ? Short(anchor) : push !== null ? "push" : "defence"}`);
    if (regrouping && point === null) Log("regroup end why=no_rally");
    regrouping = point !== null;
    rally = point;
    anchorId = anchor !== null ? anchor.GetPlayerID() : -1;
}

function Update(): void {
    const now = DotaTime();
    if (now - updatedAt < UPDATE) return;
    updatedAt = now;
    laning = TeamLaning();
    TrackDeaths(now);
    UpdateDefences(now);
    UpdatePush(now);
    UpdateRegroup(now);
}

// ---------------------------------------------------------------------------------------------
// Queries

function DefenceOf(id: number): Defence | null {
    for (const lane of LANES) {
        const d = defences[lane];
        if (d !== undefined && d.ids.includes(id)) return d;
    }
    return null;
}

export type DefendRole = "none" | "defend" | "defend_forced" | "gather" | "skip";

/**
 * For aba_defend: "defend" (go, HIGH), "defend_forced" (tier 3: FORCED), "gather" (assigned, still meeting:
 * team roam walks there), "skip" (a hero threat this bot is not picked for, or picked for another lane),
 * "none" (no hero threat here and not picked anywhere: plain OHA defence, e.g. creeps only).
 */
export function DefendRoleOf(bot: Unit, lane: Lane): DefendRole {
    Update();
    const id = bot.GetPlayerID();
    const mine = DefenceOf(id);
    if (mine !== null) {
        if (mine.lane !== lane) return "skip";
        if (!mine.gathered) return "gather";
        return mine.tier >= 3 ? "defend_forced" : "defend";
    }
    if (defences[lane] !== undefined) return "skip";
    return "none";
}

export type PushRole = "none" | "push" | "gather" | "skip";

/** For aba_push: "push" (member, gathered), "gather", "skip" (a push elsewhere or not a member), "none" (no push). */
export function PushRoleOf(bot: Unit, lane: Lane): PushRole {
    Update();
    if (push === null) return "none";
    if (push.lane !== lane || !push.ids.includes(bot.GetPlayerID())) return "skip";
    return push.gathered ? "push" : "gather";
}

/** No team push running (aba_push caps lone pushing at LOW then). */
export function NoPush(): boolean {
    Update();
    return push === null && !laning;
}

/** Team roam: walk to a defence or push gather point. HIGH while walking there, else 0. */
export function GatherDesire(bot: Unit): number {
    Update();
    if (!bot.IsAlive() || !bot.IsBot()) return 0;
    const id = bot.GetPlayerID();
    const d = DefenceOf(id);
    if (d !== null && !d.gathered) {
        target[id] = d.gather;
        return Dist(bot.GetLocation(), d.gather) > 300 ? DesireTier.HIGH : 0;
    }
    if (push !== null && !push.gathered && push.ids.includes(id)) {
        const point = PushGather(push.lane);
        target[id] = point;
        return Dist(bot.GetLocation(), point) > 400 ? DesireTier.HIGH : 0;
    }
    return 0;
}

/** Far from the group while it should be together (and not assigned to a defence or push). */
function FarFromGroup(bot: Unit): boolean {
    if (!regrouping || rally === null || laning) return false;
    const id = bot.GetPlayerID();
    if (id === anchorId || DefenceOf(id) !== null || (push !== null && push.ids.includes(id))) return false;
    const d = Dist(bot.GetLocation(), rally);
    if (moving[id] === true) {
        if (d <= REGROUP_ARRIVE) moving[id] = false;
    } else if (d > REGROUP_RADIUS) {
        moving[id] = true;
    }
    return moving[id] === true;
}

/** Team roam: walk to the rally point. HIGH while far from it (hysteresis: REGROUP_RADIUS out, REGROUP_ARRIVE in), else 0. */
export function RegroupDesire(bot: Unit): number {
    Update();
    if (!bot.IsAlive() || !bot.IsBot() || jmz.GetHP(bot) < REGROUP_MIN_HP) return 0;
    if (!FarFromGroup(bot)) return 0;
    target[bot.GetPlayerID()] = rally as Vector;
    return DesireTier.HIGH;
}

export function Think(bot: Unit): void {
    const id = bot.GetPlayerID();
    const t = target[id];
    if (t === undefined || jmz.CanNotUseAction(bot)) return;
    const now = DotaTime();
    if (lastMove[id] !== undefined && now - lastMove[id] < 0.3) return;
    lastMove[id] = now;
    // Spread around the point a little, by player id, so five bots do not stack on one spot.
    const a = (id % 5) * 1.2566;
    bot.Action_MoveToLocation(Vector(t.x + Math.cos(a) * 150, t.y + Math.sin(a) * 150, t.z));
}

/**
 * Behaviour arbiter: while a bot is picked for a defence or push, or is far from the regrouping team,
 * farm, runes, wards, shops and roaming are capped at LOW so they do not pull it away alone.
 */
export function Cap(bot: Unit, mode: BotMode, value: number): number {
    if (CAPPED[mode] !== true || value <= LOW || value >= CAP_KEEP || !bot.IsBot()) return value;
    Update();
    if (laning) return value;
    const id = bot.GetPlayerID();
    const busy = DefenceOf(id) !== null || (push !== null && push.ids.includes(id)) || FarFromGroup(bot);
    return busy ? LOW : value;
}
