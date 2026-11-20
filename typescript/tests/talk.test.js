// Offline tests for the bot chat text logic (flag `smartchat`): npm test
//
// behavior/talk_text.ts and behavior/talk_lines.ts are pure (no game API, no regular expressions), so the
// same source the game runs as Lua is transpiled here to JavaScript and checked: message intents, hero
// nicknames, placeholders, typing style, and the line bank (every placeholder known, every kind filled,
// no banned words).
const fs = require("fs");
const os = require("os");
const path = require("path");
const ts = require("typescript");

const SRC = path.join(__dirname, "..", "bots", "FunLib", "behavior");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "talk-test-"));
for (const name of ["talk_text", "talk_lines"]) {
    const src = fs.readFileSync(path.join(SRC, name + ".ts"), "utf8");
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
    fs.writeFileSync(path.join(OUT, name + ".js"), js);
}
const Text = require(path.join(OUT, "talk_text.js"));
const { LINES } = require(path.join(OUT, "talk_lines.js"));

let failed = 0;
let passed = 0;
function check(name, ok, detail) {
    if (ok) passed++;
    else {
        failed++;
        console.log(`FAIL ${name}${detail !== undefined ? ": " + detail : ""}`);
    }
}
function eq(name, got, want) {
    check(name, got === want, `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
// Deterministic random numbers for the tests.
function seq(seed) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

// --- Classify: real all-chat messages and what they mean.
const intents = [
    ["?", "qmark"],
    ["???", "qmark"],
    ["? !", "qmark"],
    ["ez", "ez"],
    ["EZZZZ", "ez"],
    ["gg ez", "ez"],
    ["so easy lol", "ez"],
    ["report jugg", "report"],
    ["reported", "report"],
    ["are you a bot", "bot"],
    ["these bots are so bad", "bot"],
    ["ur mom", "mom"],
    ["noob cm", "insult"],
    ["u r trash", "insult"],
    ["stfu", "insult"],
    ["1v1 me mid", "challenge"],
    ["come here", "challenge"],
    ["fight me", "challenge"],
    ["lag", "excuse"],
    ["sorry door", "excuse"],
    ["so toxic", "chill"],
    ["chill bro", "chill"],
    ["end pls", "end"],
    ["ff", "end"],
    ["gg", "gg"],
    ["ggwp", "gg"],
    ["gg wp", "gg"],
    ["wp", "compliment"],
    ["nice one", "compliment"],
    ["lol", "laugh"],
    ["xddd", "laugh"],
    ["hahaha", "laugh"],
    ["glhf", "greet"],
    ["hi", "greet"],
    ["why did u go there", "question"],
    ["wtf", "question"],
    ["where is ur support?", "question"],
    ["buying smoke", "unknown"],
    ["", "unknown"],
    ["   ", "unknown"],
];
for (const [msg, want] of intents) eq(`Classify(${JSON.stringify(msg)})`, Text.Classify(msg), want);

// --- Nicknames.
const nicks = [
    ["npc_dota_hero_crystal_maiden", "cm"],
    ["npc_dota_hero_antimage", "am"],
    ["npc_dota_hero_juggernaut", "jugg"],
    ["npc_dota_hero_axe", "axe"],
    ["npc_dota_hero_phantom_assassin", "pa"],
    ["npc_dota_hero_keeper_of_the_light", "kotl"],
    ["npc_dota_hero_dragon_knight", "dk"],
    ["npc_dota_hero_nevermore", "sf"],
    ["npc_dota_hero_pudge", "pudge"],
    ["", ""],
];
for (const [hero, want] of nicks) eq(`Nick(${hero})`, Text.Nick(hero), want);

// --- Who a message names.
eq("FindAddressed names cm", Text.FindAddressed("noob cm", ["axe", "cm", "jugg"]), 1);
eq("FindAddressed whole words only", Text.FindAddressed("axes are cool", ["axe"]), -1);
eq("FindAddressed none", Text.FindAddressed("gg", ["axe", "cm"]), -1);
eq("FindAddressed punctuation", Text.FindAddressed("jugg??", ["axe", "jugg"]), 1);

// --- Templates.
eq("Fill", Text.Fill("sit down {t} {tk}", { t: "cm", tk: "0-5" }), "sit down cm 0-5");
eq("Fill unknown left", Text.Fill("hi {x}", {}), "hi {x}");
eq("CanFill yes", Text.CanFill("{t} {tk}", { t: "a", tk: "b" }), true);
eq("CanFill no", Text.CanFill("{q} lol", { t: "a" }), false);
eq("Bursts", JSON.stringify(Text.Bursts("outplayed|lol")), JSON.stringify(["outplayed", "lol"]));

// --- Style.
eq("Style caps", Text.Style("sit down", { caps: true, typo: 0 }, seq(1)), "SIT DOWN");
eq("Style plain", Text.Style("sit down", { caps: false, typo: 0 }, seq(1)), "sit down");
{
    const typo = Text.Style("outplayed again", { caps: false, typo: 1 }, seq(7));
    check("Style typo keeps length", typo.length === "outplayed again".length, typo);
    check("Style typo changes text", typo !== "outplayed again", typo);
}

// --- Choose skips recent lines and lines it cannot fill.
{
    const pool = ["a", "b", "{q} c"];
    const r = seq(3);
    for (let i = 0; i < 20; i++) {
        const got = Text.Choose(pool, ["a"], { t: "x" }, r);
        check("Choose fresh and fillable", got === "b", got);
    }
    eq("Choose nothing fits", Text.Choose(["{q}"], [], {}, seq(1)), undefined);
}

// --- Line bank.
const KNOWN = ["t", "tk", "d", "me", "mk", "ally", "q", "score"];
const BANNED = ["retard", "kys", "kill yourself", "killyourself", "nigger", "nigga", "faggot", "fag ", "tranny", "cancer", "rape"];
const allVars = { t: "cm", tk: "1-6", d: "6", me: "axe", mk: "7-1", ally: "jugg", q: "ez noob", score: "20-5" };
for (const kind of Object.keys(LINES)) {
    const set = LINES[kind];
    check(`${kind} has mild lines`, Array.isArray(set.mild) && set.mild.length > 0);
    const all = [...set.mild, ...(set.harsh || [])];
    for (const p of Object.keys(set.persona || {})) all.push(...set.persona[p]);
    for (const line of all) {
        let i = line.indexOf("{");
        while (i >= 0) {
            const close = line.indexOf("}", i);
            const name = line.substring(i + 1, close);
            check(`${kind} placeholder {${name}} known`, KNOWN.includes(name), line);
            i = line.indexOf("{", close);
        }
        const filled = Text.Fill(line, allVars);
        check(`${kind} fills completely`, !filled.includes("{"), line);
        for (const part of Text.Bursts(filled)) check(`${kind} message short`, part.length <= 70, part);
        const low = (" " + line.toLowerCase() + " ");
        for (const b of BANNED) check(`${kind} has no "${b.trim()}"`, !low.includes(b), line);
    }
}
// Every intent has a reply kind (gg and end split by lead).
for (const intent of ["qmark", "report", "bot", "mom", "ez", "insult", "challenge", "excuse", "chill", "compliment", "laugh", "greet", "question", "unknown"])
    check(`reply_${intent} exists`, LINES[`reply_${intent}`] !== undefined);
for (const intent of ["gg", "end"]) for (const side of ["ahead", "behind"]) check(`reply_${intent}_${side} exists`, LINES[`reply_${intent}_${side}`] !== undefined);

// --- A sample conversation, printed for a read-through (npm test -- --show).
if (process.argv.includes("--show")) {
    const r = seq(42);
    for (const msg of ["ez", "noob axe", "are you a bot", "report", "lol", "?", "ur mom", "1v1 mid", "gg", "why"]) {
        const intent = Text.Classify(msg);
        const kind = intent === "gg" || intent === "end" ? `reply_${intent}_ahead` : `reply_${intent}`;
        const set = LINES[kind];
        const pool = [...set.mild, ...(set.harsh || [])];
        const line = Text.Choose(pool, [], allVars, r);
        console.log(`  human: ${msg.padEnd(16)} -> ${intent.padEnd(10)} bot: ${Text.Bursts(Text.Fill(line, allVars)).join(" / ")}`);
    }
}

fs.rmSync(OUT, { recursive: true, force: true });
console.log(`talk tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
