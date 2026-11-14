/**
 * Laning for every hero (docs/specs/smarter-bot-behaviour.md section 5, flag `laning`).
 *
 * Hybrid (v2). Valve's own laning Think does the walking, last hitting and denying: v1 replaced it
 * with our own Think and the same lineup lost about 20 last hits by 10:00 (Puck 20 against 38-41
 * with Valve's laning; S1 screen game 1, twice). Beginner AI, which beat plain OHA, also keeps
 * Valve's laning Think. So with the flag on:
 *
 * - mode_laning_generic.lua takes its desire from `GetDesire` here and defines no Think, so
 *   Valve's laning Think runs (the shim's and the nine-hero override's Think do not).
 * - What Valve's laning lacks runs as short bursts in team roam (mode_team_roam_generic.lua calls
 *   `BurstDesire` and `BurstThink`):
 *     trade    hit the enemy laner once when no last hit is due, then step back to drop creep aggro
 *     stepout  an enemy that outranges us just hit us: walk back out of its range
 *   During a burst `bot.laningHoldUntil` is set, which (a) keeps jmz CheckBotIdleState from
 *   relocating the bot and (b) tells the retreat and farm "should run" rules that the hero
 *   target is a lane trade, not a chase.
 * - Tango, tower aggro and danger are left to OHA's item usage, Valve's laning and retreat.
 *
 * Numbers marked "tunable" are starting values, to be changed only from lobby results.
 */
import { BotMode, DamageType, Lane, Team, Tower, Unit, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import { DesireTier } from "./desire_tiers";
import * as Pull from "./pull";
import * as Jungle from "./jungle";

// ---- tunables -------------------------------------------------------------------------

const TRADE_EXTRA_RANGE = 100; // a ranged hero may step this far into range for a trade
const TRADE_CREEPS_RANGED = 3; // a ranged hero harasses with up to this many enemy creeps within 500
const TRADE_CREEPS_MELEE = 1;
const TRADE_SWING_MARGIN = 0.3; // a last hit due within the trade swing plus this blocks the trade
const TRADE_MIN_HP = 0.5; // was 0.45: retreat's fight_lowhp_lane fires at 0.9 below 50%, so a trade below that was cancelled at once
const CREEP_AGGRO_RADIUS = 500;
const TRADE_HP_MARGIN = 0.1; // trade only if our health fraction >= theirs - this
const TRADE_MAX_LEAD = 1.2; // skip a trade whose hit would land later than this (long walk)
const TRADE_COOLDOWN = 2.5; // seconds between the end of one trade and the start of the next (tunable)
const STEP_BACK = 300;
const STEP_BACK_TIME = 0.5;
const SUPPORT_YIELD_RADIUS = 800;
const YIELD_CORE_REACH = 400; // a core within its attack range plus this of the creep takes the last hit (tunable)
const YIELD_TIME = 0.6;
const DISENGAGE_TIME = 1.5; // a core pulled out of a lane fight goes back to the creeps for this long (tunable)
const DISENGAGE_MARGIN = 0.05; // above the attack mode's own desire
const LIKELY_KILL_HP = 0.35; // an enemy hero below this is worth fighting in lane (tunable)
const LANEFIGHT_LOG_GAP = 3; // seconds between LANEFIGHT lines per bot // a yield burst lasts this long, then Valve's laning Think picks again
const SAFE_BACK = 1200;
const TOWER_RANGE = 750; // tower attack range plus a margin
const MOVE_REISSUE_DIST = 150; // move throttle (section 11.1)
const MOVE_REISSUE_TIME = 0.4;
const RANGED_HERO = 320; // attack range above this counts as ranged
const STEPOUT_RECENT = 1.5; // seconds: an enemy that outranges us and hit us this recently
const STEPOUT_MARGIN = 120; // stand this far outside its attack range
const STEPOUT_MAX = 800; // never walk back further than this
const STEPOUT_TIME = 1.2; // the burst lasts at most this long
const STEPOUT_RANGE_GAP = 50; // only enemies whose range beats ours by more than this
const STEPOUT_MAX_HP = 0.8; // above this health fraction, keep laning through harass (tunable)
const LAST_HIT_SEARCH_MIN = 600;
const OTHERS_DPS_SHARE = 0.8; // share of the attackers' damage per second expected to land in the window

// ---- per-bot state --------------------------------------------------------------------

type Burst = "none" | "trade" | "stepback" | "stepout" | "yield" | "disengage";

interface BotState {
    lastMoveLoc: Vector | null;
    lastMoveTime: number;
    burst: Burst;
    burstTarget: Unit | null;
    burstLoc: Vector | null;
    burstUntil: number;
    tradeLandsAt: number;
    nextTradeAt: number;
    /** Desire of a running disengage burst (it must stay above Valve's attack mode). */
    burstDesire: number;
    lastFightLog: number;
    /** Debug counters (Utils.DebugMode only): burst steps and desire tiers this minute. */
    steps: Record<string, number>;
    statsSince: number;
}
const states: Record<string, BotState> = {};

function StateOf(bot: Unit): BotState {
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    let state = states[key];
    if (state === undefined) {
        state = {
            lastMoveLoc: null,
            lastMoveTime: -999,
            burst: "none",
            burstTarget: null,
            burstLoc: null,
            burstUntil: -999,
            tradeLandsAt: -999,
            nextTradeAt: -999,
            burstDesire: 0,
            lastFightLog: -999,
            steps: {},
            statsSince: -999,
        };
        states[key] = state;
    }
    return state;
}

// ---- geometry -------------------------------------------------------------------------
function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/** `from` moved `distance` toward `to` (2D). */
function Toward(from: Vector, to: Vector, distance: number): Vector {
    const d = Dist(from, to);
    if (d < 1) return from;
    return Vector(from.x + ((to.x - from.x) / d) * distance, from.y + ((to.y - from.y) / d) * distance, from.z);
}

// ---- lane geometry (section 5.4) ------------------------------------------------------

/** Lane from position, as the override does (override_generic/mode_laning_generic.lua 40-55). */
export function LaneOf(bot: Unit): Lane {
    const pos = jmz.GetPosition(bot);
    if (pos === 2) return Lane.Mid;
    const safe = pos === 1 || pos === 5;
    if (GetTeam() === Team.Radiant) return safe ? Lane.Bot : Lane.Top;
    return safe ? Lane.Top : Lane.Bot;
}

const OUTER_TOWERS: Record<number, Tower[]> = {
    [Lane.Top]: [Tower.Top1, Tower.Top2, Tower.Top3],
    [Lane.Mid]: [Tower.Mid1, Tower.Mid2, Tower.Mid3],
    [Lane.Bot]: [Tower.Bot1, Tower.Bot2, Tower.Bot3],
};

function OutermostOwnTower(lane: Lane): Unit | null {
    for (const id of OUTER_TOWERS[lane] ?? []) {
        const tower = GetTower(GetTeam(), id);
        if (tower !== null && tower !== undefined && jmz.IsValidBuilding(tower)) return tower;
    }
    return null;
}

interface LaneGeometry {
    front: Vector;
    /** Unit-length direction from the front back toward our side. */
    back: Vector;
}

function LaneGeometryOf(lane: Lane): LaneGeometry {
    const team = GetTeam();
    const ownFront = GetLaneFrontLocation(team, lane, 0);
    let front = ownFront;
    if (GetLaneFrontAmount(GetOpposingTeam(), lane, false) < GetLaneFrontAmount(team, lane, false)) {
        front = GetLaneFrontLocation(GetOpposingTeam(), lane, 0);
    }
    const behind = GetLaneFrontLocation(team, lane, -500);
    let d = Dist(ownFront, behind);
    let back = d >= 1 ? Vector((behind.x - ownFront.x) / d, (behind.y - ownFront.y) / d, 0) : Vector(0, 0, 0);
    if (d < 1) {
        // Degenerate lane data: fall back to the direction of our fountain.
        const fountain = jmz.GetTeamFountain();
        d = Dist(front, fountain);
        back = d >= 1 ? Vector((fountain.x - front.x) / d, (fountain.y - front.y) / d, 0) : back;
    }
    return { front, back };
}

/** Where to retreat to: 1200 behind the front, never in front of our outermost tower in the lane. */
export function SafePoint(bot: Unit): Vector {
    const lane = LaneOf(bot);
    const geo = LaneGeometryOf(lane);
    const point = Vector(geo.front.x + geo.back.x * SAFE_BACK, geo.front.y + geo.back.y * SAFE_BACK, geo.front.z);
    const tower = OutermostOwnTower(lane);
    if (tower !== null) {
        const fountain = jmz.GetTeamFountain();
        const towerLoc = tower.GetLocation();
        if (Dist(point, fountain) > Dist(towerLoc, fountain)) return towerLoc;
    }
    return point;
}

/**
 * Where to step out to: from where the bot stands, back along the lane until outside the
 * harasser's attack range plus a margin (at most STEPOUT_MAX). Playtest 3: a melee Brood took
 * Viper's harass for a minute without moving.
 */
export function StepOutPoint(bot: Unit, enemy: Unit): Vector {
    const geo = LaneGeometryOf(LaneOf(bot));
    const need = enemy.GetAttackRange() + STEPOUT_MARGIN;
    const enemyLoc = enemy.GetLocation();
    let point = bot.GetLocation();
    for (let extra = 0; extra < STEPOUT_MAX && Dist(point, enemyLoc) < need; extra += 50) {
        point = Vector(point.x + geo.back.x * 50, point.y + geo.back.y * 50, point.z);
    }
    return point;
}

function IsRangedHero(unit: Unit): boolean {
    return unit.GetAttackRange() > RANGED_HERO;
}

// ---- last-hit prediction (only to keep trades from costing a last hit) ------------------

function AttackDamage(bot: Unit): number {
    let damage = bot.GetAttackDamage();
    if (jmz.FindItemSlotNotInNonbackpack(bot, "item_quelling_blade") >= 0) {
        damage += bot.GetAttackRange() > 310 || bot.GetUnitName() === "npc_dota_hero_templar_assassin" ? 4 : 8;
    }
    return damage;
}

/**
 * Damage other units will deal to `creep` within `seconds`: the attacks already mid-swing or in
 * flight (jmz), or everything attacking it as damage per second times the window, whichever is larger.
 */
/** Units near the bot that could be hitting a creep it wants to last hit. Built once per LastHitDue call. */
function NearbyAttackers(bot: Unit): Unit[][] {
    return [
        bot.GetNearbyLaneCreeps(1200, true),
        bot.GetNearbyLaneCreeps(1200, false),
        bot.GetNearbyHeroes(1200, true, BotMode.None),
        bot.GetNearbyHeroes(1200, false, BotMode.None),
        bot.GetNearbyTowers(1200, true),
        bot.GetNearbyTowers(1200, false),
    ];
}

function OthersDamage(bot: Unit, creep: Unit, seconds: number, groups: Unit[][]): number {
    const counted = jmz.GetTotalAttackWillRealDamage(creep, seconds);
    let dps = 0;
    for (const group of groups) {
        for (const unit of group) {
            if (unit === bot || !jmz.IsValid(unit) || unit.GetAttackTarget() !== creep) continue;
            dps += creep.GetActualIncomingDamage(unit.GetAttackDamage(), DamageType.Physical) / Math.max(unit.GetSecondsPerAttack(), 0.1);
        }
    }
    return Math.max(counted, dps * seconds * OTHERS_DPS_SHARE);
}

/** Whether one attack from the bot, landing in `seconds`, gets the kill: the others leave it alive, and our hit finishes it. */
function WillKill(bot: Unit, creep: Unit, damage: number, seconds: number, groups: Unit[][]): boolean {
    const health = creep.GetHealth() + creep.GetHealthRegen() * seconds + 0.8;
    const others = OthersDamage(bot, creep, seconds, groups);
    return others < health - 1 && others + creep.GetActualIncomingDamage(damage, DamageType.Physical) > health;
}

/** Whether some enemy lane creep near the bot can be last hit by an attack landing within its delay + `extra`. */
function LastHitDue(bot: Unit, damage: number, extra: number): boolean {
    const radius = Math.min(Math.max(bot.GetAttackRange() + 300, LAST_HIT_SEARCH_MIN), 1599);
    let groups: Unit[][] | null = null;
    for (const creep of bot.GetNearbyLaneCreeps(radius, true)) {
        if (!jmz.IsValid(creep) || !jmz.CanBeAttacked(creep)) continue;
        if (groups === null) groups = NearbyAttackers(bot);
        if (WillKill(bot, creep, damage, jmz.GetAttackProDelayTime(bot, creep) + extra, groups)) return true;
    }
    return false;
}

// ---- trade --------------------------------------------------------------------------

function CorePartnerBusy(bot: Unit): boolean {
    for (const ally of bot.GetNearbyHeroes(SUPPORT_YIELD_RADIUS, false, BotMode.None)) {
        if (ally === bot || !jmz.IsValidHero(ally) || !jmz.IsCore(ally)) continue;
        const target = ally.GetAttackTarget();
        if (target !== null && target !== undefined && target.IsCreep()) return true;
    }
    return false;
}

/**
 * The core a support should leave its current target to: the support is attacking an enemy lane
 * creep, and an allied core is close enough to that creep to last hit it. Valve's laning Think
 * last hits for every role; quick test 9089523363 had CM at 19 last hits against Juggernaut's 37
 * at 8:00, and ES at 19 against Axe's 35.
 */
function YieldTo(bot: Unit): Unit | null {
    const target = bot.GetAttackTarget();
    if (target === null || target === undefined || !jmz.IsValid(target) || !target.IsCreep()) return null;
    if (target.GetTeam() !== GetOpposingTeam()) return null; // denies stay with the support
    const targetLoc = target.GetLocation();
    for (const ally of bot.GetNearbyHeroes(SUPPORT_YIELD_RADIUS + YIELD_CORE_REACH, false, BotMode.None)) {
        if (ally === bot || !jmz.IsValidHero(ally) || jmz.IsSuspiciousIllusion(ally) || !jmz.IsCore(ally)) continue;
        if (Dist(ally.GetLocation(), targetLoc) <= ally.GetAttackRange() + YIELD_CORE_REACH) return ally;
    }
    return null;
}

// ---- lane fights for cores ----------------------------------------------------------------

/** The enemy hero a bot in attack mode is fighting, if any. */
function FightTarget(bot: Unit): Unit | null {
    const attacking = bot.GetAttackTarget();
    if (attacking !== null && attacking !== undefined && jmz.IsValidHero(attacking)) return attacking;
    const target = bot.GetTarget();
    if (target !== null && target !== undefined && jmz.IsValidHero(target)) return target;
    return null;
}

/**
 * Why a lane fight is worth it, or null if it is not: the enemy is low, or an allied hero is on it
 * with us, we are not outnumbered nearby and our health is at least theirs.
 */
function LikelyKill(bot: Unit, target: Unit): string | null {
    const targetHp = jmz.GetHP(target);
    if (targetHp < LIKELY_KILL_HP) return "low";
    let allies = 1;
    let helper = false;
    const targetLoc = target.GetLocation();
    for (const ally of bot.GetNearbyHeroes(1200, false, BotMode.None)) {
        if (ally === bot || !jmz.IsValidHero(ally) || jmz.IsSuspiciousIllusion(ally)) continue;
        allies++;
        if (Dist(ally.GetLocation(), targetLoc) < 900) helper = true;
    }
    let enemies = 0;
    for (const enemy of bot.GetNearbyHeroes(1200, true, BotMode.None)) {
        if (jmz.IsValidHero(enemy) && !jmz.IsSuspiciousIllusion(enemy)) enemies++;
    }
    if (helper && enemies <= allies && jmz.GetHP(bot) >= targetHp) return "with_ally";
    return null;
}

/**
 * Debug (Utils.DebugMode), at most every LANEFIGHT_LOG_GAP s per bot, while a core is in Valve's attack
 * mode in the laning phase:
 *   LANEFIGHT team=2 hero=npc_dota_hero_juggernaut t=152 desire=0.93 hp=0.71 target=npc_dota_hero_centaur thp=0.88 e=2 a=2 verdict=disengage
 */
function LogLaneFight(bot: Unit, state: BotState, desire: number, target: Unit | null, verdict: string): void {
    if (!Utils.DebugMode) return;
    const now = DotaTime();
    if (now - state.lastFightLog < LANEFIGHT_LOG_GAP) return;
    state.lastFightLog = now;
    const e = bot.GetNearbyHeroes(1200, true, BotMode.None).length;
    const a = bot.GetNearbyHeroes(1200, false, BotMode.None).length;
    const name = target !== null ? target.GetUnitName() : "none";
    const thp = target !== null ? jmz.GetHP(target).toFixed(2) : "-";
    print(
        `LANEFIGHT team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(now)} desire=${desire.toFixed(2)} hp=${jmz.GetHP(bot).toFixed(2)} target=${name} thp=${thp} e=${e} a=${a} verdict=${verdict}`
    );
}

/** Back to our creeps: a little behind our lane front. */
function BackToCreeps(bot: Unit): Vector {
    return GetLaneFrontLocation(GetTeam(), LaneOf(bot), -200);
}

/**
 * Who to harass, if anyone (rules from S1 playtest 2):
 * - creep aggro: a ranged hero accepts up to 3 enemy creeps near it (it steps back after the hit);
 *   a melee hero at most 1;
 * - a last hit due before the trade swing would finish blocks the trade;
 * - a ranged hero may step up to 100 into range; a melee core trades only from where it stands;
 * - a support does not trade while an allied core near it is hitting creeps;
 * - never below 45% health or 10% below the enemy, and never at a target under its own tower.
 */
function TradeTarget(bot: Unit): Unit | null {
    const range = bot.GetAttackRange();
    const ranged = IsRangedHero(bot);
    const enemyCreepsNear = bot.GetNearbyLaneCreeps(CREEP_AGGRO_RADIUS, true).filter(c => jmz.IsValid(c)).length;
    if (enemyCreepsNear > (ranged ? TRADE_CREEPS_RANGED : TRADE_CREEPS_MELEE)) return null;
    const botHp = jmz.GetHP(bot);
    if (botHp < TRADE_MIN_HP) return null;
    const isCore = jmz.IsCore(bot);
    if (!isCore && CorePartnerBusy(bot)) return null;
    const swing = bot.GetAttackPoint() / Math.max(bot.GetAttackSpeed(), 0.01) + TRADE_SWING_MARGIN;
    if (LastHitDue(bot, AttackDamage(bot), swing)) return null;

    const botLoc = bot.GetLocation();
    const towers = bot.GetNearbyTowers(1599, true).filter(t => !t.IsNull() && t.IsAlive()); // invulnerable towers still shoot
    for (const enemy of bot.GetNearbyHeroes(Math.min(range + TRADE_EXTRA_RANGE, 1599), true, BotMode.None)) {
        if (!jmz.IsValidHero(enemy) || jmz.IsSuspiciousIllusion(enemy) || !jmz.CanBeAttacked(enemy)) continue;
        if (botHp < jmz.GetHP(enemy) - TRADE_HP_MARGIN) continue;
        if (isCore && !ranged && Dist(botLoc, enemy.GetLocation()) > range) continue; // melee cores do not walk up
        const enemyLoc = enemy.GetLocation();
        if (towers.some(t => Dist(t.GetLocation(), enemyLoc) < TOWER_RANGE)) continue;
        return enemy;
    }
    return null;
}

/** An enemy hero that outranges us, hit us in the last STEPOUT_RECENT s and still has us in range. */
function Harasser(bot: Unit): Unit | null {
    const botRange = bot.GetAttackRange();
    const botLoc = bot.GetLocation();
    for (const enemy of bot.GetNearbyHeroes(1200, true, BotMode.None)) {
        if (!jmz.IsValidHero(enemy) || jmz.IsSuspiciousIllusion(enemy)) continue;
        const enemyRange = enemy.GetAttackRange();
        if (enemyRange <= botRange + STEPOUT_RANGE_GAP) continue;
        if (!bot.WasRecentlyDamagedByHero(enemy, STEPOUT_RECENT)) continue;
        if (Dist(botLoc, enemy.GetLocation()) >= enemyRange + STEPOUT_MARGIN) continue;
        return enemy;
    }
    return null;
}

// ---- moves ----------------------------------------------------------------------------

/** Move order with the throttle from section 11.1. */
function MoveTo(bot: Unit, state: BotState, loc: Vector): void {
    const now = DotaTime();
    if (state.lastMoveLoc !== null && Dist(state.lastMoveLoc, loc) <= MOVE_REISSUE_DIST && now - state.lastMoveTime < MOVE_REISSUE_TIME) {
        return;
    }
    bot.Action_MoveToLocation(loc);
    state.lastMoveLoc = loc;
    state.lastMoveTime = now;
}

// ---- laning desire (section 5.1) ------------------------------------------------------

/**
 * Desire with the flag on, called after the shim's off-conditions. During the laning phase a flat
 * MODERATE: Valve's laning Think chooses its own last hits, so there is no last-hit spike to flicker.
 * After it: the shim's ladder tail, without its 0.9 last-hit return.
 */
export function GetDesire(bot: Unit): number {
    const mode = GetGameMode();
    if (mode === 11 /* GAMEMODE_MO */ || mode === 21 /* GAMEMODE_1V1MID */) return 1;

    // Jungling after too many lane deaths (behavior/jungle, flag `farm`): farm mode has the bot.
    if (Jungle.Active(bot)) return DesireTier.LOW;
    if (jmz.IsInLaningPhase()) return Tier(bot, "moderate", DesireTier.MODERATE);

    let time = DotaTime();
    if (mode === 23) time = time * 1.65;
    const level = bot.GetLevel();
    if (time <= 10) return 0.268;
    if (time <= 9 * 60 && level <= 7) return 0.446;
    if (time <= 12 * 60 && level <= 11) return 0.369;
    if (level <= 14 && jmz.GetCoresAverageNetworth() < 7000) return 0.2;
    Utils.GameStates.passiveLaningTime = true;
    return 0.01;
}

// ---- bursts (run by team roam) ----------------------------------------------------------

function EndBurst(bot: Unit, state: BotState): void {
    state.burst = "none";
    state.burstTarget = null;
    state.burstLoc = null;
    bot.laningHoldUntil = null;
}

function StartBurst(bot: Unit, state: BotState, burst: Burst, until: number, target: Unit | null, loc: Vector | null): void {
    state.burst = burst;
    state.burstUntil = until;
    state.burstTarget = target;
    state.burstLoc = loc;
    state.lastMoveLoc = null;
    bot.laningHoldUntil = until;
}

/**
 * Team roam's desire for a lane burst: HIGH while one runs or one should start, else 0.
 * A burst starts only from laning mode, in the laning phase.
 */
export function BurstDesire(bot: Unit): number {
    const state = StateOf(bot);
    const now = DotaTime();
    if (!jmz.IsInLaningPhase() || !bot.IsAlive() || Jungle.Active(bot)) {
        if (state.burst !== "none") EndBurst(bot, state);
        Pull.Desire(bot); // lets a running pull end itself
        return 0;
    }

    // Camp pull (behavior/pull: position 5 safe lane, position 4 / a lone offlaner the offlane) comes before trades and step-outs.
    const pull = Pull.Desire(bot);
    if (pull > 0) {
        if (state.burst !== "none") EndBurst(bot, state);
        bot.laningHoldUntil = now + 0.5;
        return Tier(bot, "burst.pull", pull);
    }

    if (state.burst !== "none" && now >= state.burstUntil) EndBurst(bot, state);
    if (state.burst !== "none") {
        if (state.burst === "trade") {
            const target = state.burstTarget;
            const lost =
                target === null || !jmz.IsValidHero(target) || !jmz.CanBeAttacked(target) || Dist(bot.GetLocation(), target.GetLocation()) > bot.GetAttackRange() + 300;
            if (lost || now >= state.tradeLandsAt) {
                // The hit landed (or cannot): step back to drop creep aggro.
                StartBurst(bot, state, "stepback", now + STEP_BACK_TIME, null, Toward(bot.GetLocation(), SafePoint(bot), STEP_BACK));
                state.nextTradeAt = state.burstUntil + TRADE_COOLDOWN;
            }
        }
        return Tier(bot, `burst.${state.burst}`, state.burst === "disengage" ? state.burstDesire : DesireTier.HIGH);
    }

    // A core in Valve's attack mode in lane fights only for a likely kill; otherwise back to the creeps.
    // Quick tests 9089559472 / 9089566083: Juggernaut spent 15-34% of lane minutes in attack against
    // Centaur and Lion, then retreated or ran, and had 0-1 last hits in the first 4 minutes. Valve's attack
    // desire can exceed 0.9, so the burst bids just above it.
    if (bot.GetActiveMode() === BotMode.Attack && jmz.IsCore(bot)) {
        const attackDesire = bot.GetActiveModeDesire();
        const fightTarget = FightTarget(bot);
        const why = fightTarget !== null ? LikelyKill(bot, fightTarget) : "no_target";
        if (fightTarget !== null && why === null) {
            LogLaneFight(bot, state, attackDesire, fightTarget, "disengage");
            StartBurst(bot, state, "disengage", now + DISENGAGE_TIME, null, BackToCreeps(bot));
            state.burstDesire = Math.min(attackDesire + DISENGAGE_MARGIN, 1);
            return Tier(bot, "burst.disengage", state.burstDesire);
        }
        LogLaneFight(bot, state, attackDesire, fightTarget, `fight:${why}`);
        return 0;
    }

    if (bot.GetActiveMode() !== BotMode.Laning) return 0;
    if (jmz.CanNotUseAction(bot) || bot.IsUsingAbility() || bot.IsChanneling()) return 0;

    // Step out only once the harass has cost something: S1 screen game, 94 step-outs over the laning phase
    // and last hits still below plain OHA (Puck 34 at 10:00 against 38-41).
    const harasser = jmz.GetHP(bot) < STEPOUT_MAX_HP ? Harasser(bot) : null;
    // TradeTarget is costly (last-hit scan); with a harasser it is computed once here and reused below.
    const harasserTrade = harasser !== null ? TradeTarget(bot) : null;
    if (harasser !== null && harasserTrade === null) {
        StartBurst(bot, state, "stepout", now + STEPOUT_TIME, harasser, StepOutPoint(bot, harasser));
        return Tier(bot, "burst.stepout", DesireTier.HIGH);
    }

    // A support leaves last hits to the core next to it: stand still for a moment, which drops the target.
    if (!jmz.IsCore(bot) && YieldTo(bot) !== null) {
        StartBurst(bot, state, "yield", now + YIELD_TIME, null, Toward(bot.GetLocation(), SafePoint(bot), 50));
        return Tier(bot, "burst.yield", DesireTier.HIGH);
    }

    if (now < state.nextTradeAt || bot.IsDisarmed()) return 0;
    const target = harasser !== null ? harasserTrade : TradeTarget(bot);
    if (target === null) return 0;
    const dist = Dist(bot.GetLocation(), target.GetLocation());
    const walk = Math.max(0, dist - bot.GetAttackRange()) / Math.max(bot.GetCurrentMovementSpeed(), 1);
    const attackPoint = bot.GetAttackPoint() / Math.max(bot.GetAttackSpeed(), 0.01);
    const travel = IsRangedHero(bot) ? dist / 900 : 0;
    const lead = walk + attackPoint + travel + 0.1;
    if (lead > TRADE_MAX_LEAD) return 0;
    StartBurst(bot, state, "trade", now + lead + STEP_BACK_TIME, target, null);
    state.tradeLandsAt = now + lead;
    return Tier(bot, "burst.trade", DesireTier.HIGH);
}

/** Team roam's Think while a lane burst runs. */
export function BurstThink(bot: Unit): void {
    const state = StateOf(bot);
    if (jmz.CanNotUseAction(bot)) return;
    if (Pull.Active(bot)) {
        Pull.Think(bot);
        CountStep(bot, state, "pull");
        return;
    }
    if (state.burst === "trade" && state.burstTarget !== null) {
        // Re-issue only if the bot is not already attacking it: a fresh order restarts the swing.
        if (bot.GetAttackTarget() !== state.burstTarget) bot.Action_AttackUnit(state.burstTarget, true);
        state.lastMoveLoc = null;
        CountStep(bot, state, "trade");
        return;
    }
    if (state.burstLoc !== null) {
        MoveTo(bot, state, state.burstLoc);
        CountStep(bot, state, state.burst);
    }
}

/** Whether a camp pull is running: team roam lets it finish before a lotus trip. */
export function PullActive(bot: Unit): boolean {
    return Pull.Active(bot);
}

/** Whether a lane burst is running (team roam uses it to run BurstThink). */
export function InBurst(bot: Unit): boolean {
    const state = StateOf(bot);
    return state.burst !== "none" && DotaTime() < state.burstUntil;
}

// ---- debug counters -------------------------------------------------------------------

/**
 * Once a game minute per bot (Utils.DebugMode only):
 *     LANE team=2 hero=npc_dota_hero_puck seconds=60 lh=27 dn=9 desire.moderate=180 burst.trade=30 trade=25 stepback=12
 * Burst steps count BurstThink calls; desire.* and burst.* count desire calls.
 */
function CountStep(bot: Unit, state: BotState, step: string): void {
    if (!Utils.DebugMode) return;
    const now = DotaTime();
    if (state.statsSince < 0) state.statsSince = now;
    state.steps[step] = (state.steps[step] ?? 0) + 1;
    if (now - state.statsSince < 60) return;
    const parts: string[] = [];
    for (const key in state.steps) parts.push(`${key}=${state.steps[key]}`);
    parts.sort();
    print(`LANE team=${GetTeam()} hero=${bot.GetUnitName()} seconds=${Math.floor(now - state.statsSince)} lh=${bot.GetLastHits()} dn=${bot.GetDenies()} ${parts.join(" ")}`);
    state.steps = {};
    state.statsSince = now;
}

function Tier(bot: Unit, tier: string, desire: number): number {
    CountStep(bot, StateOf(bot), tier.startsWith("burst.") ? tier : `desire.${tier}`);
    return desire;
}
