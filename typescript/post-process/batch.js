// Parallel headless game runner (docs/specs/learned-fight-decisions.md, step 2).
//
//   npm run batch -- start <games> <flags|none> [--parallel=8] [--timescale=8] [--name=<name>]
//   npm run batch -- start <games> <flags> --data [--explore=0.03]   data batch (exploration on)
//   npm run batch -- start <games> <flags> --screen[=<min>]   screen batch: every game stops one minute after
//                                          <min> (default 30, so 31:00: about half the time); judged on the gold
//                                          lead at <min>:00 only. --screen=15 for changes that act in the laning phase
//   npm run batch -- start <games> <flags> --draft   free-draft batch: both teams pick their own heroes
//                                          (match-setup --draft): game g plays Draft_Seed ceil(g/2), the new team
//                                          Radiant on odd and Dire on even games (any checkout: Draft_Seed is on main).
//                                          Compare only with another --draft batch over the same games.
//   npm run batch -- early <name> <baseline>[+<baseline>...] [--stop]   early stop for a running batch: stops
//                                          (with --stop) once its paired gold lead is clearly worse than the
//                                          baseline's, by an O'Brien-Fleming boundary fixed before the batch
//   npm run batch -- rerun <name> <game> [--force]   replay one game of a batch whose game died (no record);
//                                          refuses when bots/ differs from the batch's commit unless --force
//   npm run batch -- status [<name>]       progress of a batch (default: the newest)
//   npm run batch -- report [<name>]       result per game, per lineup pair, and the verdict
//   npm run batch -- compare <a> <b> [--at=<min>]   batch a against baseline b (b1+b2 pools baselines); gold
//                                          at 30:00, or at the shortest screen's minute, or at --at
//   npm run batch -- stop <name>           stop a batch: its queue, its games, its port locks
//   npm run batch -- ledger [<filter>]     one line per batch: kind, flags, commit, games, wins, gold lead at 30:00
//   npm run batch -- smoke <flags> [--game=1] [--until=25] [--expect=<re>]... [--forbid=<re>]...
//                                          one game to try a change; {new} / {old} in a regex = that team's number
//   npm run batch -- smokecheck <name> [--keep]   judge it: exit 2 not ready, 0 pass, 1 fail; stops the game when ready
//
// <games> are measurement game numbers as in `npm run match` (lineup pair and side rotation), e.g. 1-8 or 1,2,5.
// Games come in whole lineup pairs (games 4p-3..4p: both lineups on both sides); --partial allows less.
// `none` as flags plays plain OHA on both teams: the A/A check of how far results move by chance.
//
// Two kinds of batch:
//   eval (default): explore 0. `report` gives the verdict, `compare` the difference to a baseline batch.
//   data (--data):  exploration on (--explore, default 0.03) for the decision dataset. No verdict: forced
//                   random decisions add noise and deaths to both teams.
// Keep rule (docs/specs/overnight-2026-11-16.md): a change is kept only on a complete eval batch whose
// verdict, or whose compare against a baseline run at the same time, says "better".
//
// For each game, match-setup.js --out writes that game's general.lua / utils.lua into
// datasets/runs/<name>/cfg/g<n>/. The repo's bots folder and these settings are copied into WSL, and
// headless/batch.sh plays the games on the Linux build (/opt/dota2), at most --parallel at once.
// Console logs land in datasets/runs/<name>/console.g<n>.log as games finish, so
// `npm run decisions -- datasets/runs/<name>` builds the decision dataset from them.
// `start` also leaves a detached `wsl.exe` running until the batch is done or stopped: WSL shut down
// with no client attached on 2026-11-16 and killed every running game.
//
// Needs: WSL distro "Ubuntu" (or --distro=) with the headless Dota install described in the spec, step 0.
// The games use the bots folder as it is when the batch starts; later edits do not affect a running batch.
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const root = path.join(__dirname, "../..");
// Batches always live in the main checkout's datasets/runs, also when started from an implementer's git
// worktree (that worktree's bots/ is what the games play), so one ledger lists every batch.
const mainRoot = (() => {
    const r = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root, encoding: "utf8" });
    const common = (r.stdout || "").trim();
    return r.status === 0 && common ? path.dirname(path.resolve(common)) : root;
})();
const runsDir = path.join(mainRoot, "datasets/runs");
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
    const m = a.match(/^--([a-z]+)(?:=(.*))?$/);
    if (m && (m[1] === "expect" || m[1] === "forbid")) (opts[m[1]] = opts[m[1]] || []).push(m[2] || "");
    else if (m) opts[m[1]] = m[2] === undefined ? true : m[2];
    else pos.push(a);
}
const distro = opts.distro || "Ubuntu";
// The minute the gold lead is read at: 30, or the shortest screen's minute among the batches compared, or --at.
let AT = 30;
const manifestOf = name => {
    const f = path.join(runsDir, name, "manifest.json");
    if (!fs.existsSync(f)) fail(`No batch ${name}`);
    return JSON.parse(fs.readFileSync(f, "utf8"));
};
const screenMinute = m => (m.screen ? Math.floor(m.screen / 60) - 1 : Infinity);
// A free-draft batch pairs by seed, a fixed-lineup batch by lineup: game g means different heroes in each.
function sameDraft(names) {
    if (new Set(names.map(n => !!manifestOf(n).draft)).size > 1)
        fail(`Do not compare free-draft and fixed-lineup batches: game numbers mean different matches (${names.map(n => `${n} ${manifestOf(n).draft ? "draft" : "lineups"}`).join(", ")}).`);
}
// A change is judged against a baseline of its own flags minus the one under test. On 2026-11-17 a day of screens
// on group,fixes,corefarm,roshsafe was judged against a group,fixes,corefarm pool, and identical code has drifted
// 2.4k between batches, about the size of the effects. --mismatch compares anyway (e.g. testing the base minus a flag).
const flagSet = m => new Set(String(m.flags || "").split(",").filter(f => f && f !== "none"));
const flagKey = s => [...s].sort().join(",") || "none";
function sameBase(a, bases) {
    const fa = flagSet(manifestOf(a));
    const fbs = bases.map(b => flagSet(manifestOf(b)));
    // A --tune set counts as one change (a bundle is tested as one); the baselines must share theirs.
    const ta = manifestOf(a).tune || "";
    const tbs = bases.map(b => manifestOf(b).tune || "");
    const problems = [];
    if (new Set(fbs.map(flagKey)).size > 1) problems.push(`the pooled baselines have different flags (${bases.map((b, i) => `${b}: ${flagKey(fbs[i])}`).join("; ")})`);
    if (new Set(tbs).size > 1) problems.push(`the pooled baselines have different tune values (${bases.map((b, i) => `${b}: ${tbs[i] || "none"}`).join("; ")})`);
    const added = [...fa].filter(f => !fbs[0].has(f));
    const missing = [...fbs[0]].filter(f => !fa.has(f));
    const tuned = ta !== tbs[0] ? 1 : 0;
    if (added.length + tuned > 1 || missing.length)
        problems.push(`${a} (${flagKey(fa)}${ta ? `, tune ${ta}` : ""}) is not its baseline (${flagKey(fbs[0])}${tbs[0] ? `, tune ${tbs[0]}` : ""}) plus one change: added ${added.join(",") || "none"}${tuned ? " and a tune set" : ""}, missing ${missing.join(",") || "none"}`);
    if (!problems.length) return;
    const msg = `Baseline mismatch: ${problems.join("; ")}. The result would mix in other flags and batch drift. Use a baseline with ${a}'s flags minus the one under test, or add --mismatch to compare anyway.`;
    if (opts.mismatch === true) console.log(`WARNING ${msg}`);
    else fail(msg);
}
function setGoldMinute(names) {
    sameDraft(names);
    if (names.length > 1) sameBase(names[0], names.slice(1));
    AT = opts.at ? Number(opts.at) : Math.min(30, ...names.map(n => screenMinute(manifestOf(n))));
}
const newest = () => {
    if (!fs.existsSync(runsDir)) fail("No batches yet.");
    const all = fs
        .readdirSync(runsDir)
        .filter(d => fs.existsSync(path.join(runsDir, d, "manifest.json")))
        .sort((a, b) => fs.statSync(path.join(runsDir, b)).mtimeMs - fs.statSync(path.join(runsDir, a)).mtimeMs);
    if (!all.length) fail("No batches yet.");
    return all[0];
};
// Runs a script in WSL from the batch folder (a file, so wsl.exe and Git Bash leave its $VARs alone).
const wslScript = (dir, file, text) => {
    fs.writeFileSync(path.join(dir, file), text + "\n");
    const r = spawnSync("wsl.exe", ["-d", distro, "--cd", dir, "--", "bash", file], { encoding: "utf8" });
    return { status: r.status, out: `${r.stdout || ""}${r.stderr || ""}`.replace(/\0/g, "") };
};

const cmd = pos[0];
if (cmd === "start") start();
else if (cmd === "status") status(pos[1] || newest());
else if (cmd === "report") report(pos[1] || newest());
else if (cmd === "compare") compare(pos[1], pos[2]);
else if (cmd === "stop") stop(pos[1]);
else if (cmd === "ledger") ledger(pos[1]);
else if (cmd === "smoke") smoke(pos[1]);
else if (cmd === "smokecheck") smokecheck(pos[1]);
else if (cmd === "early") early(pos[1], pos[2]);
else if (cmd === "rerun") rerun(pos[1], pos[2]);
else
    fail(
        "Usage: npm run batch -- start <games> <flags|none> [--parallel=8] [--timescale=8] [--data [--explore=0.03] | --screen[=<min>]] [--draft] [--partial] [--name=]\n" +
            "       npm run batch -- status|report [<name>]\n" +
            "       npm run batch -- compare <name> <baseline>[+<baseline>...] [--at=<min>]\n" +
            "       npm run batch -- early <name> <baseline>[+<baseline>...] [--stop]\n" +
            "       npm run batch -- rerun <name> <game> [--force]\n" +
            "       npm run batch -- stop <name>\n" +
            "       npm run batch -- ledger [<filter>]\n" +
            "       npm run batch -- smoke <flags> [--game=1] [--until=25] [--expect=<re>]... [--forbid=<re>]...\n" +
            "       npm run batch -- smokecheck <name> [--keep]"
    );

// Smoke game: one game of <flags>, with what must (--expect) and must not (--forbid) appear in its log.
// Regexes are JavaScript; {new} and {old} stand for the new and old team's number (2 Radiant, 3 Dire).
// Replaces the hand-written check scripts of 2026-11-16, whose watchers broke on shell quoting.
function smoke(flags) {
    if (!flags) fail("Usage: npm run batch -- smoke <flags> [--game=1] [--until=25] [--expect=<re>]... [--forbid=<re>]...");
    const game = String(opts.game || "1");
    const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(4, 13).replace("T", "");
    const name = opts.name || `smoke-${flags.replace(/,/g, "-")}-${stamp}`;
    for (const re of [...(opts.expect || []), ...(opts.forbid || [])]) new RegExp(re.replace(/\{(new|old)\}/g, "2")); // a bad regex fails here
    pos.splice(0, pos.length, "start", game, flags);
    Object.assign(opts, { partial: true, parallel: "1", name });
    start();
    const file = path.join(runsDir, name, "manifest.json");
    const m = JSON.parse(fs.readFileSync(file, "utf8"));
    m.smoke = { game, until: Number(opts.until || 25), expect: opts.expect || [], forbid: opts.forbid || [] };
    fs.writeFileSync(file, JSON.stringify(m, null, 2) + "\n");
    console.log(`Smoke ${name}: npm run batch -- smokecheck ${name}  (exit 2 until ${m.smoke.until}:00 game time or the end)`);
}

function smokecheck(name) {
    if (!name) fail("Usage: npm run batch -- smokecheck <name> [--keep]");
    const dir = path.join(runsDir, name);
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const sm = m.smoke || { game: Object.keys(m.games)[0], until: 25, expect: [], forbid: [] };
    for (const k of ["expect", "forbid"]) if (opts[k]) sm[k] = opts[k]; // override or add checks after the start
    if (opts.until) sm.until = Number(opts.until);
    const nt = m.games[sm.game].newTeam === "radiant" ? "2" : "3";
    const re = s => new RegExp(s.replace(/\{new\}/g, nt).replace(/\{old\}/g, nt === "2" ? "3" : "2"));
    const local = path.join(dir, `console.g${sm.game}.log`);
    let text = "";
    if (fs.existsSync(local)) text = fs.readFileSync(local, "utf8");
    else {
        fs.writeFileSync(path.join(dir, "smokelog.sh"), `cat /opt/oha-runs/${name}/g${sm.game}/run/console.log 2>/dev/null\n`);
        const r = spawnSync("wsl.exe", ["-d", distro, "--cd", dir, "--", "bash", "smokelog.sh"], { encoding: "utf8", maxBuffer: 1 << 30 });
        text = (r.stdout || "").replace(/\0/g, "");
    }
    if (!text) {
        console.log(`${name}: no console log yet`);
        process.exit(2);
    }
    const lines = text.split("\n");
    let t = 0;
    for (let i = lines.length - 1; i >= 0 && !t; i--) {
        const mm = lines[i].match(/\] POS team=\d hero=\S+ t=([\d.]+)/);
        if (mm) t = Number(mm[1]);
    }
    const ended = text.includes("MATCHREC {");
    const behavior = lines.filter(l => l.includes("BEHAVIOR_ERROR")).length;
    const runtime = lines.filter(l => l.includes("Script Runtime Error"));
    const other = runtime.filter(l => !l.includes("error in error handling"));
    console.log(`${name} (flags ${m.flags}, new team = team ${nt}): game time ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}${ended ? ", ended" : ""}`);
    console.log(`  BEHAVIOR_ERROR ${behavior}, other runtime errors ${other.length}, 'error in error handling' ${runtime.length - other.length} (about 20 in every game, plain OHA too)`);
    for (const l of other.slice(0, 3)) console.log(`    ${l.slice(0, 200)}`);
    let ok = behavior === 0 && other.length === 0;
    for (const s of sm.expect) {
        const n = lines.filter(l => re(s).test(l)).length;
        if (n === 0) ok = false;
        console.log(`  expect /${s}/: ${n}${n === 0 ? "  <- missing" : ""}`);
    }
    for (const s of sm.forbid) {
        const n = lines.filter(l => re(s).test(l)).length;
        if (n > 0) ok = false;
        console.log(`  forbid /${s}/: ${n}${n > 0 ? "  <- present" : ""}`);
    }
    if (!ended && t < sm.until * 60) {
        console.log(`  not ready: waiting for ${sm.until}:00`);
        process.exit(2);
    }
    console.log(`Smoke verdict: ${ok ? "PASS" : "FAIL"}`);
    if (!ended && opts.keep !== true) {
        stop(name);
        // Keep the log of the stopped game here: once stopped, batch.sh never copies it out of WSL.
        if (!fs.existsSync(local)) fs.writeFileSync(path.join(dir, `console.g${sm.game}.smoke.log`), text);
    }
    process.exit(ok ? 0 : 1);
}

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
    if (opts.screen !== undefined && opts.screen !== true && !(Number(opts.screen) >= 5 && Number(opts.screen) <= 60)) fail("--screen=<min> takes 5 to 60 minutes");
    const flags = pos[2];
    if (!flags) fail("Name the flags for the new team, e.g. arbiter,laning (or none for plain OHA on both teams)");
    const data = opts.data === true;
    if (opts.explore !== undefined && !data) fail("--explore is for data batches: add --data (eval batches run with explore 0)");
    const explore = data ? String(opts.explore || "0.03") : "0";
    const draft = opts.draft === true;
    if (draft && opts.partial !== true && games.some(g => !games.includes(g % 2 ? g + 1 : g - 1)))
        fail("A --draft batch needs whole seeds: games 2k-1 and 2k play seed k from both sides. Add --partial to run it anyway.");
    if (!draft && opts.partial !== true) {
        const byPair = {};
        for (const g of games) (byPair[Math.ceil(g / 4)] = byPair[Math.ceil(g / 4)] || []).push(g);
        const broken = Object.entries(byPair).filter(([, gs]) => gs.length !== 4);
        if (broken.length)
            fail(`Games must come in whole lineup pairs (1-4, 5-8, ...) so both lineups play both sides; pair ${broken.map(b => b[0]).join(", ")} is partial. Add --partial to run it anyway.`);
    }
    const parallel = Number(opts.parallel || 8);
    const timescale = Number(opts.timescale || 8);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
    const name = opts.name || `b${stamp}`;
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) fail("--name may use letters, digits, _ . - only");
    const dir = path.join(runsDir, name);
    if (fs.existsSync(dir)) fail(`${path.relative(root, dir)} already exists; pick another --name`);
    fs.mkdirSync(dir, { recursive: true });

    const git = a => (spawnSync("git", a, { cwd: root, encoding: "utf8" }).stdout || "").trim();
    const commit = git(["rev-parse", "--short", "HEAD"]) + (git(["status", "--porcelain", "--", "bots", "typescript/bots"]) ? "+dirty" : "");
    // Stop one minute after the gold sample (default 30:00, so 31:00), room for the 2 s POS cadence.
    const screenAt = opts.screen === true ? 30 : opts.screen ? Number(opts.screen) : 0;
    const screen = screenAt ? (screenAt + 1) * 60 : 0;
    if (screen && data) fail("--screen and --data do not mix");
    const manifest = { name, flags, kind: data ? "data" : "eval", commit, parallel, timescale, explore: Number(explore), started: new Date().toISOString(), games: {} };
    if (screen) manifest.screen = screen;
    if (draft) manifest.draft = true;
    // --tune=name=value[,...]: thresholds for the new team only (flags.ts Tune); match-setup validates the names.
    const tune = typeof opts.tune === "string" && opts.tune ? opts.tune : "";
    if (opts.tune !== undefined && !tune) fail("--tune needs name=value[,name=value...]");
    if (tune) manifest.tune = tune;
    for (const g of games) {
        const args = [path.join(__dirname, "match-setup.js"), String(g), flags, `--explore=${explore}`, `--out=${path.join(dir, "cfg", `g${g}`)}`];
        if (draft) args.push("--draft");
        if (tune) args.push(`--tune=${tune}`);
        const r = spawnSync(process.execPath, args, { encoding: "utf8" });
        if (r.status !== 0) fail(`match-setup failed for game ${g}:\n${r.stderr || r.stdout}`);
        if (draft && !/free draft, Draft_Seed \d+/.test(r.stdout)) fail(`match-setup did not set up a free draft for game ${g} (is this the draft code?):\n${r.stdout}`);
        if (tune && (r.stdout.match(/ tune=(\S+)$/m) || [])[1] !== tune) fail(`match-setup did not apply --tune=${tune} for game ${g} (is this the tune code?):\n${r.stdout}`);
        const radiantNew = /Radiant:.*<- NEW/.test(r.stdout);
        // In a free draft the "pair" is the seed: games 2k-1 and 2k.
        const pair = (r.stdout.match(draft ? /Draft_Seed (\d+)/ : /pair (\d+)/) || [])[1];
        manifest.games[g] = { pair: Number(pair), newTeam: radiantNew ? "radiant" : "dire" };
    }
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    fs.writeFileSync(path.join(dir, "games.txt"), games.join("\n") + "\n");

    launch(dir, name, "games.txt", parallel, timescale, screen);
    console.log(`Batch ${name} (${manifest.kind}${draft ? ", free draft" : ""}${screen ? `, screen: stops at ${screen / 60}:00` : ""}): games ${games.join(",")}, flags ${flags}${tune ? `, tune ${tune}` : ""}, ${parallel} at once, timescale ${timescale}, explore ${explore}`);
    console.log(`  Logs: ${path.relative(root, dir)}   Progress: npm run batch -- status   Results: npm run batch -- report`);
}

// Copies the repo's bots folder and the batch's cfg into WSL and starts headless/batch.sh for the games in
// <gamesFile> (in the batch folder). <runName> is the WSL run folder: the batch's name, or <name>-r<game> for a rerun.
// bots/ is copied into the run at launch, so games never read the checkout: merging while a batch runs is safe.
// baseFrom: a WSL folder to copy bots/ from instead of the checkout (a rerun replays its batch's own copy).
function launch(dir, runName, gamesFile, parallel, timescale, screen, baseFrom) {
    const repo = toWsl(root);
    const win = toWsl(dir);
    const B = `/opt/oha-runs/${runName}`;
    const botsSrc = baseFrom ? `${baseFrom}/` : repo + "/bots/";
    const H = `${B}/scripts`; // per batch: rewriting a script a running batch is reading would break it
    const r = wslScript(
        dir,
        "launch.sh",
        [
            "set -e",
            `mkdir -p ${B} ${H}`,
            `for f in game.sh batch.sh; do tr -d '\\r' < ${sq(repo)}/typescript/post-process/headless/$f > ${H}/$f; done`,
            `rsync -a --delete --exclude '*.matchbak' ${sq(botsSrc)} ${B}/base/`,
            `rsync -a ${sq(win + "/cfg/")} ${B}/cfg/`,
            `tr -d '\\r' < ${sq(win + "/" + gamesFile)} > ${B}/games.txt`,
            `setsid nohup bash ${H}/batch.sh ${B} ${parallel} ${timescale} ${sq(win)} ${screen} > ${B}/batch.out 2>&1 < /dev/null &`,
            // Wait until the batch has started its first game: a detached process can die with the WSL session
            // if that session closes too soon (seen when two batches were launched back to back).
            `for i in $(seq 1 30); do [ -d ${B}/g$(head -1 ${B}/games.txt) ] && break; sleep 1; done`,
            `[ -d ${B}/g$(head -1 ${B}/games.txt) ] && echo launched || echo "batch did not start"`,
        ].join("\n")
    );
    if (r.status !== 0 || !r.out.includes("launched")) fail(`WSL launch failed:\n${r.out}`);
    // Keep a WSL client attached until the batch is done or stopped.
    const keep = spawn("wsl.exe", ["-d", distro, "--", "bash", "-c", `while [ ! -f ${B}/DONE ] && [ ! -f ${B}/STOPPED ]; do sleep 60; done`], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
    });
    keep.unref();
}

// Replays one game of a batch into the same batch folder, e.g. a game whose server died (ev-gf g24 on
// 2026-11-17: its log stops at 40:22 with no MATCHREC, which kept the batch from ever being complete).
// The old log is kept as console.g<n>.dead.log. The game must play the batch's code: bots/ is compared
// with the batch's commit, and a difference stops the rerun unless --force (say why in the log).
function rerun(name, game) {
    if (!name || !game) fail("Usage: npm run batch -- rerun <name> <game> [--force]");
    const dir = path.join(runsDir, name);
    const m = manifestOf(name);
    if (!m.games[game]) fail(`Game ${game} is not in batch ${name}`);
    if (!fs.existsSync(path.join(dir, "cfg", `g${game}`))) fail(`No cfg/g${game} in ${name}`);
    const log = path.join(dir, `console.g${game}.log`);
    if (fs.existsSync(log) && readRec(log).rec && opts.force !== true) fail(`Game ${game} of ${name} has a match record; nothing to rerun (--force to replay anyway)`);
    // Replay the batch's own copy of bots/ when it is still in WSL; only without it fall back to the checkout,
    // which must then match the batch's commit.
    const snap = `/opt/oha-runs/${name}/base`;
    const hasSnap = wslScript(dir, "snapcheck.sh", `[ -f ${snap}/hero_selection.lua ] && echo yes || echo no`).out.includes("yes");
    let note = " (from the batch's own copy of bots/)";
    if (!hasSnap) {
        const commit = String(m.commit || "").replace("+dirty", "");
        const d = spawnSync("git", ["diff", "--stat", commit, "--", "bots", ":(exclude)bots/FretBots"], { cwd: root, encoding: "utf8" }); // FretBots is not loaded in headless games
        if (d.status !== 0) fail(`Cannot compare bots/ with the batch's commit ${commit}:\n${d.stderr}`);
        if (d.stdout.trim() && opts.force !== true)
            fail(`The batch's copy of bots/ (${snap}) is gone and bots/ differs from ${name}'s commit ${commit}, so the rerun would play other code:\n${d.stdout.trim().split("\n").slice(-12).join("\n")}\nRun it from a checkout of ${commit}, or add --force when the difference is behind flags this batch does not use.`);
        note = d.stdout.trim() ? " (--force: bots/ differs from the batch's commit)" : " (from the checkout, which matches the batch's commit)";
    }
    if (fs.existsSync(log)) fs.renameSync(log, path.join(dir, `console.g${game}.dead.log`));
    fs.writeFileSync(path.join(dir, `rerun.g${game}.txt`), `${game}\n`);
    launch(dir, `${name}-r${game}`, `rerun.g${game}.txt`, 1, m.timescale || 8, m.screen || 0, hasSnap ? snap : undefined);
    fs.appendFileSync(path.join(dir, "status.log"), `${new Date().toTimeString().slice(0, 8)} rerun of g${game} started${note}\n`);
    console.log(`Rerun of ${name} g${game} started; its log lands as console.g${game}.log (old one kept as console.g${game}.dead.log).`);
}

// Early stop: a batch whose change is clearly worse stops before its 32 games, so its slots go to the next
// test. Paired gold lead (as compare) over the games finished so far; one-sided, O'Brien-Fleming boundary
// z = 2.024 / sqrt(t), t = games paired / games in the batch (overall alpha about 5% across looks; at 8 of 32
// games z must pass 4.05, at 16 2.86, at 24 2.34). Needs 8 paired games. Only stops for harm: a good change
// still runs to the end, where compare judges it. The five original flags screened on 2026-11-17 took 32
// games each to show what 16 showed (fight -5.9k).
function early(name, base) {
    if (!name || !base) fail("Usage: npm run batch -- early <name> <baseline>[+<baseline>...] [--stop]");
    setGoldMinute([name, ...base.split("+")]);
    const A = results(name);
    const Bb = pooled(base);
    const gb = Object.fromEntries(Bb.rows.filter(r => r.gold && r.lead30 !== null).map(r => [r.g, r.lead30]));
    let rows = A.rows.filter(r => r.gold && r.lead30 !== null && r.g in gb);
    // --upto=<n>: backtest on a finished batch, as if only its first n games (by finish time) were in.
    if (opts.upto) {
        const t = r => fs.statSync(path.join(runsDir, name, `console.g${r.g}.log`)).mtimeMs;
        rows = rows.sort((x, y) => t(x) - t(y)).slice(0, Number(opts.upto));
    }
    const diffs = rows.map(r => r.lead30 - gb[r.g]);
    const n = diffs.length;
    if (n < 8) return console.log(`${name}: ${n} paired games so far; the early check needs 8. Continue.`);
    const mean = diffs.reduce((a, x) => a + x, 0) / n;
    const sd = Math.sqrt(diffs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1));
    const z = mean / (sd / Math.sqrt(n));
    const bound = 2.024 / Math.sqrt(Math.min(1, n / A.total));
    const worse = z < -bound;
    console.log(`${name} vs ${base}: gold lead at ${AT}:00 paired over ${n} of ${A.total} games: ${k1(mean)} (z ${z.toFixed(2)}; stop boundary -${bound.toFixed(2)}).`);
    console.log(worse ? "Early verdict: STOP, clearly worse (Gold FAIL)." : z > bound ? "Early verdict: clearly better so far; let it finish (compare judges it)." : "Early verdict: continue.");
    // Only a batch with games still to play is stopped; a complete one is judged by compare.
    if (worse && opts.stop === true && !opts.upto && A.rows.some(r => r.state === "not finished")) {
        stop(name);
        fs.appendFileSync(path.join(runsDir, name, "status.log"), `${new Date().toTimeString().slice(0, 8)} early stop: ${k1(mean)} at ${AT}:00 over ${n} games, z ${z.toFixed(2)} < -${bound.toFixed(2)}\n`);
    }
}

function stop(name) {
    if (!name) fail("Usage: npm run batch -- stop <name>");
    const dir = path.join(runsDir, name);
    if (!fs.existsSync(path.join(dir, "manifest.json"))) fail(`No batch ${name}`);
    const B = `/opt/oha-runs/${name}`;
    const r = wslScript(
        dir,
        "stop.sh",
        [
            `touch ${B}/STOPPED`,
            `for p in $(pgrep -f "bash ${B}/scripts/batch.sh"); do kill -9 $p; done`,
            `for gp in $(pgrep -f "scripts/game.sh ${B}/"); do`,
            `  port=$(tr '\\0' ' ' < /proc/$gp/cmdline | awk '{print $NF}')`,
            `  pkill -9 -P $gp; kill -9 $gp`,
            `  rm -rf /tmp/oha-ports/$port`,
            `done`,
            `pkill -f "unshare -m bash -c mount --bind '${B}/"`,
            `sleep 1; echo "left: $(pgrep -fc "oha-runs/${name}/")  dota2 running: $(ps -C dota2 -o pid= | wc -l)"`,
        ].join("\n")
    );
    console.log(r.out.trim());
    fs.appendFileSync(path.join(dir, "status.log"), `${new Date().toTimeString().slice(0, 8)} batch stopped (npm run batch -- stop)\n`);
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
    // deaths before 10:00 per team (DEATH lines, Utils.DebugMode)
    const d10 = { 2: 0, 3: 0 };
    for (const m of text.matchAll(/DEATH team=(\d) hero=\S+ t=(-?\d+)/g)) if (Number(m[2]) <= 600) d10[m[1]]++;
    // Team net worth at AT:00 (30:00 by default; POS trace lines, Utils.DebugMode), or at the last sample if the game ended sooner.
    const nw = { 2: {}, 3: {} };
    let nw30 = null;
    let nw10 = null;
    let reached30 = false;
    for (const m of text.matchAll(/\] POS team=(\d) hero=(\S+) t=([\d.-]+) .* nw=(\d+)/g)) {
        nw[m[1]][m[2]] = Number(m[4]);
        if (nw10 === null && Number(m[3]) >= 10 * 60) nw10 = Sums(nw);
        if (Number(m[3]) >= AT * 60) {
            nw30 = Sums(nw);
            reached30 = true;
            break;
        }
    }
    if (nw30 === null && Object.keys(nw[2]).length) nw30 = Sums(nw);
    return { rec, errors, decisions, d10, nw30, nw10, reached30 };
}
function Sums(nw) {
    const s = t => Object.values(nw[t]).reduce((a, v) => a + v, 0);
    return { 2: s(2), 3: s(3) };
}

function status(name) {
    const dir = path.join(runsDir, name);
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const done = fs.readdirSync(dir).filter(f => /^console\.g\d+\.log$/.test(f)).length;
    const total = Object.keys(m.games).length;
    console.log(`Batch ${name}: ${done}/${total} games finished`);
    const st = path.join(dir, "status.log");
    if (fs.existsSync(st)) console.log(fs.readFileSync(st, "utf8").trim().split("\n").slice(-12).join("\n"));
    const mem = path.join(dir, "mem.log");
    if (fs.existsSync(mem)) console.log("last memory sample: " + fs.readFileSync(mem, "utf8").trim().split("\n").pop());
    if (done < total) {
        const B = `/opt/oha-runs/${name}`;
        const r = wslScript(dir, "check.sh", `[ -f ${B}/STOPPED ] && echo stopped && exit; echo "queue $(pgrep -fc "bash ${B}/scripts/batch.sh") games $(pgrep -fc "scripts/game.sh ${B}/")"`);
        const q = r.out.match(/queue (\d+) games (\d+)/);
        if (r.out.includes("stopped")) console.log("Stopped (npm run batch -- stop).");
        else if (q && q[1] === "0" && q[2] === "0")
            console.log(`NOT RUNNING: ${total - done} games unfinished and nothing is playing (WSL restarted?). Start the missing games as a new batch.`);
        else if (q) console.log(`Running: ${q[2]} games playing.`);
    }
}

// Wilson 95% interval for w wins in n games.
function wilson(w, n) {
    if (!n) return [0, 1];
    const z = 1.96;
    const p = w / n;
    const c = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
    const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
    return [Math.max(0, c - h), Math.min(1, c + h)];
}
function pct(x) {
    return `${Math.round(100 * x)}%`;
}

// Wins of the new team per game, and the batch summary.
function results(name) {
    const dir = path.join(runsDir, name);
    if (!fs.existsSync(path.join(dir, "manifest.json"))) fail(`No batch ${name}`);
    const m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const rows = [];
    for (const g of Object.keys(m.games).map(Number).sort((a, b) => a - b)) {
        const info = m.games[g];
        const file = path.join(dir, `console.g${g}.log`);
        if (!fs.existsSync(file)) {
            rows.push({ g, info, state: "not finished" });
            continue;
        }
        const r = readRec(file);
        const nt = info.newTeam === "radiant" ? 2 : 3;
        const lead30 = r.nw30 ? r.nw30[nt] - r.nw30[5 - nt] : null;
        const lead10 = r.nw10 ? r.nw10[nt] - r.nw10[5 - nt] : null;
        // A screen game is stopped one minute past its sample without a MATCHREC; it counts once its log reached AT:00.
        const ok = r.rec || (m.screen && r.reached30);
        rows.push({ g, info, state: ok ? "done" : "no MATCHREC", ...r, lead30, lead10 });
    }
    const done = rows.filter(r => r.state === "done");
    const won = done.filter(r => r.rec && r.rec.winner === r.info.newTeam).length;
    for (const r of rows) r.gold = r.state === "done" || !!r.reached30;
    return { m, rows, played: done.length, goldPlayed: rows.filter(r => r.gold).length, won, total: rows.length, kind: m.kind || (m.explore > 0 ? "data" : "eval"), screen: !!m.screen };
}

function report(name) {
    setGoldMinute([name]);
    const { m, rows, played, won, total, kind } = results(name);
    console.log(`Batch ${name} (${kind}): new team flags ${m.flags}, explore ${m.explore}`);
    console.log("game  pair  new      winner   result  minutes  kills new-old  nw10 new-old  lh10 new-old  d10 new-old  errors  decisions");
    const sums = { nw: 0, lh: 0, d10: 0 };
    const pairs = {};
    for (const r of rows) {
        const { g, info } = r;
        const head = `${String(g).padEnd(6)}${String(info.pair).padEnd(6)}${info.newTeam.padEnd(9)}`;
        if (r.state === "not finished") {
            console.log(head + "not finished");
            continue;
        }
        if (r.state !== "done") {
            console.log(head + `no MATCHREC (errors ${r.errors})`);
            continue;
        }
        if (!r.rec) {
            console.log(head + `screened, gold lead at ${AT}:00 ${k1(r.lead30)}`);
            continue;
        }
        const { rec, errors, decisions, d10 } = r;
        const old = info.newTeam === "radiant" ? "dire" : "radiant";
        const k = rec.kills && rec.kills.end ? `${rec.kills.end[info.newTeam]}-${rec.kills.end[old]}` : "?";
        const nw = rec.nw10 ? `${rec.nw10[info.newTeam]}-${rec.nw10[old]}` : "?";
        const lhSum = side => (rec.lineup && rec.lh10 ? rec.lineup[side].reduce((a, h) => a + (rec.lh10[h] || 0), 0) : "?");
        const lh = `${lhSum(info.newTeam)}-${lhSum(old)}`;
        const dNew = d10[info.newTeam === "radiant" ? 2 : 3];
        const dOld = d10[info.newTeam === "radiant" ? 3 : 2];
        const win = rec.winner === info.newTeam;
        if (rec.nw10) sums.nw += rec.nw10[info.newTeam] - rec.nw10[old];
        if (rec.lineup && rec.lh10) sums.lh += lhSum(info.newTeam) - lhSum(old);
        sums.d10 += dNew - dOld;
        const p = (pairs[info.pair] = pairs[info.pair] || { w: 0, n: 0 });
        p.n++;
        if (win) p.w++;
        console.log(
            head +
                `${String(rec.winner).padEnd(9)}${(win ? "WIN" : "loss").padEnd(8)}` +
                `${String(Math.round(rec.duration / 60)).padEnd(9)}${k.padEnd(16)}${nw.padEnd(15)}${lh.padEnd(14)}${`${dNew}-${dOld}`.padEnd(12)}${String(errors).padEnd(8)}${decisions}`
        );
    }
    if (m.screen) console.log(`Screened ${played} of ${total} games (stopped at ${m.screen / 60}:00).`);
    else console.log(`Per lineup pair: ${Object.entries(pairs).map(([p, v]) => `pair ${p} ${v.w}/${v.n}`).join(", ")}`);
    if (!m.screen) console.log(`New team won ${won} of ${played} finished games.`);
    if (played && !m.screen) console.log(`Average per game: nw10 new-old ${Math.round(sums.nw / played)}, lh10 new-old ${Math.round(sums.lh / played)}, deaths before 10:00 new-old ${(sums.d10 / played).toFixed(1)}`);
    if (!played) return;
    const leads = rows.filter(r => r.state === "done" && r.lead30 !== null).map(r => r.lead30);
    if (leads.length > 1) {
        const [mean, lo30, hi30] = meanCI(leads);
        console.log(`Gold lead at ${AT}:00 (new - old): ${k1(mean)} per game, 95% range ${k1(lo30)} to ${k1(hi30)} (${leads.length} games).`);
    }
    if (m.screen) {
        console.log(`Win verdict: none (screen batch: games stop at ${m.screen / 60}:00). Judge it with compare against a baseline, then confirm a PASS with a full batch.`);
        return;
    }
    const [lo, hi] = wilson(won, played);
    console.log(`Win rate ${pct(won / played)}, 95% range ${pct(lo)}-${pct(hi)}.`);
    if (kind === "data") console.log("Verdict: none (data batch: exploration adds noise; use an eval batch to judge a change).");
    else if (played < total) console.log(`Verdict: none yet (${played} of ${total} games; decide on the complete batch only).`);
    else console.log(`Verdict against 50%: ${lo > 0.5 ? "BETTER" : hi < 0.5 ? "WORSE" : "inconclusive"}${m.flags === "none" ? " (A/A batch: should be inconclusive)" : ""}.`);
}

// Every batch at a glance, oldest first (by start time). <filter> keeps names containing it.
function ledger(filter) {
    const names = fs
        .readdirSync(runsDir)
        .filter(n => fs.existsSync(path.join(runsDir, n, "manifest.json")) && (!filter || n.includes(filter)))
        .map(n => [n, JSON.parse(fs.readFileSync(path.join(runsDir, n, "manifest.json"), "utf8"))])
        .sort((a, b) => String(a[1].started).localeCompare(String(b[1].started)));
    console.log("started UTC  batch                     kind  flags                         commit        games   won    win%   gold@30");
    for (const [n] of names) {
        setGoldMinute([n]);
        const r = results(n);
        const leads = r.rows.filter(x => x.state === "done" && x.lead30 !== null).map(x => x.lead30);
        const gold = leads.length ? k1(leads.reduce((a, x) => a + x, 0) / leads.length) + (AT !== 30 ? ` @${AT}:00` : "") + (leads.length < r.played ? ` (${leads.length} games with POS lines)` : "") : "-";
        const started = String(r.m.started || "").slice(5, 16).replace("T", " ");
        console.log(
            `${started.padEnd(13)}${n.padEnd(26)}${(r.screen ? "scrn" : r.kind).padEnd(6)}${String(r.m.flags).padEnd(30)}${String(r.m.commit || "?").padEnd(14)}` +
                `${`${r.played}/${r.total}`.padEnd(8)}${(r.screen ? "-" : String(r.won)).padEnd(7)}${(r.played && !r.screen ? pct(r.won / r.played) : "-").padEnd(7)}${gold}`
        );
    }
}

function meanCI(xs) {
    const n = xs.length;
    const mean = xs.reduce((a, x) => a + x, 0) / n;
    const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) * (x - mean), 0) / (n - 1));
    const h = (n < 30 ? 2.1 : 1.96) * (sd / Math.sqrt(n));
    return [mean, mean - h, mean + h];
}
function k1(x) {
    return `${x >= 0 ? "+" : ""}${(x / 1000).toFixed(1)}k`;
}

// Gold screen: the new team's net-worth lead at 30:00, paired game by game (same lineup, same side), so the
// lineup's own effect cancels. Much less noisy per game than a win; it screens a change, wins confirm it.
function goldScreen(a, b, A, Bb) {
    // A game counts for gold once its log passed 30:00, even if its server died before the end (ev-gf g24).
    const byG = x => Object.fromEntries(x.rows.filter(r => r.gold && r.lead30 !== null).map(r => [r.g, r.lead30]));
    const ga = byG(A), gb = byG(Bb);
    const diffs = Object.keys(ga).filter(g => g in gb).map(g => ga[g] - gb[g]);
    if (diffs.length < 2) return;
    const [mean, lo, hi] = meanCI(diffs);
    console.log(`Gold screen, lead at ${AT}:00 ${a} - ${b}, paired over ${diffs.length} games: ${k1(mean)}, 95% range ${k1(lo)} to ${k1(hi)}.`);
    const complete = A.goldPlayed === A.total && Bb.goldPlayed === (Bb.goldTotal ?? Bb.total);
    if (!complete) console.log("Gold verdict: none yet (both batches must be complete).");
    else console.log(`Gold verdict: ${lo > 0 ? "PASS (confirm on wins)" : hi < 0 ? "FAIL" : "inconclusive"}.`);
    // The lead at 10:00 is for changes that act in the laning phase; no verdict (10:00 is not the target).
    const by10 = x => Object.fromEntries(x.rows.filter(r => r.gold && r.lead10 != null).map(r => [r.g, r.lead10]));
    const ta = by10(A), tb = by10(Bb);
    const d10 = Object.keys(ta).filter(g => g in tb).map(g => ta[g] - tb[g]);
    if (d10.length >= 2) {
        const [m10, l10, h10] = meanCI(d10);
        console.log(`Gold lead at 10:00 (information only), paired over ${d10.length} games: ${k1(m10)}, 95% range ${k1(l10)} to ${k1(h10)}.`);
    }
    // For a change that acts only after 10:00, the 10:00 difference is draw noise that the snowball doubles by
    // 30:00. Remove it: diff30 - b * diff10, b = slope of lead30 on lead10 over the baseline's games.
    const both = Bb.rows.filter(r => r.gold && r.lead10 != null && r.lead30 !== null);
    const gs = Object.keys(ga).filter(g => g in gb && g in ta && g in tb);
    if (AT > 10 && both.length >= 8 && gs.length >= 2) {
        const mx = both.reduce((x, r) => x + r.lead10, 0) / both.length;
        const my = both.reduce((x, r) => x + r.lead30, 0) / both.length;
        const sxx = both.reduce((x, r) => x + (r.lead10 - mx) ** 2, 0);
        const slope = sxx > 0 ? both.reduce((x, r) => x + (r.lead10 - mx) * (r.lead30 - my), 0) / sxx : 0;
        const [ma, la, ha] = meanCI(gs.map(g => ga[g] - gb[g] - slope * (ta[g] - tb[g])));
        console.log(`Gold at ${AT}:00 adjusted for the 10:00 lead (slope ${slope.toFixed(2)}; use for changes that act only after 10:00): ${k1(ma)}, 95% range ${k1(la)} to ${k1(ha)}.`);
    }
}

// Several baselines joined with "+" pool into one: wins add up, and each game's gold lead is the mean over the
// baselines that played it. Pool only batches of the same flags whose code did not change for those flags
// (code added behind other, off flags is inert): re-running an unchanged baseline for every change cost half
// of the games on 2026-11-16 (ev-group, ev-group2/3/4: 128 games of the same setup).
function pooled(spec) {
    const names = spec.split("+");
    const parts = names.map(n => results(n));
    if (parts.length === 1) return parts[0];
    const flags = new Set(parts.map(p => p.m.flags));
    if (flags.size > 1) fail(`Pooled baselines must share their flags; got ${[...flags].join(" / ")}`);
    const byGame = {};
    const by10 = {};
    const winBy = {};
    for (const p of parts)
        for (const r of p.rows) {
            if (!r.gold) continue;
            if (r.lead30 !== null) (byGame[r.g] = byGame[r.g] || []).push(r.lead30);
            if (r.lead10 != null) (by10[r.g] = by10[r.g] || []).push(r.lead10);
            if (r.state === "done" && r.rec) (winBy[r.g] = winBy[r.g] || []).push(r.rec.winner === r.info.newTeam ? 1 : 0);
        }
    const mean = v => v.reduce((x, y) => x + y, 0) / v.length;
    const gs = new Set([...Object.keys(byGame), ...Object.keys(winBy)]);
    const rows = [...gs].map(g => ({ g: Number(g), state: "done", gold: true, lead30: byGame[g] ? mean(byGame[g]) : null, lead10: by10[g] ? mean(by10[g]) : null, winRate: winBy[g] ? mean(winBy[g]) : null }));
    const games = {};
    for (const p of parts) Object.assign(games, p.m.games);
    return {
        m: { flags: parts[0].m.flags, games, commit: parts.map(p => p.m.commit || "?").join("+") },
        rows,
        // Screen batches have no winners: their games count for gold only, not as played games for wins.
        played: parts.reduce((x, p) => x + (p.screen ? 0 : p.played), 0),
        goldPlayed: parts.reduce((x, p) => x + p.goldPlayed, 0),
        goldTotal: parts.reduce((x, p) => x + p.total, 0),
        won: parts.reduce((x, p) => x + p.won, 0),
        total: parts.reduce((x, p) => x + (p.screen ? 0 : p.total), 0),
        kind: parts.some(p => p.kind === "data") ? "data" : "eval",
    };
}

function compare(a, b) {
    if (!a || !b) fail("Usage: npm run batch -- compare <name> <baseline>[+<baseline>...] [--at=<min>]");
    setGoldMinute([a, ...b.split("+")]);
    const A = results(a);
    const Bb = pooled(b);
    for (const [n, x] of [[a, A], [b, Bb]]) {
        console.log(`${n} (${x.kind}, flags ${x.m.flags}${x.m.tune ? `, tune ${x.m.tune}` : ""}, commit ${x.m.commit || "?"}): ${x.won}/${x.played} won${x.played < x.total ? `, ${x.total - x.played} of ${x.total} games not finished` : ""}`);
    }
    const ga = Object.keys(A.m.games).sort().join(",");
    const gb = Object.keys(Bb.m.games).sort().join(",");
    if (ga !== gb) console.log("Note: the two batches cover different games (lineups); the difference mixes in lineup effects.");
    if (!A.played || !Bb.played) return;
    goldScreen(a, b, A, Bb);
    if (A.screen || Bb.screen) {
        console.log("Win verdict: none (screen batch: no game reaches its end). On a Gold PASS, confirm with a full eval batch.");
        return;
    }
    // Paired by game number (same lineup, same side): a game's own lineup effect cancels. The method review
    // of 2026-11-16 found 20 of 32 slots decided by lineup and side, so the unpaired test below is about 9 points blunter.
    {
        const winOf = r => (r.winRate !== undefined ? r.winRate : r.rec ? (r.rec.winner === r.info.newTeam ? 1 : 0) : null);
        const wb = Object.fromEntries(Bb.rows.filter(r => r.state === "done" && winOf(r) !== null).map(r => [r.g, winOf(r)]));
        const diffs = A.rows.filter(r => r.state === "done" && r.rec && r.g in wb).map(r => winOf(r) - wb[r.g]);
        if (diffs.length > 1) {
            const [m, l, h] = meanCI(diffs);
            const complete = A.played === A.total && Bb.played === Bb.total;
            console.log(`Wins paired by game over ${diffs.length} games: ${m >= 0 ? "+" : ""}${Math.round(100 * m)} points, 95% range ${Math.round(100 * l)} to ${Math.round(100 * h)}.`);
            if (complete && A.kind !== "data" && Bb.kind !== "data") console.log(`Paired win verdict: ${l > 0 ? "BETTER" : h < 0 ? "WORSE" : "inconclusive"}.`);
        }
    }
    const pa = A.won / A.played;
    const pb = Bb.won / Bb.played;
    const se = Math.sqrt((pa * (1 - pa)) / A.played + (pb * (1 - pb)) / Bb.played);
    const d = pa - pb;
    const lo = d - 1.96 * se;
    const hi = d + 1.96 * se;
    console.log(`Difference ${a} - ${b}: ${d >= 0 ? "+" : ""}${Math.round(100 * d)} points, 95% range ${Math.round(100 * lo)} to ${Math.round(100 * hi)}.`);
    if (A.kind === "data" || Bb.kind === "data") console.log("Verdict: none (a data batch is involved).");
    else if (A.played < A.total || Bb.played < Bb.total) console.log("Verdict: none yet (both batches must be complete).");
    else console.log(`Verdict: ${lo > 0 ? "BETTER" : hi < 0 ? "WORSE" : "inconclusive"}.`);
}
