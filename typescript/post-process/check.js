// Fast static checks before a smoke game (npm run check). A syntax error in a bot script only shows up
// in a 25-minute game otherwise.
//   1. Every Lua file under bots/ parses (luaparse 5.2 mode: its 5.1/LuaJIT modes reject a valid `break;` before `end`).
//   2. No generated Lua file still has a raw require("bots.x") / dofile("bots.x"): left behind when tstl
//      failed and the build's post-process never ran (the game cannot load those paths).
//   3. Every post-process script passes `node --check`.
//   4./5. Flag and Tune names agree between the bot code, flags.ts and match-setup.js.
// Exit code 1 on any failure.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const luaparse = require("luaparse");

const root = path.join(__dirname, "../..");
const failures = [];

function walk(dir, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out);
        else if (e.name.endsWith(".lua")) out.push(p);
    }
    return out;
}

const luaFiles = walk(path.join(root, "bots"), []);
let rawRequires = 0;
for (const f of luaFiles) {
    const text = fs.readFileSync(f, "utf8");
    try {
        luaparse.parse(text, { luaVersion: "5.2", comments: false, locations: false });
    } catch (e) {
        failures.push(`Lua syntax: ${path.relative(root, f)}: ${e.message}`);
    }
    if (/(require|dofile)\("bots[./]/.test(text)) {
        rawRequires++;
        if (rawRequires <= 5) failures.push(`Raw require("bots.x") (re-run npm run build; the TS step failed before post-process): ${path.relative(root, f)}`);
    }
}
if (rawRequires > 5) failures.push(`... and ${rawRequires - 5} more files with raw require("bots.x")`);

// 4. Flag names agree: every IsOn("x") in the bot code is in match-setup.js FLAGS (otherwise the flag can
//    never be switched on) and in the FlagName type in flags.ts, and every listed flag is read somewhere.
{
    const setup = fs.readFileSync(path.join(root, "typescript/post-process/match-setup.js"), "utf8");
    const listed = new Set(JSON.parse((setup.match(/const FLAGS = (\[[^\]]*\])/) || [, "[]"])[1].replace(/'/g, '"')));
    const typeText = fs.readFileSync(path.join(root, "typescript/bots/FunLib/behavior/flags.ts"), "utf8");
    const typed = new Set([...((typeText.match(/type FlagName =([^;]*);/) || [, ""])[1].matchAll(/"([a-z0-9_]+)"/g))].map(m => m[1]));
    const used = new Set();
    for (const f of luaFiles) for (const m of fs.readFileSync(f, "utf8").matchAll(/IsOn\(\s*["']([a-z0-9_]+)["']\s*\)/g)) used.add(m[1]);
    for (const n of used) {
        if (!listed.has(n)) failures.push(`Flag "${n}" is read with IsOn but missing from FLAGS in match-setup.js (it can never be switched on)`);
        if (!typed.has(n)) failures.push(`Flag "${n}" is read with IsOn but missing from FlagName in flags.ts`);
    }
    for (const n of listed) if (!used.has(n)) failures.push(`Flag "${n}" is in match-setup.js FLAGS but no bot code reads it`);
    for (const n of typed) if (!listed.has(n)) failures.push(`Flag "${n}" is in FlagName (flags.ts) but missing from FLAGS in match-setup.js`);
}

// 5. Tune names agree the same way: every Tune("x", ...) or Tuned("x", ...) is in match-setup.js TUNES and in the TuneName type,
//    every listed name is read somewhere, and the two lists are equal.
{
    const setup = fs.readFileSync(path.join(root, "typescript/post-process/match-setup.js"), "utf8");
    const tunesMatch = setup.match(/const TUNES = (\[[^\]]*\])/);
    if (!tunesMatch) failures.push("TUNES list not found in match-setup.js");
    const listed = new Set(JSON.parse((tunesMatch || [, "[]"])[1].replace(/'/g, '"')));
    const typeText = fs.readFileSync(path.join(root, "typescript/bots/FunLib/behavior/flags.ts"), "utf8");
    const typeMatch = typeText.match(/type TuneName =([^;]*);/);
    if (!typeMatch) failures.push("TuneName type not found in flags.ts");
    const typed = new Set([...((typeMatch || [, ""])[1].matchAll(/"([a-z0-9_]+)"/g))].map(m => m[1]));
    const used = new Set();
    for (const f of luaFiles) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bTuned?\(\s*["']([a-z0-9_]+)["']/g)) used.add(m[1]);
    for (const n of used) {
        if (!listed.has(n)) failures.push(`Tune "${n}" is read with Tune but missing from TUNES in match-setup.js (it can never be set)`);
        if (!typed.has(n)) failures.push(`Tune "${n}" is read with Tune but missing from TuneName in flags.ts`);
    }
    for (const n of listed) if (!used.has(n)) failures.push(`Tune "${n}" is in match-setup.js TUNES but no bot code reads it`);
    for (const n of typed) if (!listed.has(n)) failures.push(`Tune "${n}" is in TuneName (flags.ts) but missing from TUNES in match-setup.js`);
}

const jsDir = path.join(root, "typescript/post-process");
const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith(".js")).map(f => path.join(jsDir, f));
for (const f of jsFiles) {
    const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    if (r.status !== 0) failures.push(`JS syntax: ${path.relative(root, f)}: ${(r.stderr || "").trim().split("\n").slice(0, 4).join(" | ")}`);
}

if (failures.length) {
    console.log(failures.join("\n"));
    console.log(`check: FAILED (${failures.length})`);
    process.exit(1);
}
console.log(`check: ok (${luaFiles.length} Lua files, ${jsFiles.length} post-process scripts)`);
