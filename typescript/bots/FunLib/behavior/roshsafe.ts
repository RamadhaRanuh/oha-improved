/**
 * Roshan without wipes (flag `roshsafe`, with `group`).
 *
 * Analyst, 190 games: after 30:00 the new team died 230 times in Roshan mode (plain OHA 21), with 13
 * wipes at the pit (3+ deaths in mode 20 within 40 s), each about -5.7k gold. Roshan itself kills them:
 * no enemy heroes near, heroes stay in mode 20 at 5-25% hp for 7+ s, because mode_roshan's
 * "Roshan under half" bid is RemapValClamped(roshHP, 100, 0, MODERATE, ABSOLUTE), about 1.0 whatever
 * the hero's hp, and retreat (0.4-0.6) never beats it. So, from mode_roshan_generic's GetDesire:
 *   - lowhp: a hero under LOW_HP bids 0 for Roshan (retreat takes over), unless Roshan is under
 *     FINISH_ROSH_HP and the hero above FINISH_HP (finish it, the Aegis is one more hit-window away).
 *   - abort: the team gives up the attempt for ABORT_TIME s when it is failing: in mode 20 at the pit
 *     for more than SLOW_TIME s with Roshan still above SLOW_ROSH_HP (abort_slow), or ABORT_DEATHS
 *     allies died in mode 20 at the pit during this attempt (abort_deaths). The same finish exception holds.
 * The stricter damage check (60 s instead of 90 s) is in mode_roshan_generic's TeamHasRoshanDPS.
 *
 * Team state lives here because required modules are shared by a team's bots (one VM per team);
 * the mode file is per bot.
 *
 * Debug (Utils.DebugMode), at most once per LOG_GAP s per hero:
 *   ROSHSAFE team=2 hero=npc_dota_hero_axe t=2345 why=lowhp hp=0.23 roshhp=0.61
 * and one line per abort:
 *   ROSHSAFE team=2 t=2345 abort why=abort_deaths dur=21 deaths=2 roshhp=0.44
 */
import { BotMode, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";

const LOW_HP = 0.4; // tunable
const FINISH_ROSH_HP = 0.15;
const FINISH_HP = 0.2;
const PIT_RADIUS = 1200; // a hero in mode 20 this close to a Roshan pit is at the pit
const ATTEMPT_GAP = 10; // the attempt ends when nobody was in mode 20 at the pit for this long
const DEATH_WINDOW = 3; // a death counts when the hero was in mode 20 at the pit this recently
const SLOW_TIME = 40;
const SLOW_ROSH_HP = 0.5;
const ABORT_DEATHS = 2;
const ABORT_TIME = 60;
const ROSH_HP_FRESH = 3; // Roshan's hp is known when a bot saw it this recently
const UPDATE_GAP = 0.2;
const LOG_GAP = 5;
export const DPS_LOG_GAP = 30; // the `dps` line, per team

let updatedAt = -999;
let attemptStart = -1;
let lastAtPit = -999;
let deaths = 0;
let abortUntil = -999;
let abortWhy = "";
let roshHp = 1;
let roshHpAt = -999;
let dpsLogAt = -999;
const inRoshan: Record<number, number> = {}; // player id -> last time alive in mode 20 at the pit
const wasAlive: Record<number, boolean> = {};
const logAt: Record<string, number> = {};

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function AtPit(u: Unit): boolean {
    const loc = u.GetLocation();
    return Dist(loc, Utils.RadiantRoshanLoc) <= PIT_RADIUS || Dist(loc, Utils.DireRoshanLoc) <= PIT_RADIUS;
}

/** Roshan's hp fraction when a bot of ours saw it within ROSH_HP_FRESH s, else -1. */
function KnownRoshHp(now: number): number {
    return now - roshHpAt <= ROSH_HP_FRESH ? roshHp : -1;
}

function EndAttempt(): void {
    attemptStart = -1;
    deaths = 0;
}

function Update(now: number): void {
    if (now - updatedAt < UPDATE_GAP) return;
    updatedAt = now;

    let any = false;
    const ids = GetTeamPlayers(GetTeam());
    for (const ally of GetUnitList(UnitType.AlliedHeroes)) {
        if (ally === null || ally.IsNull() || !ally.IsAlive() || ally.IsIllusion()) continue;
        if (ally.GetActiveMode() === BotMode.Roshan && AtPit(ally)) {
            inRoshan[ally.GetPlayerID()] = now;
            any = true;
        }
    }
    for (const id of ids) {
        const alive = IsHeroAlive(id);
        if (!alive && wasAlive[id] === true && attemptStart >= 0 && now - (inRoshan[id] ?? -999) <= DEATH_WINDOW) {
            deaths++;
        }
        wasAlive[id] = alive;
    }

    if (!jmz.IsRoshanAlive()) {
        EndAttempt();
        return;
    }
    if (any) {
        if (attemptStart < 0) {
            attemptStart = now;
            deaths = 0;
        }
        lastAtPit = now;
    } else if (attemptStart >= 0 && now - lastAtPit > ATTEMPT_GAP) {
        EndAttempt();
        return;
    }
    if (attemptStart < 0) return;

    const rhp = KnownRoshHp(now);
    let why = "";
    if (deaths >= ABORT_DEATHS) why = "abort_deaths";
    else if (now - attemptStart > SLOW_TIME && rhp > SLOW_ROSH_HP) why = "abort_slow";
    if (why === "") return;
    abortUntil = now + ABORT_TIME;
    abortWhy = why;
    if (Utils.DebugMode) {
        print(`ROSHSAFE team=${GetTeam()} t=${Math.floor(now)} abort why=${why} dur=${Math.floor(now - attemptStart)} deaths=${deaths} roshhp=${rhp.toFixed(2)}`);
    }
    EndAttempt();
}

/** One trace line, at most once per LOG_GAP s per hero. */
export function Log(bot: Unit, why: string, now: number): void {
    if (!Utils.DebugMode) return;
    const name = bot.GetUnitName();
    if (now - (logAt[name] ?? -999) < LOG_GAP) return;
    logAt[name] = now;
    print(`ROSHSAFE team=${GetTeam()} hero=${name} t=${Math.floor(now)} why=${why} hp=${jmz.GetHP(bot).toFixed(2)} roshhp=${KnownRoshHp(now).toFixed(2)}`);
}

/** The `dps` line: once per DPS_LOG_GAP s per team (and LOG_GAP per hero). */
export function LogDps(bot: Unit): void {
    const now = DotaTime();
    if (now - dpsLogAt < DPS_LOG_GAP) return;
    dpsLogAt = now;
    Log(bot, "dps", now);
}

/**
 * mode_roshan_generic's desire after the roshsafe rules. Called every frame from each bot's GetDesire
 * (that also keeps the team state current). `roshan`: the bot's Roshan handle, or nil.
 */
export function Filter(bot: Unit, desire: number, roshan: Unit | undefined): number {
    const now = DotaTime();
    if (roshan !== undefined && Utils.IsValidUnit(roshan)) {
        roshHp = roshan.GetHealth() / roshan.GetMaxHealth();
        roshHpAt = now;
    }
    Update(now);
    if (desire <= 0) return desire;

    const hp = jmz.GetHP(bot);
    const rhp = KnownRoshHp(now);
    const finish = rhp >= 0 && rhp < FINISH_ROSH_HP && hp > FINISH_HP;
    if (finish) return desire;
    if (now < abortUntil) {
        Log(bot, abortWhy, now);
        return 0;
    }
    if (hp < LOW_HP) {
        Log(bot, "lowhp", now);
        return 0;
    }
    return desire;
}
