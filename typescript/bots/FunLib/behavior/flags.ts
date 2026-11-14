/**
 * Behaviour feature flags (docs/specs/smarter-bot-behaviour.md section 3.1).
 *
 * Flags live in `Customize.Behavior.Radiant` / `Customize.Behavior.Dire` in bots/Customize/general.lua.
 * A missing table or key reads as false, so every flag-off team runs the baseline (commit cb814c6).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
import Customize = require("bots/Customize/general");
import { Team } from "bots/ts_libs/dota";

export type FlagName = "arbiter" | "laning" | "fight" | "retreat" | "group" | "farm" | "roam" | "humanfeel" | "escape";

// Flags do not change during a game, so each is read once. Keyed by team as well as name,
// because Phase 0 (check P0-2) has not yet shown whether the two teams share Lua state.
const cache: Record<string, boolean> = {};

export function IsOn(name: FlagName): boolean {
    const team = GetTeam();
    const key = `${team}:${name}`;
    const cached = cache[key];
    if (cached !== undefined) return cached;

    let on = false;
    const behavior = Customize.Behavior;
    if (behavior !== undefined) {
        const teamFlags = team === Team.Radiant ? behavior.Radiant : behavior.Dire;
        on = teamFlags !== undefined && teamFlags[name] === true;
    }
    cache[key] = on;
    return on;
}
