/**
 * Pure text helpers for bot chat (flag `smartchat`, behavior/talk): message intent, hero nicknames,
 * template filling and the typing style. No game API calls and no regular expressions, so the same
 * source compiles to Lua (TSTL) for the game and to JavaScript for the offline tests
 * (typescript/tests/talk.test.js).
 */

export type Intent =
    | "qmark"
    | "report"
    | "bot"
    | "mom"
    | "ez"
    | "insult"
    | "challenge"
    | "excuse"
    | "chill"
    | "end"
    | "gg"
    | "compliment"
    | "laugh"
    | "greet"
    | "question"
    | "unknown";

/** Intents that count as trash talk from a human: they raise heat and can be quoted back later. */
export const TRASH_INTENTS: Intent[] = ["qmark", "report", "bot", "mom", "ez", "insult", "challenge"];

function IsAlnum(c: string): boolean {
    const b = c.charCodeAt(0);
    return (b >= 48 && b <= 57) || (b >= 97 && b <= 122);
}

/** Lowercase words of a message; anything that is not a letter or digit splits words. */
export function Words(msg: string): string[] {
    const text = msg.toLowerCase();
    const out: string[] = [];
    let cur = "";
    for (let i = 0; i < text.length; i++) {
        const c = text.substring(i, i + 1);
        if (IsAlnum(c)) cur += c;
        else if (cur.length > 0) {
            out.push(cur);
            cur = "";
        }
    }
    if (cur.length > 0) out.push(cur);
    return out;
}

function Trim(s: string): string {
    let a = 0;
    let b = s.length;
    while (a < b && s.substring(a, a + 1) === " ") a++;
    while (b > a && s.substring(b - 1, b) === " ") b--;
    return s.substring(a, b);
}

/** "ez", "ezz", "ezzzz", "easy". */
function IsEz(w: string): boolean {
    if (w === "easy" || w === "ezpz" || w === "izi") return true;
    if (w.length < 2 || w.substring(0, 2) !== "ez") return false;
    for (let i = 2; i < w.length; i++) if (w.substring(i, i + 1) !== "z") return false;
    return true;
}

/** "lol", "lmao", "xd", "xddd", "haha", "hahaha", "kek". */
function IsLaugh(w: string): boolean {
    if (w === "lol" || w === "lmao" || w === "lmfao" || w === "kek" || w === "rofl" || w === "lul" || w === "kekw") return true;
    if (w.length >= 2 && w.substring(0, 2) === "xd") return true;
    if (w.length >= 4 && (w.substring(0, 4) === "haha" || w.substring(0, 4) === "ahah" || w.substring(0, 4) === "hehe")) return true;
    return false;
}

function Has(words: string[], list: string[]): boolean {
    for (const w of words) if (list.indexOf(w) >= 0) return true;
    return false;
}

function HasPair(words: string[], a: string, b: string): boolean {
    for (let i = 0; i + 1 < words.length; i++) if (words[i] === a && words[i + 1] === b) return true;
    return false;
}

const INSULTS = [
    "noob", "nub", "noobs", "newb", "trash", "garbage", "bad", "dog", "idiot", "stupid", "feeder", "feed", "feeding",
    "useless", "loser", "pathetic", "uninstall", "clown", "shit", "suck", "sucks", "dumb", "braindead", "boosted",
    "cringe", "l2p", "stfu", "noobest", "scrub", "potato", "rat", "monkey", "fuck", "fucking", "bitch", "bozo", "ass",
];

/** What a human's message is about, from its words. The first matching rule wins. */
export function Classify(msg: string): Intent {
    const raw = Trim(msg);
    if (raw.length === 0) return "unknown";
    let allMarks = true;
    for (let i = 0; i < raw.length; i++) {
        const c = raw.substring(i, i + 1);
        if (c !== "?" && c !== "!" && c !== " ") allMarks = false;
    }
    if (allMarks && raw.indexOf("?") >= 0) return "qmark";

    const w = Words(raw);
    if (w.length === 0) return "unknown";
    if (Has(w, ["report", "reported", "reporting"])) return "report";
    if (Has(w, ["bot", "bots", "ai", "robot", "botting"])) return "bot";
    if (Has(w, ["mom", "mother", "mum", "mama", "momma", "ur mom"])) return "mom";
    for (const x of w) if (IsEz(x)) return "ez";
    if (Has(w, ["1v1", "1vs1", "fightme"]) || HasPair(w, "fight", "me") || HasPair(w, "come", "here") || (w.length <= 2 && w[0] === "come"))
        return "challenge";
    if (Has(w, INSULTS)) return "insult";
    if (Has(w, ["lag", "lagging", "door", "afk", "dc", "disconnect", "ping"])) return "excuse";
    if (Has(w, ["toxic", "chill", "calm", "relax", "stop", "cry"])) return "chill";
    if (Has(w, ["end", "ff", "surrender", "ff20", "ff15", "concede"])) return "end";
    if (Has(w, ["gg", "ggwp", "ggs", "gege"])) return "gg";
    if (Has(w, ["hi", "hello", "glhf", "gl", "hf", "hey", "yo", "sup", "hola", "hii"])) return "greet";
    if (Has(w, ["wp", "nice", "gj", "ns", "respect", "well", "clean", "good", "gw", "nt"])) return "compliment";
    for (const x of w) if (IsLaugh(x)) return "laugh";
    if (Has(w, ["why", "how", "what", "wtf", "who", "when"]) || raw.substring(raw.length - 1) === "?") return "question";
    return "unknown";
}

/** Nicknames players actually type. Others: initials of multi-word names, or the single word. */
const NICKS: Record<string, string> = {
    antimage: "am",
    earthshaker: "es",
    juggernaut: "jugg",
    faceless_void: "void",
    nevermore: "sf",
    queenofpain: "qop",
    skeleton_king: "wk",
    zuus: "zeus",
    rattletrap: "clock",
    furion: "np",
    obsidian_destroyer: "od",
    shredder: "timber",
    wisp: "io",
    windrunner: "wr",
    life_stealer: "naix",
    magnataur: "magnus",
    doom_bringer: "doom",
    abyssal_underlord: "underlord",
    vengefulspirit: "venge",
    drow_ranger: "drow",
    storm_spirit: "storm",
    ember_spirit: "ember",
    earth_spirit: "earth spirit",
    void_spirit: "void spirit",
    shadow_shaman: "shaman",
    bloodseeker: "bs",
    spirit_breaker: "bara",
    night_stalker: "ns",
    necrolyte: "necro",
    treant: "treant",
    centaur: "centaur",
    crystal_maiden: "cm",
    phantom_assassin: "pa",
    witch_doctor: "wd",
    templar_assassin: "ta",
    lone_druid: "ld",
    troll_warlord: "troll",
    ogre_magi: "ogre",
    naga_siren: "naga",
    winter_wyvern: "wyvern",
    skywrath_mage: "sky",
    dark_willow: "willow",
    monkey_king: "mk",
    legion_commander: "lc",
    death_prophet: "dp",
    primal_beast: "pb",
    marci: "marci",
    tinker: "tinker",
    sand_king: "sk",
    elder_titan: "et",
    keeper_of_the_light: "kotl",
};

/** "npc_dota_hero_crystal_maiden" -> "cm". */
export function Nick(heroName: string): string {
    const prefix = "npc_dota_hero_";
    const base = heroName.indexOf(prefix) === 0 ? heroName.substring(prefix.length) : heroName;
    const known = NICKS[base];
    if (known !== undefined) return known;
    const parts = base.split("_");
    if (parts.length === 1) return base;
    let out = "";
    for (const p of parts) if (p.length > 0) out += p.substring(0, 1);
    return out;
}

/** Index of the first nickname a message names as a whole word, or -1. */
export function FindAddressed(msg: string, nicks: string[]): number {
    const w = Words(msg);
    const joined = " " + w.join(" ") + " ";
    for (let i = 0; i < nicks.length; i++) {
        const n = nicks[i];
        if (n.length < 2) continue;
        if (joined.indexOf(" " + n + " ") >= 0) return i;
    }
    return -1;
}

/** Replaces {name} with vars[name]; an unknown name is left as is. */
export function Fill(template: string, vars: Record<string, string>): string {
    let out = "";
    let i = 0;
    while (i < template.length) {
        const c = template.substring(i, i + 1);
        if (c === "{") {
            const close = template.indexOf("}", i);
            if (close > i) {
                const key = template.substring(i + 1, close);
                const v = vars[key];
                out += v !== undefined ? v : template.substring(i, close + 1);
                i = close + 1;
                continue;
            }
        }
        out += c;
        i++;
    }
    return out;
}

/** True when a template only uses names that vars has (so no "{t}" reaches chat). */
export function CanFill(template: string, vars: Record<string, string>): boolean {
    let i = template.indexOf("{");
    while (i >= 0) {
        const close = template.indexOf("}", i);
        if (close < 0) return true;
        if (vars[template.substring(i + 1, close)] === undefined) return false;
        i = template.indexOf("{", close);
    }
    return true;
}

/** A line is one or more chat messages sent in a quick burst, split by "|". */
export function Bursts(line: string): string[] {
    const out: string[] = [];
    for (const p of line.split("|")) {
        const t = Trim(p);
        if (t.length > 0) out.push(t);
    }
    return out;
}

export interface StyleOptions {
    /** All caps (tilted). */
    caps: boolean;
    /** Chance of one swapped-letter typo. */
    typo: number;
}

/** Typing style: caps when tilted, an occasional swapped-letter typo in a longer word. */
export function Style(text: string, o: StyleOptions, rand: () => number): string {
    let out = text;
    if (o.typo > 0 && rand() < o.typo) {
        const words = out.split(" ");
        const longIdx: number[] = [];
        for (let i = 0; i < words.length; i++) if (words[i].length >= 5 && words[i].indexOf("{") < 0) longIdx.push(i);
        if (longIdx.length > 0) {
            const wi = longIdx[Math.min(longIdx.length - 1, Math.floor(rand() * longIdx.length))];
            const w = words[wi];
            const p = 1 + Math.min(w.length - 3, Math.floor(rand() * (w.length - 2)));
            words[wi] = w.substring(0, p) + w.substring(p + 1, p + 2) + w.substring(p, p + 1) + w.substring(p + 2);
            out = words.join(" ");
        }
    }
    if (o.caps) out = out.toUpperCase();
    return out;
}

/**
 * Picks a line from a pool, skipping lines said recently and lines whose placeholders cannot be filled.
 * Returns undefined when nothing fits.
 */
export function Choose(pool: string[], recent: string[], vars: Record<string, string>, rand: () => number): string | undefined {
    const fresh: string[] = [];
    const fillable: string[] = [];
    for (const line of pool) {
        if (!CanFill(line, vars)) continue;
        fillable.push(line);
        if (recent.indexOf(line) < 0) fresh.push(line);
    }
    const from = fresh.length > 0 ? fresh : fillable;
    if (from.length === 0) return undefined;
    return from[Math.min(from.length - 1, Math.floor(rand() * from.length))];
}
