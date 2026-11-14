/**
 * Debug thrash counter (docs/specs/smarter-bot-behaviour.md section 3.2, item 3).
 *
 * Counts each bot's active-mode changes and prints them once a minute:
 *     THRASH team=2 hero=npc_dota_hero_axe changes=14 seconds=60
 * Once a minute per team it also prints the team brain's enemy view, as an in-game check
 * that the brain works:
 *     BRAIN team=2 t=600 enemies=5 alive=4 visible=2 ...
 *
 * It does nothing unless Utils.DebugMode is true, so it does not change any game with
 * debug off. Called from ItemUsageThink, which runs every 0.1-0.2 s per bot, faster than
 * modes can change (GetDesire runs about every 0.32 s, Phase 0 check P0-6).
 * `npm run phase0` sums the THRASH lines per team.
 * With each THRASH line it also prints where the minute went and the most frequent switches:
 *     MODES team=2 hero=npc_dota_hero_axe laning=62% attack=20% ... top=laning>attack:9,attack>laning:8
 */
import * as Utils from "bots/FunLib/utils";
import { BotMode, Unit } from "bots/ts_libs/dota";
import { DescribeForDebug } from "./team_brain";

const REPORT_EVERY = 60; // game seconds

interface Track {
    mode: number;
    changes: number;
    since: number;
    lastObserved: number;
    /** Seconds spent per mode this minute. */
    time: Record<number, number>;
    /** Switch counts this minute, keyed "from>to". */
    switches: Record<string, number>;
}

function ModeName(mode: number): string {
    const name = (BotMode as unknown as Record<number, string>)[mode];
    return name !== undefined ? name.toLowerCase() : `${mode}`;
}

function DescribeModes(track: Track, seconds: number): string {
    const parts: string[] = [];
    const modes: number[] = [];
    for (const key in track.time) modes.push(Number(key));
    modes.sort((a, b) => track.time[b] - track.time[a]);
    for (const mode of modes) {
        parts.push(`${ModeName(mode)}=${Math.floor((100 * track.time[mode]) / Math.max(seconds, 1))}%`);
    }
    const pairs: string[] = [];
    for (const key in track.switches) pairs.push(key);
    pairs.sort((a, b) => track.switches[b] - track.switches[a]);
    const top: string[] = [];
    for (let i = 0; i < pairs.length && i < 4; i++) top.push(`${pairs[i]}:${track.switches[pairs[i]]}`);
    return `${parts.join(" ")} top=${top.join(",")}`;
}
/** Keyed by player id and unit name: Lone Druid's bear shares the hero's player id. */
const tracks: Record<string, Track> = {};
const brainReportAt: Record<number, number> = {};

export function Observe(bot: Unit): void {
    if (!Utils.DebugMode) {
        return;
    }
    const now = DotaTime();
    if (now < 0) {
        return; // count from the horn; pre-game modes are not decisions
    }
    const key = `${bot.GetPlayerID()}:${bot.GetUnitName()}`;
    const mode = bot.GetActiveMode();
    const track = tracks[key];
    if (track === undefined) {
        tracks[key] = { mode, changes: 0, since: now, lastObserved: now, time: {}, switches: {} };
        return;
    }
    track.time[track.mode] = (track.time[track.mode] ?? 0) + (now - track.lastObserved);
    track.lastObserved = now;
    if (mode !== track.mode) {
        track.changes += 1;
        const pair = `${ModeName(track.mode)}>${ModeName(mode)}`;
        track.switches[pair] = (track.switches[pair] ?? 0) + 1;
        track.mode = mode;
    }
    if (now - track.since >= REPORT_EVERY) {
        const seconds = Math.floor(now - track.since);
        print(`THRASH team=${GetTeam()} hero=${bot.GetUnitName()} changes=${track.changes} seconds=${seconds}`);
        print(`MODES team=${GetTeam()} hero=${bot.GetUnitName()} lh=${bot.GetLastHits()} dn=${bot.GetDenies()} nw=${bot.GetNetWorth()} ${DescribeModes(track, now - track.since)}`);
        track.changes = 0;
        track.since = now;
        track.time = {};
        track.switches = {};
    }

    const team = GetTeam();
    const last = brainReportAt[team];
    if (last === undefined || now - last >= REPORT_EVERY) {
        brainReportAt[team] = now;
        print(`BRAIN team=${team} ${DescribeForDebug()}`);
    }
}
