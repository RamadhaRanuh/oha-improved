/**
 * Retreat path (flag `escape`; spec section 7 "Retreat path", asked for after human game 9090116913:
 * 16 of 30 bot deaths after laning came 8+ s after the bot had already chosen to retreat, often at
 * 50-90% health, caught by 3-5 enemies on the engine's straight walk to the fountain).
 *
 * mode_retreat_generic.lua had no Think, so the engine walked the bot straight home, often past the
 * enemies chasing it. With enemy heroes near, this compares a few routes home and walks the cheapest:
 *   direct    straight to the fountain
 *   tower     through one of our towers that is on the way home
 *   side      a sidestep of SIDE_NEAR or SIDE_FAR to either side of the straight line
 *   ally      through a healthy ally that is not retreating
 * Cost = travel time + DANGER_WEIGHT x, for each threat, the longest time it could be waiting at a point
 * of the route before we get there (at most CATCH_CAP s; half near our towers, which shoot at it).
 * Points are sampled along the first SAMPLE_LEN of the route. Re-planned every PLAN s; the current
 * route is kept unless another is clearly cheaper (KEEP_FACTOR, KEEP_MARGIN).
 *
 * Items (Blink, Force Staff, Glimmer, Shadow Blade), the TP home and hero escape spells stay with the
 * existing item and ability code.
 *
 * Debug (Utils.DebugMode), when the route kind changes:
 *   ESCAPE team=2 t=2081 hero=lion route=side cost=4.2 direct=9.8 threats=3
 */
import { Tower, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import * as Brain from "./team_brain";

const PLAN = 0.4;
const THREAT_RADIUS = 2000;
const THREAT_SEEN = 3;
const ENEMY_SPEED = 320; // out of sight
const ENEMY_REACH_MIN = 500; // a hero hits from at least this far (spells), more if its attack range is longer
const SAMPLE_STEP = 250;
// Only the next stretch: an enemy in front reaches some point of any whole route home first, which made
// every route cost the same. The next 1500 units decide whether the bot gets away now; re-planning does the rest.
const SAMPLE_LEN = 1500;
const CATCH_CAP = 6;
const DANGER_WEIGHT = 4;
const TOWER_SAFE = 700;
const TOWER_RANGE = 4500;
const SIDE_AHEAD = 700;
const SIDE_NEAR = 900;
const SIDE_FAR = 1600;
const ALLY_RANGE = 2500;
const ALLY_MIN_HP = 0.5;
const WAYPOINT_DONE = 250;
const KEEP_FACTOR = 1.15;
const KEEP_MARGIN = 0.3;
const HOME = 1200; // this close to the fountain: just walk in

const TOWERS: Tower[] = [
    Tower.Top1, Tower.Top2, Tower.Top3, Tower.Mid1, Tower.Mid2, Tower.Mid3,
    Tower.Bot1, Tower.Bot2, Tower.Bot3, Tower.Base1, Tower.Base2,
];

interface Threat {
    loc: Vector;
    speed: number;
    reach: number;
}

export interface Route {
    kind: string;
    points: Vector[]; // waypoints, then the fountain
    cost: number;
}

interface State {
    route: Route | null;
    plannedAt: number;
    loggedKind: string;
}
const states: Record<number, State> = {};

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Short(u: Unit): string {
    return u.GetUnitName().replace("npc_dota_hero_", "");
}

function Threats(bot: Unit): Threat[] {
    const out: Threat[] = [];
    const here = bot.GetLocation();
    for (const e of Brain.Get().enemies) {
        if (!e.alive || e.lastSeenLoc === null || e.lastSeenAge > THREAT_SEEN) continue;
        if (Dist(e.lastSeenLoc, here) > THREAT_RADIUS) continue;
        let speed = ENEMY_SPEED;
        let reach = ENEMY_REACH_MIN;
        const u = e.unit;
        if (e.visible && u !== null && !u.IsNull() && u.CanBeSeen()) {
            speed = Math.max(u.GetCurrentMovementSpeed(), 200);
            reach = Math.max(u.GetAttackRange() + 100, ENEMY_REACH_MIN);
        }
        out.push({ loc: e.lastSeenLoc, speed, reach });
    }
    return out;
}

function OurTowers(): Unit[] {
    const out: Unit[] = [];
    for (const id of TOWERS) {
        const t = GetTower(GetTeam(), id);
        if (t !== null && t !== undefined && !t.IsNull() && t.IsAlive()) out.push(t);
    }
    return out;
}

/** Sample points along the route's first SAMPLE_LEN, with the distance walked to each. */
function Samples(from: Vector, points: Vector[]): [Vector, number][] {
    const out: [Vector, number][] = [];
    let walked = 0;
    let a = from;
    for (const b of points) {
        const len = Dist(a, b);
        let s = 0;
        while (s < len && walked + s <= SAMPLE_LEN) {
            const k = len > 0 ? s / len : 0;
            out.push([Vector(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 0), walked + s]);
            s += SAMPLE_STEP;
        }
        walked += len;
        if (walked > SAMPLE_LEN) break;
        a = b;
    }
    return out;
}

export function Cost(from: Vector, points: Vector[], speed: number, threats: Threat[], towers: Vector[]): number {
    let length = 0;
    let a = from;
    for (const b of points) {
        length += Dist(a, b);
        a = b;
    }
    let cost = length / speed;
    const samples = Samples(from, points);
    for (const t of threats) {
        let worst = 0;
        for (const [p, walked] of samples) {
            const ours = walked / speed;
            const theirs = Math.max(Dist(t.loc, p) - t.reach, 0) / t.speed;
            let wait = Math.min(Math.max(ours - theirs, 0), CATCH_CAP);
            if (wait > 0 && towers.some(tw => Dist(tw, p) <= TOWER_SAFE)) wait *= 0.5;
            if (wait > worst) worst = wait;
        }
        cost += DANGER_WEIGHT * worst;
    }
    return cost;
}

function Passable(p: Vector): boolean {
    return IsLocationPassable(p);
}

/** Candidate routes home, cheapest first. */
export function Routes(bot: Unit, threats: Threat[]): Route[] {
    const here = bot.GetLocation();
    const home = jmz.GetTeamFountain();
    const speed = Math.max(bot.GetCurrentMovementSpeed(), 200);
    const towerUnits = OurTowers();
    const towers = towerUnits.map(t => t.GetLocation());
    const homeDist = Dist(here, home);
    const out: Route[] = [];
    const add = (kind: string, via: Vector[]): void => {
        const points = [...via, home];
        out.push({ kind, points, cost: Cost(here, points, speed, threats, towers) });
    };
    add("direct", []);
    for (const t of towers) {
        if (Dist(here, t) > TOWER_RANGE || Dist(t, home) >= homeDist) continue;
        if (Dist(here, t) < WAYPOINT_DONE) continue;
        add("tower", [t]);
    }
    const dx = (home.x - here.x) / Math.max(homeDist, 1);
    const dy = (home.y - here.y) / Math.max(homeDist, 1);
    for (const side of [SIDE_NEAR, -SIDE_NEAR, SIDE_FAR, -SIDE_FAR]) {
        const p = Vector(here.x + dx * SIDE_AHEAD - dy * side, here.y + dy * SIDE_AHEAD + dx * side, here.z);
        if (Passable(p)) add("side", [p]);
    }
    for (const a of GetUnitList(UnitType.AlliedHeroes)) {
        if (a === null || a.IsNull() || !a.IsAlive() || a.IsIllusion() || a === bot) continue;
        if (jmz.GetHP(a) < ALLY_MIN_HP || jmz.IsRetreating(a)) continue;
        const loc = a.GetLocation();
        if (Dist(here, loc) > ALLY_RANGE || Dist(here, loc) < WAYPOINT_DONE) continue;
        add("ally", [loc]);
    }
    out.sort((x, y) => x.cost - y.cost);
    return out;
}

function Log(bot: Unit, route: Route, direct: number, threats: number): void {
    if (!Utils.DebugMode) return;
    print(
        `ESCAPE team=${GetTeam()} t=${Math.floor(DotaTime())} hero=${Short(bot)} route=${route.kind} cost=${Math.floor(route.cost * 10) / 10} direct=${Math.floor(direct * 10) / 10} threats=${threats}`
    );
}

/** Where to walk now, or null to walk straight home. */
export function Next(bot: Unit): Vector | null {
    const id = bot.GetPlayerID();
    let st = states[id];
    if (st === undefined) {
        st = { route: null, plannedAt: -999, loggedKind: "direct" };
        states[id] = st;
    }
    const now = DotaTime();
    if (bot.DistanceFromFountain() <= HOME) {
        st.route = null;
        return null;
    }
    // Drop reached waypoints.
    if (st.route !== null) {
        while (st.route.points.length > 1 && Dist(bot.GetLocation(), st.route.points[0]) <= WAYPOINT_DONE) {
            st.route.points.shift();
        }
    }
    if (now - st.plannedAt >= PLAN || st.route === null) {
        st.plannedAt = now;
        const threats = Threats(bot);
        if (threats.length === 0) {
            st.route = null;
            st.loggedKind = "direct";
            return null;
        }
        const routes = Routes(bot, threats);
        const best = routes[0];
        let keep = false;
        if (st.route !== null && st.route.points.length > 1) {
            const speed = Math.max(bot.GetCurrentMovementSpeed(), 200);
            const towers = OurTowers().map(t => t.GetLocation());
            const current = Cost(bot.GetLocation(), st.route.points, speed, threats, towers);
            st.route.cost = current;
            keep = current <= best.cost * KEEP_FACTOR + KEEP_MARGIN;
        }
        if (!keep) st.route = { kind: best.kind, points: best.points.slice(), cost: best.cost };
        const route = st.route as Route;
        if (route.kind !== st.loggedKind) {
            const direct = routes.find(r => r.kind === "direct");
            Log(bot, route, direct !== undefined ? direct.cost : 0, threats.length);
            st.loggedKind = route.kind;
        }
    }
    return st.route !== null ? st.route.points[0] : null;
}

/** Retreat Think: walk the chosen route, or straight to the fountain. Returns true (the caller's SafeCall reads nil as an error). */
export function Think(bot: Unit): boolean {
    if (jmz.CanNotUseAction(bot)) return true;
    const next = Next(bot);
    bot.Action_MoveToLocation(next !== null ? next : jmz.GetTeamFountain());
    return true;
}
