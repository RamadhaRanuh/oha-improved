/**
 * Bot moods (flag `mood`, docs/BEHAVIOR_CHANGES.md): tilt, cockiness and desperation.
 *
 * Bot mood (per bot):
 *   tilted: TILT_DEATHS deaths within TILT_WINDOW s, or killed twice by the same enemy within GRUDGE_WINDOW s
 *           (that enemy becomes the bot's grudge). Lasts TILT_TIME s after the last death. Feed guard: after
 *           FEED_GUARD deaths while tilted the bot calms down and cannot tilt again for CALM_TIME s.
 * Team mood (whole team):
 *   cocky:     the team is well ahead (Lead() >= LeadNeeded()); spreads out, dives, farms, delays the end.
 *              Never after CLOSE_OUT_TIME: from then on a lead only means ending the game.
 *   desperate: the team is well behind; groups, plays safe, defends.
 * Each mood multiplies the persona-scaled desire (behavior/persona ApplyFactor limits apply). Hothead
 * moods hit 1.5x as hard; a guardian needs one more death to tilt.
 *
 * Lead() uses what the scoreboard shows (kills, hero levels, towers), not enemy net worth.
 *
 * Debug trace (Utils.DebugMode):
 *   MOOD team=3 hero=axe t=612 mood=tilted why=deaths|grudge grudge=7     on a bot's change
 *   MOOD team=3 hero=axe t=800 mood=calm why=time|feedguard
 *   TEAMMOOD team=3 t=1500 mood=cocky lead=6100 need=5500                  on a team's change
 *   LEAD team=3 t=1500 lead=6100 kills=12 levels=9 towers=2 anw=41000 enw=38000   every 60 s (calibration)
 */
import { BotMode, Unit, UnitType } from "bots/ts_libs/dota";
import * as Utils from "bots/FunLib/utils";
import * as Persona from "./persona";

export type BotMood = "calm" | "tilted";
export type TeamMood = "even" | "cocky" | "desperate";

const UPDATE_PERIOD = 0.5;
const TEAM_PERIOD = 2;
const LEAD_LOG_PERIOD = 60;

const TILT_DEATHS = 3;
const TILT_WINDOW = 240;
const GRUDGE_WINDOW = 600;
const TILT_TIME = 240;
const FEED_GUARD = 2;
const CALM_TIME = 300;
const CLOSE_OUT_TIME = 40 * 60;

const KILL_WORTH = 200;
const LEVEL_WORTH = 250;
const TOWER_WORTH = 600;
/** Team moods hold until the lead falls back by this much, so they do not flicker. */
const HYSTERESIS = 1500;

type Factors = Partial<Record<Persona.Knob, number>>;

const BOT_FACTORS: Record<BotMood, Factors> = {
    calm: {},
    // Plays riskier and hunts.
    tilted: { retreat: 0.85, gank: 1.15, farm: 0.9, push: 1.05 },
};

const TEAM_FACTORS: Record<TeamMood, Factors> = {
    even: {},
    // Spreads out to farm, takes fights in the open, defends less, delays the end.
    cocky: { retreat: 0.9, farm: 1.15, gank: 1.1, push: 0.85, defend: 0.9 },
    // Sticks together and plays safe.
    desperate: { retreat: 1.1, farm: 0.9, gank: 0.9, push: 0.9, defend: 1.15 },
};

interface BotState {
    mood: BotMood;
    deaths: number[]; // death times within the windows
    killers: Record<number, number[]>; // enemy player id -> times that enemy killed this bot
    lastDeath: number;
    tiltDeaths: number;
    calmUntil: number;
    grudge: number; // enemy player id, -1 for none
    lastKiller: number; // enemy player id, -1 for none
}

interface PlayerCount {
    kills: number;
    deaths: number;
}

const bots: Record<number, BotState> = {};
const counts: Record<number, PlayerCount> = {};
let teamMood: TeamMood = "even";
let lastUpdate = -999;
let lastTeam = -999;
let lastLeadLog = -999;
let lead = 0;

function Short(pid: number): string {
    const name = GetSelectedHeroName(pid);
    return name !== undefined && name !== null ? name.replace("npc_dota_hero_", "") : `p${pid}`;
}

function State(pid: number): BotState {
    let s = bots[pid];
    if (s === undefined) {
        s = { mood: "calm", deaths: [], killers: {}, lastDeath: -999, tiltDeaths: 0, calmUntil: -999, grudge: -1, lastKiller: -1 };
        bots[pid] = s;
    }
    return s;
}

function SetMood(pid: number, s: BotState, mood: BotMood, now: number, why: string): void {
    if (s.mood === mood) return;
    s.mood = mood;
    if (mood === "calm") s.tiltDeaths = 0;
    if (Utils.DebugMode) {
        const g = mood === "tilted" && s.grudge >= 0 ? ` grudge=${s.grudge}` : "";
        print(`MOOD team=${GetTeam()} hero=${Short(pid)} t=${Math.floor(now)} mood=${mood} why=${why}${g}`);
    }
}

/** Kills and deaths since the last update, per player; returns the enemies whose kills went up. */
function Scan(): { died: number[]; scorers: number[] } {
    const died: number[] = [];
    const scorers: number[] = [];
    for (const pid of GetTeamPlayers(GetTeam())) {
        const d = GetHeroDeaths(pid);
        const c = counts[pid];
        if (c !== undefined && d > c.deaths) died.push(pid);
        counts[pid] = { kills: GetHeroKills(pid), deaths: d };
    }
    for (const pid of GetTeamPlayers(GetOpposingTeam())) {
        const k = GetHeroKills(pid);
        const c = counts[pid];
        if (c !== undefined && k > c.kills) scorers.push(pid);
        counts[pid] = { kills: k, deaths: GetHeroDeaths(pid) };
    }
    return { died, scorers };
}

function OnDeath(pid: number, killer: number, now: number): void {
    const s = State(pid);
    s.lastDeath = now;
    s.lastKiller = killer;
    s.deaths = s.deaths.filter(t => now - t <= GRUDGE_WINDOW);
    s.deaths.push(now);
    if (s.mood === "tilted") {
        s.tiltDeaths += 1;
        if (s.tiltDeaths >= FEED_GUARD) {
            s.calmUntil = now + CALM_TIME;
            SetMood(pid, s, "calm", now, "feedguard");
            return;
        }
    }
    if (now < s.calmUntil) return;

    let grudge = false;
    if (killer >= 0) {
        const times = (s.killers[killer] ?? []).filter(t => now - t <= GRUDGE_WINDOW);
        times.push(now);
        s.killers[killer] = times;
        if (times.length >= 2) {
            grudge = true;
            s.grudge = killer;
        }
    }
    const recent = s.deaths.filter(t => now - t <= TILT_WINDOW).length;
    const need = TILT_DEATHS + (IsPlayerBot(pid) && PersonaOf(pid) === "guardian" ? 1 : 0);
    if (grudge) SetMood(pid, s, "tilted", now, "grudge");
    else if (recent >= need) SetMood(pid, s, "tilted", now, "deaths");
}

function PersonaOf(pid: number): Persona.PersonaName | undefined {
    for (let i = 1; i <= 5; i++) {
        const m = GetTeamMember(i);
        if (m !== null && m !== undefined && m.GetPlayerID() === pid) return Persona.Get(m);
    }
    return undefined;
}

function Towers(team: number): number {
    let up = 0;
    for (let i = 0; i <= 10; i++) {
        const t = GetTower(team, i);
        if (t !== null && t !== undefined && t.IsAlive()) up += 1;
    }
    return up;
}

/** Our scoreboard lead in rough gold: kills, summed hero levels, towers. */
function Lead(now: number): number {
    let kills = 0;
    let levels = 0;
    for (const pid of GetTeamPlayers(GetTeam())) {
        kills += GetHeroKills(pid);
        levels += GetHeroLevel(pid);
    }
    for (const pid of GetTeamPlayers(GetOpposingTeam())) {
        kills -= GetHeroKills(pid);
        levels -= GetHeroLevel(pid);
    }
    const towers = Towers(GetTeam()) - Towers(GetOpposingTeam());
    const value = kills * KILL_WORTH + levels * LEVEL_WORTH + towers * TOWER_WORTH;
    if (Utils.DebugMode && now - lastLeadLog >= LEAD_LOG_PERIOD) {
        lastLeadLog = now;
        let anw = 0;
        let enw = 0;
        for (let i = 1; i <= 5; i++) {
            const m = GetTeamMember(i);
            if (m !== null && m !== undefined) anw += m.GetNetWorth();
        }
        for (const pid of GetTeamPlayers(GetOpposingTeam())) {
            for (const h of GetUnitList(UnitType.EnemyHeroes)) {
                if (h.GetPlayerID() === pid && !h.IsIllusion()) {
                    enw += h.GetNetWorth();
                    break;
                }
            }
        }
        print(`LEAD team=${GetTeam()} t=${Math.floor(now)} lead=${value} kills=${kills} levels=${levels} towers=${towers} anw=${anw} enw=${enw}`);
    }
    return value;
}

/** The lead a team mood needs at this game time: 5000 at 15:00, growing 100 per minute. */
function LeadNeeded(now: number): number {
    return 5000 + Math.max(0, now / 60 - 15) * 100;
}

function UpdateTeam(now: number): void {
    lead = Lead(now);
    const need = LeadNeeded(now);
    let next: TeamMood = teamMood;
    if (now < 15 * 60) next = "even";
    else if (teamMood === "cocky") next = lead < need - HYSTERESIS || now >= CLOSE_OUT_TIME ? "even" : "cocky";
    else if (teamMood === "desperate") next = lead > -need + HYSTERESIS ? "even" : "desperate";
    else if (lead >= need && now < CLOSE_OUT_TIME) next = "cocky";
    else if (lead <= -need) next = "desperate";
    if (next !== teamMood) {
        teamMood = next;
        if (Utils.DebugMode) print(`TEAMMOOD team=${GetTeam()} t=${Math.floor(now)} mood=${next} lead=${lead} need=${Math.floor(need)}`);
    }
}

/** Team-wide update, run from any bot's desire call at most every UPDATE_PERIOD s. */
export function Update(): void {
    const now = DotaTime();
    if (now - lastUpdate < UPDATE_PERIOD) return;
    lastUpdate = now;
    const { died, scorers } = Scan();
    for (const pid of died) {
        // The killer: an enemy whose kill count went up in the same scan; if several, one that hit this hero.
        let killer = scorers.length > 0 ? scorers[0] : -1;
        if (scorers.length > 1) {
            for (let i = 1; i <= 5; i++) {
                const m = GetTeamMember(i);
                if (m === null || m === undefined || m.GetPlayerID() !== pid) continue;
                for (const e of scorers) if (m.WasRecentlyDamagedByPlayer(e, 3)) killer = e;
            }
        }
        OnDeath(pid, killer, now);
    }
    for (const pidKey in bots) {
        const pid = Number(pidKey);
        const s = bots[pid];
        if (s.mood === "tilted" && now - s.lastDeath > TILT_TIME) SetMood(pid, s, "calm", now, "time");
    }
    if (now - lastTeam >= TEAM_PERIOD) {
        lastTeam = now;
        UpdateTeam(now);
    }
}

function Amplified(f: number, amp: number): number {
    return 1 + (f - 1) * amp;
}

/** The mood factor of a bot for a mode (bot mood times team mood). */
export function Factor(bot: Unit, mode: BotMode): number {
    const knob = Persona.KnobOf(mode);
    if (knob === undefined) return 1;
    Update();
    const amp = Persona.Get(bot) === "hothead" ? 1.5 : 1;
    const s = State(bot.GetPlayerID());
    const fb = BOT_FACTORS[s.mood][knob] ?? 1;
    const ft = TEAM_FACTORS[teamMood][knob] ?? 1;
    return Amplified(fb, amp) * Amplified(ft, amp);
}

/** What the chat module reads. */
export interface MoodInfo {
    mood: BotMood;
    team: TeamMood;
    grudge: number;
    lastKiller: number;
    lead: number;
}

export function Info(bot: Unit): MoodInfo {
    Update();
    const s = State(bot.GetPlayerID());
    return { mood: s.mood, team: teamMood, grudge: s.grudge, lastKiller: s.lastKiller, lead };
}
