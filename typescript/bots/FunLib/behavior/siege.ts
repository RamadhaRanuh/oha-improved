/**
 * High-ground gate and Roshan first (flag `group`; spec 8.1, the parts the human asked for first).
 *
 * Plain OHA pushes the tier-3 towers, barracks and ancient whenever it is ahead on net worth or
 * levels, even with all five enemies alive: the human saw bots "YOLO" to tier 4 and throw. A human
 * team ahead takes Roshan first, then sieges with the Aegis or after winning a fight.
 *
 * - A lane is at high ground when the enemy tier-1 and tier-2 towers in it are down.
 * - High ground is open only when we have the numbers: 2+ more heroes alive, or the enemy has 2 or
 *   fewer alive, or we hold the Aegis and are not outnumbered.
 * - Roshan first: a lane is at high ground, high ground is closed, Roshan is alive, we have no
 *   Aegis, it is past 20:00 and we are not outnumbered.
 *
 * - Commit (game 9089589000 sat 25 minutes at high ground and wasted open windows): while high
 *   ground is open the team picks one high-ground lane and everyone pushes it together (aba_push
 *   desire COMMIT_DESIRE, farm and runes off). They first meet at a gather point behind the lane
 *   front until GATHER_COUNT are there or GATHER_TIMEOUT passes. Once going, the window holds while we
 *   still have more heroes alive (HOLD_LEAD), the enemy has ENEMY_FEW or fewer, or we hold the Aegis
 *   and are not outnumbered: game 9089630662 ended 8 windows the moment one enemy respawned (5v3 to
 *   5v4), after 6 to 68 seconds.
 *
 * Debug (Utils.DebugMode): once a game minute per team, when anything is at high ground:
 *   SIEGE team=2 t=1834 hg=top,mid open=false why=numbers5v5 roshanFirst=true aegis=false
 * and one line per commit window:
 *   SIEGEGO team=2 t=3768 start lane=mid why=lead4v1 rax=6 anc=1.00
 *   SIEGEGO team=2 t=3812 end lane=mid why=numbers5v4 dur=44 gathered=true rax=4 anc=1.00
 */
import { Barracks, Lane, Tower, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import { Tuned } from "./flags";

const ROSHAN_FIRST_TIME = Tuned("roshan_first_time", 20 * 60); // --tune roshan_first_time
const NUMBERS_LEAD = 2; // allies alive minus enemies alive needed to siege without the Aegis (tunable)
const ENEMY_FEW = 2; // or the enemy has at most this many alive

const T1: Record<number, Tower> = { [Lane.Top]: Tower.Top1, [Lane.Mid]: Tower.Mid1, [Lane.Bot]: Tower.Bot1 };
const T2: Record<number, Tower> = { [Lane.Top]: Tower.Top2, [Lane.Mid]: Tower.Mid2, [Lane.Bot]: Tower.Bot2 };
const LANES: Lane[] = [Lane.Top, Lane.Mid, Lane.Bot];
const LANE_NAMES: Record<number, string> = { [Lane.Top]: "top", [Lane.Mid]: "mid", [Lane.Bot]: "bot" };

/**
 * Whether the enemy tower stands. Not jmz.IsValidBuilding: that also needs the tower visible and not
 * invulnerable, so out-of-vision towers and tier-2s still protected by their tier-1 read as down, and
 * every lane was "high ground" from 15:00 (quick test 9089566083: all pushes held, game lost).
 */
function TowerUp(id: Tower): boolean {
    const tower = GetTower(GetOpposingTeam(), id);
    return tower !== null && tower !== undefined && !tower.IsNull() && tower.IsAlive();
}

/** The enemy tier-1 and tier-2 towers in `lane` are down: the next push target is on high ground. */
export function LaneAtHighGround(lane: Lane): boolean {
    if (T1[lane] === undefined) return false;
    return !TowerUp(T1[lane]) && !TowerUp(T2[lane]);
}

export function AnyLaneAtHighGround(): boolean {
    return LANES.some(l => LaneAtHighGround(l));
}

let cacheAt = -999;
let cacheOpen = false;
let cacheWhy = "";

/** Whether we have the numbers (or the Aegis) to go up high ground, and why. Cached 0.5 s. */
export function HighGroundOpen(): [boolean, string] {
    const now = DotaTime();
    if (now - cacheAt < 0.5) return [cacheOpen, cacheWhy];
    const allies = jmz.GetNumOfAliveHeroes(false);
    const enemies = jmz.GetNumOfAliveHeroes(true);
    const aegis = jmz.DoesTeamHaveAegis();
    if (allies - enemies >= NUMBERS_LEAD) {
        cacheOpen = true;
        cacheWhy = `lead${allies}v${enemies}`;
    } else if (enemies <= ENEMY_FEW) {
        cacheOpen = true;
        cacheWhy = `few${allies}v${enemies}`;
    } else if (aegis && allies >= enemies) {
        cacheOpen = true;
        cacheWhy = `aegis${allies}v${enemies}`;
    } else {
        cacheOpen = false;
        cacheWhy = `numbers${allies}v${enemies}`;
    }
    cacheAt = now;
    return [cacheOpen, cacheWhy];
}

/** Push into `lane` is held back: it is at high ground and high ground is closed. */
export function PushBlocked(lane: Lane): boolean {
    if (!LaneAtHighGround(lane)) return false;
    return !HighGroundOpen()[0];
}

/** Take Roshan before going up: see the module comment. */
export function RoshanFirst(): boolean {
    if (DotaTime() < ROSHAN_FIRST_TIME() || !AnyLaneAtHighGround()) return false;
    if (HighGroundOpen()[0] || jmz.DoesTeamHaveAegis() || !jmz.IsRoshanAlive()) return false;
    return jmz.GetNumOfAliveHeroes(false) >= jmz.GetNumOfAliveHeroes(true);
}

let reportAt = -999;
/** Debug line, at most once a game minute per team (one VM per team). */
export function Report(): void {
    if (!Utils.DebugMode) return;
    const now = DotaTime();
    if (now - reportAt < 60) return;
    reportAt = now;
    const hg = LANES.filter(l => LaneAtHighGround(l)).map(l => LANE_NAMES[l]);
    if (hg.length === 0) return;
    const gate = HighGroundOpen();
    print(`SIEGE team=${GetTeam()} t=${Math.floor(now)} hg=${hg.join(",")} open=${gate[0]} why=${gate[1]} roshanFirst=${RoshanFirst()} aegis=${jmz.DoesTeamHaveAegis()}`);
}

// ---------------------------------------------------------------------------------------------
// Commit: everyone pushes one high-ground lane while high ground is open.
export const COMMIT_DESIRE = 0.85; // above farm and push, below retreat's SURVIVE (tunable)
export const COMMIT_MIN_HP = 0.35;
const GATHER_BACK = -1200; // gather this far behind our lane front
const GATHER_RADIUS = 1600;
const GATHER_COUNT = 3; // or every living ally if fewer
const GATHER_TIMEOUT = 25;
const HOLD_LEAD = 1; // keep a running window while allies alive - enemies alive >= this (tunable)
const BARRACKS: Barracks[] = [Barracks.TopMelee, Barracks.TopRanged, Barracks.MidMelee, Barracks.MidRanged, Barracks.BotMelee, Barracks.BotRanged];

let commitLane: Lane | null = null;
let commitAt = -999;
let commitWhy = "";
let gathered = false;
let commitCheckedAt = -999;

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Progress(): string {
    let rax = 0;
    for (const id of BARRACKS) {
        const b = GetBarracks(GetOpposingTeam(), id);
        if (b !== null && b !== undefined && !b.IsNull() && b.IsAlive()) rax++;
    }
    // Out of vision the ancient reports no health (logged anc=-666 in 9089630662).
    const anc = GetAncient(GetOpposingTeam());
    const seen = anc !== null && !anc.IsNull() && anc.CanBeSeen() && anc.GetHealth() >= 0;
    return `rax=${rax} anc=${seen ? Math.floor((anc.GetHealth() / anc.GetMaxHealth()) * 100) / 100 : "?"}`;
}

function LiveAllies(): Unit[] {
    return GetUnitList(UnitType.AlliedHeroes).filter(
        h => h !== null && !h.IsNull() && h.IsAlive() && !h.IsIllusion() && !jmz.IsMeepoClone(h) && h.IsHero()
    );
}

/** The high-ground lane nearest our living heroes: everyone goes to the same one. */
function PickLane(): Lane | null {
    const allies = LiveAllies();
    let best: Lane | null = null;
    let bestDist = 99999;
    for (const lane of LANES) {
        if (!LaneAtHighGround(lane)) continue;
        const front = GetLaneFrontLocation(GetTeam(), lane, 0);
        let sum = 0;
        for (const a of allies) sum += Dist(a.GetLocation(), front);
        const d = allies.length > 0 ? sum / allies.length : 0;
        if (d < bestDist) {
            bestDist = d;
            best = lane;
        }
    }
    return best;
}

/** The lane the team commits to now, or null. Updated at most every 0.5 s (one VM per team). */
export function CommitLane(): Lane | null {
    const now = DotaTime();
    if (now - commitCheckedAt < 0.5) return commitLane;
    commitCheckedAt = now;
    const gate = HighGroundOpen();
    const stillOk = commitLane !== null && LaneAtHighGround(commitLane);
    const holding = commitLane !== null && stillOk && Holding();
    if ((gate[0] || holding) && (stillOk || AnyLaneAtHighGround())) {
        if (commitLane === null || !stillOk) {
            commitLane = PickLane();
            if (commitLane !== null) {
                commitAt = now;
                commitWhy = gate[1];
                gathered = false;
                if (Utils.DebugMode) print(`SIEGEGO team=${GetTeam()} t=${Math.floor(now)} start lane=${LANE_NAMES[commitLane]} why=${commitWhy} ${Progress()}`);
            }
        }
    } else if (commitLane !== null) {
        if (Utils.DebugMode) {
            print(
                `SIEGEGO team=${GetTeam()} t=${Math.floor(now)} end lane=${LANE_NAMES[commitLane]} why=${gate[1]} dur=${Math.floor(now - commitAt)} gathered=${gathered} ${Progress()}`
            );
        }
        commitLane = null;
    }
    return commitLane;
}

/** A running window keeps going with a smaller lead than it needs to start. */
function Holding(): boolean {
    const allies = jmz.GetNumOfAliveHeroes(false);
    const enemies = jmz.GetNumOfAliveHeroes(true);
    return allies - enemies >= HOLD_LEAD || enemies <= ENEMY_FEW || (jmz.DoesTeamHaveAegis() && allies >= enemies);
}

/** Where the team meets before going up: behind our lane front in the committed lane. */
export function GatherPoint(lane: Lane): Vector {
    return GetLaneFrontLocation(GetTeam(), lane, GATHER_BACK);
}

/** Whether enough heroes met at the gather point (sticky for the window), or it took too long. */
export function Gathered(lane: Lane): boolean {
    if (gathered) return true;
    const point = GatherPoint(lane);
    const allies = LiveAllies();
    const need = Math.min(GATHER_COUNT, allies.length);
    let here = 0;
    for (const a of allies) if (Dist(a.GetLocation(), point) <= GATHER_RADIUS) here++;
    if (here >= need || DotaTime() - commitAt > GATHER_TIMEOUT) {
        gathered = true;
        if (Utils.DebugMode) print(`SIEGEGO team=${GetTeam()} t=${Math.floor(DotaTime())} gathered lane=${LANE_NAMES[lane]} here=${here}/${allies.length}`);
    }
    return gathered;
}
