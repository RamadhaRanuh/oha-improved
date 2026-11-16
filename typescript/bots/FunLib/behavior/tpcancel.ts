/**
 * Cancel a TP into a lost fight (asked for after the S1 playtests, as Ryndrb's bots do).
 *
 * Plain OHA casts a TP scroll and always lets it finish, even when the enemy team gathers on the
 * landing spot during the 3 s channel: the bot lands in five heroes and dies. A human watches the
 * minimap and cancels. So:
 *   - Every TP cast records its destination (behavior/gank).
 *   - Before casting: a TP is not started into a spot that is already a lost fight (Blocked).
 *   - While channeling (Check, every frame): if the landing spot became a lost fight, stop
 *     (Action_ClearActions(true)) and do not TP near that spot again for BLOCK_TIME s.
 *
 * Callers: behavior/gank (flag `roam`) uses Blocked and Record for counter-gank TPs. The item-usage
 * hooks (Record on every TP, Check every frame) belonged to flag `retreat`, removed 2026-11-17, so
 * nothing calls Check now and the BLOCK_TIME block never starts.
 *
 * Lost fight at `loc`: at least MIN_ENEMIES living enemy heroes seen within DANGER_RADIUS of it in the
 * last SEEN_TIME s, and more of them than allies there + us + our buildings there (tower, ancient). A
 * TP to our fountain is never cancelled (that is an escape), nor one that is safer than where we are.
 *
 * Debug (Utils.DebugMode):
 *   TPCANCEL team=2 hero=npc_dota_hero_puck t=1430 action=cancel dest=-4800,200 enemies=4 allies=1 buildings=1 here=0
 *   TPCANCEL team=2 hero=npc_dota_hero_puck t=1431 action=skip dest=-4800,200 enemies=4 allies=1 buildings=1 here=0
 */
import { Tower, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";

const DANGER_RADIUS = 1300; // tunable
const SEEN_TIME = 3;
const MIN_ENEMIES = 2;
// Laning: two enemy laners near our tower is normal lane play. 9089765175 skipped Jugg's TP back to his lane at 3:41.
const MIN_ENEMIES_LANING = 3;
const BLOCK_TIME = 10;
const BLOCK_RADIUS = 1500;
const FOUNTAIN_RADIUS = 2500;
const BUILDING_RADIUS = 1300; // a TP lands next to the building, so one this close to the target is there
const LOG_GAP = 3;
const TP_ITEMS: Record<string, boolean> = { item_tpscroll: true, item_travel_boots: true, item_travel_boots_2: true };
const TOWERS: Tower[] = [
    Tower.Top1, Tower.Top2, Tower.Top3, Tower.Mid1, Tower.Mid2, Tower.Mid3, Tower.Bot1, Tower.Bot2, Tower.Bot3, Tower.Base1, Tower.Base2,
];

interface TpState {
    dest: Vector | null;
    castAt: number;
    blockedLoc: Vector | null;
    blockedUntil: number;
    lastLog: number;
}
const states: Record<string, TpState> = {};

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Fmt(v: Vector): string {
    return `${Math.floor(v.x)},${Math.floor(v.y)}`;
}

function StateOf(bot: Unit): TpState {
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    let s = states[key];
    if (s === undefined) {
        s = { dest: null, castAt: -999, blockedLoc: null, blockedUntil: -999, lastLog: -999 };
        states[key] = s;
    }
    return s;
}

/** Enemy heroes alive and seen near `loc` in the last SEEN_TIME s (visible or just out of vision). */
function EnemiesNear(loc: Vector, radius: number): number {
    let n = 0;
    for (const id of GetTeamPlayers(GetOpposingTeam())) {
        if (!IsHeroAlive(id)) continue;
        const info = GetHeroLastSeenInfo(id);
        const seen = info !== null && info !== undefined ? info[0] : undefined;
        if (seen === undefined || seen.time_since_seen > SEEN_TIME) continue;
        if (Dist(seen.location, loc) <= radius) n++;
    }
    return n;
}

function AlliesNear(bot: Unit, loc: Vector, radius: number): number {
    let n = 0;
    for (const ally of GetUnitList(UnitType.AlliedHeroes)) {
        if (ally === null || ally.IsNull() || !ally.IsAlive() || ally.IsIllusion() || ally === bot) continue;
        if (jmz.IsMeepoClone(ally)) continue;
        if (Dist(ally.GetLocation(), loc) <= radius) n++;
    }
    return n;
}

function BuildingsNear(loc: Vector): number {
    let n = 0;
    for (const id of TOWERS) {
        const t = GetTower(GetTeam(), id);
        if (t !== null && t !== undefined && !t.IsNull() && t.IsAlive() && Dist(t.GetLocation(), loc) <= BUILDING_RADIUS) n++;
    }
    const ancient = GetAncient(GetTeam());
    if (ancient !== null && ancient !== undefined && Dist(ancient.GetLocation(), loc) <= BUILDING_RADIUS + 400) n++;
    return n;
}

/** [lost fight, text for the log]. */
function LostFight(bot: Unit, dest: Vector): [boolean, string] {
    if (Dist(dest, jmz.GetTeamFountain()) <= FOUNTAIN_RADIUS) return [false, ""];
    const enemies = EnemiesNear(dest, DANGER_RADIUS);
    if (enemies < (jmz.IsInLaningPhase() ? MIN_ENEMIES_LANING : MIN_ENEMIES)) return [false, ""];
    const allies = AlliesNear(bot, dest, DANGER_RADIUS);
    const buildings = BuildingsNear(dest);
    if (enemies <= allies + 1 + buildings) return [false, ""];
    // Staying must be safer than landing: a bot already in a lost fight keeps its TP.
    const loc = bot.GetLocation();
    const here = EnemiesNear(loc, DANGER_RADIUS) - AlliesNear(bot, loc, DANGER_RADIUS) - 1;
    const there = enemies - allies - 1 - buildings;
    if (here >= there) return [false, ""];
    return [true, `dest=${Fmt(dest)} enemies=${enemies} allies=${allies} buildings=${buildings} here=${here}`];
}

/** Skips are throttled (Blocked runs every item-usage tick); cancels always print. */
function Log(bot: Unit, s: TpState, text: string, always: boolean): void {
    if (!Utils.DebugMode) return;
    const now = DotaTime();
    if (!always && now - s.lastLog < LOG_GAP) return;
    s.lastLog = now;
    print(`TPCANCEL team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(now)} ${text}`);
}

export function IsTp(itemName: string): boolean {
    return TP_ITEMS[itemName] === true;
}

/** Remember where this bot's TP goes (call when the cast order is given). */
export function Record(bot: Unit, dest: Vector): void {
    const s = StateOf(bot);
    s.dest = dest;
    s.castAt = DotaTime();
}

/** Do not start a TP to `dest`: it was cancelled there just now, or it is a lost fight already. */
export function Blocked(bot: Unit, itemName: string, dest: any): boolean {
    if (!IsTp(itemName) || dest === null || dest === undefined || dest.x === undefined) return false;
    const s = StateOf(bot);
    if (s.blockedLoc !== null && DotaTime() < s.blockedUntil && Dist(s.blockedLoc, dest) <= BLOCK_RADIUS) return true;
    const lost = LostFight(bot, dest);
    if (lost[0]) {
        Log(bot, s, `action=skip ${lost[1]}`, false);
        return true;
    }
    return false;
}

/** Every frame: cancel this bot's TP channel when it would land in a lost fight. True when it cancelled. */
export function Check(bot: Unit): boolean {
    const s = StateOf(bot);
    if (s.dest === null) return false;
    if (!bot.HasModifier("modifier_teleporting")) {
        // Give the cast order a moment to start the channel; after that the TP is over.
        if (DotaTime() - s.castAt > 1) s.dest = null;
        return false;
    }
    const lost = LostFight(bot, s.dest);
    if (!lost[0]) return false;
    Log(bot, s, `action=cancel ${lost[1]}`, true);
    s.blockedLoc = s.dest;
    s.blockedUntil = DotaTime() + BLOCK_TIME;
    s.dest = null;
    bot.Action_ClearActions(true);
    return true;
}
