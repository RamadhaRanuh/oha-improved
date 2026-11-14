/**
 * Team brain (docs/specs/smarter-bot-behaviour.md section 3.3).
 *
 * One shared view of the game per team: the "global mind" every bot reads, while each bot's
 * modes still make their own decisions from it. Phase 0 showed that the five bots of a team
 * share one Lua state, so the memo below is computed once per team per 0.25 s bucket.
 * It is still written to the convergence rules (3.3.1), so it also holds if that ever changes:
 * only team-observable inputs, no randomness, unit lists from global_cache.
 *
 * Stage 0 fills `enemies` only. Later stages fill their own fields:
 * engagements (S2), group and defenders (S4), farm (S6), gank (S7).
 * Nothing reads the brain until a stage's flag is on, so it costs nothing with flags off.
 */
import { Lane, Unit, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import { getGlobalUnitState } from "bots/FunLib/global_cache";

type PlayerID = number;

export interface EnemyInfo {
    id: PlayerID;
    /** The hero when it is visible now, otherwise null. */
    unit: Unit | null;
    visible: boolean;
    alive: boolean;
    /** Where it was last seen; null if it has never been seen. */
    lastSeenLoc: Vector | null;
    /** Seconds since last seen: 0 while visible, a large number if never seen. */
    lastSeenAge: number;
    /** Brain time at which the current sighting began, or -1 while not visible. */
    firstSeenThisSighting: number;
    /** Last known health fraction (0 when dead). */
    hpFrac: number;
    /** Last known GetRawOffensivePower(). */
    rawPower: number;
}

export interface Engagement {
    id: string;
    center: Vector;
    allyIds: PlayerID[];
    enemyIds: PlayerID[];
    state: "none" | "engage" | "hold" | "disengage";
    stateSince: number;
    ratio: number;
    focusId: PlayerID | null;
    focusSince: number;
    initiatorId: PlayerID | null;
}

export interface GroupIntent {
    kind: "none" | "push" | "defend" | "roshan";
    lane: Lane | null;
    memberIds: PlayerID[];
    since: number;
}

export interface FarmArea {
    kind: "lane" | "jungle";
    lane?: Lane;
    anchor: Vector;
}

export interface GankPlan {
    targetId: PlayerID;
    gankerIds: PlayerID[];
    since: number;
}

export interface TeamView {
    /** Start of the 0.25 s bucket this view was computed for (DotaTime). */
    time: number;
    enemies: EnemyInfo[];
    engagements: Engagement[];
    group: GroupIntent;
    defenders: Partial<Record<Lane, PlayerID[]>>;
    farm: Partial<Record<PlayerID, FarmArea>>;
    gank: GankPlan | null;
}

const BUCKET = 0.25;
const NEVER_SEEN_AGE = 9999;
const LANES = [Lane.Top, Lane.Mid, Lane.Bot];

/** The memoised view, per team. */
const views: Record<number, TeamView> = {};

/** What the team remembers about each enemy between sightings, keyed by player id. */
interface EnemyMemory {
    sightingStart: number;
    hpFrac: number;
    rawPower: number;
}
const memory: Record<PlayerID, EnemyMemory> = {};

/** The team's current view, recomputed at most once per 0.25 s of game time. */
export function Get(): TeamView {
    const team = GetTeam();
    const time = Math.floor(DotaTime() / BUCKET) * BUCKET;
    const cached = views[team];
    if (cached !== undefined && cached.time === time) {
        return cached;
    }
    const view: TeamView = {
        time,
        enemies: BuildEnemies(time),
        engagements: [],
        group: { kind: "none", lane: null, memberIds: [], since: time },
        defenders: {},
        farm: {},
        gank: null,
    };
    views[team] = view;
    return view;
}

/**
 * Visible enemy heroes by player id, without illusions. The global cache already drops units
 * that are not visible, dead or invulnerable. When several visible units share an id, the
 * first non-illusion in list order is kept.
 */
function VisibleEnemyHeroes(): Partial<Record<PlayerID, Unit>> {
    const byId: Partial<Record<PlayerID, Unit>> = {};
    for (const unit of getGlobalUnitState().enemyHeroes) {
        if (unit.IsIllusion() || jmz.IsSuspiciousIllusion(unit)) {
            continue;
        }
        const id = unit.GetPlayerID();
        if (byId[id] === undefined) {
            byId[id] = unit;
        }
    }
    return byId;
}

function BuildEnemies(time: number): EnemyInfo[] {
    const visible = VisibleEnemyHeroes();
    const enemies: EnemyInfo[] = [];
    for (const id of GetTeamPlayers(GetOpposingTeam())) {
        let mem = memory[id];
        if (mem === undefined) {
            mem = { sightingStart: -1, hpFrac: 1, rawPower: 0 };
            memory[id] = mem;
        }
        const alive = IsHeroAlive(id);
        const unit = visible[id];

        if (unit !== undefined) {
            if (mem.sightingStart < 0) {
                mem.sightingStart = time;
            }
            const maxHealth = unit.GetMaxHealth();
            mem.hpFrac = maxHealth > 0 ? unit.GetHealth() / maxHealth : 0;
            mem.rawPower = unit.GetRawOffensivePower();
            enemies.push({
                id,
                unit,
                visible: true,
                alive,
                lastSeenLoc: unit.GetLocation(),
                lastSeenAge: 0,
                firstSeenThisSighting: mem.sightingStart,
                hpFrac: mem.hpFrac,
                rawPower: mem.rawPower,
            });
        } else {
            mem.sightingStart = -1;
            if (!alive) {
                mem.hpFrac = 0;
            }
            const info = GetHeroLastSeenInfo(id);
            const last = info !== undefined && info.length > 0 ? info[0] : undefined;
            enemies.push({
                id,
                unit: null,
                visible: false,
                alive,
                lastSeenLoc: last !== undefined ? last.location : null,
                lastSeenAge: last !== undefined ? last.time_since_seen : NEVER_SEEN_AGE,
                firstSeenThisSighting: -1,
                hpFrac: mem.hpFrac,
                rawPower: mem.rawPower,
            });
        }
    }
    return enemies;
}

/** The engagement this bot takes part in, if any. */
export function EngagementOf(bot: Unit): Engagement | null {
    const id = bot.GetPlayerID();
    for (const engagement of Get().engagements) {
        if (engagement.allyIds.includes(id)) {
            return engagement;
        }
    }
    return null;
}

/** Whether this bot is a member of the team's current push, defence or Roshan group. */
export function IsGroupMember(bot: Unit): boolean {
    const group = Get().group;
    return group.kind !== "none" && group.memberIds.includes(bot.GetPlayerID());
}

/** The lane this bot is assigned to defend, if any. */
export function DefenderLane(bot: Unit): Lane | null {
    const id = bot.GetPlayerID();
    const defenders = Get().defenders;
    for (const lane of LANES) {
        const ids = defenders[lane];
        if (ids !== undefined && ids.includes(id)) {
            return lane;
        }
    }
    return null;
}

/** The farm area allotted to this bot, if any. */
export function FarmAreaOf(bot: Unit): FarmArea | null {
    return Get().farm[bot.GetPlayerID()] ?? null;
}

/** Whether this bot is a ganker in the team's current gank plan. */
export function IsGanker(bot: Unit): boolean {
    const gank = Get().gank;
    return gank !== null && gank.gankerIds.includes(bot.GetPlayerID());
}

/** One-line summary for debug output: alive, visible and per-enemy state. */
export function DescribeForDebug(): string {
    const view = Get();
    let alive = 0;
    let visible = 0;
    const parts: string[] = [];
    for (const enemy of view.enemies) {
        if (enemy.alive) alive += 1;
        if (enemy.visible) visible += 1;
        const age = enemy.visible ? "v" : enemy.lastSeenAge >= NEVER_SEEN_AGE ? "never" : `${Math.floor(enemy.lastSeenAge)}s`;
        parts.push(`${enemy.id}:${enemy.alive ? "up" : "dead"}/${age}/hp${Math.floor(enemy.hpFrac * 100)}/pow${Math.floor(enemy.rawPower)}`);
    }
    return `t=${view.time} enemies=${view.enemies.length} alive=${alive} visible=${visible} ${parts.join(" ")}`;
}
