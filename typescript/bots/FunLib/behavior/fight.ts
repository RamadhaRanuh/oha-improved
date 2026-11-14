/**
 * Team fights (flag `fight`; docs/specs/smarter-bot-behaviour.md section 6, cut down).
 *
 * Plain OHA has no team fight: Valve's attack mode, team roam's "help the nearest ally" and every hero's
 * spell code each pick their own target, and each bot runs on its own health. In 9089765175, 6 of 23
 * Radiant deaths after 10:00 were even fights where the bot only ran at 4-37% health, and attack and
 * retreat swapped 14 times. This module gives the five bots of a team one shared view of each fight
 * (one Lua VM per team, so the state below is shared).
 *
 * 1. Engagements: visible enemy heroes (and ones seen in the last SEEN_RECENT s) grouped by single-link
 *    GROUP_LINK; a group is an engagement when an ally is within CONTACT of it. Allies within CONTACT of
 *    its enemies, or within JOIN_TIME s of travel of its centre, take part. Enemies unseen for up to
 *    MISSING_AGE s whose last spot is within MISSING_TRAVEL s of the centre count at MISSING_WEIGHT.
 *    ratio = (ourDPS / theirHP) / (theirDPS / ourHP): how much faster we kill them than they kill us.
 * 2. State per engagement, with hysteresis:
 *      none -> engage (ratio >= ENGAGE_RATIO; ENGAGE_RATIO_LANING in the laning phase; never when
 *              visible enemies outnumber allies by 2+ unless ratio >= OUTNUMBERED_RATIO)
 *      none -> hold (ratio > DISENGAGE_RATIO and someone is already fighting)
 *      engage -> hold (ratio in between for HOLD_AFTER s);  hold -> engage (ratio >= ENGAGE_RATIO)
 *      engage/hold -> disengage (ratio <= DISENGAGE_RATIO after MIN_ENGAGE s in engage, or 2 allies
 *              of the engagement died within DEATH_WINDOW s)
 *      disengage -> none (no ally within CLEAR_RADIUS of an enemy)
 *    Attack mode (mode_attack_generic.lua) and retreat (mode_retreat_generic.lua) read it, so the team
 *    commits together and leaves together.
 * 3. Focus: one target per engagement, score = sqrt(power) / time-to-kill, halved when far from our
 *    allies; zero under Shallow Grave, Borrowed Time and similar. Sticky (SWITCH_FACTOR); a target chased
 *    for LEASH_TIME s that lost less than LEASH_DROP of its health is skipped for LEASH_SKIP s.
 *    Every bot calls SetTarget(focus), so hero spell code that reads the bot's target casts on it too.
 * 4. Initiator: the ally with the highest `initiator` weight (aba_hero_roles_map). For FOLLOW_WAIT s
 *    after engage starts, the others hold FOLLOW_GAP from the enemy until the initiator is in or an
 *    enemy is disabled.
 * 5. Ranged kiting: between attacks, a ranged bot steps KITE_STEP away from a melee enemy in KITE_RANGE.
 *
 * Debug (Utils.DebugMode):
 *   FIGHT team=2 t=1704 eng=7 none>engage ratio=1.41 allies=axe,jugg,cm enemies=luna,lion focus=lion init=axe
 *   FIGHT team=2 t=1709 eng=7 focus=luna (was lion) score=3.2
 */
import { DamageType, Unit, UnitType, Vector } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import * as Brain from "./team_brain";
import { HeroRolesMap } from "bots/FunLib/aba_hero_roles_map";
import { HeroName } from "bots/ts_libs/dota/heroes";
import { DesireTier } from "./desire_tiers";

// ---- engagements (tunable)
const BUCKET = 0.25;
const SEEN_RECENT = 3;
const GROUP_LINK = 1200;
const CONTACT = 1600;
const JOIN_TIME = 4;
const MISSING_AGE = 8;
const MISSING_TRAVEL = 5;
const MISSING_WEIGHT = 0.75;
// ---- states (tunable)
const ENGAGE_RATIO = 1.25;
const ENGAGE_RATIO_LANING = 2.0; // laning: harass and trades belong to behavior/laning; only clear kills here
const DISENGAGE_RATIO = 0.8;
const HUMAN_FACTOR = 0.75; // ratio multiplier when a person is among the enemies (tunable)
// Engage only if no more unaccounted enemies than our heroes here, unless a target is low (after laning).
const ELSEWHERE_AGE = 10; // an enemy seen this recently...
const ELSEWHERE_DIST = 4000; // ...this far from the engagement is accounted for
const LOW_TARGET_HP = 0.35;
const OUTNUMBERED_RATIO = 2.0;
const HOLD_AFTER = 1.5;
const MIN_ENGAGE = 3;
const DEATH_WINDOW = 5;
const CLEAR_RADIUS = 1200;
const FIGHTING_RADIUS = 900; // "someone is fighting": an ally this close to an enemy and hit by a hero
// ---- focus (tunable)
const FOCUS_NEAR = 1200;
const FOCUS_FAR = 1000;
const SWITCH_FACTOR = 1.3;
const LOST_TIME = 1.5;
const FOCUS_LEASH_DIST = 1600;
const LEASH_TIME = 5;
const LEASH_DROP = 0.1;
const LEASH_SKIP = 6;
// ---- think (tunable)
const FOLLOW_WAIT = 1.5;
const FOLLOW_GAP = 700;
const INITIATOR_IN = 300;
const SWAP_RANGE = 400; // focus farther than attack range + this: hit something in range instead
const REATTACK = 1;
const KITE_RANGE = 300;
const KITE_STEP = 200;
const MELEE_RANGE = 350;
const FOG_TIME = 3;
// ---- retreat (tunable)
export const SURVIVE = 0.96;
const SURVIVE_HP = 0.2;
const SURVIVE_LOW_HP = 0.15; // below this, leave even with no enemy close, unless finishing a kill
const SURVIVE_RADIUS = 900;
const SURVIVE_PROJECTED = 0.15;
const PROJECT_RADIUS = 1200;
const PROJECT_TIME = 3;
const ENGAGE_RETREAT_CAP = 0.3;
// Engage attack desire at full health: with the running-mode bonus at most 0.95, below retreat's SURVIVE (0.96).
const ENGAGE_DESIRE = 0.83;
const DISENGAGE_RETREAT = 0.88;
const DISENGAGE_MIN = 2;

const SKIP_MODS = [
    "modifier_dazzle_shallow_grave",
    "modifier_abaddon_borrowed_time",
    "modifier_item_aeon_disk_buff",
    "modifier_ursa_enrage",
    "modifier_troll_warlord_battle_trance",
    "modifier_winter_wyvern_cold_embrace",
    "modifier_oracle_false_promise_timer",
];
const BLADE_MAIL = "modifier_item_blade_mail_reflect";

type State = "none" | "engage" | "hold" | "disengage";

interface EnemyEntry {
    id: number;
    unit: Unit | null; // visible now
    loc: Vector;
    weight: number;
    health: number;
    power: number;
}

export interface Fight {
    id: number;
    centre: Vector;
    allies: Unit[];
    enemies: EnemyEntry[];
    state: State;
    stateSince: number;
    ratio: number;
    focusId: number;
    focusSince: number;
    focusHp: number; // focus health fraction when it became the focus
    focusSeenAt: number;
    initiator: Unit | null;
    deaths: number[];
    alive: Record<number, boolean>;
    holdSince: number; // engage: when the ratio dropped into the hold band
    disengageAt: number;
}

let fights: Fight[] = [];
let builtAt = -999;
let nextId = 1;
const skipUntil: Record<number, number> = {}; // enemy id -> focus excluded until
const lastHealth: Record<number, number> = {}; // enemy id -> last seen health
const lastMaxHealth: Record<number, number> = {}; // enemy id -> last seen max health
/**
 * Health assumed for an enemy out of sight: what it had when last seen, but at least this share of its max.
 * 9090005145 at 48:47: three bots engaged at ratio=1020 against one fogged enemy last seen nearly dead
 * (it had walked off and healed); the other four enemies joined and four bots died.
 */
const FOGGED_MIN_HP = 0.5;

function FoggedHealth(id: number): number {
    const hp = lastHealth[id];
    if (hp === undefined) return 1000;
    const max = lastMaxHealth[id];
    return max !== undefined ? Math.max(hp, max * FOGGED_MIN_HP) : hp;
}
const lastAttackOrder: Record<number, [number, number]> = {}; // bot id -> [target id, time]

function Dist(a: Vector, b: Vector): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function Short(name: string): string {
    return name.replace("npc_dota_hero_", "");
}

function Log(f: Fight, text: string): void {
    if (Utils.DebugMode) print(`FIGHT team=${GetTeam()} t=${Math.floor(DotaTime())} eng=${f.id} ${text}`);
}

/**
 * A handle we may call methods on. An enemy hero that left vision since the brain or the global cache
 * (0.5 s) listed it throws "Invalid object passed to IsHero" from the IsIllusion override (9089819931,
 * five BEHAVIOR_ERROR fight lines in lane against Templar Assassin), so IsNull alone is not enough.
 */
function Live(u: Unit | null | undefined): u is Unit {
    return u !== null && u !== undefined && !u.IsNull() && u.CanBeSeen();
}

function Allies(): Unit[] {
    return GetUnitList(UnitType.AlliedHeroes).filter(
        h => h !== null && !h.IsNull() && h.IsAlive() && !h.IsIllusion() && !jmz.IsMeepoClone(h)
    );
}

function Centre(points: Vector[]): Vector {
    let x = 0;
    let y = 0;
    for (const p of points) {
        x += p.x;
        y += p.y;
    }
    const n = Math.max(points.length, 1);
    return Vector(x / n, y / n, 0);
}

function EnemyName(f: Fight, id: number): string {
    for (const e of f.enemies) {
        if (e.id === id && Live(e.unit)) return Short(e.unit.GetUnitName());
    }
    return `#${id}`;
}

function InitiatorWeight(h: Unit): number {
    const roles = (HeroRolesMap as any)[h.GetUnitName() as HeroName];
    return roles !== undefined && roles.initiator !== undefined ? roles.initiator : 0;
}

/** Enemies for the engagements: visible or seen in the last SEEN_RECENT s. */
/** Enemy player ids seen to be people, not bots. */
const humanIds: Record<number, boolean> = {};

function EnemyEntries(): EnemyEntry[] {
    const out: EnemyEntry[] = [];
    for (const e of Brain.Get().enemies) {
        if (!e.alive || e.lastSeenLoc === null || e.lastSeenAge > SEEN_RECENT) continue;
        let unit: Unit | null = null;
        let health = FoggedHealth(e.id);
        if (e.visible && Live(e.unit)) {
            unit = e.unit;
            health = unit.GetHealth();
            lastHealth[e.id] = health;
            lastMaxHealth[e.id] = unit.GetMaxHealth();
            if (!unit.IsBot()) humanIds[e.id] = true;
        }
        out.push({ id: e.id, unit, loc: e.lastSeenLoc, weight: 1, health, power: e.rawPower });
    }
    return out;
}

/** Single-link groups of enemies. */
function Groups(entries: EnemyEntry[]): EnemyEntry[][] {
    const groups: EnemyEntry[][] = [];
    const used: boolean[] = entries.map(() => false);
    for (let i = 0; i < entries.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        const group = [entries[i]];
        for (let k = 0; k < group.length; k++) {
            for (let j = 0; j < entries.length; j++) {
                if (!used[j] && Dist(group[k].loc, entries[j].loc) <= GROUP_LINK) {
                    used[j] = true;
                    group.push(entries[j]);
                }
            }
        }
        groups.push(group);
    }
    return groups;
}

function Ratio(f: Fight): number {
    let ourDps = 0;
    let ourHp = 0;
    for (const a of f.allies) {
        ourDps += Math.max(a.GetOffensivePower(), 0) / 5;
        ourHp += a.GetHealth();
    }
    // An enemy never seen yet has no power reading (0): count it as strong as our average hero, not as
    // harmless (9089819931: lane engages at ratio=99 against a fogged Luna, dropped again 1-3 s later).
    const unknownPower = f.allies.length > 0 ? (ourDps * 5) / f.allies.length : 0;
    let theirDps = 0;
    let theirHp = 0;
    for (const e of f.enemies) {
        theirDps += ((e.power > 0 ? e.power : unknownPower) / 5) * e.weight;
        theirHp += e.health * e.weight;
    }
    if (ourDps <= 0 || ourHp <= 0) return 0;
    if (theirDps <= 0 || theirHp <= 0) return 99;
    // People focus a target and chase a retreating bot far better than bots do, so the same numbers are
    // worth less against them: engage later and back out sooner. 9089836233 (5 human enemies): 14 of 33 bot
    // deaths came after the bot had already decided to back out.
    const human = f.enemies.some(e => e.weight >= 1 && humanIds[e.id] === true);
    return ((ourDps / theirHp) / (theirDps / ourHp)) * (human ? HUMAN_FACTOR : 1);
}

function Fighting(f: Fight): boolean {
    for (const a of f.allies) {
        if (!a.WasRecentlyDamagedByAnyHero(2)) continue;
        for (const e of f.enemies) {
            if (e.weight >= 1 && Dist(a.GetLocation(), e.loc) <= FIGHTING_RADIUS) return true;
        }
    }
    return false;
}

function Contact(f: Fight, radius: number): boolean {
    for (const a of f.allies) {
        for (const e of f.enemies) {
            if (e.weight >= 1 && Dist(a.GetLocation(), e.loc) <= radius) return true;
        }
    }
    return false;
}

function SetState(f: Fight, state: State, why: string): void {
    if (f.state === state) return;
    const was = f.state;
    f.state = state;
    f.stateSince = DotaTime();
    if (state === "disengage") f.disengageAt = DotaTime();
    if (state === "engage") {
        // The leash measures damage from the engage, not from a focus picked earlier while in lane.
        for (const e of f.enemies) {
            if (e.id === f.focusId && Live(e.unit)) f.focusHp = e.unit.GetHealth() / Math.max(e.unit.GetMaxHealth(), 1);
        }
    }
    Log(
        f,
        `${was}>${state} why=${why} ratio=${Math.floor(f.ratio * 100) / 100} allies=${f.allies.map(a => Short(a.GetUnitName())).join(",")} enemies=${f.enemies
            .filter(e => e.weight >= 1)
            .map(e => EnemyName(f, e.id))
            .join(",")} focus=${f.focusId >= 0 ? EnemyName(f, f.focusId) : "-"} init=${f.initiator !== null ? Short(f.initiator.GetUnitName()) : "-"}`
    );
}

/**
 * Living enemies not in this engagement and not seen far away lately: they may be in the fog next to it.
 * 9089836233 (human enemies): Sniper alone engaged a visible Faceless Void at ratio 1.75 at 30:27; the
 * other four came out of the fog within 5 s and he died. Bots alone kept dying the same way after laning.
 */
function Unaccounted(f: Fight): number {
    let n = 0;
    for (const e of Brain.Get().enemies) {
        if (!e.alive || f.enemies.some(x => x.id === e.id)) continue;
        const elsewhere = e.lastSeenLoc !== null && e.lastSeenAge <= ELSEWHERE_AGE && Dist(e.lastSeenLoc, f.centre) > ELSEWHERE_DIST;
        if (!elsewhere) n++;
    }
    return n;
}

/** A visible enemy in the engagement is low enough to be a likely kill. */
function LowTarget(f: Fight): boolean {
    for (const e of f.enemies) {
        if (Live(e.unit) && e.unit.GetHealth() / Math.max(e.unit.GetMaxHealth(), 1) < LOW_TARGET_HP) return true;
    }
    return false;
}

/** After laning: more enemies unaccounted for than we have allies here, and no low target: likely a trap. */
function Trap(f: Fight, laning: boolean): boolean {
    return !laning && Unaccounted(f) > f.allies.length && !LowTarget(f);
}

function UpdateState(f: Fight): void {
    const now = DotaTime();
    const laning = jmz.IsInLaningPhase();
    // Allies of this engagement that died.
    for (const id in f.alive) {
        if (f.alive[id] && !IsHeroAlive(Number(id))) {
            f.alive[id] = false;
            f.deaths.push(now);
        }
    }
    for (const a of f.allies) f.alive[a.GetPlayerID()] = true;
    f.deaths = f.deaths.filter(t => now - t <= DEATH_WINDOW);
    const visibleEnemies = f.enemies.filter(e => e.unit !== null).length;
    const outnumbered = visibleEnemies - f.allies.length >= 2 && f.ratio < OUTNUMBERED_RATIO;
    const engageAt = laning ? ENGAGE_RATIO_LANING : ENGAGE_RATIO;

    if (f.state !== "disengage" && f.state !== "none" && f.deaths.length >= 2) {
        SetState(f, "disengage", "deaths");
        return;
    }
    if (f.state === "none") {
        // At least one enemy in sight: an engage on fog alone has nothing to hit.
        if (f.ratio >= engageAt && !outnumbered && visibleEnemies > 0 && Contact(f, CONTACT)) {
            if (Trap(f, laning)) return;
            SetState(f, "engage", "stronger");
        }
        else if (!laning && f.ratio > DISENGAGE_RATIO && visibleEnemies > 0 && Fighting(f)) SetState(f, "hold", "fighting");
        return;
    }
    if (f.state === "engage") {
        if (f.ratio <= DISENGAGE_RATIO && now - f.stateSince >= MIN_ENGAGE) {
            SetState(f, "disengage", "weaker");
            return;
        }
        if (f.ratio < engageAt) {
            if (f.holdSince < 0) f.holdSince = now;
            if (now - f.holdSince >= HOLD_AFTER) {
                f.holdSince = -1;
                SetState(f, laning ? "none" : "hold", "even");
            }
        } else {
            f.holdSince = -1;
        }
        return;
    }
    if (f.state === "hold") {
        if (f.ratio <= DISENGAGE_RATIO) SetState(f, "disengage", "weaker");
        else if (f.ratio >= engageAt && !outnumbered && visibleEnemies > 0 && !Trap(f, laning)) SetState(f, "engage", "stronger");
        else if (!Contact(f, CLEAR_RADIUS)) SetState(f, "none", "apart");
        return;
    }
    // disengage
    if (!Contact(f, CLEAR_RADIUS)) SetState(f, "none", "clear");
}

function FocusScore(f: Fight, e: EnemyEntry, allyCentre: Vector): number {
    const u = e.unit;
    if (!Live(u) || !u.IsAlive() || !jmz.CanBeAttacked(u) || jmz.IsSuspiciousIllusion(u)) return 0;
    if (skipUntil[e.id] !== undefined && DotaTime() < skipUntil[e.id]) return 0;
    for (const m of SKIP_MODS) if (u.HasModifier(m)) return 0;
    let dps = 0;
    for (const a of f.allies) if (Dist(a.GetLocation(), e.loc) <= FOCUS_NEAR) dps += Math.max(a.GetOffensivePower(), 0) / 5;
    if (dps <= 0) for (const a of f.allies) dps += (Math.max(a.GetOffensivePower(), 0) / 5) * 0.5;
    if (dps <= 0) dps = 1;
    const ttk = Math.max(u.GetHealth(), 1) / dps;
    let score = Math.sqrt(Math.max(e.power, 1)) / ttk;
    if (Dist(e.loc, allyCentre) > FOCUS_FAR) score *= 0.5;
    if (u.HasModifier(BLADE_MAIL)) score *= 0.2;
    return score;
}

function UpdateFocus(f: Fight): void {
    const now = DotaTime();
    const allyCentre = Centre(f.allies.map(a => a.GetLocation()));
    let current: EnemyEntry | null = null;
    for (const e of f.enemies) if (e.id === f.focusId) current = e;
    // Leash: chased LEASH_TIME s while engaged and barely hurt. Engaged time only, counted from the later of
    // the focus pick and the engage (9089819931: in state none in lane, a lone Templar Assassin focus was
    // leashed every 0.25 s, 1560 log lines: nothing else to pick, so focusSince never moved).
    const chasing = f.state === "engage" ? now - Math.max(f.focusSince, f.stateSince) : 0;
    if (current !== null && Live(current.unit) && chasing >= LEASH_TIME) {
        const hp = current.unit.GetHealth() / Math.max(current.unit.GetMaxHealth(), 1);
        if (f.focusHp - hp < LEASH_DROP) {
            skipUntil[current.id] = now + LEASH_SKIP;
            Log(f, `leash ${EnemyName(f, current.id)} hp=${Math.floor(hp * 100)}%`);
            current = null;
            f.focusId = -1; // re-picked below, or after the skip ends
            f.focusSince = now;
        }
    }
    if (current !== null && current.unit !== null) f.focusSeenAt = now;
    let invalid = current === null || now - f.focusSeenAt > LOST_TIME || Dist(current.loc, f.centre) > FOCUS_LEASH_DIST;
    const curScore = current !== null && !invalid ? FocusScore(f, current, allyCentre) : 0;
    if (curScore <= 0 && current !== null && current.unit !== null) invalid = true;
    let best: EnemyEntry | null = null;
    let bestScore = 0;
    for (const e of f.enemies) {
        const s = FocusScore(f, e, allyCentre);
        if (s > bestScore) {
            bestScore = s;
            best = e;
        }
    }
    if (best === null) return;
    if (!invalid && best.id !== f.focusId && bestScore < curScore * SWITCH_FACTOR) return;
    if (best.id === f.focusId) return;
    const was = f.focusId >= 0 ? EnemyName(f, f.focusId) : "-";
    f.focusId = best.id;
    f.focusSince = now;
    f.focusSeenAt = now;
    const u = best.unit as Unit;
    f.focusHp = u.GetHealth() / Math.max(u.GetMaxHealth(), 1);
    if (f.state !== "none") Log(f, `focus=${EnemyName(f, best.id)} (was ${was}) score=${Math.floor(bestScore * 100) / 100}`);
}

/** Rebuild the engagements (once per BUCKET for the team). */
function Build(): void {
    const now = DotaTime();
    if (now - builtAt < BUCKET) return;
    builtAt = now;
    const entries = EnemyEntries();
    const allies = Allies();
    const prev = fights;
    const next: Fight[] = [];
    const taken: Record<number, boolean> = {};
    for (const group of Groups(entries)) {
        const centre = Centre(group.map(e => e.loc));
        const inContact = allies.some(a => group.some(e => Dist(a.GetLocation(), e.loc) <= CONTACT));
        if (!inContact) continue;
        const members = allies.filter(a => {
            if (taken[a.GetPlayerID()]) return false;
            if (group.some(e => Dist(a.GetLocation(), e.loc) <= CONTACT)) return true;
            return Dist(a.GetLocation(), centre) / Math.max(a.GetCurrentMovementSpeed(), 250) <= JOIN_TIME;
        });
        if (members.length === 0) continue;
        for (const a of members) taken[a.GetPlayerID()] = true;
        const enemies = group.slice();
        // Missing enemies who could arrive.
        for (const e of Brain.Get().enemies) {
            if (!e.alive || e.visible || e.lastSeenLoc === null || e.lastSeenAge <= SEEN_RECENT || e.lastSeenAge > MISSING_AGE) continue;
            if (enemies.some(x => x.id === e.id)) continue;
            if (Dist(e.lastSeenLoc, centre) / 300 > MISSING_TRAVEL) continue;
            enemies.push({ id: e.id, unit: null, loc: e.lastSeenLoc, weight: MISSING_WEIGHT, health: FoggedHealth(e.id), power: e.rawPower });
        }
        // Same fight as before if it shares an enemy.
        let old: Fight | null = null;
        for (const p of prev) {
            if (p.enemies.some(pe => pe.weight >= 1 && group.some(e => e.id === pe.id)) && !next.some(n => n === p)) {
                old = p;
                break;
            }
        }
        const f: Fight =
            old !== null
                ? old
                : {
                      id: nextId++,
                      centre,
                      allies: members,
                      enemies,
                      state: "none",
                      stateSince: now,
                      ratio: 0,
                      focusId: -1,
                      focusSince: now,
                      focusHp: 1,
                      focusSeenAt: now,
                      initiator: null,
                      deaths: [],
                      alive: {},
                      holdSince: -1,
                      disengageAt: -999,
                  };
        f.centre = centre;
        f.allies = members;
        f.enemies = enemies;
        f.ratio = Ratio(f);
        let init: Unit | null = null;
        let initWeight = 0;
        for (const a of members) {
            const w = InitiatorWeight(a);
            if (w > initWeight || (w === initWeight && w > 0 && init !== null && a.GetHealth() > init.GetHealth())) {
                init = a;
                initWeight = w;
            }
        }
        f.initiator = init;
        UpdateFocus(f);
        UpdateState(f);
        next.push(f);
    }
    // A disengaging fight whose enemies left vision still keeps its members running for DISENGAGE_MIN.
    fights = next;
}

/** The engagement this bot takes part in, if any. */
export function FightOf(bot: Unit): Fight | null {
    Build();
    for (const f of fights) if (f.allies.some(a => a === bot)) return f;
    return null;
}

function FocusUnit(f: Fight): Unit | null {
    for (const e of f.enemies) {
        if (e.id === f.focusId && Live(e.unit) && e.unit.IsAlive()) return e.unit;
    }
    return null;
}

// ---------------------------------------------------------------------------------------------
// Attack mode

/** Attack mode desire (spec 6.2). */
export function AttackDesire(bot: Unit): number {
    if (!bot.IsAlive() || bot.IsIllusion()) return 0;
    const f = FightOf(bot);
    if (f === null) return 0;
    const hp = jmz.GetHP(bot);
    if (f.state === "engage") {
        if (FocusUnit(f) === null && DotaTime() - f.focusSeenAt > FOG_TIME) return 0;
        // About to die: let retreat have it. With the running-mode bonus, FORCED attack (0.9 + 0.12) beat
        // retreat's SURVIVE 0.96 and its "run:" reasons (1.1 -> 0.96): 9089923826 Disruptor attacked from 60%
        // to 30% with SURVIVE asked (death 11:41), and at 34% to 7% under an enemy tower (5:01).
        if (Survive(bot)) return 0;
        return RemapValClamped(hp, 0.35, 0.2, ENGAGE_DESIRE, DesireTier.HIGH);
    }
    if (jmz.IsInLaningPhase()) return 0;
    if (f.state === "hold") {
        const range = bot.GetAttackRange() + 200;
        for (const e of f.enemies) {
            if (e.unit !== null && Dist(e.loc, bot.GetLocation()) <= range) return DesireTier.HIGH;
        }
        return DesireTier.MODERATE;
    }
    return 0;
}

/** Follower hold (spec 6.3 step 2). True when it gave this tick's order. */
function FollowerHold(bot: Unit, f: Fight): boolean {
    if (f.state !== "engage" || DotaTime() - f.stateSince > FOLLOW_WAIT) return false;
    const init = f.initiator;
    if (init === null || init === bot || init.IsNull() || !init.IsAlive()) return false;
    let nearest: EnemyEntry | null = null;
    let nearestDist = 99999;
    for (const e of f.enemies) {
        if (!Live(e.unit)) continue;
        if (jmz.IsDisabled(e.unit)) return false;
        if (Dist(init.GetLocation(), e.loc) <= INITIATOR_IN) return false;
        const d = Dist(bot.GetLocation(), e.loc);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = e;
        }
    }
    if (nearest === null) return false;
    if (nearestDist >= FOLLOW_GAP) {
        bot.Action_ClearActions(false);
        return true; // wait here
    }
    const away = Math.max(nearestDist, 1);
    const loc = bot.GetLocation();
    bot.Action_MoveToLocation(
        Vector(loc.x + ((loc.x - nearest.loc.x) / away) * (FOLLOW_GAP - nearestDist + 50), loc.y + ((loc.y - nearest.loc.y) / away) * (FOLLOW_GAP - nearestDist + 50), loc.z)
    );
    return true;
}

/** Ranged kiting (spec 6.3 step 5). True when it stepped away. */
function Kite(bot: Unit, f: Fight): boolean {
    if (bot.GetAttackRange() < MELEE_RANGE + 100) return false;
    const since = GameTime() - bot.GetLastAttackTime();
    // Between attacks: the attack animation is done and the next attack is not ready yet.
    if (since < bot.GetAttackPoint() || since > bot.GetSecondsPerAttack() * 0.8) return false;
    for (const e of f.enemies) {
        const u = e.unit;
        if (!Live(u) || u.GetAttackRange() > MELEE_RANGE) continue;
        const d = Dist(bot.GetLocation(), e.loc);
        if (d > KITE_RANGE) continue;
        const loc = bot.GetLocation();
        const len = Math.max(d, 1);
        bot.Action_MoveToLocation(Vector(loc.x + ((loc.x - e.loc.x) / len) * KITE_STEP, loc.y + ((loc.y - e.loc.y) / len) * KITE_STEP, loc.z));
        return true;
    }
    return false;
}

export function AttackThink(bot: Unit): void {
    if (jmz.CanNotUseAction(bot)) return;
    const f = FightOf(bot);
    if (f === null) return;
    if (FollowerHold(bot, f)) return;
    let t = FocusUnit(f);
    if (t === null) {
        // Fog: go to where the focus was last seen.
        for (const e of f.enemies) {
            if (e.id === f.focusId) {
                bot.Action_MoveToLocation(e.loc);
                return;
            }
        }
        return;
    }
    // Focus out of reach and something else in range: hit that, the published focus stays.
    const range = bot.GetAttackRange();
    if (Dist(bot.GetLocation(), t.GetLocation()) > range + SWAP_RANGE) {
        for (const e of f.enemies) {
            const u = e.unit;
            if (!Live(u) || u === t || !jmz.CanBeAttacked(u)) continue;
            let skip = false;
            for (const m of SKIP_MODS) if (u.HasModifier(m)) skip = true;
            if (!skip && Dist(bot.GetLocation(), e.loc) <= range + 50) {
                t = u;
                break;
            }
        }
    }
    bot.SetTarget(t);
    if (Kite(bot, f)) return;
    const id = bot.GetPlayerID();
    const last = lastAttackOrder[id];
    const tid = t.GetPlayerID();
    if (last === undefined || last[0] !== tid || GameTime() - last[1] >= REATTACK) {
        bot.Action_AttackUnit(t, true);
        lastAttackOrder[id] = [tid, GameTime()];
    }
}

// ---------------------------------------------------------------------------------------------
// Retreat

/** About to die: health below SURVIVE_HP with an enemy hero close, or projected health below SURVIVE_PROJECTED. */
/** Our focus is in attack reach and dies to two of our hits. */
function FinishingKill(bot: Unit): boolean {
    const f = FightOf(bot);
    const t = f !== null ? FocusUnit(f) : null;
    if (t === null) return false;
    return Dist(t.GetLocation(), bot.GetLocation()) <= bot.GetAttackRange() + 150 && t.GetHealth() <= bot.GetAttackDamage() * 2;
}

function Survive(bot: Unit): boolean {
    const hp = jmz.GetHP(bot);
    const loc = bot.GetLocation();
    let incoming = 0;
    let close = false;
    for (const e of jmz.GetEnemiesNearLoc(loc, PROJECT_RADIUS)) {
        if (!jmz.IsValidHero(e)) continue;
        if (Dist(e.GetLocation(), loc) <= SURVIVE_RADIUS) close = true;
        incoming += e.GetEstimatedDamageToTarget(true, bot, PROJECT_TIME, DamageType.All);
    }
    if (close && hp < SURVIVE_HP) return true;
    // Very low with nobody close: only stay to finish a kill in reach. 9089836233: Monkey King attacked for
    // 5 s at 11% to 3% health with enemies 900-1200 away (retreat capped at 0.3 while engaged) and died.
    if (hp < SURVIVE_LOW_HP && !FinishingKill(bot)) return true;
    return (bot.GetHealth() - incoming) / Math.max(bot.GetMaxHealth(), 1) < SURVIVE_PROJECTED && incoming > 0;
}

/**
 * Retreat desire under the team fight (spec 7): while engaged only SURVIVE (other retreat reasons are
 * capped at ENGAGE_RETREAT_CAP); while disengaging every member runs at DISENGAGE_RETREAT.
 * `why` is the retreat mode's reason; spell dodges ("run:") are kept.
 */
export function RetreatAdjust(bot: Unit, desire: number, why: string): number {
    if (!bot.IsAlive() || bot.IsIllusion()) return desire;
    const f = FightOf(bot);
    if (f === null) return desire;
    if (f.state === "engage") {
        if (Survive(bot)) return Math.max(desire, SURVIVE);
        if (why.startsWith("run:")) return desire;
        // Laning: the lane safety rules (fight_lowhp_lane, lane burst) stay in charge. 9089923826 Undying
        // ran at 29% health with retreat capped at 0.3 by a lane engage and died (3:40).
        if (jmz.IsInLaningPhase()) return desire;
        return Math.min(desire, ENGAGE_RETREAT_CAP);
    }
    if (f.state === "disengage") {
        const near = jmz.GetEnemiesNearLoc(bot.GetLocation(), CLEAR_RADIUS).length > 0;
        if (near || DotaTime() - f.disengageAt < DISENGAGE_MIN) return Math.max(desire, DISENGAGE_RETREAT);
    }
    return desire;
}

/** Team roam steps aside: hero targets belong to the fight module (spec 6.4). */
export function OwnsHeroTargets(): boolean {
    return !jmz.IsInLaningPhase();
}
