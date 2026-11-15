/**
 * Fight decision log (docs/specs/learned-fight-decisions.md, step 1).
 *
 * Training data for a learned fight / run policy. Independent of the behaviour flags: it runs for every
 * bot on both teams, so plain OHA's decisions are logged too. Switched on by
 * `Customize.DecisionLog = { enabled = true, explore = 0 }` in bots/Customize/general.lua
 * (`npm run match` turns it on; `npm run match -- reset` restores the file).
 *
 * Every DECISION_PERIOD s, while a bot has a visible enemy hero within SITUATION_RADIUS, one line with the
 * situation and what the bot is doing (fight / run / other, from its active mode):
 *   FIGHTDEC id=2-3-1234 t=123.4 team=2 hero=juggernaut pos=1 lvl=5 hp=0.62 ... act=fight forced=0
 * HORIZON s later, one line with what happened to it and to the heroes around it:
 *   FIGHTOUT id=2-3-1234 died=0 kills=1 allyDeaths=0 hp=0.40 nwGain=310
 *
 * Exploration (data games only, explore > 0): at a decision with no forced action running, with
 * probability `explore` the bot is forced to fight or run (50/50) for FORCE_TIME s. Retreat and team
 * roam read Forced(): "run" lifts retreat to 0.97; "fight" caps retreat at 0.05 and team roam attacks the
 * nearest enemy hero (FightThink). Forced decisions are logged with forced=1.
 */
import { BotMode, DamageType, Unit } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Rng from "./rng";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import Customize = require("bots/Customize/general");

const DECISION_PERIOD = 1.0;
const SITUATION_RADIUS = 1600;
const HORIZON = 10;
const FORCE_TIME = 4;
const UNSEEN_AGE = 3;

interface Pending {
    id: string;
    at: number;
    enemyIds: number[];
    allyIds: number[];
    enemyDied: Record<number, boolean>;
    allyDied: Record<number, boolean>;
    selfDied: boolean;
    nw: number;
}

interface BotState {
    lastDecision: number;
    pending: Pending[];
    forced: "fight" | "run" | null;
    forcedUntil: number;
    forcedTarget: Unit | null;
}

const states: Record<number, BotState> = {};
let enabled: boolean | undefined;
let explore = 0;

export function Enabled(): boolean {
    if (enabled === undefined) {
        const cfg = Customize.DecisionLog;
        enabled = cfg !== undefined && cfg.enabled === true;
        explore = enabled && typeof cfg.explore === "number" ? Math.max(0, Math.min(cfg.explore, 1)) : 0;
    }
    return enabled;
}

function StateOf(bot: Unit): BotState {
    const id = bot.GetPlayerID();
    let s = states[id];
    if (s === undefined) {
        s = { lastDecision: -999, pending: [], forced: null, forcedUntil: -1, forcedTarget: null };
        states[id] = s;
    }
    return s;
}

function Dist(a: Unit, b: Unit): number {
    return GetUnitToUnitDistance(a, b);
}

function Short(u: Unit): string {
    return u.GetUnitName().replace("npc_dota_hero_", "");
}

function F(x: number, d = 2): string {
    return x.toFixed(d);
}

function RealHeroes(bot: Unit, enemy: boolean): Unit[] {
    return bot.GetNearbyHeroes(SITUATION_RADIUS, enemy, BotMode.None).filter(h => jmz.IsValidHero(h) && !jmz.IsSuspiciousIllusion(h) && h !== bot);
}

function UltReady(bot: Unit): number {
    for (let i = 0; i <= 5; i++) {
        const a = bot.GetAbilityInSlot(i);
        if (a === null || a === undefined || a.IsNull()) continue;
        if ((a as unknown as { IsUltimate(): boolean }).IsUltimate() && a.IsTrained() && a.IsFullyCastable()) return 1;
    }
    return 0;
}

function NearestTowerDist(bot: Unit, enemy: boolean): number {
    let best = 99999;
    for (const t of bot.GetNearbyTowers(1600, enemy)) {
        if (t !== null && !t.IsNull() && t.IsAlive()) best = Math.min(best, Dist(bot, t));
    }
    return Math.floor(best);
}

function MissingEnemies(): number {
    let n = 0;
    for (const pid of GetTeamPlayers(GetOpposingTeam())) {
        if (!IsHeroAlive(pid)) continue;
        const info = GetHeroLastSeenInfo(pid);
        const age = info !== undefined && info !== null && info.length > 0 ? info[0].time_since_seen : 999;
        if (age > UNSEEN_AGE) n++;
    }
    return n;
}

function Action(bot: Unit, s: BotState): string {
    if (s.forced !== null) return s.forced;
    const mode = bot.GetActiveMode();
    if (mode === BotMode.Retreat || mode === BotMode.EvasiveManeuvers) return "run";
    if (mode === BotMode.Attack) return "fight";
    if (mode === BotMode.TeamRoam) {
        const t = bot.GetTarget();
        if (t !== null && t !== undefined && !t.IsNull() && t.IsHero()) return "fight";
    }
    return "other";
}

/** Outcome bookkeeping: deaths seen at any tick in the window, then the FIGHTOUT line. */
function Settle(bot: Unit, s: BotState, now: number): void {
    const keep: Pending[] = [];
    for (const p of s.pending) {
        if (!bot.IsAlive()) p.selfDied = true;
        for (const pid of p.enemyIds) if (!IsHeroAlive(pid)) p.enemyDied[pid] = true;
        for (const pid of p.allyIds) if (!IsHeroAlive(pid)) p.allyDied[pid] = true;
        if (now - p.at < HORIZON) {
            keep.push(p);
            continue;
        }
        const kills = p.enemyIds.filter(pid => p.enemyDied[pid]).length;
        const allyDeaths = p.allyIds.filter(pid => p.allyDied[pid]).length;
        print(
            `FIGHTOUT id=${p.id} died=${p.selfDied ? 1 : 0} kills=${kills} allyDeaths=${allyDeaths} hp=${F(bot.IsAlive() ? jmz.GetHP(bot) : 0)} nwGain=${bot.GetNetWorth() - p.nw}`
        );
    }
    s.pending = keep;
}

function MaybeForce(bot: Unit, s: BotState, now: number, enemies: Unit[]): void {
    if (s.forced !== null && now >= s.forcedUntil) {
        s.forced = null;
        s.forcedTarget = null;
    }
    if (s.forced !== null || explore <= 0 || enemies.length === 0) return;
    if (Rng.Float(0, 1) >= explore) return;
    s.forced = Rng.Float(0, 1) < 0.5 ? "fight" : "run";
    s.forcedUntil = now + FORCE_TIME;
    let nearest: Unit | null = null;
    for (const e of enemies) {
        if (!jmz.CanBeAttacked(e)) continue;
        if (nearest === null || Dist(bot, e) < Dist(bot, nearest)) nearest = e;
    }
    s.forcedTarget = nearest;
    if (s.forced === "fight" && nearest === null) s.forced = null;
}

/** Called from retreat's GetDesire for every bot. Returns true (SafeCall reads nil as an error). */
export function Tick(bot: Unit): boolean {
    if (!Enabled() || bot.IsIllusion()) return true;
    const s = StateOf(bot);
    const now = DotaTime();
    Settle(bot, s, now);
    if (!bot.IsAlive()) {
        s.forced = null;
        return true;
    }
    if (now - s.lastDecision < DECISION_PERIOD) return true;
    const enemies = RealHeroes(bot, true);
    if (enemies.length === 0) {
        if (s.forced !== null && now >= s.forcedUntil) s.forced = null;
        return true;
    }
    s.lastDecision = now;
    MaybeForce(bot, s, now, enemies);

    const allies = RealHeroes(bot, false);
    let nearest = enemies[0];
    let enemyHp = 0;
    let enemyLvl = 0;
    let incoming = 0;
    for (const e of enemies) {
        if (Dist(bot, e) < Dist(bot, nearest)) nearest = e;
        enemyHp += jmz.GetHP(e);
        enemyLvl += e.GetLevel();
        incoming += e.GetEstimatedDamageToTarget(true, bot, 3, DamageType.All);
    }
    let allyHp = jmz.GetHP(bot);
    let allyLvl = bot.GetLevel();
    let allyNw = bot.GetNetWorth();
    let teamOut = bot.GetEstimatedDamageToTarget(true, nearest, 3, DamageType.All);
    const out = teamOut;
    for (const a of allies) {
        allyHp += jmz.GetHP(a);
        allyLvl += a.GetLevel();
        allyNw += a.GetNetWorth();
        if (Dist(a, nearest) <= SITUATION_RADIUS) teamOut += a.GetEstimatedDamageToTarget(true, nearest, 3, DamageType.All);
    }
    const nearestHealth = Math.max(nearest.GetHealth(), 1);
    const id = `${GetTeam()}-${bot.GetPlayerID()}-${Math.floor(now * 10)}`;
    print(
        `FIGHTDEC id=${id} t=${F(now, 1)} team=${GetTeam()} hero=${Short(bot)} pos=${jmz.GetPosition(bot)} lvl=${bot.GetLevel()} hp=${F(jmz.GetHP(bot))} mp=${F(jmz.GetMP(bot))} nw=${bot.GetNetWorth()}` +
            ` allies=${allies.length} allyHp=${F(allyHp / (allies.length + 1))} allyLvl=${allyLvl} allyNw=${allyNw}` +
            ` enemies=${enemies.length} enemyHp=${F(enemyHp / enemies.length)} enemyLvl=${enemyLvl} missing=${MissingEnemies()}` +
            ` near=${Math.floor(Dist(bot, nearest))} nearHp=${F(jmz.GetHP(nearest))} inc=${F(incoming / Math.max(bot.GetHealth(), 1))} out=${F(out / nearestHealth)} teamOut=${F(teamOut / nearestHealth)}` +
            ` ult=${UltReady(bot)} towerAlly=${NearestTowerDist(bot, false)} towerEnemy=${NearestTowerDist(bot, true)} home=${Math.floor(bot.DistanceFromFountain())} laning=${jmz.IsInLaningPhase() ? 1 : 0}` +
            ` act=${Action(bot, s)} forced=${s.forced !== null ? 1 : 0}`
    );
    s.pending.push({
        id,
        at: now,
        enemyIds: enemies.map(e => e.GetPlayerID()),
        allyIds: allies.map(a => a.GetPlayerID()),
        enemyDied: {},
        allyDied: {},
        selfDied: false,
        nw: bot.GetNetWorth(),
    });
    return true;
}

/** The forced action running for this bot, if any (exploration). */
export function Forced(bot: Unit): string | null {
    if (!Enabled() || explore <= 0) return null;
    const s = StateOf(bot);
    if (s.forced === null) return null;
    if (DotaTime() >= s.forcedUntil || !bot.IsAlive()) {
        s.forced = null;
        s.forcedTarget = null;
        return null;
    }
    if (s.forced === "fight") {
        const t = s.forcedTarget;
        if (t === null || t.IsNull() || !t.IsAlive() || !t.CanBeSeen() || !jmz.CanBeAttacked(t)) {
            s.forced = null;
            s.forcedTarget = null;
            return null;
        }
    }
    return s.forced;
}

/** Team roam Think while a forced fight runs: attack the chosen enemy. Returns true. */
export function FightThink(bot: Unit): boolean {
    const s = StateOf(bot);
    const t = s.forcedTarget;
    if (jmz.CanNotUseAction(bot) || t === null || t.IsNull()) return true;
    bot.SetTarget(t);
    if (bot.GetAttackTarget() !== t) bot.Action_AttackUnit(t, true);
    return true;
}
