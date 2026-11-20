/**
 * Bot chat that reacts to the game and to what humans type in all chat (flag `smartchat`).
 * Replaces OHA's canned reply and taunt code (X.SetTalkMessage) for a flagged team.
 *
 * Events: kills (taunt, revenge on whoever killed this bot, throwing a human's own trash talk back,
 * kill streaks, first blood), deaths (tilt lines, flaming the bot's own team, or a calm "wp"), won and
 * lost fights, the team turning cocky or desperate (behavior/mood), an ancient getting low, the horn.
 * Replies: every human all-chat message is classified (behavior/talk_text) and answered by the bot it
 * names, else the bot that last fought that human, else a random bot weighted by persona. Each human
 * has a heat that rises with their trash talk and falls with "wp" / "lol"; high heat and tilt pick the
 * harsh lines (Trash_Talk_Level 3). Lines come from behavior/talk_lines plus Customize/trash_talk.lua.
 *
 * Levels (Customize.Trash_Talk_Level; Allow_Trash_Talk = false silences everything):
 *   1: replies, death lines and team lines only, mild lines; 2: also kill taunts; 3: also harsh lines.
 *
 * Messages wait a typing delay and go out from the speaking bot's own think (Tick), one burst message
 * at a time; at most TEAM_PER_MIN messages a minute per team and one message per bot every BOT_GAP s.
 *
 * Debug (Utils.DebugMode): the all-chat of enemy bots counts as human, so bot-vs-bot games exercise the
 * replies, and every message sent is traced:
 *   TALK team=2 hero=axe t=612 kind=kill to=crystal_maiden text=sit down cm
 */
import { Unit } from "bots/ts_libs/dota";
import Customize = require("bots/Customize/general");
import * as Utils from "bots/FunLib/utils";
import * as Rng from "./rng";
import * as Persona from "./persona";
import * as Mood from "./mood";
import { Kind, LINES } from "./talk_lines";
import * as Text from "./talk_text";

declare function require(this: void, path: string): unknown;

const UPDATE_PERIOD = 0.5;
const BOT_GAP = 3;
const TEAM_PER_MIN = 10;
const REPLY_GAP = 4;
const FIGHT_WINDOW = 12;
const FIGHT_GAP = 30;
const TEAM_LINE_GAP = 300;
const HEAT_DECAY = 120; // seconds per point of heat lost while the human is quiet
const QUOTE_MAX = 32;
const RECENT_MAX = 40;

/** Chance a persona taunts after a kill. */
const KILL_TALK: Record<Persona.PersonaName, number> = { hothead: 0.7, bully: 0.6, playmaker: 0.5, greedy: 0.3, guardian: 0.15 };
/** Weight of a persona when a random bot is picked to speak. */
const TALKATIVE: Record<Persona.PersonaName, number> = { hothead: 1, bully: 0.9, playmaker: 0.7, greedy: 0.5, guardian: 0.3 };
/** Chance of replying, by intent. */
const REPLY_CHANCE: Record<Text.Intent, number> = {
    qmark: 0.6,
    report: 0.85,
    bot: 0.95,
    mom: 0.9,
    ez: 0.95,
    insult: 0.9,
    challenge: 0.85,
    excuse: 0.7,
    chill: 0.7,
    end: 0.75,
    gg: 0.7,
    compliment: 0.55,
    laugh: 0.45,
    greet: 0.6,
    question: 0.6,
    unknown: 0.3,
};
const PILE_ON: Text.Intent[] = ["insult", "ez", "bot", "report", "mom"];

interface Human {
    heat: number;
    quote: string | undefined;
    lastMsg: number;
    lastReply: number;
    lastBot: number; // our bot that last killed or was killed by this human, -1 for none
    greeted: boolean;
}

interface Queued {
    due: number;
    text: string;
    kind: Kind;
    to: number;
}

interface ChatEvent {
    player_id: number;
    string: string;
    team_only: boolean;
}

const humans: Record<number, Human> = {};
const queues: Record<number, Queued[]> = {};
const lastSpoke: Record<number, number> = {};
const killerOf: Record<number, number> = {};
const counts: Record<number, { kills: number; deaths: number }> = {};
let sentTimes: number[] = [];
let recent: string[] = [];
let enemyDeaths: number[] = [];
let ourDeaths: number[] = [];
let lastUpdate = -999;
let lastFightTalk = -999;
let lastTeamLine = -999;
let teamMood: Mood.TeamMood = "even";
let started = false;
let ancientOurs = false;
let ancientTheirs = false;
let callbackInstalled = false;
let custom: Partial<Record<Kind, string[]>> | undefined;

function Rand(): number {
    return Rng.Float(0, 1);
}

function Level(): number {
    if (Customize.Allow_Trash_Talk === false) return 0;
    const l = Customize.Trash_Talk_Level;
    return typeof l === "number" ? l : 1;
}

/** Customize/trash_talk.lua: the user's own lines, by kind. The game/Customize copy wins, as for general.lua. */
function Custom(): Partial<Record<Kind, string[]>> {
    if (custom !== undefined) return custom;
    custom = {};
    for (const path of ["game/Customize/trash_talk", GetScriptDirectory() + "/Customize/trash_talk"]) {
        const [ok, mod] = pcall(require, path);
        if (ok && typeof mod === "object" && mod !== null) {
            custom = mod as Partial<Record<Kind, string[]>>;
            break;
        }
    }
    return custom;
}

function HumanOf(pid: number): Human {
    let h = humans[pid];
    if (h === undefined) {
        h = { heat: 0, quote: undefined, lastMsg: -999, lastReply: -999, lastBot: -1, greeted: false };
        humans[pid] = h;
    }
    return h;
}

function Kda(pid: number): string {
    return `${GetHeroKills(pid)}-${GetHeroDeaths(pid)}`;
}

function NickOf(pid: number): string {
    return Text.Nick(GetSelectedHeroName(pid) ?? "");
}

/** Our team's bots: player id -> unit. */
function OurBots(): Record<number, Unit> {
    const out: Record<number, Unit> = {};
    for (let i = 1; i <= 5; i++) {
        const m = GetTeamMember(i);
        if (m !== null && m !== undefined && m.IsHero() && !m.IsIllusion() && IsPlayerBot(m.GetPlayerID())) out[m.GetPlayerID()] = m;
    }
    return out;
}

function PersonaOf(pid: number): Persona.PersonaName {
    const b = OurBots()[pid];
    return b !== undefined ? Persona.Get(b) : "playmaker";
}

function Tilted(pid: number): boolean {
    const b = OurBots()[pid];
    return b !== undefined && Mood.Info(b).mood === "tilted";
}

/** A random bot of ours, weighted by persona; `prefer` (when given) doubles a bot's weight. */
function PickSpeaker(exclude: number, prefer?: (pid: number) => boolean): number {
    const bots = OurBots();
    let total = 0;
    const ids: number[] = [];
    const weights: number[] = [];
    for (const k in bots) {
        const pid = Number(k);
        if (pid === exclude) continue;
        let w = TALKATIVE[Persona.Get(bots[pid])];
        if (prefer !== undefined && prefer(pid)) w *= 2;
        ids.push(pid);
        weights.push(w);
        total += w;
    }
    if (ids.length === 0) return -1;
    let roll = Rand() * total;
    for (let i = 0; i < ids.length; i++) {
        if (roll < weights[i]) return ids[i];
        roll -= weights[i];
    }
    return ids[ids.length - 1];
}

function Vars(speaker: number, target: number): Record<string, string> {
    const v: Record<string, string> = { me: NickOf(speaker), mk: Kda(speaker) };
    let ours = 0;
    let theirs = 0;
    for (const pid of GetTeamPlayers(GetTeam())) ours += GetHeroKills(pid);
    for (const pid of GetTeamPlayers(GetOpposingTeam())) theirs += GetHeroKills(pid);
    v.score = `${ours}-${theirs}`;
    const allies: number[] = [];
    for (const pid of GetTeamPlayers(GetTeam())) if (pid !== speaker) allies.push(pid);
    if (allies.length > 0) v.ally = NickOf(allies[Math.min(allies.length - 1, Math.floor(Rand() * allies.length))]);
    if (target >= 0) {
        v.t = NickOf(target);
        v.tk = Kda(target);
        v.d = `${GetHeroDeaths(target)}`;
        const h = humans[target];
        if (h !== undefined && h.quote !== undefined) v.q = h.quote;
    }
    return v;
}

function Pool(kind: Kind, persona: Persona.PersonaName, harshOnly: boolean): string[] {
    const set = LINES[kind];
    const harsh = Level() >= 3 && set.harsh !== undefined ? set.harsh : [];
    const extra = Custom()[kind] ?? [];
    if (harshOnly && harsh.length + extra.length > 0) return [...harsh, ...extra];
    const own = set.persona !== undefined ? set.persona[persona] ?? [] : [];
    return [...set.mild, ...harsh, ...own, ...own, ...extra];
}

function TeamBudget(now: number): boolean {
    sentTimes = sentTimes.filter(t => now - t < 60);
    return sentTimes.length < TEAM_PER_MIN;
}

/** Queues a line of `kind` from `speaker` (a bot of ours) about `target` (any player, -1 for none). */
function Say(speaker: number, kind: Kind, target: number, extraDelay = 0): boolean {
    if (speaker < 0) return false;
    const now = DotaTime();
    if (now - (lastSpoke[speaker] ?? -999) < BOT_GAP || !TeamBudget(now)) return false;
    const persona = PersonaOf(speaker);
    const tilted = Tilted(speaker);
    const h = target >= 0 ? humans[target] : undefined;
    const harshOnly = Level() >= 3 && (tilted || (h !== undefined && h.heat >= 3)) && Rand() < 0.6;
    const vars = Vars(speaker, target);
    const line = Text.Choose(Pool(kind, persona, harshOnly), recent, vars, Rand) ?? Text.Choose(Pool(kind, persona, false), recent, vars, Rand);
    if (line === undefined) return false;
    recent.push(line);
    if (recent.length > RECENT_MAX) recent = recent.slice(recent.length - RECENT_MAX);

    const caps = (tilted || persona === "hothead") && Rand() < (tilted ? 0.45 : 0.15);
    let due = now + extraDelay;
    const q = queues[speaker] ?? [];
    for (const part of Text.Bursts(Text.Fill(line, vars))) {
        const text = Text.Style(part, { caps, typo: 0.06 }, Rand);
        due += (0.8 + text.length * 0.05 + Rand() * 1.2) * (tilted ? 0.6 : 1);
        q.push({ due, text, kind, to: target });
    }
    queues[speaker] = q;
    lastSpoke[speaker] = due;
    if (kind.substring(0, 6) === "reply_" || kind === "pile_on") {
        if (h !== undefined) h.lastReply = now;
    }
    return true;
}

function OnKill(bot: number, victim: number, firstBlood: boolean): void {
    if (Level() < 2) return;
    const persona = PersonaOf(bot);
    let p = KILL_TALK[persona] + (teamMood === "cocky" ? 0.15 : 0);
    let kind: Kind = "kill";
    const h = humans[victim];
    const b = OurBots()[bot];
    if (firstBlood) {
        kind = "first_blood";
        p = 0.8;
    } else if (h !== undefined && h.quote !== undefined && Rand() < 0.7) {
        kind = "throwback";
        p = 0.95;
    } else if (killerOf[bot] === victim || (b !== undefined && Mood.Info(b).grudge === victim)) {
        kind = "revenge";
        p = 0.85;
    } else if (GetHeroKills(bot) >= 5 && GetHeroDeaths(bot) <= 2 && Rand() < 0.35) {
        kind = "streak";
    }
    if (Rand() < p && Say(bot, kind, victim) && kind === "throwback" && h !== undefined) h.quote = undefined;
}

function OnDeath(bot: number, killer: number): void {
    const persona = PersonaOf(bot);
    const tilted = Tilted(bot);
    if (tilted || persona === "hothead") {
        if (Rand() < 0.55) Say(bot, Rand() < 0.4 ? "flame_team" : "death_tilt", killer);
    } else if (persona === "guardian") {
        if (Rand() < 0.25) Say(bot, "death_calm", killer);
    } else if (Rand() < 0.25) {
        Say(bot, "death_tilt", killer);
    }
}

function Scan(now: number): void {
    const ours = GetTeamPlayers(GetTeam());
    const theirs = GetTeamPlayers(GetOpposingTeam());
    const ourScorers: number[] = [];
    const theirScorers: number[] = [];
    const ourDied: number[] = [];
    const theirDied: number[] = [];
    let ourKills = 0;
    let theirKills = 0;
    for (const pid of ours) {
        const k = GetHeroKills(pid);
        const d = GetHeroDeaths(pid);
        ourKills += k;
        const c = counts[pid];
        if (c !== undefined) {
            if (k > c.kills) ourScorers.push(pid);
            if (d > c.deaths) ourDied.push(pid);
        }
        counts[pid] = { kills: k, deaths: d };
    }
    for (const pid of theirs) {
        const k = GetHeroKills(pid);
        const d = GetHeroDeaths(pid);
        theirKills += k;
        const c = counts[pid];
        if (c !== undefined) {
            if (k > c.kills) theirScorers.push(pid);
            if (d > c.deaths) theirDied.push(pid);
        }
        counts[pid] = { kills: k, deaths: d };
    }
    for (const victim of theirDied) {
        enemyDeaths.push(now);
        const killer = ourScorers.length > 0 ? ourScorers[0] : -1;
        if (killer >= 0) {
            HumanOf(victim).lastBot = killer;
            if (IsPlayerBot(killer)) OnKill(killer, victim, ourKills === 1 && theirKills === 0);
        }
    }
    for (const victim of ourDied) {
        ourDeaths.push(now);
        const killer = theirScorers.length > 0 ? theirScorers[0] : -1;
        killerOf[victim] = killer;
        if (killer >= 0) HumanOf(killer).lastBot = victim;
        if (IsPlayerBot(victim)) OnDeath(victim, killer);
    }
}

function Fights(now: number): void {
    enemyDeaths = enemyDeaths.filter(t => now - t <= FIGHT_WINDOW);
    ourDeaths = ourDeaths.filter(t => now - t <= FIGHT_WINDOW);
    if (now - lastFightTalk < FIGHT_GAP) return;
    if (enemyDeaths.length >= 3 && ourDeaths.length <= 1) {
        if (Say(PickSpeaker(-1), "fight_won", -1)) lastFightTalk = now;
    } else if (ourDeaths.length >= 3 && enemyDeaths.length <= 1) {
        if (Say(PickSpeaker(-1, pid => Tilted(pid) || PersonaOf(pid) === "hothead"), "fight_lost", -1)) lastFightTalk = now;
    }
}

function TeamLines(now: number): void {
    const bots = OurBots();
    let any: Unit | undefined;
    for (const k in bots) {
        any = bots[Number(k)];
        break;
    }
    if (any === undefined) return;
    const next = Mood.Info(any).team;
    if (next !== teamMood) {
        teamMood = next;
        if (next !== "even" && now - lastTeamLine >= TEAM_LINE_GAP) {
            const speaker = next === "desperate" ? PickSpeaker(-1, pid => PersonaOf(pid) === "hothead") : PickSpeaker(-1);
            if (Say(speaker, next, -1)) lastTeamLine = now;
        }
    }
    const ancient = (team: number): number => {
        const a = GetAncient(team);
        return a !== null && a !== undefined ? a.GetHealth() / Math.max(1, a.GetMaxHealth()) : 1;
    };
    if (!ancientOurs && ancient(GetTeam()) < 0.25) {
        ancientOurs = true;
        Say(PickSpeaker(-1), "our_ancient_low", -1);
    }
    if (!ancientTheirs && ancient(GetOpposingTeam()) < 0.25) {
        ancientTheirs = true;
        Say(PickSpeaker(-1), "their_ancient_low", -1);
    }
}

function ReplyKind(intent: Text.Intent): Kind {
    if (intent === "gg" || intent === "end") {
        const bots = OurBots();
        let lead = 0;
        for (const k in bots) {
            lead = Mood.Info(bots[Number(k)]).lead;
            break;
        }
        return `reply_${intent}_${lead >= 0 ? "ahead" : "behind"}` as Kind;
    }
    return `reply_${intent}` as Kind;
}

function OnChat(c: ChatEvent): void {
    const pid = c.player_id;
    if (Utils.DebugMode)
        print(`CHATIN team=${GetTeam()} t=${Math.floor(DotaTime())} pid=${pid} bot=${IsPlayerBot(pid)} ally=${IsTeamPlayer(pid)} teamonly=${c.team_only} text=${c.string}`);
    if (pid === undefined || c.team_only || IsTeamPlayer(pid)) return;
    if (IsPlayerBot(pid) && !Utils.DebugMode) return;
    const now = DotaTime();
    const text = c.string ?? "";
    const intent = Text.Classify(text);
    const h = HumanOf(pid);
    h.heat = Math.max(0, h.heat - Math.floor((now - h.lastMsg) / HEAT_DECAY));
    h.lastMsg = now;
    if (Text.TRASH_INTENTS.indexOf(intent) >= 0) {
        h.heat += intent === "ez" ? 2 : 1;
        if (intent !== "qmark" && text.length <= QUOTE_MAX) h.quote = text.toLowerCase();
    } else if (intent === "compliment" || intent === "laugh" || intent === "greet") {
        h.heat = Math.max(0, h.heat - 1);
    }
    if (intent === "greet") {
        if (h.greeted) return;
        h.greeted = true;
    }
    if (now - h.lastReply < REPLY_GAP) return;

    // Who answers: the bot the message names, else the bot that last fought this human, else a random one.
    const bots = OurBots();
    const ids: number[] = [];
    const nicks: string[] = [];
    for (const k in bots) {
        ids.push(Number(k));
        nicks.push(NickOf(Number(k)));
    }
    if (ids.length === 0) return;
    const named = Text.FindAddressed(text, nicks);
    let speaker = named >= 0 ? ids[named] : bots[h.lastBot] !== undefined ? h.lastBot : PickSpeaker(-1);
    if (speaker < 0) speaker = ids[0];

    const persona = PersonaOf(speaker);
    let p = REPLY_CHANCE[intent] * (persona === "guardian" ? 0.6 : persona === "hothead" ? 1.2 : 1);
    if (named >= 0) p = Math.max(p, 0.85);
    if (Rand() >= p) return;
    if (!Say(speaker, ReplyKind(intent), pid)) return;
    if (PILE_ON.indexOf(intent) >= 0 && Level() >= 2 && Rand() < 0.15) Say(PickSpeaker(speaker), "pile_on", pid, 2.5);
}

function Update(): void {
    const now = DotaTime();
    if (now - lastUpdate < UPDATE_PERIOD) return;
    lastUpdate = now;
    if (!started && now >= 0) {
        started = true;
        if (Rand() < 0.35) Say(PickSpeaker(-1), "game_start", -1, Rand() * 4);
    }
    Scan(now);
    Fights(now);
    TeamLines(now);
}

function Flush(bot: Unit): void {
    const pid = bot.GetPlayerID();
    const q = queues[pid];
    if (q === undefined || q.length === 0) return;
    const now = DotaTime();
    while (q.length > 0 && q[0].due <= now) {
        const m = q.shift() as Queued;
        bot.ActionImmediate_Chat(m.text, true);
        sentTimes.push(now);
        if (Utils.DebugMode) {
            const to = m.to >= 0 ? (GetSelectedHeroName(m.to) ?? "").replace("npc_dota_hero_", "") : "-";
            print(`TALK team=${GetTeam()} hero=${bot.GetUnitName().replace("npc_dota_hero_", "")} t=${Math.floor(now)} kind=${m.kind} to=${to} text=${m.text}`);
        }
    }
}

/** Called from each bot's courier think (every 0.5 s, alive or dead). Returns true (SafeCall reads nil as an error). */
export function Tick(bot: Unit): boolean {
    if (Level() <= 0 || !bot.IsHero() || bot.IsIllusion()) return true;
    if (!callbackInstalled) {
        callbackInstalled = true;
        InstallChatCallback((c: ChatEvent) => OnChat(c));
    }
    Update();
    Flush(bot);
    return true;
}
