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
 * Normalises a legacy desire onto the 0..1 tier scale and applies the incumbent bonus.
 * 1. Values above 1 are compressed into 0.95..0.99, keeping their order. Negative values become 0.
 * 2. If the bot is already in `mode` and raw > 0.1, add INCUMBENT_BONUS, capped at 1.
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

    if (raw > INCUMBENT_MIN_RAW && bot.GetActiveMode() === mode) {
        value = Math.min(value + INCUMBENT_BONUS, 1);
    }
    return value;
}

/**
 * Returns the GetDesire the engine should see for this mode file.
 * Flag off (or no GetDesire defined): returns `getDesire` itself, unchanged.
 */
export function Wrap(
    bot: Unit,
    mode: BotMode,
    getDesire: ((this: void) => number | undefined) | undefined
): ((this: void) => number | undefined) | undefined {
    if (getDesire === undefined || !IsOn("arbiter")) return getDesire;
    return () => Finalize(bot, mode, getDesire());
}
