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
 * and HORIZON_LONG s later the same counts over the longer window:
 *   FIGHTOUT30 id=2-3-1234 died=1 kills=1 allyDeaths=1 hp=0.00 nwGain=180
 *
 * Exploration (data games only, explore > 0): at a decision with no forced action running, with
 * probability `explore` the bot is forced to fight or run (50/50) for FORCE_TIME s. Retreat and team
 * roam read Forced(): "run" lifts retreat to 0.97; "fight" caps retreat at 0.05 and team roam attacks the
 * nearest enemy hero (FightThink). Forced decisions are logged with forced=1.
 *
 * Learned policy (flag `learned`, step 3): at each decision with no forced action running, the model in
 * learned_fight_model.lua (written by typescript/post-process/train-fight.js) predicts the score of fighting
 * and of running from the same situation fields. If one beats the other by more than the model's margin,
 * the bot is forced to it for FORCE_TIME s through the same hooks as exploration (the model was trained on
 * exactly that intervention). Logged as src=learned (forced=0, so it does not mix into training data).
 * Without a model file, or with a feature list that does not match, the flag does nothing.
 */
import { BotMode, DamageType, Unit } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Rng from "./rng";
import * as Flags from "./flags";
import * as Utils from "bots/FunLib/utils";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import Customize = require("bots/Customize/general");

const DECISION_PERIOD = 1.0;
const SITUATION_RADIUS = 1600;
const HORIZON = 10;
// Second outcome line: the 10 s score missed what a death costs later (overnight 2026-11-15: a model
// trained on it lost 6 of 6), so FIGHTOUT30 reports the same counts over 30 s.
const HORIZON_LONG = 30;
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
    shortDone: boolean;
}

interface BotState {
    lastDecision: number;
    pending: Pending[];
    forced: "fight" | "run" | null;
    forcedUntil: number;
    forcedTarget: Unit | null;
    src: "explore" | "learned" | null;
}

/** The fields of one FIGHTDEC line. */
interface Situation {
    t: number;
    pos: number;
    lvl: number;
    hp: number;
    mp: number;
    nw: number;
    allies: number;
    allyHp: number;
    allyLvl: number;
    allyNw: number;
    enemies: number;
    enemyHp: number;
    enemyLvl: number;
    missing: number;
    near: number;
    nearHp: number;
    inc: number;
    out: number;
    teamOut: number;
    ult: number;
    towerAlly: number;
    towerEnemy: number;
    home: number;
    laning: number;
}

interface Tree {
    v?: number;
    f?: number;
    t?: number;
    l?: Tree;
    r?: Tree;
}
interface Ensemble {
    base: number;
    trees: Tree[];
}
interface LearnedModel {
    features: string[];
    lr: number;
    margin: number;
    fight: Ensemble;
    run: Ensemble;
}

const states: Record<number, BotState> = {};
let enabled: boolean | undefined;
let explore = 0;
let learnedOn: boolean | undefined;
let model: LearnedModel | null | undefined;

function LearnedOn(): boolean {
    if (learnedOn === undefined) learnedOn = Flags.IsOn("learned");
    return learnedOn;
}

/** Decision log on, or the learned policy on for this team: the mode hooks are needed. */
export function Active(): boolean {
    return Enabled() || LearnedOn();
}

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
        s = { lastDecision: -999, pending: [], forced: null, forcedUntil: -1, forcedTarget: null, src: null };
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
        const tag = p.shortDone ? "FIGHTOUT30" : "FIGHTOUT";
        if (!p.shortDone || now - p.at >= HORIZON_LONG) {
            print(
                `${tag} id=${p.id} died=${p.selfDied ? 1 : 0} kills=${kills} allyDeaths=${allyDeaths} hp=${F(bot.IsAlive() ? jmz.GetHP(bot) : 0)} nwGain=${bot.GetNetWorth() - p.nw}`
            );
        }
        if (!p.shortDone) {
            p.shortDone = true;
            keep.push(p);
        } else if (now - p.at < HORIZON_LONG) {
            keep.push(p);
        }
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
    s.src = "explore";
    s.forcedUntil = now + FORCE_TIME;
    const nearest = NearestAttackable(bot, enemies);
    s.forcedTarget = nearest;
    if (s.forced === "fight" && nearest === null) s.forced = null;
}

function NearestAttackable(bot: Unit, enemies: Unit[]): Unit | null {
    let nearest: Unit | null = null;
    for (const e of enemies) {
        if (!jmz.CanBeAttacked(e)) continue;
        if (nearest === null || Dist(bot, e) < Dist(bot, nearest)) nearest = e;
    }
    return nearest;
}

function SituationOf(bot: Unit, enemies: Unit[], allies: Unit[], now: number): Situation {
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
    return {
        t: now,
        pos: jmz.GetPosition(bot),
        lvl: bot.GetLevel(),
        hp: jmz.GetHP(bot),
        mp: jmz.GetMP(bot),
        nw: bot.GetNetWorth(),
        allies: allies.length,
        allyHp: allyHp / (allies.length + 1),
        allyLvl,
        allyNw,
        enemies: enemies.length,
        enemyHp: enemyHp / enemies.length,
        enemyLvl,
        missing: MissingEnemies(),
        near: Math.floor(Dist(bot, nearest)),
        nearHp: jmz.GetHP(nearest),
        inc: incoming / Math.max(bot.GetHealth(), 1),
        out: out / nearestHealth,
        teamOut: teamOut / nearestHealth,
        ult: UltReady(bot),
        towerAlly: NearestTowerDist(bot, false),
        towerEnemy: NearestTowerDist(bot, true),
        home: Math.floor(bot.DistanceFromFountain()),
        laning: jmz.IsInLaningPhase() ? 1 : 0,
    };
}

// ---- learned policy ----

/** Same order and transforms as FEATURES in typescript/post-process/train-fight.js. */
const FEATURE_NAMES = ["hp", "mp", "lvl", "allies", "enemies", "sideDiff", "allyHp", "enemyHp", "lvlDiff", "missing", "near", "nearHp", "inc", "out", "teamOut", "ult", "towerAlly", "towerEnemy", "home", "laning", "minute", "pos"];

function FeaturesOf(x: Situation): number[] {
    return [
        x.hp, x.mp, x.lvl, x.allies, x.enemies, x.allies + 1 - x.enemies, x.allyHp, x.enemyHp,
        x.allyLvl / (x.allies + 1) - x.enemyLvl / Math.max(x.enemies, 1), x.missing, x.near, x.nearHp,
        Math.min(x.inc, 5), Math.min(x.out, 5), Math.min(x.teamOut, 10), x.ult,
        Math.min(x.towerAlly, 5000), Math.min(x.towerEnemy, 5000), x.home, x.laning, x.t / 60, x.pos,
    ];
}

function Model(): LearnedModel | null {
    if (model !== undefined) return model;
    model = null;
    const [ok, m] = pcall(require, GetScriptDirectory() + "/FunLib/behavior/learned_fight_model");
    if (!ok || m === undefined || m === null) {
        print("LEARNED no model file: flag learned does nothing");
        return model;
    }
    const lm = m as LearnedModel;
    const names = lm.features;
    let same = names !== undefined && names.length === FEATURE_NAMES.length;
    if (same) for (let i = 0; i < FEATURE_NAMES.length; i++) if (names[i] !== FEATURE_NAMES[i]) same = false;
    if (!same) {
        print("LEARNED model feature list does not match: flag learned does nothing");
        return model;
    }
    model = lm;
    return model;
}

function EvalTree(tree: Tree, x: number[]): number {
    let n = tree;
    while (n.v === undefined) n = x[(n.f as number) - 1] <= (n.t as number) ? (n.l as Tree) : (n.r as Tree);
    return n.v;
}

function Predict(e: Ensemble, lr: number, x: number[]): number {
    let sum = e.base;
    for (const t of e.trees) sum += lr * EvalTree(t, x);
    return sum;
}

function Learned(bot: Unit, s: BotState, now: number, enemies: Unit[], sit: Situation): void {
    if (s.forced !== null) return;
    const m = Model();
    if (m === null) return;
    const x = FeaturesOf(sit);
    const d = Predict(m.fight, m.lr, x) - Predict(m.run, m.lr, x);
    if (Math.abs(d) <= m.margin) return;
    const choice = d > 0 ? "fight" : "run";
    const target = NearestAttackable(bot, enemies);
    if (choice === "fight" && target === null) return;
    s.forced = choice;
    s.src = "learned";
    s.forcedUntil = now + FORCE_TIME;
    s.forcedTarget = target;
    if (Utils.DebugMode) print(`LEARNED team=${GetTeam()} hero=${Short(bot)} t=${F(now, 1)} choice=${choice} d=${F(d)}`);
}

/** Called from retreat's GetDesire for every bot. Returns true (SafeCall reads nil as an error). */
export function Tick(bot: Unit): boolean {
    if (!Active() || bot.IsIllusion()) return true;
    const s = StateOf(bot);
    const now = DotaTime();
    if (Enabled()) Settle(bot, s, now);
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
    const x = SituationOf(bot, enemies, allies, now);
    if (LearnedOn()) Learned(bot, s, now, enemies, x);
    if (!Enabled()) return true;

    const id = `${GetTeam()}-${bot.GetPlayerID()}-${Math.floor(now * 10)}`;
    print(
        `FIGHTDEC id=${id} t=${F(now, 1)} team=${GetTeam()} hero=${Short(bot)} pos=${x.pos} lvl=${x.lvl} hp=${F(x.hp)} mp=${F(x.mp)} nw=${x.nw}` +
            ` allies=${x.allies} allyHp=${F(x.allyHp)} allyLvl=${x.allyLvl} allyNw=${x.allyNw}` +
            ` enemies=${x.enemies} enemyHp=${F(x.enemyHp)} enemyLvl=${x.enemyLvl} missing=${x.missing}` +
            ` near=${x.near} nearHp=${F(x.nearHp)} inc=${F(x.inc)} out=${F(x.out)} teamOut=${F(x.teamOut)}` +
            ` ult=${x.ult} towerAlly=${x.towerAlly} towerEnemy=${x.towerEnemy} home=${x.home} laning=${x.laning}` +
            ` act=${Action(bot, s)} forced=${s.forced !== null && s.src === "explore" ? 1 : 0} src=${s.forced !== null && s.src !== null ? s.src : "-"}`
    );
    s.pending.push({
        id,
        at: now,
        enemyIds: enemies.map(e => e.GetPlayerID()),
        allyIds: allies.map(a => a.GetPlayerID()),
        enemyDied: {},
        allyDied: {},
        selfDied: false,
        nw: x.nw,
        shortDone: false,
    });
    return true;
}

/** The forced action running for this bot, if any (exploration). */
export function Forced(bot: Unit): string | null {
    if (!Active()) return null;
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
