/**
 * Lotus pool pickup (flag `laning`; requested after the S1 playtests).
 *
 * Valve's built-in lotus pool mode (BOT_MODE_LOTUS_POOL, 30) never ran in any of our games, on
 * either team, while its watcher mode did. So team roam runs this instead: a nearby support (or any
 * hero already next to the pool) walks to a pool that should have lotuses and picks them.
 *
 * How picking works (from the human): the hero stands inside the pool until the lotuses are grabbed,
 * like the wisdom shrine. So the bot walks to the pool unit's own location and stands there. Games
 * 9089559472 and 9089566083 confirmed there is no pickup ability (heroes only have ability_capture and
 * ability_lamp_use). If standing ever picks nothing, the team tries the fallbacks in METHODS in turn and
 * keeps the first that works.
 * Every attempt prints one line (Utils.DebugMode):
 *   LOTUSPICK team=2 hero=npc_dota_hero_crystal_maiden t=372 pool=0 method=ability_capture result=picked lotuses=0>1 ...
 */
import { BotMode, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import { DesireTier } from "./desire_tiers";

// Pool spots as ryndrb defines them; the LOTUS debug lines found npc_dota_lotus_pool within 700 of both.
const POOLS: Vector[] = [Vector(7515, -4423, 128), Vector(-7562, 4219, 128)];
const POOL_NAME = "npc_dota_lotus_pool";
/** Ways to pick, tried in turn: cast the hero ability on the pool, attack it, or walk onto it (right-click). */
const METHODS = ["stand", "ability_capture", "attack"];
const METHOD_RETRY = 25; // after a method picked nothing, try the next one this soon
const FIRST_LOTUS = 180; // a pool is first worth a visit at 3:00 (tunable)
const REGROW = 180; // after a pick, try that pool again this much later (tunable)
const EMPTY_RETRY = 90; // after a visit that found nothing
// After an enemy at the pool: 20 s sent ES to the same contested pool 4 times in 80 s in 9089765175, away from its lane.
const ENEMY_RETRY = 60;
const SUPPORT_RADIUS = 3000; // a support this close to a pool goes
const ANY_RADIUS = 1200; // any hero this close goes
const ENEMY_RADIUS = 1500; // no visible enemy hero this close to the pool
const ABORT_RADIUS = 900;
const MIN_HP = 0.5;
const WALK_TIMEOUT = 25;
const PICK_TIMEOUT = 6; // seconds standing in the pool (or after a cast) before giving up (tunable)
const PICK_RANGE = 250; // walk to the pool spot until this close, then to the pool unit itself
const STAND_RADIUS = 200; // "inside the pool": this close to the pool unit's location (tunable)
const STUCK_RADIUS = 400; // within this, no progress for STUCK_TIME counts as standing in the pool
const STUCK_TIME = 1.0;

interface LotusState {
    pool: number; // index into POOLS, -1 when idle
    startAt: number;
    castAt: number;
    lotusesBefore: number;
    lastMoveTime: number;
    /** Closest the bot has come to the pool centre, and when: the centre itself may be unreachable. */
    closest: number;
    closestAt: number;
    method: number; // index into METHODS used on this visit, -1 before the attempt
}
const states: Record<string, LotusState> = {};
/** Per pool: when it is next worth a visit, and who is on the way. Shared by the team (one VM per team). */
const readyAt: number[] = [FIRST_LOTUS, FIRST_LOTUS];
const claimedBy: (number | null)[] = [null, null];
const claimedAt: number[] = [-999, -999];
/** Team-wide: the method to try next, and the one that worked (then always used). */
let nextMethod = 0;
let workingMethod: number | null = null;
/** A claim older than this is dropped: a claimant that died stops running Desire (team roam returns early), so it never ends its own claim. */
const CLAIM_STALE = WALK_TIMEOUT + PICK_TIMEOUT + 5;

function StateOf(bot: Unit): LotusState {
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    let s = states[key];
    if (s === undefined) {
        s = { pool: -1, startAt: -999, castAt: -1, lotusesBefore: 0, lastMoveTime: -999, closest: 99999, closestAt: -999, method: -1 };
        states[key] = s;
    }
    return s;
}

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function PoolUnit(index: number): Unit | null {
    for (const unit of GetUnitList(UnitType.All)) {
        if (unit === null || unit === undefined || unit.IsNull()) continue;
        if (unit.GetUnitName() === POOL_NAME && Dist(unit.GetLocation(), POOLS[index]) < 700) return unit;
    }
    return null;
}

function CountLotuses(bot: Unit): number {
    let n = 0;
    for (let slot = 0; slot <= 8; slot++) {
        const item = bot.GetItemInSlot(slot);
        if (item !== null && item !== undefined && item.GetName().indexOf("famango") >= 0) n += Math.max(item.GetCurrentCharges(), 1);
    }
    return n;
}

function EnemyNear(loc: Vector, radius: number): boolean {
    for (const enemy of GetUnitList(UnitType.EnemyHeroes)) {
        if (jmz.IsValidHero(enemy) && !jmz.IsSuspiciousIllusion(enemy) && Dist(enemy.GetLocation(), loc) < radius) return true;
    }
    return false;
}

function Describe(bot: Unit, pool: Unit | null): string {
    let text = "";
    {
        const hints: string[] = [];
        for (let i = 0; i < 32; i++) {
            const a = bot.GetAbilityInSlot(i);
            if (a === null || a === undefined) continue;
            const name = a.GetName();
            if (name.indexOf("ability_") === 0 || name.indexOf("famango") >= 0 || name.indexOf("pluck") >= 0) hints.push(name);
        }
        text += ` heroAbilities=${hints.join(",")}`;
    }
    if (pool !== null) {
        const mods: string[] = [];
        for (let i = 0; i < pool.NumModifiers(); i++) mods.push(`${pool.GetModifierName(i)}x${pool.GetModifierStackCount(i)}`);
        const abilities: string[] = [];
        for (let i = 0; i < 6; i++) {
            const a = pool.GetAbilityInSlot(i);
            if (a !== null && a !== undefined) abilities.push(a.GetName());
        }
        text += ` poolhp=${pool.GetHealth()} poolmods=${mods.join(",")} poolabilities=${abilities.join(",")}`;
    } else {
        text += " pool=unseen";
    }
    return text;
}

function End(bot: Unit, s: LotusState, result: string, retryIn: number): void {
    const index = s.pool;
    if (index < 0) return;
    if (Utils.DebugMode) {
        print(
            `LOTUSPICK team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(DotaTime())} pool=${index} method=${s.method >= 0 ? METHODS[s.method] : "none"} result=${result} lotuses=${s.lotusesBefore}>${CountLotuses(bot)} ${Describe(bot, PoolUnit(index))}`
        );
    }
    if (s.method >= 0) {
        if (result === "picked") workingMethod = s.method;
        else if ((result === "nothing" || result === "no_ability") && workingMethod === null && s.method === nextMethod) {
            nextMethod = (nextMethod + 1) % METHODS.length;
            retryIn = METHOD_RETRY;
        }
    }
    // A stale claim may have passed to another bot since; only the holder resets the pool.
    if (claimedBy[index] === bot.GetPlayerID()) {
        readyAt[index] = DotaTime() + retryIn;
        claimedBy[index] = null;
    }
    s.pool = -1;
    s.castAt = -1;
    s.method = -1;
}

function Busy(bot: Unit): boolean {
    const mode = bot.GetActiveMode();
    return (
        mode === BotMode.Retreat ||
        mode === BotMode.Attack ||
        mode === BotMode.EvasiveManeuvers ||
        mode === BotMode.DefendAlly ||
        bot.WasRecentlyDamagedByAnyHero(3) ||
        jmz.CanNotUseAction(bot) ||
        bot.IsChanneling()
    );
}

/** HIGH while a pickup runs or should start, else 0. */
export function Desire(bot: Unit): number {
    const s = StateOf(bot);
    const now = DotaTime();
    if (s.pool >= 0) {
        const poolLoc = POOLS[s.pool];
        if (!bot.IsAlive() || jmz.GetHP(bot) < MIN_HP - 0.1) {
            End(bot, s, "low_hp", 20);
            return 0;
        }
        if (EnemyNear(bot.GetLocation(), ABORT_RADIUS) || EnemyNear(poolLoc, ABORT_RADIUS)) {
            End(bot, s, "enemy_near", ENEMY_RETRY);
            return 0;
        }
        // Picked at any point, also on the way in: walking into the pool is enough. Checking only after
        // reaching the centre left bots walking into the pool for 25 s after the grab (test 9089581778).
        if (CountLotuses(bot) > s.lotusesBefore) {
            End(bot, s, "picked", REGROW);
            return 0;
        }
        if (s.castAt < 0 && now - s.startAt > WALK_TIMEOUT) {
            End(bot, s, "walk_timeout", EMPTY_RETRY);
            return 0;
        }
        if (s.castAt >= 0) {
            if (now - s.castAt > PICK_TIMEOUT) {
                End(bot, s, "nothing", EMPTY_RETRY);
                return 0;
            }
        }
        return DesireTier.HIGH;
    }

    if (now < FIRST_LOTUS || !bot.IsAlive() || bot.IsIllusion() || Busy(bot) || jmz.GetHP(bot) < MIN_HP) return 0;
    const support = !jmz.IsCore(bot);
    const botLoc = bot.GetLocation();
    for (let i = 0; i < POOLS.length; i++) {
        if (now < readyAt[i] || (claimedBy[i] !== null && now - claimedAt[i] < CLAIM_STALE)) continue;
        const d = Dist(botLoc, POOLS[i]);
        if (d > (support ? SUPPORT_RADIUS : ANY_RADIUS)) continue;
        if (EnemyNear(POOLS[i], ENEMY_RADIUS)) continue;
        s.pool = i;
        s.startAt = now;
        s.castAt = -1;
        s.closest = 99999;
        s.closestAt = now;
        s.lotusesBefore = CountLotuses(bot);
        claimedBy[i] = bot.GetPlayerID();
        claimedAt[i] = now;
        return DesireTier.HIGH;
    }
    return 0;
}

export function Active(bot: Unit): boolean {
    return StateOf(bot).pool >= 0;
}

export function Think(bot: Unit): void {
    const s = StateOf(bot);
    if (s.pool < 0 || jmz.CanNotUseAction(bot)) return;
    const now = DotaTime();
    if (s.castAt >= 0) return; // wait for the cast / channel, or stand in the pool
    // The pool unit is listed even out of vision; walk to it rather than to the hard-coded spot.
    const pool = PoolUnit(s.pool);
    if (pool === null) {
        End(bot, s, "no_pool", 600);
        return;
    }
    const centre = pool.GetLocation();
    const d = Dist(bot.GetLocation(), centre);
    // Progress toward the centre: it may be unreachable, so no progress near the pool counts as arrived.
    if (d < s.closest - 25) {
        s.closest = d;
        s.closestAt = now;
    }
    const stuck = d <= STUCK_RADIUS && now - s.closestAt > STUCK_TIME;
    const method = workingMethod !== null ? workingMethod : nextMethod;
    const name = METHODS[method];
    const arriveAt = name === "stand" ? STAND_RADIUS : PICK_RANGE;
    if (d > arriveAt && !stuck) {
        if (now - s.lastMoveTime > 0.4) {
            bot.Action_MoveToLocation(centre);
            s.lastMoveTime = now;
        }
        return;
    }
    s.method = method;
    if (name === "attack") {
        bot.Action_AttackUnit(pool, true);
    } else if (name !== "stand") {
        const ability = bot.GetAbilityByName(name);
        if (ability === null || ability === undefined) {
            End(bot, s, "no_ability", METHOD_RETRY);
            return;
        }
        bot.Action_UseAbilityOnEntity(ability, pool);
    }
    // "stand": the bot stays where it is; Desire ends the visit when a lotus appears or after PICK_TIMEOUT.
    s.castAt = now;
}
