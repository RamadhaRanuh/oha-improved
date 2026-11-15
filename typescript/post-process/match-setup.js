// Sets up one measurement game (docs/specs/smarter-bot-behaviour.md section 13).
//
//   npm run match -- <game> <flag>[,<flag>...]   e.g.  npm run match -- 3 arbiter
//   npm run match -- play <flag>[,<flag>...]     human-vs-bot feel game: flags on BOTH teams, heroes untouched
//   npm run match -- play none                   same, every flag off (baseline OHA with debug prints)
//   npm run match -- reset                       put general.lua and utils.lua back as they were
//   ... --explore=0.03                           data game: bots sometimes force a random fight / run
//
// Every setup also turns on the fight decision log (Customize.DecisionLog; FIGHTDEC / FIGHTOUT lines,
// docs/specs/learned-fight-decisions.md), with explore 0 unless --explore is given.
//
// <game> is 1..32: game n plays lineup pair ceil(n/4) in rotation ((n-1) % 4) + 1, so a
// screen is games 1-8 (pairs 1 and 2) and a confirm run is games 1-32.
// Lineups come from docs/specs/measurement-lineups.md. Rotations:
//   1: Radiant A, Dire B, flags on Radiant    2: Radiant B, Dire A, flags on Dire
//   3: Radiant B, Dire A, flags on Radiant    4: Radiant A, Dire B, flags on Dire
//
// It writes Customize.Radiant_Heros / Dire_Heros and Customize.Behavior in
// bots/Customize/general.lua, and turns Utils.DebugMode on in bots/FunLib/utils.lua so the
// thrash counter prints. The first run keeps backups (*.matchbak). `reset` restores them.
// `npm run build` regenerates utils.lua with DebugMode off, so run this again after building.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const generalPath = path.join(root, "bots/Customize/general.lua");
const utilsPath = path.join(root, "bots/FunLib/utils.lua");
const lineupsPath = path.join(root, "docs/specs/measurement-lineups.md");
const FLAGS = ["arbiter", "laning", "fight", "retreat", "group", "farm", "roam", "humanfeel", "escape"];
const backup = p => p + ".matchbak";

function fail(msg) {
    console.error(msg);
    process.exit(1);
}

const rawArgs = process.argv.slice(2);
let explore = 0;
const args = rawArgs.filter(a => {
    const m = a.match(/^--explore=([0-9.]+)$/);
    if (m) explore = Number(m[1]);
    return !m;
});
if (!(explore >= 0 && explore <= 1)) fail("--explore must be between 0 and 1");
// Customize.DecisionLog: logging on for every match setup.
const withDecisionLog = text => {
    const re = /Customize\.DecisionLog = \{[^}]*\}/;
    const line = `Customize.DecisionLog = { enabled = true, explore = ${explore} }`;
    if (re.test(text)) return text.replace(re, line);
    const nl = text.includes("\r\n") ? "\r\n" : "\n";
    return text.replace(/\r?\nreturn Customize/, nl + line + nl + "return Customize");
};
if (args[0] === "reset") {
    for (const p of [generalPath, utilsPath]) {
        if (fs.existsSync(backup(p))) {
            fs.copyFileSync(backup(p), p);
            fs.unlinkSync(backup(p));
            console.log(`Restored ${path.relative(root, p)}`);
        } else {
            console.log(`No backup for ${path.relative(root, p)}, left as it is`);
        }
    }
    process.exit(0);
}

const parseFlags = arg => {
    if (arg === "none") return []; // "play none": every flag off (baseline OHA), debug prints on
    const on = (arg || "").split(",").map(s => s.trim()).filter(Boolean);
    if (!on.length) fail(`Name the flags, e.g. "arbiter". Known: ${FLAGS.join(", ")}`);
    for (const f of on) if (!FLAGS.includes(f)) fail(`Unknown flag "${f}". Known: ${FLAGS.join(", ")}`);
    return on;
};
const setDebugMode = () => {
    const utils = fs.readFileSync(utilsPath, "utf8");
    if (!/____exports\.DebugMode = (true|false)/.test(utils)) fail("Could not find DebugMode in bots/FunLib/utils.lua");
    fs.writeFileSync(utilsPath, utils.replace(/____exports\.DebugMode = (true|false)/, "____exports.DebugMode = true"));
};

if (args[0] === "play") {
    const on = parseFlags(args[1]);
    for (const p of [generalPath, utilsPath]) if (!fs.existsSync(backup(p))) fs.copyFileSync(p, backup(p));
    let text = fs.readFileSync(generalPath, "utf8");
    const nl = text.includes("\r\n") ? "\r\n" : "\n";
    const row = FLAGS.map(f => `${f} = ${on.includes(f)}`).join(", ");
    const re = /Customize\.Behavior = \{[\s\S]*?\n\}/;
    if (!re.test(text)) fail("Could not find Customize.Behavior in general.lua");
    text = text.replace(re, `Customize.Behavior = {${nl}    Radiant = { ${row} },${nl}    Dire    = { ${row} },${nl}}`);
    fs.writeFileSync(generalPath, withDecisionLog(text));
    setDebugMode();
    console.log(`Play setup: flags on both teams (${on.length ? on.join(", ") : "none: baseline OHA"}); heroes as in general.lua. Debug prints on.`);
    console.log("When done: npm run match -- reset");
    process.exit(0);
}

const game = Number(args[0]);
if (!Number.isInteger(game) || game < 1 || game > 32) fail("Usage: npm run match -- <game 1-32> <flag>[,<flag>...]   or   npm run match -- reset");
const flagsOn = (args[1] || "").split(",").map(s => s.trim()).filter(Boolean);
if (!flagsOn.length) fail(`Name the flags for the new team, e.g. "arbiter". Known: ${FLAGS.join(", ")}`);
for (const f of flagsOn) if (!FLAGS.includes(f)) fail(`Unknown flag "${f}". Known: ${FLAGS.join(", ")}`);

// Lineups: rows like "| 1 | A | juggernaut | puck | axe | earthshaker | crystal_maiden |"
const lineups = {};
for (const line of fs.readFileSync(lineupsPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*([AB])\s*\|(.+)\|\s*$/);
    if (!m) continue;
    const heroes = m[3].split("|").map(s => s.trim()).filter(Boolean);
    if (heroes.length === 5) (lineups[m[1]] = lineups[m[1]] || {})[m[2]] = heroes;
}

const pair = Math.ceil(game / 4);
const rotation = ((game - 1) % 4) + 1;
const lineup = lineups[pair];
if (!lineup || !lineup.A || !lineup.B) fail(`Pair ${pair} is missing from ${path.relative(root, lineupsPath)}`);
const radiantSide = rotation === 1 || rotation === 4 ? "A" : "B";
const direSide = radiantSide === "A" ? "B" : "A";
const newTeam = rotation === 1 || rotation === 3 ? "Radiant" : "Dire";

for (const p of [generalPath, utilsPath]) if (!fs.existsSync(backup(p))) fs.copyFileSync(p, backup(p));

// general.lua
const eol = s => (s.includes("\r\n") ? "\r\n" : "\n");
let general = fs.readFileSync(generalPath, "utf8");
const nl = eol(general);
const heroTable = (name, heroes) =>
    `Customize.${name} = {${nl}${heroes.map(h => `    'npc_dota_hero_${h}',`).join(nl)}${nl}}`;
const replaceTable = (text, name, value) => {
    const re = new RegExp(`Customize\\.${name} = \\{[\\s\\S]*?\\n\\}`);
    if (!re.test(text)) fail(`Could not find Customize.${name} in general.lua`);
    return text.replace(re, value);
};
const flagRow = on => FLAGS.map(f => `${f} = ${on && flagsOn.includes(f)}`).join(", ");
general = replaceTable(general, "Radiant_Heros", heroTable("Radiant_Heros", lineup[radiantSide]));
general = replaceTable(general, "Dire_Heros", heroTable("Dire_Heros", lineup[direSide]));
general = replaceTable(
    general,
    "Behavior",
    `Customize.Behavior = {${nl}    Radiant = { ${flagRow(newTeam === "Radiant")} },${nl}    Dire    = { ${flagRow(newTeam === "Dire")} },${nl}}`
);
fs.writeFileSync(generalPath, withDecisionLog(general));

// utils.lua: DebugMode on, for the thrash counter
const utils = fs.readFileSync(utilsPath, "utf8");
if (!/____exports\.DebugMode = (true|false)/.test(utils)) fail("Could not find DebugMode in bots/FunLib/utils.lua");
fs.writeFileSync(utilsPath, utils.replace(/____exports\.DebugMode = (true|false)/, "____exports.DebugMode = true"));

console.log(`Game ${game}: pair ${pair}, rotation ${rotation}`);
console.log(`  Radiant: lineup ${radiantSide}  ${lineup[radiantSide].join(", ")}${newTeam === "Radiant" ? `   <- NEW (${flagsOn.join(", ")})` : ""}`);
console.log(`  Dire:    lineup ${direSide}  ${lineup[direSide].join(", ")}${newTeam === "Dire" ? `   <- NEW (${flagsOn.join(", ")})` : ""}`);
console.log(`  Debug prints on (thrash counter). Decision log on, explore ${explore}. Check the picks match at the start of the game.`);
