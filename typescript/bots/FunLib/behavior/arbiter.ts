/**
 * Mode desire arbiter (docs/specs/smarter-bot-behaviour.md section 3.2, flag `arbiter`).
 *
 * Mode entry files call `Wrap` once at load time:
 *     GetDesire = require(GetScriptDirectory()..'/FunLib/behavior/arbiter').Wrap(bot, BOT_MODE_X, GetDesire)
 * With the flag off, `Wrap` returns the very same function it was given, so the baseline
 * GetDesire runs untouched and `Finalize` is never called.
 */
import { BotMode, Unit } from "bots/ts_libs/dota";
import { IsOn } from "./flags";
import * as jmz from "bots/FunLib/jmz_func";
import * as Group from "./group";
import * as Persona from "./persona";
import * as Mood from "./mood";

/** Errors in the group cap print once each and leave the desire unchanged. */
const groupErrors: Record<string, boolean> = {};

/**
 * Added to the running mode's desire so it must be beaten clearly before it is replaced. Tunable.
 * Was 0.06; in the S0b screen that cut mode changes by only about 13% (21.4 against 24.8 per bot
 * per minute). 0.12 is the most it can be while a mode one tier higher (tiers are 0.15 apart
 * from MODERATE upward) still always wins.
 */
const INCUMBENT_BONUS = 0.12;
/** Only a mode that still wants to run (raw above this) gets the incumbent bonus. */
const INCUMBENT_MIN_RAW = 0.1;
/**
 * The bonus lifts a mode other than retreat no higher than this (just under SURVIVE 0.96). Game 9090005145:
 * a group defence at FORCED 0.9 plus the bonus reached 1.0 and held bots in defend mode while retreat
 * said 0.96 (fight_survive); four deaths came that way.
 */
const INCUMBENT_CEIL = 0.95;

/**
 * Normalises a legacy desire onto the 0..1 tier scale and applies the incumbent bonus.
 * 1. Values above 1 are compressed into 0.95..0.99, keeping their order. Negative values become 0.
 * 2. If the bot is already in `mode` and raw > 0.1, add INCUMBENT_BONUS, capped at 1 for retreat and at
 *    INCUMBENT_CEIL for other modes (never lowering a value already above it).
 */
export function Finalize(bot: Unit, mode: BotMode, raw: number | undefined): number | undefined {
    // A GetDesire that returns nothing is passed through as is; the engine handles it as before.
    if (raw === undefined) return raw;

    let value = raw;
    if (value > 1) {
        value = 0.95 + Math.min(value - 1, 0.5) * 0.08;
    } else if (value < 0) {
        value = 0;
    }

    // Behaviour flag `group`: farm, runes, wards, shops and roaming wait while the bot should be with the team.
    if (IsOn("group")) {
        const [ok, capped] = pcall(Group.Cap, bot, mode, value);
        if (ok) value = capped as number;
        else if (!groupErrors[`${capped}`]) {
            groupErrors[`${capped}`] = true;
            print(`BEHAVIOR_ERROR group team=${GetTeam()} t=${Math.floor(DotaTime())} ${capped}`);
        }
    }

    // No bonus for a support's farm. OHA caps farm desire at 0.3-0.6 so it never beats pushing, defending or
    // fights; +0.12 lifted a support's farm above those and it stayed farming (S1 test games: Radiant
    // Earthshaker 17-40% farm and 2.7x the support last hits of Dire's, starving the cores).
    const supportFarm = mode === BotMode.Farm && jmz.GetPosition(bot) >= 4;
    if (raw > INCUMBENT_MIN_RAW && bot.GetActiveMode() === mode && !supportFarm) {
        const ceil = mode === BotMode.Retreat ? 1 : Math.max(value, INCUMBENT_CEIL);
        value = Math.min(value + INCUMBENT_BONUS, ceil);
    }
    return value;
}

/** Errors in the persona / mood scaling print once each and leave the desire unchanged. */
const personaErrors: Record<string, boolean> = {};

function ScaleFactor(bot: Unit, mode: BotMode, persona: boolean, mood: boolean): number {
    let f = 1;
    if (persona) f *= Persona.Factor(bot, mode);
    if (mood) f *= Mood.Factor(bot, mode);
    return f;
}

/**
 * Behaviour flags `persona` and `mood`: the bot's hidden persona and its current mood scale the raw desire
 * (behavior/persona, behavior/mood), within the limits of Persona.ApplyFactor.
 */
function PersonaScale(bot: Unit, mode: BotMode, raw: number | undefined, persona: boolean, mood: boolean): number | undefined {
    if (raw === undefined) return raw;
    // A laning last-hit bid (flag `lasthit`) is timing, not a gank: personas and moods leave it alone.
    if (mode === BotMode.TeamRoam && (bot as unknown as { roamSub?: string }).roamSub === "lasthit" && IsOn("lasthit")) return raw;
    const [ok, factor] = pcall(ScaleFactor, bot, mode, persona, mood);
    if (ok) return Persona.ApplyFactor(raw, factor as number);
    if (!personaErrors[`${factor}`]) {
        personaErrors[`${factor}`] = true;
        print(`BEHAVIOR_ERROR persona team=${GetTeam()} t=${Math.floor(DotaTime())} ${factor}`);
    }
    return raw;
}

/**
 * Returns the GetDesire the engine should see for this mode file.
 * Flags `arbiter`, `persona` and `mood` off (or no GetDesire defined): returns `getDesire` itself, unchanged.
 */
export function Wrap(
    bot: Unit,
    mode: BotMode,
    getDesire: ((this: void) => number | undefined) | undefined
): ((this: void) => number | undefined) | undefined {
    if (getDesire === undefined) return getDesire;
    const arbiter = IsOn("arbiter");
    const scaled = Persona.KnobOf(mode) !== undefined;
    const persona = scaled && IsOn("persona");
    const mood = scaled && IsOn("mood");
    if (!persona && !mood) return arbiter ? () => Finalize(bot, mode, getDesire()) : getDesire;
    if (!arbiter) return () => PersonaScale(bot, mode, getDesire(), persona, mood);
    return () => Finalize(bot, mode, PersonaScale(bot, mode, getDesire(), persona, mood));
}
