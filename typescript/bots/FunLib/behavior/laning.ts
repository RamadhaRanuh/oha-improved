/**
 * Laning for every hero (docs/specs/smarter-bot-behaviour.md section 5, flag `laning`).
 *
 * With the flag on, bots/mode_laning_generic.lua takes its desire from `GetDesire` here
 * (after the shim's own off-conditions) and defines Think() for every hero as `Think` here.
 * Neither the shim's Think() nor the nine-hero override's runs, and Valve's default laning
 * Think() no longer runs for the other heroes. With the flag off none of this is loaded.
 *
 * Think is a strict priority list; the first step that issues an action returns:
 *   1 consumables (Tango)  2 danger back-off  3 tower aggro  4 last hit  5 deny
 *   6 trade (harass, then step back)  7 wave discipline (implicit)  8 hold position
 *
 * Numbers marked "tunable" are starting values, to be changed only from lobby results.
 */
import { BotMode, DamageType, Lane, Team, Tower, Unit, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import { DesireTier } from "./desire_tiers";

// ---- tunables -------------------------------------------------------------------------
const DANGER_WINDOW = 2.0; // seconds of incoming damage to estimate
const DANGER_FRACTION = 0.35; // back off when that exceeds this share of current health
const DANGER_RADIUS = 1000;
const DANGER_REACH = 200; // a facing enemy counts only within its attack range plus this
const DUE_MOVE = 0.6; // move to an out-of-range creep only if its last hit is due this soon
const DENY_BLOCK = 1.2; // no deny while a last hit is due this soon
const TRADE_EXTRA_RANGE = 100;
const TRADE_CREEPS_RANGED = 3; // a ranged hero harasses with up to this many enemy creeps within 500
const TRADE_CREEPS_MELEE = 1;
const TRADE_SWING_MARGIN = 0.3; // a last hit due within the trade swing plus this blocks the trade
const TRADE_MIN_HP = 0.45;
const CREEP_AGGRO_RADIUS = 500;
const TRADE_HP_MARGIN = 0.1; // trade only if our health fraction >= theirs - this
const STEP_BACK = 300;
const STEP_BACK_TIME = 0.5;
const SUPPORT_YIELD_RADIUS = 800;
const ROLE_OFFSET_MELEE_CORE = 0;
const ROLE_OFFSET_RANGED_CORE = 100;
const ROLE_OFFSET_SUPPORT = 150;
const PARTNER_CLOSE = 300;
const PARTNER_SIDESTEP = 320;
const SAFE_BACK = 1200;
const TOWER_RANGE = 750; // tower attack range plus a margin
const MOVE_REISSUE_DIST = 150; // move throttle (section 11.1)
const MOVE_REISSUE_TIME = 0.4;
const TANGO_MISSING_HP = 115;
const TANGO_TREE_RANGE = 400;
const RANGED_HERO = 320; // attack range above this counts as ranged
const HOLD_MELEE_BACK = 200; // melee: stand this far behind the front
const HOLD_RANGED_INSIDE = 100;
const HARASSED_RECENT = 3; // seconds: an enemy hero that hit us this recently pushes the hold point back
const HARASS_MARGIN = 120; // stand this far outside that hero's attack range
const HARASS_MAX_EXTRA = 800; // but never more than this much further back // ranged: stand at attack range minus this behind the front
const LAST_HIT_SEARCH_MIN = 600;
const OTHERS_DPS_SHARE = 0.8; // share of the attackers' damage per second expected to land in the window // look for last hits at least this far away
const COMMIT_EXTRA = 0.3; // keep a started last-hit attack this long past its expected landing
const HIGH_HOLD = 1.5; // seconds GetDesire stays HIGH after a last hit was due
const IDLE_EXEMPT = 0.5; // tells jmz CheckBotIdleState that standing still here is on purpose

// ---- per-bot state --------------------------------------------------------------------
interface BotState {
    lastMoveLoc: Vector | null;
    lastMoveTime: number;
    tradeLandsAt: number; // when the trade attack lands; step back after it
    stepBackUntil: number;
    lastAggroDrop: number;
    /** The creep a last-hit attack was started on, kept until `commitUntil`. */
    commitCreep: Unit | null;
    commitUntil: number;
    /** GetDesire stays at HIGH until this time (hysteresis). */
    highUntil: number;
    /** Debug counters (Utils.DebugMode only): Think steps and desire tiers this minute. */
    steps: Record<string, number>;
    statsSince: number;
}
const states: Record<string, BotState> = {};

function StateOf(bot: Unit): BotState {
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    let state = states[key];
    if (state === undefined) {
        state = { lastMoveLoc: null, lastMoveTime: -999, tradeLandsAt: -999, stepBackUntil: -999, lastAggroDrop: -999, commitCreep: null, commitUntil: -999, highUntil: -999, steps: {}, statsSince: -999 };
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

function IsRangedHero(unit: Unit): boolean {
    return unit.GetAttackRange() > RANGED_HERO;
}

function RoleOffset(bot: Unit): number {
    if (!jmz.IsCore(bot)) return ROLE_OFFSET_SUPPORT;
    return IsRangedHero(bot) ? ROLE_OFFSET_RANGED_CORE : ROLE_OFFSET_MELEE_CORE;
}

/**
 * How far behind the front to stand: close enough that the creeps at the front are within the
 * last-hit search radius. Enemy hero range is NOT used here (playtest 1: a melee carry stood
 * 600 back from Lion's range and never found a creep); enemy harass is handled by the danger step.
 */
function HoldBack(bot: Unit): number {
    const range = bot.GetAttackRange();
    const base = IsRangedHero(bot) ? Math.max(range - HOLD_RANGED_INSIDE, HOLD_MELEE_BACK) : HOLD_MELEE_BACK;
    return base + RoleOffset(bot);
}

/** Where to stand: the front moved back by `HoldBack`. */
export function HoldPoint(bot: Unit): Vector {
    const lane = LaneOf(bot);
    const geo = LaneGeometryOf(lane);
    const back = HoldBack(bot);
    let point = Vector(geo.front.x + geo.back.x * back, geo.front.y + geo.back.y * back, geo.front.z);

    // Out of harass range (playtest 3: a melee Brood took Viper's harass for a minute without
    // moving). An enemy hero that hit us recently, outranges us and that we cannot hit back from
    // here: move the spot back along the lane until it is outside that hero's range + margin.
    const botRange = bot.GetAttackRange();
    for (const enemy of bot.GetNearbyHeroes(1200, true, BotMode.None)) {
        if (!jmz.IsValidHero(enemy) || jmz.IsSuspiciousIllusion(enemy)) continue;
        const enemyRange = enemy.GetAttackRange();
        if (enemyRange <= botRange || !bot.WasRecentlyDamagedByHero(enemy, HARASSED_RECENT)) continue;
        const need = enemyRange + HARASS_MARGIN;
        const enemyLoc = enemy.GetLocation();
        for (let extra = 0; extra < HARASS_MAX_EXTRA && Dist(point, enemyLoc) < need; extra += 50) {
            point = Vector(point.x + geo.back.x * 50, point.y + geo.back.y * 50, point.z);
        }
    }

    // Side-step from a lane partner standing on top of us (ryndrb).
    for (const ally of bot.GetNearbyHeroes(PARTNER_CLOSE, false, BotMode.None)) {
        if (ally !== bot && jmz.IsValidHero(ally) && ally.GetPlayerID() !== bot.GetPlayerID()) {
            const side = bot.GetPlayerID() > ally.GetPlayerID() ? 1 : -1;
            point = Vector(point.x - geo.back.y * PARTNER_SIDESTEP * side, point.y + geo.back.x * PARTNER_SIDESTEP * side, point.z);
            break;
        }
    }
    return point;
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

// ---- creeps and timing (section 5.3) --------------------------------------------------

function AttackDamage(bot: Unit): number {
    let damage = bot.GetAttackDamage();
    if (jmz.FindItemSlotNotInNonbackpack(bot, "item_quelling_blade") >= 0) {
        damage += bot.GetAttackRange() > 310 || bot.GetUnitName() === "npc_dota_hero_templar_assassin" ? 4 : 8;
    }
    return damage;
}

/** Whether one attack from the bot kills the creep if it lands `extra` seconds later than it could. */
/**
 * Damage other units will deal to `creep` within `seconds`.
 *
 * jmz.GetTotalAttackWillRealDamage counts only attacks already mid-swing or in flight. Over a
 * ranged hero's ~1 s delay the attackers start new swings it does not see, and allied heroes are
 * not counted at all, so ranged bots aimed at creeps that died before the projectile landed
 * (screen game 1: Puck 32 last hits at 13:00 vs Templar Assassin 90). So also estimate the damage
 * from everything currently attacking the creep as damage per second times the window, and take
 * the larger of the two.
 */
function OthersDamage(bot: Unit, creep: Unit, seconds: number): number {
    const counted = jmz.GetTotalAttackWillRealDamage(creep, seconds);
    let dps = 0;
    const groups: Unit[][] = [
        bot.GetNearbyLaneCreeps(1200, true),
        bot.GetNearbyLaneCreeps(1200, false),
        bot.GetNearbyHeroes(1200, true, BotMode.None),
        bot.GetNearbyHeroes(1200, false, BotMode.None),
        bot.GetNearbyTowers(1200, true),
        bot.GetNearbyTowers(1200, false),
    ];
    for (const group of groups) {
        for (const unit of group) {
            if (unit === bot || !jmz.IsValid(unit) || unit.GetAttackTarget() !== creep) continue;
            dps += creep.GetActualIncomingDamage(unit.GetAttackDamage(), DamageType.Physical) / Math.max(unit.GetSecondsPerAttack(), 0.1);
        }
    }
    return Math.max(counted, dps * seconds * OTHERS_DPS_SHARE);
}

/** Whether one attack from the bot, landing in `seconds`, gets the kill: the others leave it alive, and our hit finishes it. */
function WillKill(bot: Unit, creep: Unit, damage: number, seconds: number): boolean {
    const health = creep.GetHealth() + creep.GetHealthRegen() * seconds + 0.8;
    const others = OthersDamage(bot, creep, seconds);
    return others < health - 1 && others + creep.GetActualIncomingDamage(damage, DamageType.Physical) > health;
}

function DueWithin(bot: Unit, creep: Unit, damage: number, extra: number): boolean {
    return WillKill(bot, creep, damage, jmz.GetAttackProDelayTime(bot, creep) + extra);
}

function IsRangedCreep(creep: Unit): boolean {
    return creep.GetUnitName().includes("ranged");
}

function LastHitCandidates(bot: Unit): Unit[] {
    const radius = Math.min(Math.max(bot.GetAttackRange() + 300, LAST_HIT_SEARCH_MIN), 1599);
    return bot.GetNearbyLaneCreeps(radius, true).filter(c => jmz.IsValid(c) && jmz.CanBeAttacked(c));
}

/**
 * Partner rule: a support (position 4 or 5) leaves a creep to an allied core that is within
 * 800 of it and can walk into attack range before the hit is due. A core never yields.
 */
function SupportShouldYield(bot: Unit, creep: Unit, delay: number): boolean {
    if (jmz.GetPosition(bot) < 4) return false;
    const creepLoc = creep.GetLocation();
    for (const ally of bot.GetNearbyHeroes(1200, false, BotMode.None)) {
        if (ally === bot || !jmz.IsValidHero(ally) || !jmz.IsCore(ally)) continue;
        const dist = Dist(ally.GetLocation(), creepLoc);
        if (dist > SUPPORT_YIELD_RADIUS) continue;
        const walk = Math.max(0, dist - ally.GetAttackRange()) / Math.max(ally.GetCurrentMovementSpeed(), 1);
        if (walk <= delay + 0.3) return true;
    }
    return false;
}

interface LastHit {
    creep: Unit;
    /** It dies to one attack issued now. */
    now: boolean;
}

/** The best last hit: killable now first (ranged creeps before others), else the nearest one due within `soon`. */
function BestLastHit(bot: Unit, damage: number, soon: number): LastHit | null {
    let best: Unit | null = null;
    let bestRanged = false;
    let dueSoon: Unit | null = null;
    let dueSoonDist = 99999;
    const botLoc = bot.GetLocation();
    for (const creep of LastHitCandidates(bot)) {
        const delay = jmz.GetAttackProDelayTime(bot, creep);
        if (SupportShouldYield(bot, creep, delay)) continue;
        if (WillKill(bot, creep, damage, delay)) {
            const ranged = IsRangedCreep(creep);
            if (best === null || (ranged && !bestRanged)) {
                best = creep;
                bestRanged = ranged;
            }
        } else if (soon > 0 && WillKill(bot, creep, damage, delay + soon)) {
            const d = Dist(botLoc, creep.GetLocation());
            if (d < dueSoonDist) {
                dueSoon = creep;
                dueSoonDist = d;
            }
        }
    }
    if (best !== null) return { creep: best, now: true };
    if (dueSoon !== null) return { creep: dueSoon, now: false };
    return null;
}

function BestDeny(bot: Unit, damage: number): Unit | null {
    for (const creep of bot.GetNearbyLaneCreeps(Math.min(bot.GetAttackRange() + 200, 1599), false)) {
        if (!jmz.IsValid(creep) || !jmz.CanBeAttacked(creep) || jmz.GetHP(creep) >= 0.5) continue;
        if (DueWithin(bot, creep, damage, 0)) return creep;
    }
    return null;
}

// ---- consumables (step 1) -------------------------------------------------------------

interface TangoUse {
    slot: number;
    tree: number;
}

function ConsiderTango(bot: Unit): TangoUse | null {
    if (bot.HasModifier("modifier_tango_heal")) return null;
    let slot = jmz.FindItemSlotNotInNonbackpack(bot, "item_tango");
    if (slot < 0) slot = jmz.FindItemSlotNotInNonbackpack(bot, "item_tango_single");
    if (slot < 0) return null;
    if (bot.OriginalGetMaxHealth() - bot.OriginalGetHealth() < TANGO_MISSING_HP) return null;
    if (bot.WasRecentlyDamagedByAnyHero(2)) return null;

    const trees = bot.GetNearbyTrees(TANGO_TREE_RANGE);
    if (trees.length === 0) return null;
    const tree = trees[0];
    const treeLoc = GetTreeLocation(tree);
    if (!IsLocationVisible(treeLoc) || !IsLocationPassable(treeLoc)) return null;
    const treeDist = Dist(bot.GetLocation(), treeLoc);
    for (const enemy of bot.GetNearbyHeroes(1000, true, BotMode.None)) {
        if (jmz.IsValidHero(enemy) && Dist(enemy.GetLocation(), bot.GetLocation()) < treeDist * 1.6) return null;
    }
    for (const tower of bot.GetNearbyTowers(1400, true)) {
        if (jmz.IsValidBuilding(tower) && Dist(tower.GetLocation(), treeLoc) <= 920) return null;
    }
    return { slot, tree };
}

// ---- danger and aggro (steps 2 and 3) -------------------------------------------------

function IncomingDamage(bot: Unit): number {
    const botLoc = bot.GetLocation();
    let damage = 0;
    for (const enemy of bot.GetNearbyHeroes(DANGER_RADIUS, true, BotMode.None)) {
        if (!jmz.IsValidHero(enemy) || jmz.IsSuspiciousIllusion(enemy)) continue;
        // Only enemies that are actually threatening: attacking us, hit us in the last second, or
        // facing us from within their attack range + DANGER_REACH. Playtest 4: counting every enemy
        // within 1000 that merely faced us (with all its spells) made bots back off 50-66 times a
        // minute and lane passively.
        const threatening =
            enemy.GetAttackTarget() === bot ||
            bot.WasRecentlyDamagedByHero(enemy, 1) ||
            (enemy.IsFacingLocation(botLoc, 30) && Dist(enemy.GetLocation(), botLoc) <= enemy.GetAttackRange() + DANGER_REACH);
        if (threatening) {
            damage += enemy.GetEstimatedDamageToTarget(true, bot, DANGER_WINDOW, DamageType.All);
        }
    }
    for (const tower of bot.GetNearbyTowers(DANGER_RADIUS, true)) {
        if (jmz.IsValidBuilding(tower) && tower.GetAttackTarget() === bot) {
            damage += tower.GetEstimatedDamageToTarget(true, bot, DANGER_WINDOW, DamageType.All);
        }
    }
    return damage;
}

function TowerTargetingBot(bot: Unit): Unit | null {
    for (const tower of bot.GetNearbyTowers(DANGER_RADIUS, true)) {
        if (jmz.IsValidBuilding(tower) && tower.GetAttackTarget() === bot) return tower;
    }
    return null;
}

/**
 * An allied creep the bot can hit to drop tower aggro: within the bot's attack range, inside
 * the tower's range, and below half health so the attack is a legal deny order. The spec asks
 * to verify in game whether hitting an allied creep drops aggro; if not, only the move is used.
 */
function AggroDropCreep(bot: Unit, tower: Unit): Unit | null {
    const towerLoc = tower.GetLocation();
    for (const creep of bot.GetNearbyLaneCreeps(Math.min(bot.GetAttackRange() + 50, 1599), false)) {
        if (jmz.IsValid(creep) && jmz.CanBeAttacked(creep) && jmz.GetHP(creep) < 0.5 && Dist(creep.GetLocation(), towerLoc) < TOWER_RANGE) {
            return creep;
        }
    }
    return null;
}

// ---- trade (step 6) -------------------------------------------------------------------

function CorePartnerBusy(bot: Unit): boolean {
    for (const ally of bot.GetNearbyHeroes(SUPPORT_YIELD_RADIUS, false, BotMode.None)) {
        if (ally === bot || !jmz.IsValidHero(ally) || !jmz.IsCore(ally)) continue;
        const target = ally.GetAttackTarget();
        if (target !== null && target !== undefined && target.IsCreep()) return true;
    }
    return false;
}

/**
 * Who to harass, if anyone. Playtest 2: the first rules (no trade with 2+ enemy creeps within
 * 500, none while any last hit was due within a full attack cycle, cores never moving) meant
 * mid heroes almost never hit the enemy hero. Now:
 * - creep aggro: a ranged hero accepts up to 3 enemy creeps near it (it steps back after the hit);
 *   a melee hero at most 1;
 * - a last hit only blocks the trade if it is due before the trade swing would finish;
 * - a ranged core may step up to 100 into range; a melee core trades only from where it stands;
 * - never below 45% health, and never at a target standing under its own tower.
 */
function TradeTarget(bot: Unit, damage: number): Unit | null {
    const range = bot.GetAttackRange();
    const ranged = IsRangedHero(bot);
    const enemyCreepsNear = bot.GetNearbyLaneCreeps(CREEP_AGGRO_RADIUS, true).filter(c => jmz.IsValid(c)).length;
    if (enemyCreepsNear > (ranged ? TRADE_CREEPS_RANGED : TRADE_CREEPS_MELEE)) return null;
    const swing = bot.GetAttackPoint() / Math.max(bot.GetAttackSpeed(), 0.01) + TRADE_SWING_MARGIN;
    if (BestLastHit(bot, damage, swing) !== null) return null;

    const botHp = jmz.GetHP(bot);
    if (botHp < TRADE_MIN_HP) return null;
    const isCore = jmz.IsCore(bot);
    if (!isCore && CorePartnerBusy(bot)) return null;
    const botLoc = bot.GetLocation();
    const towers = bot.GetNearbyTowers(1599, true).filter(t => jmz.IsValidBuilding(t));
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

/** Stand where we are (cancels a walk to the hold point). Issued once until another order. */
function Stop(bot: Unit, state: BotState): void {
    const loc = bot.GetLocation();
    if (state.lastMoveLoc !== null && Dist(state.lastMoveLoc, loc) < 30) return;
    bot.Action_MoveToLocation(loc);
    state.lastMoveLoc = loc;
    state.lastMoveTime = DotaTime();
}

function Attack(bot: Unit, state: BotState, target: Unit): void {
    // Only creeps become the bot's target. A hero target lingers after the trade, and OHA's farm-mode
    // "should run" rule reads it as a chase (see mode_farm_generic.lua X.ShouldRun).
    if (!target.IsHero()) bot.SetTarget(target);
    bot.Action_AttackUnit(target, true);
    state.lastMoveLoc = null; // the next move is not throttled against an old destination
}

// ---- desire (section 5.1) -------------------------------------------------------------

/**
 * Desire with the flag on, called after the shim's off-conditions. During the laning phase:
 * SURVIVE when a Tango is due, HIGH when a last hit is due within 0.6 s, else MODERATE.
 * After it: the shim's ladder tail, without its 0.9 last-hit return.
 */
export function GetDesire(bot: Unit): number {
    const mode = GetGameMode();
    if (mode === 11 /* GAMEMODE_MO */ || mode === 21 /* GAMEMODE_1V1MID */) return 1;

    if (jmz.IsInLaningPhase()) {
        if (ConsiderTango(bot) !== null) return Tier(bot, "survive", DesireTier.SURVIVE);
        // Hysteresis: once a last hit is due, stay at HIGH for HIGH_HOLD seconds. Without it the
        // desire flickered 0.5 <-> 0.75 every few frames and any mode wanting ~0.6 won and lost
        // in turn (playtest 2: up to 81 mode changes per bot per minute; baseline ~24).
        const state = StateOf(bot);
        const now = DotaTime();
        if (BestLastHit(bot, AttackDamage(bot), DUE_MOVE) !== null) state.highUntil = now + HIGH_HOLD;
        if (now < state.highUntil) return Tier(bot, "high", DesireTier.HIGH);
        return Tier(bot, "moderate", DesireTier.MODERATE);
    }

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

// ---- debug counters -------------------------------------------------------------------

/**
 * Once a game minute per bot (Utils.DebugMode only):
 *     LANE team=2 hero=npc_dota_hero_axe hold=120 lasthit=14 wait=30 ... desire.high=40 desire.moderate=150
 * Think steps count Think calls (only while laning is the active mode); desire counts GetDesire calls.
 */
function CountStep(bot: Unit, state: BotState, step: string): void {
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
    if (Utils.DebugMode) CountStep(bot, StateOf(bot), `desire.${tier}`);
    return desire;
}

// ---- think (section 5.2) --------------------------------------------------------------

export function Think(bot: Unit): void {
    const state = StateOf(bot);
    const step = Step(bot, state);
    if (Utils.DebugMode) CountStep(bot, state, step);
}

/** One Think: issues at most one order and returns which step issued it (for the debug counters). */
function Step(bot: Unit, state: BotState): string {
    if (!bot.IsAlive() || jmz.CanNotUseAction(bot) || bot.IsUsingAbility() || bot.IsChanneling()) return "busy";
    const now = DotaTime();
    const canAttack = !bot.IsDisarmed();
    // Standing at the hold point is on purpose: keep jmz CheckBotIdleState from "relocating" the
    // bot with an attack-move to the lane front (playtest 1: 71 relocations in 3 minutes).
    bot.laningHoldUntil = now + IDLE_EXEMPT;

    // 1. Consumables.
    const tango = ConsiderTango(bot);
    if (tango !== null) {
        const item = bot.GetItemInSlot(tango.slot);
        if (item !== null && item !== undefined) {
            bot.Action_UseAbilityOnTree(item, tango.tree);
            return "tango";
        }
    }

    // A trade attack has landed: step back to release creep aggro (part of the trade).
    if (now >= state.tradeLandsAt && now < state.stepBackUntil) {
        MoveTo(bot, state, Toward(bot.GetLocation(), SafePoint(bot), STEP_BACK));
        return "stepback";
    }

    // 2. Danger.
    if (IncomingDamage(bot) > bot.GetHealth() * DANGER_FRACTION) {
        MoveTo(bot, state, SafePoint(bot));
        return "danger";
    }

    // 3. Tower aggro.
    const tower = TowerTargetingBot(bot);
    if (tower !== null) {
        const creep = canAttack && now - state.lastAggroDrop > 1 ? AggroDropCreep(bot, tower) : null;
        if (creep !== null) {
            state.lastAggroDrop = now;
            Attack(bot, state, creep);
        } else {
            MoveTo(bot, state, SafePoint(bot));
        }
        return "aggro";
    }

    const damage = AttackDamage(bot);
    if (canAttack) {
        // 4. Last hit. A started last-hit attack is kept until it lands: re-deciding every
        // frame would cancel the swing whenever the prediction flickers.
        const committed = state.commitCreep;
        if (committed !== null && now < state.commitUntil && jmz.IsValid(committed) && committed.IsAlive()) {
            Attack(bot, state, committed);
            return "commit";
        }
        state.commitCreep = null;

        const hit = BestLastHit(bot, damage, DUE_MOVE);
        if (hit !== null) {
            const inRange = Dist(bot.GetLocation(), hit.creep.GetLocation()) <= bot.GetAttackRange();
            if (hit.now) {
                Attack(bot, state, hit.creep); // the delay already counts the walk into range
                state.commitCreep = hit.creep;
                state.commitUntil = now + jmz.GetAttackProDelayTime(bot, hit.creep) + COMMIT_EXTRA;
                return "lasthit";
            }
            if (!inRange) {
                MoveTo(bot, state, Toward(hit.creep.GetLocation(), bot.GetLocation(), bot.GetAttackRange() * 0.9));
                return "approach";
            }
            // In range and due within 0.6 s: stand still and wait for it (not back to the hold point).
            Stop(bot, state);
            return "wait";
        }

        // 5. Deny, if no last hit is due within 1.2 s.
        if (BestLastHit(bot, damage, DENY_BLOCK) === null) {
            const deny = BestDeny(bot, damage);
            if (deny !== null) {
                Attack(bot, state, deny);
                return "deny";
            }
        }

        // 6. Trade.
        const target = TradeTarget(bot, damage);
        if (target !== null) {
            Attack(bot, state, target);
            const attackPoint = bot.GetAttackPoint() / Math.max(bot.GetAttackSpeed(), 0.01);
            const travel = IsRangedHero(bot) ? Dist(bot.GetLocation(), target.GetLocation()) / 900 : 0;
            state.tradeLandsAt = now + attackPoint + travel + 0.1;
            state.stepBackUntil = state.tradeLandsAt + STEP_BACK_TIME;
            return "trade";
        }
    }

    // 7. Wave discipline: nothing above attacks a creep that is not a last hit or deny.
    // 8. Position.
    MoveTo(bot, state, HoldPoint(bot));
    return "hold";
}
