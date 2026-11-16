// Fast static checks before a smoke game (npm run check). A syntax error in a bot script only shows up
// in a 25-minute game otherwise.
//   1. Every Lua file under bots/ parses (luaparse 5.2 mode: its 5.1/LuaJIT modes reject a valid `break;` before `end`).
//   2. No generated Lua file still has a raw require("bots.x") / dofile("bots.x"): left behind when tstl
//      failed and the build's post-process never ran (the game cannot load those paths).
//   3. Every post-process script passes `node --check`.
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
