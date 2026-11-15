// Parallel headless game runner (docs/specs/learned-fight-decisions.md, step 2).
//
//   npm run batch -- start <games> <flag>[,<flag>...] [--parallel=8] [--timescale=8] [--explore=0] [--name=<name>]
//   npm run batch -- status [<name>]     progress of a batch (default: the newest)
//   npm run batch -- report [<name>]     result per game and the new team's win count
//
// <games> are measurement game numbers as in `npm run match` (lineup pair and side rotation), e.g. 1-8 or 1,2,5.
// For each game, match-setup.js --out writes that game's general.lua / utils.lua into
// datasets/runs/<name>/cfg/g<n>/. The repo's bots folder and these settings are copied into WSL, and
// headless/batch.sh plays the games on the Linux build (/opt/dota2), at most --parallel at once.
// Console logs land in datasets/runs/<name>/console.g<n>.log as games finish, so
// `npm run decisions -- datasets/runs/<name>` builds the decision dataset from them.
//
// Needs: WSL distro "Ubuntu" (or --distro=) with the headless Dota install described in the spec, step 0.
// The games use the bots folder as it is when the batch starts; later edits do not affect a running batch.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "../..");
const runsDir = path.join(root, "datasets/runs");
const fail = msg => {
    console.error(msg);
    process.exit(1);
};
const toWsl = p => {
    const m = path.resolve(p).match(/^([A-Za-z]):\\(.*)$/);
    if (!m) fail(`Not a drive path: ${p}`);
    return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}`;
};
const sq = s => `'${s.replace(/'/g, `'\\''`)}'`;

const opts = {};
const pos = [];
for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([a-z]+)=(.*)$/);
    if (m) opts[m[1]] = m[2];
    else pos.push(a);
}
const distro = opts.distro || "Ubuntu";
const newest = () => {
    if (!fs.existsSync(runsDir)) fail("No batches yet.");
    const all = fs
        .readdirSync(runsDir)
        .filter(d => fs.existsSync(path.join(runsDir, d, "manifest.json")))
        .sort((a, b) => fs.statSync(path.join(runsDir, b)).mtimeMs - fs.statSync(path.join(runsDir, a)).mtimeMs);
    if (!all.length) fail("No batches yet.");
    return all[0];
};

const cmd = pos[0];
if (cmd === "start") start();
else if (cmd === "status") status(pos[1] || newest());
else if (cmd === "report") report(pos[1] || newest());
else fail("Usage: npm run batch -- start <games> <flags> [--parallel=8] [--timescale=8] [--explore=0] [--name=]\n       npm run batch -- status|report [<name>]");

function parseGames(s) {
    const out = [];
    for (const part of (s || "").split(",")) {
        const m = part.match(/^(\d+)(?:-(\d+))?$/);
        if (!m) fail(`Bad game list "${s}". Use e.g. 1-8 or 1,2,5`);
        for (let n = Number(m[1]); n <= Number(m[2] || m[1]); n++) out.push(n);
    }
    return out;
}

function start() {
    const games = parseGames(pos[1]);
    const flags = pos[2];
    if (!flags) fail("Name the flags for the new team, e.g. arbiter,laning");
    const parallel = Number(opts.parallel || 8);
    const timescale = Number(opts.timescale || 8);
    const explore = opts.explore || "0";
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
    const name = opts.name || `b${stamp}`;
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) fail("--name may use letters, digits, _ . - only");
    const dir = path.join(runsDir, name);
    if (fs.existsSync(dir)) fail(`${path.relative(root, dir)} already exists; pick another --name`);
    fs.mkdirSync(dir, { recursive: true });

    const manifest = { name, flags, parallel, timescale, explore: Number(explore), started: new Date().toISOString(), games: {} };
    for (const g of games) {
        const r = spawnSync(process.execPath, [path.join(__dirname, "match-setup.js"), String(g), flags, `--explore=${explore}`, `--out=${path.join(dir, "cfg", `g${g}`)}`], { encoding: "utf8" });
        if (r.status !== 0) fail(`match-setup failed for game ${g}:\n${r.stderr || r.stdout}`);
        const radiantNew = /Radiant:.*<- NEW/.test(r.stdout);
        const pair = (r.stdout.match(/pair (\d+)/) || [])[1];
        manifest.games[g] = { pair: Number(pair), newTeam: radiantNew ? "radiant" : "dire" };
    }
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    fs.writeFileSync(path.join(dir, "games.txt"), games.join("\n") + "\n");

    const repo = toWsl(root);
    const win = toWsl(dir);
    const B = `/opt/oha-runs/${name}`;
    const H = "/opt/oha-runs/headless";
    const launch = [
        "set -e",
        `mkdir -p ${B} ${H}`,
        `for f in game.sh batch.sh; do tr -d '\\r' < ${sq(repo)}/typescript/post-process/headless/$f > ${H}/$f; done`,
        `rsync -a --delete --exclude '*.matchbak' ${sq(repo + "/bots/")} ${B}/base/`,
        `rsync -a ${sq(win + "/cfg/")} ${B}/cfg/`,
        `tr -d '\\r' < ${sq(win + "/games.txt")} > ${B}/games.txt`,
        `setsid nohup bash ${H}/batch.sh ${B} ${parallel} ${timescale} ${sq(win)} > ${B}/batch.out 2>&1 < /dev/null &`,
        "echo launched",
    ].join("\n");
    fs.writeFileSync(path.join(dir, "launch.sh"), launch + "\n");
    const r = spawnSync("wsl.exe", ["-d", distro, "--cd", dir, "--", "bash", "launch.sh"], { encoding: "utf8" });
    const out = `${r.stdout || ""}${r.stderr || ""}`.replace(/\0/g, "");
    if (r.status !== 0 || !out.includes("launched")) fail(`WSL launch failed:\n${out}`);
    console.log(`Batch ${name}: games ${games.join(",")}, flags ${flags}, ${parallel} at once, timescale ${timescale}, explore ${explore}`);
    console.log(`  Logs: ${path.relative(root, dir)}   Progress: npm run batch -- status   Results: npm run batch -- report`);
}

function readRec(file) {
    const text = fs.readFileSync(file, "utf8");
    const i = text.indexOf("MATCHREC {");
    let rec = null;
    if (i >= 0) {
        try {
            rec = JSON.parse(text.slice(i + 9, text.indexOf("\n", i)).trim());
        } catch (e) {
            /* partial line */
        }
    }
    const errors = (text.match(/script error|BEHAVIOR_ERROR/g) || []).length;
    const decisions = (text.match(/FIGHTDEC /g) || []).length;
    return { rec, errors, decisions };
}

function status(name) {
    const dir = path.join(runsDir, name);
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const done = fs.readdirSync(dir).filter(f => /^console\.g\d+\.log$/.test(f)).length;
    console.log(`Batch ${name}: ${done}/${Object.keys(m.games).length} games finished`);
    const st = path.join(dir, "status.log");
    if (fs.existsSync(st)) console.log(fs.readFileSync(st, "utf8").trim().split("\n").slice(-12).join("\n"));
    const mem = path.join(dir, "mem.log");
    if (fs.existsSync(mem)) console.log("last memory sample: " + fs.readFileSync(mem, "utf8").trim().split("\n").pop());
}

function report(name) {
    const dir = path.join(runsDir, name);
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    console.log(`Batch ${name}: new team flags ${m.flags}, explore ${m.explore}`);
    console.log("game  pair  new      winner   result  minutes  kills new-old  nw10 new-old  errors  decisions");
    let played = 0;
    let won = 0;
    for (const g of Object.keys(m.games).map(Number).sort((a, b) => a - b)) {
        const info = m.games[g];
        const file = path.join(dir, `console.g${g}.log`);
        if (!fs.existsSync(file)) {
            console.log(`${String(g).padEnd(6)}${String(info.pair).padEnd(6)}${info.newTeam.padEnd(9)}not finished`);
            continue;
        }
        const { rec, errors, decisions } = readRec(file);
        if (!rec) {
            console.log(`${String(g).padEnd(6)}${String(info.pair).padEnd(6)}${info.newTeam.padEnd(9)}no MATCHREC (errors ${errors})`);
            continue;
        }
        const old = info.newTeam === "radiant" ? "dire" : "radiant";
        const k = rec.kills && rec.kills.end ? `${rec.kills.end[info.newTeam]}-${rec.kills.end[old]}` : "?";
        const nw = rec.nw10 ? `${rec.nw10[info.newTeam]}-${rec.nw10[old]}` : "?";
        const win = rec.winner === info.newTeam;
        played++;
        if (win) won++;
        console.log(
            `${String(g).padEnd(6)}${String(info.pair).padEnd(6)}${info.newTeam.padEnd(9)}${String(rec.winner).padEnd(9)}${(win ? "WIN" : "loss").padEnd(8)}` +
                `${String(Math.round(rec.duration / 60)).padEnd(9)}${k.padEnd(16)}${nw.padEnd(15)}${String(errors).padEnd(8)}${decisions}`
        );
    }
    console.log(`New team won ${won} of ${played} finished games.`);
}
