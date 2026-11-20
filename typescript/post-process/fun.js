// Fun report for the persona / mood / smartchat flags (docs/BEHAVIOR_CHANGES.md "Fun against humans").
//
//   npm run fun -- <batch> [<baseline batch>]
//
// Per batch, from the game logs (POS trace lines, MATCHREC):
//   closeness: game length, lead changes (the new team's net-worth lead crossing zero by more than 2k),
//              largest lead either way, games with a comeback (a team 5k+ behind after 15:00 that won),
//              games still within 5k at 30:00;
//   moods:     tilts and team moods per game (MOOD / TEAMMOOD lines);
//   chat:      messages per game and the most used kinds (TALK lines).
// With a baseline (same games, without persona), the mechanism check: for each persona, how the share of
// time its heroes spent in farm / team roam / retreat / push / defend differs from the same hero in the
// same baseline game (same lineup and side).
const fs = require("fs");
const path = require("path");

const runsDir = path.join(__dirname, "..", "..", "datasets", "runs");
const MODES = { 17: "farm", 16: "gank", 4: "retreat", 8: "push", 9: "push", 10: "push", 11: "defend", 12: "defend", 13: "defend", 1: "lane" };
const SWING = 2000;
const COMEBACK = 5000;

function readBatch(name) {
    const dir = path.join(runsDir, name);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const games = {};
    for (const g of Object.keys(manifest.games)) {
        const file = path.join(dir, `console.g${g}.log`);
        if (!fs.existsSync(file)) continue;
        games[g] = readGame(fs.readFileSync(file, "utf8"), manifest.games[g].newTeam === "radiant" ? 2 : 3);
    }
    return { name, manifest, games };
}

function readGame(text, newTeam) {
    const oldTeam = newTeam === 2 ? 3 : 2;
    const nw = { 2: {}, 3: {} };
    const series = []; // [t, lead of the new team]
    const modeTime = {}; // hero -> mode -> samples (new team only)
    let lastT = -1;
    let lastSample = -999;
    for (const m of text.matchAll(/\] POS team=(\d) hero=(\S+) t=([\d.-]+) .* mode=(\d+) nw=(\d+)/g)) {
        const team = Number(m[1]);
        const t = Number(m[3]);
        nw[team][m[2]] = Number(m[5]);
        if (team === newTeam && t >= 0) {
            const mode = MODES[m[4]] || "other";
            modeTime[m[2]] = modeTime[m[2]] || {};
            modeTime[m[2]][mode] = (modeTime[m[2]][mode] || 0) + 1;
        }
        if (t - lastSample >= 10) {
            lastSample = t;
            const sum = k => Object.values(nw[k]).reduce((a, v) => a + v, 0);
            series.push([t, sum(newTeam) - sum(oldTeam)]);
        }
        lastT = t;
    }
    let rec = null;
    const i = text.indexOf("MATCHREC {");
    if (i >= 0) {
        try {
            rec = JSON.parse(text.slice(i + 9, text.indexOf("\n", i)).trim());
        } catch (e) {
            /* partial */
        }
    }
    const personas = {};
    for (const m of text.matchAll(new RegExp(`PERSONA team=${newTeam} hero=(\\S+) pos=\\d persona=(\\w+)`, "g"))) personas[m[1]] = m[2];
    const tilts = (text.match(new RegExp(`MOOD team=${newTeam} hero=\\S+ t=\\d+ mood=tilted`, "g")) || []).length;
    const teamMoods = [...text.matchAll(new RegExp(`TEAMMOOD team=${newTeam} t=(\\d+) mood=(\\w+)`, "g"))].map(m => `${m[2]}@${Math.floor(m[1] / 60)}`);
    const talk = [...text.matchAll(new RegExp(`TALK team=${newTeam} hero=\\S+ t=\\d+ kind=(\\w+)`, "g"))].map(m => m[1]);
    const winner = rec ? (rec.winner === "radiant" ? 2 : 3) : null;
    return { series, modeTime, personas, tilts, teamMoods, talk, rec, winner, newTeam, duration: rec ? rec.duration : lastT };
}

function closeness(g) {
    let changes = 0;
    let side = 0;
    let maxLead = 0;
    let minLead = 0;
    let lead30 = null;
    for (const [t, lead] of g.series) {
        maxLead = Math.max(maxLead, lead);
        minLead = Math.min(minLead, lead);
        if (lead30 === null && t >= 1800) lead30 = lead;
        const s = lead > SWING ? 1 : lead < -SWING ? -1 : 0;
        if (s !== 0 && side !== 0 && s !== side) changes++;
        if (s !== 0) side = s;
    }
    const late = g.series.filter(([t]) => t >= 900);
    const newBehind = late.some(([, l]) => l <= -COMEBACK);
    const newAhead = late.some(([, l]) => l >= COMEBACK);
    const comeback = g.winner !== null && ((newBehind && g.winner === g.newTeam) || (newAhead && g.winner !== g.newTeam));
    return { changes, maxLead, minLead, lead30, comeback, won: g.winner === g.newTeam };
}

function mean(xs) {
    return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN;
}
function k1(x) {
    return isNaN(x) ? "-" : `${(x / 1000).toFixed(1)}k`;
}

function report(b) {
    const gs = Object.values(b.games).filter(g => g.rec);
    const cs = gs.map(closeness);
    console.log(`\n${b.name} (${b.manifest.flags}): ${gs.length} finished games`);
    if (!gs.length) return;
    const wins = cs.filter(c => c.won).length;
    console.log(`  wins ${wins}/${gs.length} (${Math.round((100 * wins) / gs.length)}%)   length ${(mean(gs.map(g => g.duration)) / 60).toFixed(1)} min`);
    console.log(
        `  lead changes/game ${mean(cs.map(c => c.changes)).toFixed(2)}   largest lead ${k1(mean(cs.map(c => Math.max(c.maxLead, -c.minLead))))}` +
            `   comebacks ${cs.filter(c => c.comeback).length}/${gs.length}   within 5k at 30:00 ${cs.filter(c => c.lead30 !== null && Math.abs(c.lead30) < 5000).length}/${cs.filter(c => c.lead30 !== null).length}`
    );
    const tilts = mean(gs.map(g => g.tilts));
    const tm = gs.flatMap(g => g.teamMoods);
    if (tilts > 0 || tm.length) {
        const count = k => tm.filter(x => x.startsWith(k)).length;
        console.log(`  tilts/game ${tilts.toFixed(1)}   team moods: cocky ${count("cocky")}, desperate ${count("desperate")}, back to even ${count("even")}`);
    }
    const talk = gs.flatMap(g => g.talk);
    if (talk.length) {
        const by = {};
        for (const k of talk) by[k] = (by[k] || 0) + 1;
        const top = Object.entries(by)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([k, n]) => `${k} ${n}`)
            .join(", ");
        console.log(`  chat: ${(talk.length / gs.length).toFixed(1)} messages/game; ${top}`);
    }
}

function shares(modeTime) {
    const total = Object.values(modeTime).reduce((a, v) => a + v, 0) || 1;
    const out = {};
    for (const k of ["farm", "gank", "retreat", "push", "defend"]) out[k] = (modeTime[k] || 0) / total;
    return out;
}

function mechanism(a, base) {
    const diffs = {}; // persona -> mode -> [diff]
    for (const g of Object.keys(a.games)) {
        const ga = a.games[g];
        const gb = base.games[g];
        if (!gb) continue;
        for (const [hero, persona] of Object.entries(ga.personas)) {
            if (!ga.modeTime[hero] || !gb.modeTime[hero]) continue;
            const sa = shares(ga.modeTime[hero]);
            const sb = shares(gb.modeTime[hero]);
            diffs[persona] = diffs[persona] || {};
            for (const k of Object.keys(sa)) (diffs[persona][k] = diffs[persona][k] || []).push(sa[k] - sb[k]);
        }
    }
    console.log(`\nMechanism: share of time per mode, persona hero minus the same hero in ${base.name} (points)`);
    console.log("  persona     n    farm   gank   retreat push   defend");
    for (const p of ["greedy", "playmaker", "bully", "guardian", "hothead"]) {
        const d = diffs[p];
        if (!d) continue;
        const n = d.farm.length;
        const cell = k => {
            const v = 100 * mean(d[k]);
            return `${v >= 0 ? "+" : ""}${v.toFixed(1)}`.padStart(6);
        };
        console.log(`  ${p.padEnd(10)} ${String(n).padStart(3)}  ${cell("farm")} ${cell("gank")} ${cell("retreat")}  ${cell("push")} ${cell("defend")}`);
    }
}

const names = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (!names.length) {
    console.error("Usage: npm run fun -- <batch> [<baseline batch>]");
    process.exit(1);
}
const batches = names.map(readBatch);
for (const b of batches) report(b);
if (batches.length >= 2) mechanism(batches[0], batches[1]);
