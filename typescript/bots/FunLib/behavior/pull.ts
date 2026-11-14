/**
 * Camp pulling for the supports (flag `laning`; requested after the S1 playtests).
 *
 * Who pulls which lane: position 5 the safe lane; position 4 the offlane, and the offlaner (position 3)
 * when no allied position 4 is near it (alone in lane). The offlane pull waits while a lane ally has an
 * enemy hero next to it, as the laning-phase stacks do.
 *
 * When our safe-lane wave has pushed up to the enemy tier-1 tower, the position-5 bot pulls the
 * small or medium camp next to its safe lane so the next allied wave fights the neutrals and the
 * lane comes back toward our tower, as a human support does.
 *
 * Phases, run as a team-roam burst through behavior/laning (BurstDesire / BurstThink):
 *   go    walk to a spot beside the camp, on the lane side
 *   wait  stand there until the hit time
 *   hit   attack the nearest neutral once
 *   drag  walk to the lane path, toward the oncoming allied wave, so the neutrals follow into it
 * Timing (v2, after the first test game: 9 pulls, all timed out with no creep on the neutrals):
 * our lane creeps are always visible to us, so the hit time comes from the real wave. Each allied
 * lane creep on the lane path between our base and the pull point gives an arrival time at creep
 * speed; the nearest one is the next wave. Waves arrive every 30 s at the same phase, so a seen
 * wave also fixes when the next ones arrive, which decides when to leave the lane. Before any wave
 * is seen, the phase comes from the path length (v1's estimate).
 *
 * Debug (Utils.DebugMode): one line per pull, e.g.
 *   PULL team=2 hero=npc_dota_hero_crystal_maiden t=212 result=fought creepsOnNeutrals=3 waveEta=-0.8 camp=small
 * waveEta: seconds from the predicted wave arrival to when our first creep reached the pull point
 * (positive: the wave came later than predicted).
 */
import { BotMode, Lane, Team, Tower, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import { DesireTier } from "./desire_tiers";

// ---- tunables -------------------------------------------------------------------------

const PULL_START_TIME = 75; // camps spawn at 1:00
const PUSHED_DIST = 1800; // our lane front within this of the enemy tier-1 tower counts as pushed (tunable)
const PUSHED_AMOUNT = 0.6; // when that tower is gone: our front amount above this (tunable)
const CAMP_MAX_FROM_LANE = 1600;
const CREEP_SPEED = 325;
const PULL_WAVE_DELAY = 0; // seconds added to the path-length estimate, used until a wave is seen
const WAIT_MAX = 14; // longest wait at the camp before the hit (tunable)
const LIVE_EVERY = 0.25; // seconds between live wave scans
const LIVE_PATH_DIST = 450; // a creep this close to the lane path counts as on it
const LIVE_MIN_INDEX = 5; // ignore path points at the base, where the lanes meet
const AGGRO_LEAD = 1.0; // hit this much earlier than the plain walk time needs
const MAX_PLAN_AHEAD = 28; // do not plan for a wave further away than this
const GO_EARLY = 3; // leave the lane this long before the walk to the camp has to start
const STAND_FROM_CAMP = 300; // stand this far from the camp centre, toward the lane
const HIT_TIMEOUT = 2.0;
const DRAG_TIMEOUT = 9.0;
const DRAG_BEYOND = 0.03; // lane amount past the pull point, toward our base
const ABORT_ENEMY_RADIUS = 900;
const MIN_HP = 0.45;
const NEUTRAL_TEAM = 4; // TEAM_NEUTRAL
const OFFLANER_ALONE = 2500; // offlaner pulls when no allied position 4 is this close
const PARTNER_RADIUS = 1600; // offlane pull: lane allies this close to us...
const PARTNER_ENEMY = 1400; // ...must have no enemy hero this close

// ---- per-bot state --------------------------------------------------------------------

type Phase = "none" | "go" | "wait" | "hit" | "drag";

interface PullPlan {
    lane: Lane;
    campLoc: Vector;
    campType: string;
    standLoc: Vector;
    pullLoc: Vector;
    dragLoc: Vector;
    /** Path length from our end of the lane to the pull point. */
    pathLen: number;
    path: Vector[];
    /** cum[i]: path length from our end to path[i]. */
    cum: number[];
    pullIndex: number;
}

interface PullState {
    plan: PullPlan | null; // null: none (see planLane)
    /** Lane the plan was worked out for, -1 if not yet. In Lua null and undefined are both nil, so "no usable
     * camp" could not be told from "not worked out" (9089836233: 2000 PULLPLAN camp=none lines). */
    planLane: number;
    phase: Phase;
    hitAt: number;
    waveAt: number;
    phaseStart: number;
    pulledWave: number; // predicted arrival time of the wave last tried
    firstCreepAt: number;
    lastMoveTime: number;
    maxOnNeutrals: number;
    /** GameTime() when the hit phase started: GetLastAttackTime() is on that clock, not DotaTime(). */
    hitGameStart: number;
    liveAt: number;
    liveEta: number | null;
}
const states: Record<string, PullState> = {};

function StateOf(bot: Unit): PullState {
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    let s = states[key];
    if (s === undefined) {
        s = { plan: null, planLane: -1, phase: "none", hitAt: -999, waveAt: -999, phaseStart: -999, pulledWave: -999, firstCreepAt: -1, lastMoveTime: -999, maxOnNeutrals: 0, hitGameStart: -999, liveAt: -999, liveEta: null };
        states[key] = s;
    }
    return s;
}

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

function SafeLane(): Lane {
    return GetTeam() === Team.Radiant ? Lane.Bot : Lane.Top;
}

function OffLane(): Lane {
    return GetTeam() === Team.Radiant ? Lane.Top : Lane.Bot;
}

/** The lane this bot pulls in, or null when it does not pull. */
function PullLane(bot: Unit): Lane | null {
    const pos = jmz.GetPosition(bot);
    if (pos === 5) return SafeLane();
    if (pos === 4) return OffLane();
    if (pos !== 3) return null;
    for (const ally of GetUnitList(UnitType.AlliedHeroes)) {
        if (ally === null || ally === bot || ally.IsNull() || !ally.IsAlive() || ally.IsIllusion()) continue;
        if (jmz.GetPosition(ally) === 4 && Dist(ally.GetLocation(), bot.GetLocation()) < OFFLANER_ALONE) return null;
    }
    return OffLane();
}

/** Offlane: a lane ally (or we) has an enemy hero next to it; leaving would cost the partner. */
function PartnerPressed(bot: Unit): boolean {
    for (const ally of jmz.GetAlliesNearLoc(bot.GetLocation(), PARTNER_RADIUS)) {
        if (jmz.GetEnemiesNearLoc(ally.GetLocation(), PARTNER_ENEMY).length > 0) return true;
    }
    return false;
}

const ENEMY_T1: Record<number, Tower> = { [Lane.Top]: Tower.Top1, [Lane.Mid]: Tower.Mid1, [Lane.Bot]: Tower.Bot1 };

// ---- plan (worked out once per bot) -----------------------------------------------------

/**
 * The camp to pull: one of ours, small or medium, closest to the safe-lane path (within 1600).
 * GetLocationAlongLane's 0 end may be either base, so the end nearer our fountain is taken as the spawn end.
 */
function MakePlan(lane: Lane): PullPlan | null {
    const fountain = jmz.GetTeamFountain();
    const fromZero = Dist(GetLocationAlongLane(lane, 0), fountain) < Dist(GetLocationAlongLane(lane, 1), fountain);
    const STEPS = 100;
    const path: Vector[] = [];
    for (let i = 0; i <= STEPS; i++) path.push(GetLocationAlongLane(lane, fromZero ? i / STEPS : 1 - i / STEPS));

    let best: PullPlan | null = null;
    let bestDist = CAMP_MAX_FROM_LANE;
    const camps = GetNeutralSpawners();
    for (const key in camps) {
        const camp = camps[key];
        if (camp === undefined || camp === null || camp.location === undefined || camp.location === null) continue;
        if (camp.team !== undefined && camp.team !== GetTeam()) continue;
        const type = `${camp.type ?? ""}`;
        if (type !== "small" && type !== "medium") continue;
        const loc: Vector = camp.location;
        let nearest = -1;
        let nearestDist = 99999;
        for (let i = 0; i <= STEPS; i++) {
            const d = Dist(path[i], loc);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = i;
            }
        }
        if (nearest < 0 || nearestDist >= bestDist) continue;
        const cum: number[] = [0];
        for (let i = 1; i <= STEPS; i++) cum.push(cum[i - 1] + Dist(path[i - 1], path[i]));
        const pathLen = cum[nearest];
        const dragIndex = Math.max(0, nearest - Math.floor(DRAG_BEYOND * STEPS));
        bestDist = nearestDist;
        best = {
            lane,
            campLoc: loc,
            campType: type,
            standLoc: Toward(loc, path[nearest], STAND_FROM_CAMP),
            pullLoc: path[nearest],
            dragLoc: path[dragIndex],
            pathLen,
            path,
            cum,
            pullIndex: nearest,
        };
    }
    return best;
}

// ---- conditions -----------------------------------------------------------------------

function WavePushed(lane: Lane): boolean {
    const front = GetLaneFrontLocation(GetTeam(), lane, 0);
    const tower = GetTower(GetOpposingTeam(), ENEMY_T1[lane]);
    // Alive, not jmz.IsValidBuilding: that needs the tower in vision, which their tier-1 often is not.
    if (tower !== null && tower !== undefined && !tower.IsNull() && tower.IsAlive()) return Dist(front, tower.GetLocation()) < PUSHED_DIST;
    return GetLaneFrontAmount(GetTeam(), lane, false) > PUSHED_AMOUNT;
}

function EnemyNear(bot: Unit, loc: Vector, radius: number): boolean {
    for (const enemy of bot.GetNearbyHeroes(1600, true, BotMode.None)) {
        if (jmz.IsValidHero(enemy) && !jmz.IsSuspiciousIllusion(enemy) && Dist(enemy.GetLocation(), loc) < radius) return true;
    }
    return false;
}

/** Arrival phase of our waves at each lane's pull point (seconds mod 30), shared by the team; unset until seen. */
const wavePhase: Record<number, number> = {};

/**
 * Seconds until the nearest allied lane creep still on our side of the pull point reaches it, or
 * null if none is on the path. Scanned at most every LIVE_EVERY s per bot.
 */
function LiveEta(s: PullState, plan: PullPlan, now: number): number | null {
    if (now - s.liveAt < LIVE_EVERY) return s.liveEta;
    s.liveAt = now;
    let best: number | null = null;
    for (const creep of GetUnitList(UnitType.AlliedCreeps)) {
        if (!jmz.IsValid(creep) || creep.GetUnitName().indexOf("guys") < 0) continue; // lane creeps only
        const loc = creep.GetLocation();
        let index = -1;
        let nearest = LIVE_PATH_DIST;
        for (let i = LIVE_MIN_INDEX; i <= plan.pullIndex; i++) {
            const d = Dist(plan.path[i], loc);
            if (d < nearest) {
                nearest = d;
                index = i;
            }
        }
        if (index < 0 || index >= plan.pullIndex) continue; // not on the path, or at / past the pull point
        const eta = (plan.cum[plan.pullIndex] - plan.cum[index]) / CREEP_SPEED;
        if (best === null || eta < best) best = eta;
    }
    s.liveEta = best;
    if (best !== null) wavePhase[plan.lane] = (((now + best) % 30) + 30) % 30;
    return best;
}

/** Seconds until the next wave reaches the pull point: the live wave if one is on the path, else from the phase. */
function NextArrival(s: PullState, plan: PullPlan, now: number): number {
    const live = LiveEta(s, plan, now);
    if (live !== null) return live;
    const seen = wavePhase[plan.lane];
    const phase = seen !== undefined ? seen : (plan.pathLen / CREEP_SPEED + PULL_WAVE_DELAY) % 30;
    return (((phase - now) % 30) + 30) % 30;
}

function DragTime(bot: Unit, plan: PullPlan): number {
    return Dist(plan.standLoc, plan.dragLoc) / Math.max(bot.GetCurrentMovementSpeed(), 200);
}

function CountOnNeutrals(bot: Unit): number {
    let n = 0;
    for (const creep of bot.GetNearbyLaneCreeps(1200, false)) {
        if (!jmz.IsValid(creep)) continue;
        const t = creep.GetAttackTarget();
        if (t !== null && t !== undefined && t.GetTeam() === NEUTRAL_TEAM) n++;
    }
    return n;
}

// ---- desire / think ---------------------------------------------------------------------

function End(bot: Unit, s: PullState, result: string): void {
    if (Utils.DebugMode && s.phase !== "none" && s.phase !== "go") {
        const onNeutrals = Math.max(s.maxOnNeutrals, CountOnNeutrals(bot));
        if (result === "fought" && onNeutrals === 0) result = "missed";
        const eta = s.firstCreepAt > 0 ? (s.firstCreepAt - s.waveAt).toFixed(1) : "none";
        print(
            `PULL team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(DotaTime())} result=${result} creepsOnNeutrals=${onNeutrals} waveEta=${eta} camp=${s.plan ? s.plan.campType : "?"} lane=${s.plan ? s.plan.lane : "?"}`
        );
    } else if (Utils.DebugMode && s.phase === "go") {
        print(`PULL team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(DotaTime())} result=${result} (before reaching the camp)`);
    }
    s.phase = "none";
    s.firstCreepAt = -1;
    s.maxOnNeutrals = 0;
    bot.laningHoldUntil = null;
}

function SetPhase(s: PullState, phase: Phase): void {
    s.phase = phase;
    s.phaseStart = DotaTime();
}

/** HIGH while a pull runs or should start now, else 0. Positions 5 and 4 pull, and an offlaner alone in lane. */
export function Desire(bot: Unit): number {
    const s = StateOf(bot);
    const now = DotaTime();
    const lane = jmz.IsInLaningPhase() && bot.IsAlive() ? PullLane(bot) : null;
    if (lane === null) {
        if (s.phase !== "none") End(bot, s, "stopped");
        return 0;
    }

    if (s.phase !== "none") {
        const plan = s.plan as PullPlan;
        if (jmz.GetHP(bot) < MIN_HP) {
            End(bot, s, "low_hp");
            return 0;
        }
        if (EnemyNear(bot, bot.GetLocation(), ABORT_ENEMY_RADIUS)) {
            End(bot, s, "enemy_near");
            return 0;
        }
        if (s.phase === "hit" && now - s.phaseStart > HIT_TIMEOUT) {
            End(bot, s, "no_hit");
            return 0;
        }
        if (s.phase === "wait" || s.phase === "go") {
            // Follow the real wave: its arrival moves the hit time.
            const live = LiveEta(s, plan, now);
            if (live !== null && Math.abs(now + live - s.waveAt) < 12) {
                s.waveAt = now + live;
                s.hitAt = s.waveAt - DragTime(bot, plan) - AGGRO_LEAD;
            }
        }
        if (s.phase === "drag") {
            s.maxOnNeutrals = Math.max(s.maxOnNeutrals, CountOnNeutrals(bot));
            // Note when our first lane creep reaches the pull point, for the timing check.
            if (s.firstCreepAt < 0) {
                for (const creep of bot.GetNearbyLaneCreeps(1200, false)) {
                    if (jmz.IsValid(creep) && Dist(creep.GetLocation(), plan.pullLoc) < 400) {
                        s.firstCreepAt = now;
                        break;
                    }
                }
            }
            if (s.firstCreepAt > 0 && now - s.firstCreepAt > 1.5) {
                End(bot, s, "fought");
                return 0;
            }
            if (now - s.phaseStart > DRAG_TIMEOUT) {
                End(bot, s, "timeout");
                return 0;
            }
        }
        if (s.phase === "wait" && now > s.hitAt + 1.0) {
            End(bot, s, "late");
            return 0;
        }
        bot.laningHoldUntil = now + 0.5;
        return DesireTier.HIGH;
    }

    // Start only from laning, after the camps spawn, with the safe-lane wave pushed.
    if (now < PULL_START_TIME || bot.GetActiveMode() !== BotMode.Laning || jmz.GetHP(bot) < 0.6) return 0;
    if (s.planLane !== lane) {
        s.planLane = lane;
        s.plan = MakePlan(lane);
        if (Utils.DebugMode) {
            const types: string[] = [];
            const camps = GetNeutralSpawners();
            for (const key in camps) types.push(`${camps[key]?.type}/${camps[key]?.team}`);
            const p = s.plan;
            print(
                `PULLPLAN team=${GetTeam()} hero=${bot.GetUnitName()} lane=${lane} camp=${p ? `${p.campType}@${Math.floor(p.campLoc.x)},${Math.floor(p.campLoc.y)} pathLen=${Math.floor(p.pathLen)}` : "none"} seen=${types.join(",")}`
            );
        }
    }
    const plan = s.plan;
    if (plan === null || !WavePushed(lane)) return 0;
    if (lane === OffLane() && PartnerPressed(bot)) return 0;
    if (EnemyNear(bot, plan.campLoc, 1200) || EnemyNear(bot, bot.GetLocation(), ABORT_ENEMY_RADIUS)) return 0;
    const speed = Math.max(bot.GetCurrentMovementSpeed(), 200);
    const walk = Dist(bot.GetLocation(), plan.standLoc) / speed;
    const drag = DragTime(bot, plan);
    let eta = NextArrival(s, plan, now);
    if (eta - drag - AGGRO_LEAD < walk + 1) eta += 30; // this wave is too close: plan for the next one
    if (eta > MAX_PLAN_AHEAD + 30) return 0;
    const waveAt = now + eta;
    const hitAt = waveAt - drag - AGGRO_LEAD;
    if (Math.abs(waveAt - s.pulledWave) < 10) return 0; // already tried this wave
    if (now < hitAt - walk - GO_EARLY) return 0; // too early to leave the lane
    if (hitAt - (now + walk) > WAIT_MAX) return 0;
    s.pulledWave = waveAt;
    s.waveAt = waveAt;
    s.hitAt = hitAt;
    s.firstCreepAt = -1;
    SetPhase(s, "go");
    bot.laningHoldUntil = now + 0.5;
    return DesireTier.HIGH;
}

export function Active(bot: Unit): boolean {
    return StateOf(bot).phase !== "none";
}

function Move(bot: Unit, s: PullState, loc: Vector): void {
    const now = DotaTime();
    if (now - s.lastMoveTime < 0.3) return;
    bot.Action_MoveToLocation(loc);
    s.lastMoveTime = now;
}

export function Think(bot: Unit): void {
    const s = StateOf(bot);
    const plan = s.plan;
    if (plan === null || plan === undefined || s.phase === "none" || jmz.CanNotUseAction(bot)) return;
    const now = DotaTime();

    if (s.phase === "go") {
        if (Dist(bot.GetLocation(), plan.standLoc) < 150) SetPhase(s, "wait");
        else Move(bot, s, plan.standLoc);
        return;
    }
    if (s.phase === "wait") {
        if (now < s.hitAt) {
            if (Dist(bot.GetLocation(), plan.standLoc) > 100) Move(bot, s, plan.standLoc);
            return;
        }
        SetPhase(s, "hit");
        s.hitGameStart = GameTime();
    }
    if (s.phase === "hit") {
        let target: Unit | null = null;
        let best = 99999;
        for (const creep of bot.GetNearbyNeutralCreeps(900, true)) {
            if (!jmz.IsValid(creep) || creep.IsAncientCreep()) continue;
            const d = Dist(creep.GetLocation(), plan.campLoc);
            if (d < 700 && d < best) {
                best = d;
                target = creep;
            }
        }
        if (target === null) {
            End(bot, s, "empty_camp");
            return;
        }
        // Drag once the attack has gone off, or a neutral is already after us. GetLastAttackTime() is on the
        // GameTime() clock; comparing it with DotaTime() (v2) counted any earlier lane hit, so the bot
        // dragged without ever hitting the camp (quick test 9089559472: 4 pulls, all missed).
        let aggro = false;
        for (const creep of bot.GetNearbyNeutralCreeps(900, true)) {
            if (jmz.IsValid(creep) && creep.GetAttackTarget() === bot) aggro = true;
        }
        if (bot.GetLastAttackTime() >= s.hitGameStart || aggro) {
            SetPhase(s, "drag");
        } else if (bot.GetAttackTarget() !== target) {
            bot.Action_AttackUnit(target, true);
            return;
        } else {
            return;
        }
    }
    if (s.phase === "drag") Move(bot, s, plan.dragLoc);
}
