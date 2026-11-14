/**
 * Per-game random numbers for the behaviour modules.
 *
 * Valve's RandomFloat / RandomInt / RandomVector start from the same seed in the bot VM every game:
 * the pre-horn plan rolled 0.66 (ambush) in every test game, and jitter, timings and jungle rolls
 * repeated the same way. This is a Park-Miller generator (exact in Lua doubles) seeded once per VM
 * from RealTime() (real-world seconds since Dota started, so it differs per game) and the team.
 *
 * Debug (Utils.DebugMode), once per team:
 *   RNG team=2 seed=123456789
 */
import { Vector } from "bots/ts_libs/dota";
import * as Utils from "bots/FunLib/utils";

const MOD = 2147483647;
const MUL = 16807;
let state = 0;

function Seed(): void {
    // Milliseconds of real time, mixed with the team so both VMs differ.
    const ms = Math.floor(RealTime() * 1000) + GetTeam() * 7919;
    state = (ms % (MOD - 1)) + 1;
    for (let i = 0; i < 3; i++) state = (state * MUL) % MOD; // spread close seeds apart
    if (Utils.DebugMode) print(`RNG team=${GetTeam()} seed=${state}`);
}

/** Uniform in [0, 1). */
function Next(): number {
    if (state === 0) Seed();
    state = (state * MUL) % MOD;
    return (state - 1) / (MOD - 1);
}

/** Uniform in [min, max). */
export function Float(min: number, max: number): number {
    return min + (max - min) * Next();
}

/** Uniform integer in [min, max], both included. */
export function Int(min: number, max: number): number {
    return Math.min(max, min + Math.floor(Next() * (max - min + 1)));
}

/** A vector of length `length` in a random direction (as Valve's RandomVector). */
export function Direction(length: number): Vector {
    const a = Next() * 2 * Math.PI;
    return Vector(Math.cos(a) * length, Math.sin(a) * length, 0);
}
