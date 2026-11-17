/**
 * Behaviour feature flags (docs/specs/smarter-bot-behaviour.md section 3.1).
 *
 * Flags live in `Customize.Behavior.Radiant` / `Customize.Behavior.Dire` in bots/Customize/general.lua.
 * A missing table or key reads as false, so every flag-off team runs the baseline (commit cb814c6).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
import Customize = require("bots/Customize/general");
import { Team } from "bots/ts_libs/dota";

export type FlagName = "arbiter" | "group" | "learned" | "fixes" | "corefarm" | "roshsafe";

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

/**
 * Per-team numeric tuning (npm run match -- ... --tune=name=value[,...]).
 *
 * Values live in `Customize.Behavior.<Radiant|Dire>.tune`, written for the new team only. A missing table,
 * a missing key or a value that is not a number reads as `def`, so a team without a tune table plays
 * today's constants. Every name is also in TUNES in typescript/post-process/match-setup.js (npm run check).
 *
 * Trace, once per team per game, on the first Tune read of a team that has a tune table:
 *   TUNE team=2 name=value name=value
 */
export type TuneName = never;

const tuneCache: Record<string, number> = {};
const tuneLogged: Record<number, boolean> = {};

function TeamTune(team: number): Record<string, unknown> | undefined {
    const behavior = Customize.Behavior;
    if (behavior === undefined) return undefined;
    const teamFlags = team === Team.Radiant ? behavior.Radiant : behavior.Dire;
    if (teamFlags === undefined || typeof teamFlags.tune !== "object") return undefined;
    return teamFlags.tune;
}

function LogTune(team: number, tune: Record<string, unknown>): void {
    tuneLogged[team] = true;
    const names: string[] = [];
    for (const k in tune) names.push(k);
    names.sort();
    let text = "";
    for (const k of names) text += ` ${k}=${tostring(tune[k])}`;
    print(`TUNE team=${team}${text}`);
}

export function Tune(name: TuneName, def: number): number {
    const team = GetTeam();
    const key = `${team}:${name}`;
    const cached = tuneCache[key];
    if (cached !== undefined) return cached;

    let value = def;
    const tune = TeamTune(team);
    if (tune !== undefined) {
        if (tuneLogged[team] !== true) LogTune(team, tune);
        const v = tune[name];
        if (typeof v === "number") value = v;
    }
    tuneCache[key] = value;
    return value;
}
