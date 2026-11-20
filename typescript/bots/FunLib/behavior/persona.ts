/**
 * Hidden bot personas (flag `persona`, docs/BEHAVIOR_CHANGES.md).
 *
 * Each bot of a flagged team gets one persona per game, drawn by position with per-game randomness
 * (behavior/rng), at most two bots per persona. The persona scales a few mode desires through
 * arbiter.Wrap, so the same hero plays differently from game to game. It is never shown to players:
 * no name tag, no chat line; the debug trace below is the only place it appears.
 *
 * Persona knobs multiply the raw desire of a mode. Limits keep every bot playable:
 *   - a raw desire at or above LOCKED (forced defence, about to die) is never changed;
 *   - a scaled desire never rises to LOCKED or above, so a persona cannot create a forced bid;
 *   - a raw desire at or below FLOOR (mode not wanted) is left alone.
 *
 * Debug trace (Utils.DebugMode), once per bot:
 *   PERSONA team=3 hero=axe pos=3 persona=bully
 */
import { BotMode, Unit } from "bots/ts_libs/dota";
import * as jmz from "bots/FunLib/jmz_func";
import * as Utils from "bots/FunLib/utils";
import * as Rng from "./rng";

export type PersonaName = "greedy" | "playmaker" | "bully" | "guardian" | "hothead";

/** Mode groups a persona can bias. */
export type Knob = "retreat" | "farm" | "gank" | "push" | "defend" | "rune" | "ward" | "roshan";

type Knobs = Record<Knob, number>;

const LOCKED = 0.9;
const FLOOR = 0.05;
const MAX_PER_PERSONA = 2;

/**
 * retreat < 1: stays in fights longer. farm > 1: farms longer, joins fights late.
 * gank: team roam (ganks, joining a teammate's fight). push / defend: tower modes.
 */
export const PERSONAS: Record<PersonaName, Knobs> = {
    // Carry mindset: farm first, fights later, little defending of other lanes.
    greedy: { retreat: 1.05, farm: 1.2, gank: 0.7, push: 0.9, defend: 0.85, rune: 0.9, ward: 1, roshan: 0.9 },
    // Roams and hunts: ganks, runes, chases.
    playmaker: { retreat: 0.9, farm: 0.85, gank: 1.3, push: 1, defend: 1, rune: 1.25, ward: 1, roshan: 1.1 },
    // Pressure: takes trades, pushes towers, stays in fights.
    bully: { retreat: 0.85, farm: 0.95, gank: 1.1, push: 1.15, defend: 0.95, rune: 1, ward: 1, roshan: 1.05 },
    // Careful: backs off early, defends, wards.
    guardian: { retreat: 1.15, farm: 0.9, gank: 1, push: 0.95, defend: 1.15, rune: 1, ward: 1.3, roshan: 1 },
    // Impulsive: dives, ganks, pushes, then pays for it.
    hothead: { retreat: 0.85, farm: 1, gank: 1.15, push: 1.1, defend: 0.9, rune: 1.05, ward: 0.9, roshan: 1.1 },
};

/** Draw weights by position (1-5). */
const WEIGHTS: Record<number, Partial<Record<PersonaName, number>>> = {
    1: { greedy: 5, hothead: 2, playmaker: 1, bully: 1 },
    2: { playmaker: 4, hothead: 3, greedy: 2, bully: 1 },
    3: { bully: 5, hothead: 2, playmaker: 2, guardian: 1 },
    4: { playmaker: 4, bully: 2, guardian: 2, hothead: 2 },
    5: { guardian: 5, playmaker: 2, hothead: 1, bully: 1 },
};

const ORDER: PersonaName[] = ["greedy", "playmaker", "bully", "guardian", "hothead"];

/** Module state is per team: each team has its own Lua state. Keyed by player id. */
const assigned: Record<number, PersonaName> = {};
const taken: Partial<Record<PersonaName, number>> = {};

function Draw(pos: number): PersonaName {
    const weights = WEIGHTS[pos] ?? WEIGHTS[3];
    let total = 0;
    for (const p of ORDER) {
        const w = weights[p] ?? 0;
        if (w > 0 && (taken[p] ?? 0) < MAX_PER_PERSONA) total += w;
    }
    if (total <= 0) return ORDER[Rng.Int(0, ORDER.length - 1)];
    let roll = Rng.Float(0, total);
    for (const p of ORDER) {
        const w = weights[p] ?? 0;
        if (w <= 0 || (taken[p] ?? 0) >= MAX_PER_PERSONA) continue;
        if (roll < w) return p;
        roll -= w;
    }
    return ORDER[0];
}

/** The bot's persona, drawn on first use. */
export function Get(bot: Unit): PersonaName {
    const id = bot.GetPlayerID();
    const have = assigned[id];
    if (have !== undefined) return have;
    const pos = jmz.GetPosition(bot);
    const p = Draw(pos);
    assigned[id] = p;
    taken[p] = (taken[p] ?? 0) + 1;
    if (Utils.DebugMode) print(`PERSONA team=${GetTeam()} hero=${bot.GetUnitName().replace("npc_dota_hero_", "")} pos=${pos} persona=${p}`);
    return p;
}

/** The knob a mode answers to, or undefined for modes personas leave alone. */
export function KnobOf(mode: BotMode): Knob | undefined {
    switch (mode) {
        case BotMode.Retreat:
            return "retreat";
        case BotMode.Farm:
            return "farm";
        case BotMode.TeamRoam:
            return "gank";
        case BotMode.PushTowerTop:
        case BotMode.PushTowerMid:
        case BotMode.PushTowerBot:
            return "push";
        case BotMode.DefendTowerTop:
        case BotMode.DefendTowerMid:
        case BotMode.DefendTowerBot:
            return "defend";
        case BotMode.Rune:
            return "rune";
        case BotMode.Ward:
            return "ward";
        case BotMode.Roshan:
            return "roshan";
        default:
            return undefined;
    }
}

/**
 * Applies a multiplier to a raw desire within the limits in the header.
 * Exported for the mood module, which scales on top of the persona.
 */
export function ApplyFactor(value: number, factor: number): number {
    if (value >= LOCKED || value <= FLOOR || factor === 1) return value;
    return Math.min(value * factor, LOCKED - 0.01);
}

/** The persona factor of a bot for a mode (1 for modes personas leave alone). */
export function Factor(bot: Unit, mode: BotMode): number {
    const knob = KnobOf(mode);
    if (knob === undefined) return 1;
    return PERSONAS[Get(bot)][knob];
}
