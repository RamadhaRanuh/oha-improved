/**
 * Don't go alone into danger (flag `group`; game 9089589000: 18 of 24 Radiant deaths after 20:00
 * were a hero with at most one ally near, against 2-3 enemies: warding, defending a tower or farming
 * alone).
 *
 * After the laning phase, a hero is exposed when MISSING_COUNT or more living enemies have not been
 * seen for MISSING_TIME seconds and no allied hero is within ALONE_RADIUS. Then:
 * - farm: no camp or lane deep in enemy territory (farm mode picks a camp on our half, or stops);
 * - ward: no ward spot deep in enemy territory.
 *   "Deep" = in the enemy half and within DEEP_DIST of the enemy ancient. The first version blocked the
 *   whole enemy half, river included: in bot games 3+ enemies are unseen nearly all the time, so our
 *   cores lost half the map's farm (9089684860: Jugg/Puck about 24 last hits per 4 min after 20:00,
 *   Luna/TA 40-50; Radiant fell from +3.4k to -4.6k).
 * - defend: a tower outside our base is not defended by a hero who would be the only defender: no
 *   other healthy, non-retreating ally within DEFEND_HELP_RADIUS, and DEFEND_ENEMIES or more enemies
 *   at it. (Comparing helpers with enemies made all five skip the same tower at once in 9089630662
 *   and 9089668456, so Dire took outer towers for free.)
 *
 * Debug (Utils.DebugMode), at most once per LOG_GAP s per hero and kind:
 *   ALONE team=2 hero=npc_dota_hero_crystal_maiden t=1932 blocked=ward missing=4 spot=1200,3400
 */
import { BotMode, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";

const MISSING_TIME = 15; // tunable
const MISSING_COUNT = 3;
const ALONE_RADIUS = 2000;
const DEFEND_ENEMIES = 2;
const DEFEND_ENEMY_RADIUS = 1600;
// Allies who can come help, this far from the tower (most of the map; heroes also TP). 4500 made all
// five bots skip the same tower at once in 9089630662 (helpers=0-1 each), so outer towers fell to 2-man pushes.
const DEFEND_HELP_RADIUS = 8000;
const DEFEND_HELP_HP = 0.4;
const BASE_RADIUS = 5000; // defending inside our base is always allowed
const LOG_GAP = 20;
const DEEP_DIST = 7000; // tunable: the enemy's own jungle and base side, not the river

let missingAt = -999;
let missingCount = 0;
const lastLog: Record<string, number> = {};

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Log(bot: Unit, kind: string, text: string): void {
    if (!Utils.DebugMode) return;
    const key = `${bot.GetPlayerID()}:${kind}`;
    const now = DotaTime();
    if (lastLog[key] !== undefined && now - lastLog[key] < LOG_GAP) return;
    lastLog[key] = now;
    print(`ALONE team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(now)} blocked=${kind} missing=${MissingEnemies()} ${text}`);
}

function Fmt(v: Vector): string {
    return `${Math.floor(v.x)},${Math.floor(v.y)}`;
}

/** Living enemy heroes not seen for MISSING_TIME s. Cached 0.5 s (one VM per team). */
export function MissingEnemies(): number {
    const now = DotaTime();
    if (now - missingAt < 0.5) return missingCount;
    missingAt = now;
    let n = 0;
    for (const id of GetTeamPlayers(GetOpposingTeam())) {
        if (!IsHeroAlive(id)) continue;
        const info = GetHeroLastSeenInfo(id);
        const seen = info !== null && info !== undefined ? info[0] : undefined;
        if (seen === undefined || seen.time_since_seen >= MISSING_TIME) n++;
    }
    missingCount = n;
    return n;
}

function AlliesNear(loc: Vector, radius: number, except: Unit | null, minHp: number): number {
    let n = 0;
    for (const ally of GetUnitList(UnitType.AlliedHeroes)) {
        if (ally === null || ally.IsNull() || !ally.IsAlive() || ally.IsIllusion() || ally === except) continue;
        if (jmz.IsMeepoClone(ally) || jmz.GetHP(ally) < minHp) continue;
        if (minHp > 0 && ally.GetActiveMode() === BotMode.Retreat) continue; // helpers only: a retreating hero is not coming
        if (Dist(ally.GetLocation(), loc) <= radius) n++;
    }
    return n;
}

export function EnemyHalf(loc: Vector): boolean {
    return Dist(loc, GetAncient(GetOpposingTeam()).GetLocation()) < Dist(loc, GetAncient(GetTeam()).GetLocation());
}

/** No ally near and too many enemies unseen, after the laning phase. */
export function Exposed(bot: Unit): boolean {
    if (jmz.IsInLaningPhase()) return false;
    if (MissingEnemies() < MISSING_COUNT) return false;
    return AlliesNear(bot.GetLocation(), ALONE_RADIUS, bot, 0) === 0;
}

/** Deep in enemy territory: see DEEP_DIST. */
export function Deep(loc: Vector): boolean {
    return EnemyHalf(loc) && Dist(loc, GetAncient(GetOpposingTeam()).GetLocation()) < DEEP_DIST;
}

/** Farm or ward at `loc` is unsafe for `bot` now (logs once per LOG_GAP). */
export function Risky(bot: Unit, loc: Vector, kind: string): boolean {
    if (!Deep(loc) || !Exposed(bot)) return false;
    Log(bot, kind, `spot=${Fmt(loc)}`);
    return true;
}

/** Defending the tower at `defendLoc` would be a lone fight: see the module comment. */
export function DefendAlone(bot: Unit, defendLoc: Vector): boolean {
    if (jmz.IsInLaningPhase()) return false;
    if (Dist(defendLoc, GetAncient(GetTeam()).GetLocation()) < BASE_RADIUS) return false;
    const enemies = jmz.GetEnemiesNearLoc(defendLoc, DEFEND_ENEMY_RADIUS).length;
    if (enemies < DEFEND_ENEMIES) return false;
    // Other allies who could fight there. Anyone else coming means this bot is not alone. An ally no
    // farther than this bot counts too: in 9089765175 all four were over 8000 from the bottom tower, each
    // saw helpers=0, and nobody defended it (t=863 and t=1143).
    const radius = Math.max(DEFEND_HELP_RADIUS, Dist(bot.GetLocation(), defendLoc) + 1500);
    const helpers = AlliesNear(defendLoc, radius, bot, DEFEND_HELP_HP);
    if (helpers > 0) return false;
    Log(bot, "defend", `at=${Fmt(defendLoc)} enemies=${enemies} helpers=${helpers}`);
    return true;
}
