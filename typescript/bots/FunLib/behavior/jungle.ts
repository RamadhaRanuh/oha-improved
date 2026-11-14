/**
 * Jungle after dying in lane (flag `farm`; asked for after the S1 playtests).
 *
 * A core that keeps dying in lane walks straight back into the same lane. A human sometimes goes to
 * the jungle instead, catches up on levels, and comes back when the lane is safe. So:
 *
 * - Trigger (laning phase only): the hero died in lane DEATHS_IN_WINDOW times within WINDOW seconds,
 *   or DEATHS_TOTAL times since the horn. A death counts as "in lane" when the hero was within
 *   LANE_DEATH_DIST of its lane. Then it rolls once: CHANCE by position (supports never jungle).
 *   Needs level MIN_LEVEL and game time MIN_START: game 9089668456 sent Jugg (pos 1) to the jungle at
 *   level 3 at 4:33, he farmed 36 last hits in 9.7 minutes, came back level 5 against level 8 laners
 *   and had the lowest core net worth on the map at 19:00.
 * - While jungling, farm mode takes the bot to our own small and medium camps (large from
 *   LARGE_LEVEL) with JUNGLE_DESIRE, and laning mode steps aside (Laning.GetDesire / BurstDesire).
 * - Back to lane after MIN_TIME when: caught up (level at least the highest enemy seen in the lane in
 *   the last LEVEL_MEMORY s, and HP over SAFE_HP), or the lane is empty (an ally sees the lane and no
 *   enemy hero was there for EMPTY_TIME s), or the laning phase ends. It also goes back when the jungle
 *   is not working: BEHIND_LEVELS or more below the lane's highest enemy after MIN_TIME, or a death
 *   while jungling. Every REROLL_TIME s it rolls again to keep jungling.
 *
 * Debug (Utils.DebugMode):
 *   JUNGLE team=2 hero=npc_dota_hero_juggernaut t=312 roll=0.41 chance=0.6 result=start deaths=2/300s,2 lane=3 lvl=4
 *   JUNGLE team=2 hero=npc_dota_hero_juggernaut t=455 result=end reason=caught_up lvl=7 laneMax=7 hp=0.82
 */
import { Lane, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import * as Rng from "./rng";

const WINDOW = 300;
const DEATHS_IN_WINDOW = 2;
const DEATHS_TOTAL = 3;
const LANE_DEATH_DIST = 2500;
const CHANCE: Record<number, number> = { 1: 0.4, 2: 0.3, 3: 0.6, 4: 0, 5: 0 }; // tunable
const MIN_LEVEL = 6; // a bot at level 3-5 clears camps too slowly (9089668456)
const MIN_START = 6 * 60;
const BEHIND_LEVELS = 2;
const LARGE_LEVEL = 7;
const MIN_TIME = 90;
const REROLL_TIME = 240;
const SAFE_HP = 0.7;
const LEVEL_MEMORY = 60;
const EMPTY_TIME = 20;
const LANE_RADIUS = 2000; // an enemy hero this close to our lane front counts as "in the lane"
const VISION_RADIUS = 1500; // an ally this close to the lane front means we can see the lane
export const JUNGLE_DESIRE = 0.6; // above laning's MODERATE (0.5)

interface JungleState {
    deaths: number; // GetHeroDeaths seen so far
    laneDeaths: number[]; // times of deaths in lane
    lastAliveLoc: Vector | null;
    active: boolean;
    startAt: number;
    rollAt: number;
    lane: Lane;
    laneSeenAt: number; // last time an enemy hero was seen in our lane
    laneLevels: Record<string, [number, number]>; // enemy name -> [level, seen at]
}
const states: Record<string, JungleState> = {};

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Log(bot: Unit, text: string): void {
    if (Utils.DebugMode) print(`JUNGLE team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(DotaTime())} ${text}`);
}

function StateOf(bot: Unit): JungleState {
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    let s = states[key];
    if (s === undefined) {
        s = {
            deaths: GetHeroDeaths(bot.GetPlayerID()),
            laneDeaths: [],
            lastAliveLoc: null,
            active: false,
            startAt: -999,
            rollAt: -999,
            lane: bot.GetAssignedLane(),
            laneSeenAt: -999,
            laneLevels: {},
        };
        states[key] = s;
    }
    return s;
}

function NearLane(loc: Vector, lane: Lane): boolean {
    for (let i = 0; i <= 20; i++) {
        if (Dist(loc, GetLocationAlongLane(lane, i * 0.05)) <= LANE_DEATH_DIST) return true;
    }
    return false;
}

function Chance(bot: Unit): number {
    const c = CHANCE[jmz.GetPosition(bot)];
    return c === undefined ? 0 : c;
}

/** Remember the enemy heroes seen in our lane (by anyone on the team) and their levels. */
function WatchLane(s: JungleState): void {
    const now = DotaTime();
    const front = GetLaneFrontLocation(GetTeam(), s.lane, 0);
    for (const enemy of GetUnitList(UnitType.EnemyHeroes)) {
        if (!jmz.IsValidHero(enemy) || jmz.IsSuspiciousIllusion(enemy)) continue;
        if (Dist(enemy.GetLocation(), front) > LANE_RADIUS) continue;
        s.laneSeenAt = now;
        s.laneLevels[enemy.GetUnitName()] = [enemy.GetLevel(), now];
    }
}

function LaneMaxLevel(s: JungleState): number {
    const now = DotaTime();
    let max = -1;
    for (const name in s.laneLevels) {
        const entry = s.laneLevels[name];
        if (now - entry[1] <= LEVEL_MEMORY && entry[0] > max) max = entry[0];
    }
    return max;
}

function LaneWatched(bot: Unit, s: JungleState): boolean {
    const front = GetLaneFrontLocation(GetTeam(), s.lane, 0);
    for (const ally of jmz.GetAlliesNearLoc(front, VISION_RADIUS)) {
        if (ally !== bot) return true;
    }
    return false;
}

function Stop(bot: Unit, s: JungleState, reason: string): void {
    s.active = false;
    Log(bot, `result=end reason=${reason} lvl=${bot.GetLevel()} laneMax=${LaneMaxLevel(s)} hp=${Math.floor(jmz.GetHP(bot) * 100) / 100}`);
}

/** Track deaths; roll to start jungling after too many lane deaths. */
function OnDeaths(bot: Unit, s: JungleState): void {
    const now = DotaTime();
    const deaths = GetHeroDeaths(bot.GetPlayerID());
    if (deaths <= s.deaths) return;
    s.deaths = deaths;
    if (!jmz.IsInLaningPhase()) return;
    if (s.lastAliveLoc !== null && NearLane(s.lastAliveLoc, s.lane)) s.laneDeaths.push(now);
    if (s.active) {
        // Died in the jungle: it is not safer than the lane (Jugg in 9089668456 stayed 5 more minutes).
        Stop(bot, s, "died_jungling");
        return;
    }
    const recent = s.laneDeaths.filter(t => now - t <= WINDOW).length;
    const total = s.laneDeaths.length;
    if (recent < DEATHS_IN_WINDOW && total < DEATHS_TOTAL) return;
    const chance = Chance(bot);
    if (chance <= 0 || bot.GetLevel() < MIN_LEVEL || now < MIN_START) return;
    const roll = Rng.Float(0, 1);
    const start = roll < chance;
    Log(bot, `roll=${Math.floor(roll * 100) / 100} chance=${chance} result=${start ? "start" : "stay"} deaths=${recent}/${WINDOW}s,${total} lane=${s.lane} lvl=${bot.GetLevel()}`);
    if (start) {
        s.active = true;
        s.startAt = now;
        s.rollAt = now;
    }
}

/** Call every frame (farm mode GetDesire). Returns JUNGLE_DESIRE while this bot should jungle, else 0. */
export function Desire(bot: Unit): number {
    if (bot.IsIllusion()) return 0;
    const s = StateOf(bot);
    if (bot.IsAlive()) s.lastAliveLoc = bot.GetLocation();
    OnDeaths(bot, s);
    if (!s.active) return 0;
    WatchLane(s);
    const now = DotaTime();
    if (!jmz.IsInLaningPhase()) {
        Stop(bot, s, "laning_over");
        return 0;
    }
    if (!bot.IsAlive()) return JUNGLE_DESIRE;
    if (now - s.startAt >= MIN_TIME) {
        const laneMax = LaneMaxLevel(s);
        if (laneMax > 0 && bot.GetLevel() <= laneMax - BEHIND_LEVELS) {
            Stop(bot, s, "falling_behind");
            return 0;
        }
        if (laneMax > 0 && bot.GetLevel() >= laneMax && jmz.GetHP(bot) > SAFE_HP) {
            Stop(bot, s, "caught_up");
            return 0;
        }
        if (LaneWatched(bot, s) && now - s.laneSeenAt > EMPTY_TIME) {
            Stop(bot, s, "lane_empty");
            return 0;
        }
    }
    if (now - s.rollAt >= REROLL_TIME) {
        s.rollAt = now;
        const roll = Rng.Float(0, 1);
        if (roll >= Chance(bot)) {
            Stop(bot, s, "reroll");
            return 0;
        }
        Log(bot, `result=keep roll=${Math.floor(roll * 100) / 100}`);
    }
    return JUNGLE_DESIRE;
}

/** Whether this bot is jungling now (laning mode steps aside). */
export function Active(bot: Unit): boolean {
    const s = states[`${bot.GetPlayerID()}:${bot.GetUnitName()}`];
    return s !== undefined && s.active;
}

/** Camps an early jungler can take: our own small and medium camps, large ones from LARGE_LEVEL. */
export function Camps(bot: Unit, all: any[]): any[] {
    const level = bot.GetLevel();
    return all.filter(camp => {
        const c = camp.cattr;
        if (c === undefined || c.team !== GetTeam()) return false;
        return c.type === "small" || c.type === "medium" || (c.type === "large" && level >= LARGE_LEVEL);
    });
}

/** Where to wait for a respawn when every camp is cleared: beside the nearest own camp, never inside it. */
export function WaitSpot(bot: Unit, camps: any[]): Vector | null {
    let best: Vector | null = null;
    let bestDist = 99999;
    for (const camp of camps) {
        const loc: Vector = camp.cattr.location;
        const d = Dist(bot.GetLocation(), loc);
        if (d < bestDist) {
            bestDist = d;
            best = loc;
        }
    }
    if (best === null) return null;
    const home = GetAncient(GetTeam()).GetLocation();
    const len = Math.max(Dist(best, home), 1);
    return Vector(best.x + ((home.x - best.x) / len) * 450, best.y + ((home.y - best.y) / len) * 450, best.z);
}
