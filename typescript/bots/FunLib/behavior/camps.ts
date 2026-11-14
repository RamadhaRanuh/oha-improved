/**
 * Neutral camps: stacking (flag `farm`) and the camp data camp blocking uses (behavior/prehorn).
 *
 * Stacking: a support walks to one of our camps, hits a neutral at the stack second (x:52-x:54 by
 * camp size) and walks away, so the neutrals are out of the spawn box at x:00 and a second set spawns.
 * Our cores then clear a bigger camp. Plain OHA never stacks.
 *   - Positions 4 and 5 only, from STACK_START, at most once per STACK_GAP s each (STACK_GAP_LANING
 *     in the laning phase, when they also have a lane).
 *   - The camp: our own, not claimed by another stacker this minute, no enemy hero near it, and
 *     reachable before the hit second.
 *   - Aborts on enemies near, damage from a hero, or low HP.
 *
 * Camp positions: GetNeutralSpawners() gives `location` (pulls use it) and may give the spawn box
 * as `min`/`max`. BoxCentre uses the box when present. One CAMPS line at the first call reports which.
 *
 * Debug (Utils.DebugMode):
 *   CAMPS team=2 n=18 box=true fields=location,max,min,speed,team,type
 *   STACK team=2 hero=npc_dota_hero_crystal_maiden t=473 camp=large result=pulled hitAt=53.0 neutrals=4
 */
import { BotMode, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import { DesireTier } from "./desire_tiers";

const STACK_START = 2 * 60 + 30;
const STACK_GAP = 60; // tunable
const STACK_GAP_LANING = 120;
const PLAN_FROM = 30; // start planning at x:30
const HIT_SEC: Record<string, number> = { ancient: 52.5, large: 53, medium: 53.5, small: 54 }; // tunable
const STAND_DIST = 350; // wait this far from the box centre
const PULL_DIST = 1100; // walk this far from the centre after the hit
const MAX_TRAVEL = 2600;
const ENEMY_RADIUS = 1500;
// 9089765175: 9 of 30 stacks pulled. Fixes below for the 21 failures:
// - enemy_near at x:30-x:35: the abort counted enemies near the bot, i.e. the enemy laners next to it.
//   Now only enemies near the camp count, or near the bot once it is at the camp (AT_CAMP).
// - late: travel time used the straight line; jungle paths are longer (PATH_FACTOR).
// - empty: the camp was already farmed (often by our cores). Skip a camp an ally can see with no neutrals
//   in it, or an ally hero is standing in (FARMER_RADIUS).
const AT_CAMP = 900;
const PATH_FACTOR = 1.4;
const SEE_RADIUS = 1000; // an allied unit this close to the camp sees whether it has neutrals
const FARMER_RADIUS = 1000;
const MIN_HP = 0.5;
// Laning phase: in 9089765175 ES and CM left their lanes to stack at 2:30 and 4:30 and Axe and Jugg died
// alone in lane. A laning support only stacks a camp next to the lane, and only when its lane ally is not
// facing an enemy hero.
const LANING_MAX_TRAVEL = 1600;
const LANING_PARTNER_RADIUS = 1600;
const LANING_PARTNER_ENEMY = 1400;

export interface Camp {
    centre: Vector;
    type: string;
    team: number;
    raw: any;
}

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

let camps: Camp[] | null = null;

/** All camps with the spawn-box centre (min/max when the game gives them, else location). */
export function Camps(): Camp[] {
    if (camps !== null) return camps;
    const out: Camp[] = [];
    let box = false;
    let fields = "";
    for (const raw of GetNeutralSpawners() as any[]) {
        if (raw === null || raw === undefined) continue;
        if (fields === "") {
            const keys: string[] = [];
            for (const k in raw) keys.push(k);
            keys.sort();
            fields = keys.join(",");
        }
        let centre: Vector | null = null;
        if (raw.min !== undefined && raw.min !== null && raw.max !== undefined && raw.max !== null) {
            centre = Vector((raw.min.x + raw.max.x) / 2, (raw.min.y + raw.max.y) / 2, raw.min.z);
            box = true;
        } else if (raw.location !== undefined && raw.location !== null) {
            centre = raw.location;
        }
        if (centre === null) continue;
        out.push({ centre, type: `${raw.type}`, team: raw.team, raw });
    }
    if (Utils.DebugMode) print(`CAMPS team=${GetTeam()} n=${out.length} box=${box} fields=${fields}`);
    camps = out;
    return out;
}

// ---------------------------------------------------------------------------------------------
// Stacking

interface StackState {
    camp: Camp | null;
    phase: "none" | "go" | "hit" | "pull";
    minute: number;
    hitAt: number; // second of the minute
    stand: Vector;
    away: Vector;
    lastStack: number;
    neutrals: number;
    lastMove: number;
    hitGame: number; // GameTime() of the hit order (GetLastAttackTime is on the GameTime clock)
}
const states: Record<string, StackState> = {};
const claimed: Record<number, number> = {}; // camp index -> minute it is claimed for

function StateOf(bot: Unit): StackState {
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    let s = states[key];
    if (s === undefined) {
        s = { camp: null, phase: "none", minute: -1, hitAt: 0, stand: Vector(0, 0, 0), away: Vector(0, 0, 0), lastStack: -999, neutrals: 0, lastMove: -999, hitGame: -999 };
        states[key] = s;
    }
    return s;
}

function EnemyNear(loc: Vector, radius: number): boolean {
    return jmz.GetEnemiesNearLoc(loc, radius).length > 0;
}

function Busy(bot: Unit): boolean {
    const mode = bot.GetActiveMode();
    return (
        mode === BotMode.Retreat ||
        mode === BotMode.Attack ||
        mode === BotMode.DefendAlly ||
        mode === BotMode.EvasiveManeuvers ||
        bot.WasRecentlyDamagedByAnyHero(3) ||
        jmz.CanNotUseAction(bot) ||
        bot.IsChanneling()
    );
}

function Toward(from: Vector, to: Vector, distance: number): Vector {
    const d = Math.max(Dist(from, to), 1);
    return Vector(from.x + ((to.x - from.x) / d) * distance, from.y + ((to.y - from.y) / d) * distance, from.z);
}

function End(bot: Unit, s: StackState, result: string): void {
    if (s.camp !== null && Utils.DebugMode) {
        print(
            `STACK team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(DotaTime())} camp=${s.camp.type} result=${result} hitAt=${s.hitAt} neutrals=${s.neutrals}`
        );
    }
    if (result !== "pulled" && result !== "hit") s.lastStack = DotaTime() - STACK_GAP / 2; // try again sooner
    s.camp = null;
    s.phase = "none";
}

function NeutralsAt(bot: Unit, centre: Vector): Unit[] {
    return bot.GetNearbyNeutralCreeps(1600, true).filter(n => jmz.IsValid(n) && Dist(n.GetLocation(), centre) < 700);
}

/** Skip: an ally hero is at the camp (farming it), or an allied unit sees it and it has no neutrals. */
function KnownEmptyOrTaken(bot: Unit, centre: Vector): boolean {
    let seen = false;
    for (const ally of GetUnitList(UnitType.AlliedHeroes)) {
        if (ally === null || ally.IsNull() || !ally.IsAlive()) continue;
        const d = Dist(ally.GetLocation(), centre);
        if (ally !== bot && d < FARMER_RADIUS) return true;
        if (d < SEE_RADIUS) seen = true;
    }
    if (!seen) return false;
    for (const n of GetUnitList(UnitType.NeutralCreeps)) {
        if (n !== null && !n.IsNull() && n.IsAlive() && Dist(n.GetLocation(), centre) < 700) return false;
    }
    return true;
}

/** A lane ally near this bot is facing an enemy hero (laning: do not leave it alone). */
function PartnerPressed(bot: Unit): boolean {
    for (const ally of jmz.GetAlliesNearLoc(bot.GetLocation(), LANING_PARTNER_RADIUS)) {
        if (ally === bot) continue;
        if (EnemyNear(ally.GetLocation(), LANING_PARTNER_ENEMY)) return true;
    }
    return false;
}

/** Pick a camp this minute, if this bot should stack. */
function Plan(bot: Unit, s: StackState, now: number, sec: number, minute: number): boolean {
    const pos = jmz.GetPosition(bot);
    if (pos !== 4 && pos !== 5) return false;
    if (now < STACK_START || sec < PLAN_FROM || sec > 50) return false;
    const gap = jmz.IsInLaningPhase() ? STACK_GAP_LANING : STACK_GAP;
    if (now - s.lastStack < gap) return false;
    if (!bot.IsAlive() || Busy(bot) || jmz.GetHP(bot) < MIN_HP) return false;
    const speed = Math.max(bot.GetCurrentMovementSpeed(), 250);
    const laning = jmz.IsInLaningPhase();
    if (laning && PartnerPressed(bot)) return false;
    const list = Camps();
    let best = -1;
    let bestDist = laning ? LANING_MAX_TRAVEL : MAX_TRAVEL;
    for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.team !== GetTeam() || HIT_SEC[c.type] === undefined) continue;
        if (c.type === "ancient" && bot.GetLevel() < 6) continue;
        if (claimed[i] === minute) continue;
        const d = Dist(bot.GetLocation(), c.centre);
        if (d >= bestDist) continue;
        if ((d * PATH_FACTOR) / speed > HIT_SEC[c.type] - 2 - sec) continue; // cannot get there in time
        if (EnemyNear(c.centre, ENEMY_RADIUS)) continue;
        if (KnownEmptyOrTaken(bot, c.centre)) continue;
        best = i;
        bestDist = d;
    }
    if (best < 0) return false;
    const c = list[best];
    claimed[best] = minute;
    s.camp = c;
    s.phase = "go";
    s.minute = minute;
    s.hitAt = HIT_SEC[c.type];
    // Wait on the side we came from (pathable), and pull back the same way.
    s.stand = Toward(c.centre, bot.GetLocation(), STAND_DIST);
    s.away = Toward(c.centre, bot.GetLocation(), PULL_DIST);
    s.lastStack = now;
    s.neutrals = 0;
    return true;
}

/** HIGH while this bot is stacking a camp (team roam), else 0. */
export function StackDesire(bot: Unit): number {
    const s = StateOf(bot);
    const now = DotaTime();
    const sec = now % 60;
    const minute = Math.floor(now / 60);
    if (s.phase === "none") {
        if (!Plan(bot, s, now, sec, minute)) return 0;
        return DesireTier.HIGH;
    }
    const camp = s.camp as Camp;
    if (!bot.IsAlive() || jmz.GetHP(bot) < MIN_HP - 0.1 || bot.WasRecentlyDamagedByAnyHero(2)) {
        End(bot, s, "danger");
        return 0;
    }
    const atCamp = Dist(bot.GetLocation(), camp.centre) < AT_CAMP;
    if (EnemyNear(camp.centre, 1200) || (atCamp && EnemyNear(bot.GetLocation(), 1200))) {
        End(bot, s, "enemy_near");
        return 0;
    }
    if (minute !== s.minute) {
        // x:00 passed: done (pull phase) or too late.
        End(bot, s, s.phase === "pull" ? "pulled" : "late");
        return 0;
    }
    return DesireTier.HIGH;
}

export function StackActive(bot: Unit): boolean {
    return StateOf(bot).phase !== "none";
}

export function StackThink(bot: Unit): void {
    const s = StateOf(bot);
    if (s.phase === "none" || s.camp === null || jmz.CanNotUseAction(bot)) return;
    const now = DotaTime();
    const sec = now % 60;
    const camp = s.camp;
    (bot as any).laningHoldUntil = now + 1; // waiting at the camp is not being stuck (J.CheckBotIdleState)
    if (s.phase === "go") {
        if (sec >= s.hitAt) {
            const neutrals = NeutralsAt(bot, camp.centre);
            if (neutrals.length === 0) {
                End(bot, s, Dist(bot.GetLocation(), camp.centre) < 900 ? "empty" : "late");
                return;
            }
            s.neutrals = neutrals.length;
            bot.Action_AttackUnit(neutrals[0], true);
            s.hitGame = GameTime();
            s.phase = "hit";
            return;
        }
        if (Dist(bot.GetLocation(), s.stand) > 120 && now - s.lastMove > 0.3) {
            bot.Action_MoveToLocation(s.stand);
            s.lastMove = now;
        }
        return;
    }
    if (s.phase === "hit") {
        // Pull once the attack is out (aggro), or after 1.5 s whatever happened.
        if (bot.GetLastAttackTime() >= s.hitGame || GameTime() - s.hitGame > 1.5) {
            s.phase = "pull";
        } else {
            return;
        }
    }
    if (s.phase === "pull" && now - s.lastMove > 0.3) {
        bot.Action_MoveToLocation(s.away);
        s.lastMove = now;
    }
}
