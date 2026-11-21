/**
 * Laning last hits and denies (flag `lasthit`), called from mode_team_roam_generic in place of its old
 * last-hit grab (X.GetLastHitCreep) before ACTIVE_UNTIL.
 *
 * Why (cs-match-rel-miss, 8 games, release flags both teams): carries took 27% of their lane's creeps at
 * 10:00 (21 last hits; 69 alone in a drill). Of the creeps that died within 1000 of a carry to creeps or
 * towers, 71% died while the carry attacked nothing, mostly within 400 and above 70% health; 26% (mid: 41%)
 * were killed by a tower. The old grab fired only once a creep was already killable within the attack delay,
 * counted only lane creeps' swings (no tower shots, no hero attacks), shaded its margins by hero level, and
 * never denied.
 *
 * Kept 2026-11-21 (16 fixed lineups, 5v5, release flags with vs without, at 10:00): last hits +2.4 per hero
 * (+1.8 ± 1.2 on games 1-8, +3.0 ± 0.9 on games 9-16), denies +5.8; solo mid drill +4.5 ± 1.8, denies +11.5.
 *
 * The bot script runs only every 0.15-0.4 s (GetDesire about 3 times a game second, at timescale 1 and 8), so
 * Desire keeps team roam active and Think plans again on each call. Per call and bot:
 *   - A damage timeline per creep: attack projectiles in flight, and the wind-up and following swings of every
 *     visible lane creep, tower and hero whose attack target is that creep.
 *   - Our hit time: walk into range, attack cooldown, wind-up, projectile. Our damage: attack damage minus half
 *     the base variance, plus Quelling Blade, after armor.
 *   - hit:    the creep's predicted health when our hit lands is in (0, our damage]: attack it once, and keep
 *             the order until the attack is released.
 *   - sched:  that window opens before the next call: Action_Delay(delay) then ActionQueue_AttackUnit, timed to
 *             land just after the hit that opens it.
 *   - deny:   the same on an own creep below 50% health.
 *   - hold:   the creep will be killable within HOLD_AHEAD s: step into attack range and wait, attacking nothing.
 *   - cancel: our issued hit would land while the creep still has more than our damage (it would survive).
 *             No cancel when it would die first: the engine drops that attack for free, and a wrong
 *             prediction still gets the creep.
 * Bids: HIT_DESIRE 0.9 / HOLD_DESIRE 0.7, passed by team roam past its laning-phase cap (0.72) and by arbiter past
 * persona / mood scaling (both had let laning or harass win a timed hit).
 * Supports leave enemy creeps to a core within CORE_NEAR of the creep (they still deny). Next to an enemy tower
 * only while the tower shoots a creep and we are above TOWER_HP health. No hold while retreating or
 * outnumbered near the creep; while retreating only a hit that needs no walk, above RETREAT_HP health.
 *
 * Debug (Utils.DebugMode), once a minute per hero:
 *   LASTHIT team=2 hero=npc_dota_hero_juggernaut t=360 hit=14 deny=6 hold=22 cancel=3 sched=9 desires=1200 thinks=250 gap=0.30
 *   LHBID   team=2 hero=... t=360 won=410 lost_m2=12   (did the bid win the next call; lost_m<mode>)
 *   LHWHY   team=2 hero=... t=360 got@roam=10 lost_released@lane=4 support@lane=7 ...
 *           (each enemy lane creep that died within SCAN_RANGE, by its last reason @ the bot's mode at the death:
 *           got; lost_<stage> for a creep we chose (chosen, walk, fired, cancel, released); else why it was
 *           skipped (support, tower, teamfight, busy, retreat, dying, not_soon, hold, ...), win_ when it had been
 *           killable at some call)
 * and per hit / deny order, once its outcome is known (pred = predicted seconds to land, point = seconds from
 * the order to our damage point, left = predicted health when our hit lands, res = got | alive | lost; kind
 * sched_* for a queued hit):
 *   LHPRED team=2 hero=... t=361.2 act=hit kind=melee pred=0.62 point=0.41 left=31 dmg=44 hp0=88 res=got
 * and per cancel:
 *   LHCANCEL team=2 hero=... t=361.2 why=early land=0.20 left=60 dmg=44
 */
import { BotMode, DamageType, Unit, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";

const ACTIVE_UNTIL = 12 * 60;
const SCAN_RANGE = 1000; // creeps within this of the bot are candidates
const ATTACKER_RANGE = 1600; // units within this of the bot can be attacking a candidate
const HOLD_AHEAD = 1.5; // hold when the creep becomes killable within this many s after our hit could land
const HP_MARGIN = 1; // our damage must beat the predicted health by this
const ATTACK_ACTIVITY = 1503;
const TOWER_NEAR = 900; // a creep this close to an enemy tower is "at the tower"
const TOWER_HP = 0.5;
const RETREAT_HP = 0.5;
const DANGER_HP = 0.3;
const DANGER_RANGE = 800;
const CORE_NEAR = 900;
const DENY_HP = 0.5;
// Bids as the engine sees them: mode_team_roam_generic passes a last-hit bid past its laning-phase cap (0.72) and
// arbiter passes it past persona / mood scaling. Above laning, harass and farm; below a serious retreat.
const HIT_DESIRE = 0.9;
// The bot script runs only every 0.15-0.35 s (GetDesire ~3 a second, Think ~4-6 while active), so a hit whose
// window opens before the next run is queued: Action_Delay(delay) then ActionQueue_AttackUnit, which the engine
// plays every frame. Look this far ahead (s) beyond the measured run gap.
const SCHED_EXTRA = 0.15;
const HOLD_DESIRE = 0.7;
const LOG_GAP = 60;

type Act = "hit" | "deny" | "sched" | "keep" | "hold" | "cancel";
interface Plan {
    act: Act;
    creep: Unit;
    left?: number;
    delay?: number; // sched: seconds to wait before the attack order
    deny?: boolean; // sched: an own creep
}
interface Pending {
    creep: Unit;
    act: Act;
    t0: number;
    pred: number;
    left: number;
    dmg: number;
    hp0: number;
    atk0: number;
    count0: number;
    point: number;
    kind: string;
}
interface Stats {
    hit: number;
    deny: number;
    hold: number;
    cancel: number;
    sched: number;
    bidWon: number;
    bidLost: Record<string, number>;
    desires: number;
    thinks: number;
    logAt: number;
    lastAct: string;
}

// Keyed by player id: required modules are shared by a team's bots.
const plans: Record<number, Plan | undefined> = {};
const stats: Record<number, Stats> = {};
const pending: Record<number, Pending | undefined> = {};
// An issued hit / deny, kept until our attack is released (GetLastAttackTime passes atk0) or it can no longer land.
interface Commit {
    creep: Unit;
    act: Act;
    t0: number;
    land: number;
    atk0: number;
}
const commits: Record<number, Commit | undefined> = {};
// The last creep we held for, to log it when it dies without our hit.
interface HoldTrack {
    creep: Unit;
    left: number;
    dmg: number;
    land: number;
    at: number;
    kind: string;
}
const holds: Record<number, HoldTrack | undefined> = {};

// Why each nearby enemy creep was not taken (LHWHY): the last reason Desire gave for it, counted when it dies.
interface Why {
    creep: Unit;
    reason: string;
    at: number;
    window: boolean; // at some call it was killable by our hit (hit or sched), chosen or not
    lh0: number; // our last hits when it was last chosen ("mine")
    stage: string; // for a chosen creep, how far we got: chosen | walk | fired | released | cancel
}

function Stage(bot: Unit, creep: Unit, stage: string): void {
    if (!Utils.DebugMode) return;
    const w = (whys[bot.GetPlayerID()] || {})[tostring(creep)];
    if (w === undefined) return;
    const order = ["chosen", "walk", "fired", "cancel", "released"];
    if (order.indexOf(stage) > order.indexOf(w.stage)) w.stage = stage;
}
const whys: Record<number, Record<string, Why>> = {};
const whyCounts: Record<number, Record<string, number>> = {};
const lastCall: Record<number, number> = {};


function Note(bot: Unit, creep: Unit, reason: string): void {
    if (!Utils.DebugMode) return;
    const id = bot.GetPlayerID();
    if (whys[id] === undefined) whys[id] = {};
    const key = tostring(creep);
    const old = whys[id][key];
    // Once chosen, it stays "mine" (our own projectile in flight would otherwise read as "dying").
    if (old !== undefined && old.reason === "mine" && reason !== "mine" && GameTime() - old.at < 2) return;
    whys[id][key] = {
        creep,
        reason,
        at: GameTime(),
        window: old !== undefined && old.window,
        lh0: reason === "mine" ? bot.GetLastHits() : -1,
        stage: old !== undefined && old.reason === "mine" ? old.stage : "chosen",
    };
}

function MarkWindow(bot: Unit, creep: Unit): void {
    if (!Utils.DebugMode) return;
    const id = bot.GetPlayerID();
    if (whys[id] === undefined) whys[id] = {};
    const key = tostring(creep);
    if (whys[id][key] === undefined) whys[id][key] = { creep, reason: "other", at: GameTime(), window: true, lh0: -1, stage: "chosen" };
    else whys[id][key].window = true;
}

const MODE_NAMES: Record<number, string> = { 1: "lane", 2: "attack", 4: "retreat", 7: "rune", 16: "roam", 17: "farm", 19: "evasive", 28: "watcher" };

function NoteAll(bot: Unit, reason: string): void {
    if (!Utils.DebugMode) return;
    for (const c of bot.GetNearbyLaneCreeps(SCAN_RANGE, true)) Note(bot, c, reason);
}

// Counts the reasons of noted creeps that died, as reason@mode (the bot's active mode at the death). A creep that
// was killable by our hit at some call but was not taken is "win_<last reason>". A run much later than usual: "gap".
function TrackDeaths(bot: Unit): void {
    if (!Utils.DebugMode) return;
    const id = bot.GetPlayerID();
    const now = GameTime();
    const gap = lastCall[id] !== undefined && now - lastCall[id] > Math.max(0.6, 2 * GapOf(bot));
    lastCall[id] = now;
    const lh = bot.GetLastHits();
    const list = whys[id];
    if (list === undefined) return;
    if (whyCounts[id] === undefined) whyCounts[id] = {};
    const counts = whyCounts[id];
    for (const key in list) {
        const w = list[key];
        if (jmz.IsValid(w.creep) && w.creep.IsAlive()) {
            if (now - w.at > 2) delete list[key];
            continue;
        }
        delete list[key];
        let r = gap ? "gap" : w.window && w.reason !== "mine" ? `win_${w.reason}` : w.reason;
        if (w.reason === "mine") r = lh > w.lh0 ? "got" : `lost_${w.stage}`;
        const m = bot.GetActiveMode();
        r = `${r}@${MODE_NAMES[m] || `m${m}`}`;
        counts[r] = (counts[r] || 0) + 1;
    }
}

function CheckHold(bot: Unit): void {
    const id = bot.GetPlayerID();
    const h = holds[id];
    if (h === undefined) return;
    if (jmz.IsValid(h.creep) && h.creep.IsAlive()) return;
    holds[id] = undefined;
    if (!Utils.DebugMode) return;
    print(
        `LHHOLDMISS team=${GetTeam()} hero=${bot.GetUnitName()} t=${string.format("%.1f", DotaTime())} kind=${h.kind}` +
            ` left=${Math.floor(h.left)} dmg=${Math.floor(h.dmg)} land=${string.format("%.2f", h.land)} age=${string.format("%.2f", DotaTime() - h.at)}`
    );
}

function KindOf(creep: Unit): string {
    const n = creep.GetUnitName();
    if (string.find(n, "siege")[0] !== undefined) return "siege";
    if (string.find(n, "ranged")[0] !== undefined) return "ranged";
    return "melee";
}

// Resolves the pending order of `bot` once its outcome is known, with an LHPRED line.
function CheckPending(bot: Unit): void {
    const id = bot.GetPlayerID();
    const p = pending[id];
    if (p === undefined) return;
    const now = GameTime();
    if (p.point < 0 && bot.GetLastAttackTime() > p.atk0) p.point = bot.GetLastAttackTime() - p.t0;
    const count = p.act === "deny" ? bot.GetDenies() : bot.GetLastHits();
    const got = count > p.count0;
    const alive = jmz.IsValid(p.creep) && p.creep.IsAlive();
    if (!got && alive && now < p.t0 + p.pred + 0.6) return;
    pending[id] = undefined;
    if (!Utils.DebugMode) return;
    const res = got ? "got" : alive ? "alive" : "lost";
    print(
        `LHPRED team=${GetTeam()} hero=${bot.GetUnitName()} t=${string.format("%.1f", DotaTime())} act=${p.act} kind=${p.kind}` +
            ` pred=${string.format("%.2f", p.pred)} point=${string.format("%.2f", p.point)} left=${Math.floor(p.left)} dmg=${Math.floor(p.dmg)} hp0=${p.hp0} res=${res}`
    );
}

function Rate(u: Unit): number {
    let a = u.GetAttackSpeed();
    if (a > 10) a = a / 100; // some units report percent
    return Math.max(0.2, a);
}

function IsRanged(u: Unit): boolean {
    return u.IsTower() || u.GetAttackRange() > 300;
}

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function InWindup(u: Unit): boolean {
    return u.GetAnimActivity() === ATTACK_ACTIVITY && u.GetAnimCycle() < u.GetAttackPoint();
}

/** Times (s from now) and damage of the hits coming at `creep` within `horizon` s. */
function Timeline(creep: Unit, attackers: Unit[], horizon: number): [number, number][] {
    const out: [number, number][] = [];
    const now = GameTime();
    const loc = creep.GetLocation();
    for (const p of creep.GetIncomingTrackingProjectiles()) {
        if (!p.is_attack || p.caster === null || p.caster === undefined || !p.caster.CanBeSeen()) continue;
        const t = Dist(p.location, loc) / Math.max(300, p.caster.GetAttackProjectileSpeed());
        if (t <= horizon) out.push([t, creep.GetActualIncomingDamage(p.caster.GetAttackDamage(), DamageType.Physical)]);
    }
    for (const a of attackers) {
        if (a.GetAttackTarget() !== creep) continue;
        const dmg = creep.GetActualIncomingDamage(a.GetAttackDamage(), DamageType.Physical);
        const rate = Rate(a);
        const ap = a.GetAttackPoint() / rate;
        const spa = Math.max(0.3, a.GetSecondsPerAttack());
        const travel = IsRanged(a) ? Math.max(0, GetUnitToUnitDistance(a, creep) - 30) / Math.max(300, a.GetAttackProjectileSpeed()) : 0;
        // Damage point of the next swing: the current wind-up, or one attack period after the last damage point.
        let swing = InWindup(a) ? (a.GetAttackPoint() - a.GetAnimCycle()) / rate : Math.max(ap, a.GetLastAttackTime() + spa - now);
        while (swing + travel <= horizon) {
            out.push([swing + travel, dmg]);
            swing += spa;
        }
    }
    return out;
}

/** Predicted health at `t` s from now, counting the hits that land before `t`. */
function HealthAt(creep: Unit, events: [number, number][], t: number): number {
    let hp = creep.GetHealth() + creep.GetHealthRegen() * t;
    for (const [at, dmg] of events) if (at < t) hp -= dmg;
    return hp;
}

/** Seconds until our hit on `creep` lands, and whether we must walk first. */
function OurHitTime(bot: Unit, creep: Unit): [number, boolean] {
    const rate = Rate(bot);
    const ap = bot.GetAttackPoint() / rate;
    const reach = bot.GetAttackRange() + 40;
    const d = GetUnitToUnitDistance(bot, creep);
    const travel = IsRanged(bot) ? Math.max(0, Math.min(d, reach) - 30) / Math.max(300, bot.GetAttackProjectileSpeed()) : 0;
    const walk = Math.max(0, d - reach) / Math.max(200, bot.GetCurrentMovementSpeed());
    const ready = Math.max(0, bot.GetLastAttackTime() - ap + bot.GetSecondsPerAttack() - GameTime());
    return [Math.max(walk, ready) + 0.05 + ap + travel, walk > 0];
}

/** Our attack timing on `creep`: seconds until we may swing (cooldown), walk time, and swing-to-land time. */
function OurTiming(bot: Unit, creep: Unit): [number, number, number] {
    const rate = Rate(bot);
    const ap = bot.GetAttackPoint() / rate;
    const reach = bot.GetAttackRange() + 40;
    const d = GetUnitToUnitDistance(bot, creep);
    const travel = IsRanged(bot) ? Math.max(0, Math.min(d, reach) - 30) / Math.max(300, bot.GetAttackProjectileSpeed()) : 0;
    const walk = Math.max(0, d - reach) / Math.max(200, bot.GetCurrentMovementSpeed());
    const ready = Math.max(0, bot.GetLastAttackTime() - ap + bot.GetSecondsPerAttack() - GameTime());
    return [ready, walk, 0.05 + ap + travel];
}

// Measured gap between runs of this bot's script (Desire or Think), for how far ahead to queue a hit.
const runAt: Record<number, number> = {};
const runGap: Record<number, number> = {};
function NoteRun(bot: Unit): void {
    const id = bot.GetPlayerID();
    const now = GameTime();
    const prev = runAt[id];
    runAt[id] = now;
    if (prev === undefined || now - prev <= 0 || now - prev > 1) return;
    runGap[id] = runGap[id] === undefined ? now - prev : 0.8 * runGap[id] + 0.2 * (now - prev);
}
function GapOf(bot: Unit): number {
    const g = runGap[bot.GetPlayerID()];
    return g === undefined ? 0.3 : Math.min(0.5, Math.max(0.03, g));
}

function OurDamage(bot: Unit, creep: Unit): number {
    let dmg = bot.GetAttackDamage() - 0.5 * bot.GetBaseDamageVariance();
    const qb = bot.FindItemSlot("item_quelling_blade");
    if (qb >= 0 && bot.GetItemSlotType(qb) === 0) dmg += IsRanged(bot) ? 4 : 8;
    return creep.GetActualIncomingDamage(dmg, DamageType.Physical);
}

function CountNear(units: Unit[], loc: Vector, radius: number): number {
    let n = 0;
    for (const u of units) if (jmz.IsValidHero(u) && Dist(u.GetLocation(), loc) <= radius) n++;
    return n;
}

function StatsOf(bot: Unit): Stats {
    const id = bot.GetPlayerID();
    if (stats[id] === undefined) stats[id] = { hit: 0, deny: 0, hold: 0, cancel: 0, sched: 0, bidWon: 0, bidLost: {}, desires: 0, thinks: 0, logAt: DotaTime(), lastAct: "" };
    return stats[id];
}

function Log(bot: Unit): void {
    if (!Utils.DebugMode) return;
    const s = StatsOf(bot);
    if (DotaTime() - s.logAt < LOG_GAP) return;
    s.logAt = DotaTime();
    print(`LASTHIT team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(DotaTime())} hit=${s.hit} deny=${s.deny} hold=${s.hold} cancel=${s.cancel} sched=${s.sched} desires=${s.desires} thinks=${s.thinks} gap=${string.format("%.2f", GapOf(bot))}`);
    let lost = "";
    for (const k in s.bidLost) lost += ` lost_${k}=${s.bidLost[k]}`;
    print(`LHBID team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(DotaTime())} won=${s.bidWon}${lost}`);
    const counts = whyCounts[bot.GetPlayerID()];
    if (counts !== undefined) {
        let text = "";
        for (const k in counts) text += ` ${k}=${counts[k]}`;
        print(`LHWHY team=${GetTeam()} hero=${bot.GetUnitName()} t=${Math.floor(DotaTime())}${text}`);
    }
}

/**
 * The smallest delay (s) after which an attack order on `creep` lands with its health in (0, our damage], within the
 * next run gap plus SCHED_EXTRA; -1 when there is none. Candidate delays are just after each hit on the timeline.
 */
function SchedDelay(bot: Unit, creep: Unit, events: [number, number][], dmg: number, deny: boolean): number {
    const [ready, , swing] = OurTiming(bot, creep);
    const ahead = GapOf(bot) + SCHED_EXTRA;
    let best = -1;
    for (const [at] of events) {
        const delay = at - swing + 0.02;
        if (delay <= 0 || delay > ahead || (best >= 0 && delay >= best)) continue;
        const land = Math.max(delay, ready) + swing;
        const left = HealthAt(creep, events, land);
        if (left <= 0 || left + HP_MARGIN > dmg) continue;
        if (deny && HealthAt(creep, events, delay) / Math.max(1, creep.GetMaxHealth()) >= DENY_HP) continue;
        best = delay;
    }
    return best;
}

/**
 * Plans for this moment: sets plans[id] and returns the bid (0: nothing to do). The engine polls GetDesire only
 * about 3 times a game second (ROAMSUB counts, timescale 1 and 8 alike), shorter than many last-hit windows, so
 * Desire only keeps team roam active while a creep is near its window and Think plans again on every call.
 */
function MakePlan(bot: Unit): number {
    const id = bot.GetPlayerID();
    plans[id] = undefined;
    CheckPending(bot);
    const t = DotaTime();
    if (t < 0 || t >= ACTIVE_UNTIL || !bot.IsAlive()) return 0;
    TrackDeaths(bot);
    Log(bot);
    if (bot.IsUsingAbility() || bot.IsChanneling() || bot.IsDisarmed()) {
        NoteAll(bot, "busy");
        return 0;
    }
    if (jmz.IsInTeamFight(bot, 1200)) {
        NoteAll(bot, "teamfight");
        return 0;
    }

    const hp = jmz.GetHP(bot);
    const enemies = bot.GetNearbyHeroes(ATTACKER_RANGE, true, BotMode.None);
    const allies = bot.GetNearbyHeroes(ATTACKER_RANGE, false, BotMode.None);
    if (hp < DANGER_HP && CountNear(enemies, bot.GetLocation(), DANGER_RANGE) > 0) {
        NoteAll(bot, "danger");
        return 0;
    }
    const retreating = jmz.IsRetreating(bot);
    if (retreating && hp < RETREAT_HP) {
        NoteAll(bot, "retreat");
        return 0;
    }

    const enemyCreeps = bot.GetNearbyLaneCreeps(ATTACKER_RANGE, true);
    const ownCreeps = bot.GetNearbyLaneCreeps(ATTACKER_RANGE, false);
    const enemyTowers = bot.GetNearbyTowers(ATTACKER_RANGE, true);
    const ownTowers = bot.GetNearbyTowers(ATTACKER_RANGE, false);
    const attackers: Unit[] = [];
    for (const list of [enemyCreeps, ownCreeps, enemyTowers, ownTowers, enemies, allies])
        for (const u of list) if (u !== bot && u.CanBeSeen() && u.IsAlive()) attackers.push(u);
    const isCore = jmz.IsCore(bot);

    // An issued hit: keep it until the attack is released; cancel only when it clearly cannot kill.
    CheckHold(bot);
    const c = commits[id];
    if (c !== undefined && GameTime() < c.t0 && jmz.IsValid(c.creep) && c.creep.IsAlive()) {
        // A queued attack that has not fired yet: keep the queue while our hit would still land in the window.
        const wait = c.t0 - GameTime();
        const at = wait + c.land;
        const left = HealthAt(c.creep, Timeline(c.creep, attackers, at + 0.1), at);
        if (left > 0 && left + HP_MARGIN <= OurDamage(bot, c.creep)) {
            plans[id] = { act: "keep", creep: c.creep };
            if (c.act === "hit") Note(bot, c.creep, "mine"); // a deny is not a last hit (LHWHY counts enemy creeps)
            return HIT_DESIRE;
        }
        commits[id] = undefined;
        pending[id] = undefined;
    } else if (c !== undefined) {
        const now = GameTime();
        const released = bot.GetLastAttackTime() > c.atk0 + 0.001;
        if (released && jmz.IsValid(c.creep)) Stage(bot, c.creep, "released");
        if (released || !jmz.IsValid(c.creep) || !c.creep.IsAlive() || now > c.t0 + c.land + 0.3) {
            commits[id] = undefined;
        } else {
            const remaining = Math.max(0.02, c.t0 + c.land - now);
            const left = HealthAt(c.creep, Timeline(c.creep, attackers, remaining + 0.1), remaining);
            const dmg = OurDamage(bot, c.creep);
            // Cancel only when it would survive our hit. A creep that dies first just drops our attack (no cooldown), and if
            // the prediction was wrong the hit still gets it ("late" cancels lost 9-13% of the creeps near cores, cs-why5).
            if (left > dmg + Math.max(5, 0.25 * dmg)) {
                commits[id] = undefined;
                pending[id] = undefined;
                plans[id] = { act: "cancel", creep: c.creep };
                Stage(bot, c.creep, "cancel");
                if (Utils.DebugMode)
                    print(
                        `LHCANCEL team=${GetTeam()} hero=${bot.GetUnitName()} t=${string.format("%.1f", DotaTime())} why=${left > 0 ? "early" : "late"}` +
                            ` land=${string.format("%.2f", remaining)} left=${Math.floor(left)} dmg=${Math.floor(dmg)}`
                    );
                return HIT_DESIRE;
            }
            plans[id] = { act: c.act, creep: c.creep };
            NoteAll(bot, c.act === "deny" ? "busy_deny" : "busy_commit");
            if (c.act === "hit") Note(bot, c.creep, "mine");
            return HIT_DESIRE;
        }
    }

    let best: Plan | undefined = undefined;
    let bestRank = 99;
    let bestDist = 99999;
    const consider = (creep: Unit, deny: boolean): void => {
        const note = (r: string): void => {
            if (!deny) Note(bot, creep, r);
        };
        if (!jmz.IsValid(creep) || !jmz.CanBeAttacked(creep)) return; // includes a creep that just died
        const d = GetUnitToUnitDistance(bot, creep);
        if (d > SCAN_RANGE) return;
        const loc = creep.GetLocation();
        if (deny && creep.GetHealth() / Math.max(1, creep.GetMaxHealth()) >= DENY_HP + 0.15) return;
        if (!deny && !isCore) {
            for (const a of allies)
                if (a !== bot && jmz.IsValidHero(a) && jmz.IsCore(a) && Dist(a.GetLocation(), loc) <= CORE_NEAR) return note("support");
        }
        for (const tw of enemyTowers) {
            if (!tw.IsAlive() || Dist(tw.GetLocation(), loc) > TOWER_NEAR) continue;
            const shot = tw.GetAttackTarget();
            if (hp < TOWER_HP || shot === null || shot === undefined || shot === bot || shot.IsHero()) return note("tower");
        }
        const [land, walk] = OurHitTime(bot, creep);
        if (retreating && walk) return note("retreat_walk");
        const outnumbered = CountNear(enemies, loc, 1000) > CountNear(allies, loc, 1000);
        if (walk && outnumbered) return note("out_walk");
        const events = Timeline(creep, attackers, land + HOLD_AHEAD);
        const dmg = OurDamage(bot, creep);
        const left = HealthAt(creep, events, land);
        if (left <= 0) return note(walk ? "dying_walk" : OurTiming(bot, creep)[0] > 0.05 ? "dying_cd" : "dying");
        let rank: number;
        let act: Act;
        if (left + HP_MARGIN <= dmg) {
            if (deny && creep.GetHealth() / Math.max(1, creep.GetMaxHealth()) >= DENY_HP) return; // not deniable yet
            act = deny ? "deny" : "hit";
            if (!deny) MarkWindow(bot, creep);
            rank = deny ? 1 : 0;
        } else if (!walk && (best === undefined || bestRank > (deny ? 1.5 : 0.5)) && SchedDelay(bot, creep, events, dmg, deny) >= 0) {
            act = "sched";
            if (!deny) MarkWindow(bot, creep);
            rank = deny ? 1.5 : 0.5;
        } else {
            if (retreating) return note("hold_retreat");
            if (outnumbered) return note("hold_out");
            if (HealthAt(creep, events, land + HOLD_AHEAD) > dmg) return note("not_soon");
            act = "hold";
            rank = deny ? 3 : 2;
        }
        note("other");
        if (rank < bestRank || (rank === bestRank && d < bestDist)) {
            best = { act, creep, left, deny };
            if (act === "sched") best.delay = SchedDelay(bot, creep, events, dmg, deny);
            bestRank = rank;
            bestDist = d;
        }
    };
    for (const c of enemyCreeps) consider(c, false);
    for (const c of ownCreeps) consider(c, true);
    if (best === undefined) return 0;
    plans[id] = best;
    const chosen = best as Plan;
    if (chosen.act === "hit" || (chosen.act === "sched" && chosen.deny !== true)) {
        Note(bot, chosen.creep, "mine");
        if (OurHitTime(bot, chosen.creep)[1]) Stage(bot, chosen.creep, "walk");
    }
    else if (chosen.act === "hold") Note(bot, chosen.creep, "hold");
    else NoteAll(bot, "deny_chosen");
    if (chosen.act === "hold") {
        const [land] = OurHitTime(bot, chosen.creep);
        holds[id] = { creep: chosen.creep, left: chosen.left === undefined ? -1 : chosen.left, dmg: OurDamage(bot, chosen.creep), land, at: DotaTime(), kind: KindOf(chosen.creep) };
    } else if (holds[id] !== undefined && holds[id]!.creep === chosen.creep) {
        holds[id] = undefined;
    }
    return (best as Plan).act === "hold" ? HOLD_DESIRE : HIT_DESIRE;
}

const lastBid: Record<number, number | undefined> = {};

/** The bid for team roam (0 when there is nothing to do). */
export function Desire(bot: Unit): number {
    const s = StatsOf(bot);
    s.desires++;
    NoteRun(bot);
    // Did the previous bid win? (the engine picks the mode between GetDesire calls)
    const id = bot.GetPlayerID();
    if (lastBid[id] !== undefined && lastBid[id]! > 0) {
        const m = bot.GetActiveMode();
        if (m === BotMode.TeamRoam) s.bidWon++;
        else s.bidLost[`m${m}`] = (s.bidLost[`m${m}`] || 0) + 1;
    }
    const bid = MakePlan(bot);
    lastBid[id] = bid;
    return bid;
}

/** Plans again for this frame and acts on it. */
export function Think(bot: Unit): void {
    StatsOf(bot).thinks++;
    NoteRun(bot);
    MakePlan(bot);
    const plan = plans[bot.GetPlayerID()];
    if (plan === undefined || !jmz.IsValid(plan.creep)) return;
    const s = StatsOf(bot);
    const creep = plan.creep;
    if (plan.act === "keep") return; // a queued attack is waiting; leave the queue alone
    if (plan.act === "sched") {
        const delay = plan.delay === undefined ? 0 : plan.delay;
        const [ready, , swing] = OurTiming(bot, creep);
        bot.Action_Delay(delay);
        bot.ActionQueue_AttackUnit(creep, true);
        Stage(bot, creep, "fired");
        const id = bot.GetPlayerID();
        commits[id] = { creep, act: plan.deny === true ? "deny" : "hit", t0: GameTime() + delay, land: Math.max(0, ready - delay) + swing, atk0: bot.GetLastAttackTime() };
        if (holds[id] !== undefined && holds[id]!.creep === creep) holds[id] = undefined;
        s.sched++;
        s.lastAct = "sched";
        if (pending[id] === undefined)
            pending[id] = {
                creep,
                act: plan.deny === true ? "deny" : "hit",
                t0: GameTime(),
                pred: delay + Math.max(0, ready - delay) + swing,
                left: plan.left === undefined ? -1 : plan.left,
                dmg: OurDamage(bot, creep),
                hp0: creep.GetHealth(),
                atk0: bot.GetLastAttackTime(),
                count0: plan.deny === true ? bot.GetDenies() : bot.GetLastHits(),
                point: -1,
                kind: "sched_" + KindOf(creep),
            };
        return;
    }
    if (plan.act === "cancel") {
        bot.Action_ClearActions(true);
        s.cancel++;
        s.lastAct = "cancel";
        return;
    }
    if (plan.act === "hold") {
        const reach = bot.GetAttackRange() + 40;
        const d = GetUnitToUnitDistance(bot, creep);
        if (s.lastAct !== "hold") s.hold++;
        s.lastAct = "hold";
        if (d > reach - 20) {
            // Step to just inside attack range, on our side of the creep.
            const from = creep.GetLocation();
            const to = bot.GetLocation();
            const k = Math.max(0, reach - 60) / Math.max(1, d);
            bot.Action_MoveToLocation(Vector(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z));
        } else if (bot.GetAttackTarget() !== null && bot.GetAttackTarget() !== undefined) {
            bot.Action_ClearActions(true);
        }
        return;
    }
    // hit / deny: one attack, committed until released (Desire keeps the plan while the commit holds).
    const id0 = bot.GetPlayerID();
    const commit = commits[id0];
    if (commit !== undefined && commit.creep === creep) {
        if (bot.GetAttackTarget() !== creep) bot.Action_AttackUnit(creep, true);
        return;
    }
    bot.Action_AttackUnit(creep, true);
    Stage(bot, creep, "fired");
    commits[id0] = { creep, act: plan.act, t0: GameTime(), land: OurHitTime(bot, creep)[0], atk0: bot.GetLastAttackTime() };
    if (holds[id0] !== undefined && holds[id0]!.creep === creep) holds[id0] = undefined;
    const key = `${plan.act}:${tostring(creep)}`;
    if (s.lastAct !== key) {
        if (plan.act === "hit") s.hit++;
        else s.deny++;
        const id = bot.GetPlayerID();
        if (pending[id] === undefined) {
            const [land] = OurHitTime(bot, creep);
            pending[id] = {
                creep,
                act: plan.act,
                t0: GameTime(),
                pred: land,
                left: plan.left === undefined ? -1 : plan.left,
                dmg: OurDamage(bot, creep),
                hp0: creep.GetHealth(),
                atk0: bot.GetLastAttackTime(),
                count0: plan.act === "deny" ? bot.GetDenies() : bot.GetLastHits(),
                point: -1,
                kind: KindOf(creep),
            };
        }
    }
    s.lastAct = key;
}
