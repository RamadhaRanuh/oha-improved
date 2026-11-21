// Last-hit and deny report from the match recorder's CSREC lines (bots/tools/match_recorder.lua).
//
//   npm run cs -- <batch>                 per hero: last hits and denies at 5:00 and 10:00, and the share of the
//                                          lane creeps that died near the hero that it took (LH%) or denied (DN%)
//   npm run cs -- <change> <baseline>     the same for both, paired by game and hero, with the difference
//   ... --all                              every hero (default: the new team only; in a drill, the drilled heroes)
//
// <batch> is a folder name under datasets/runs (npm run batch) or a path to one. Drill batches
// (npm run batch -- start 1-8 <flags> --drill=solo --screen=10) count only the heroes that played.
// LH% = lhLane / lhNear: of the enemy lane creeps that died within `near` (1000) of the hero before the minute,
// the share the hero last-hit. Missed = died to creeps, towers or nobody; Denied = the enemy denied it.
// DN% = dnLane / dnNear: of the hero's own lane creeps that died near it, the share it denied.
// lane = the enemy lane creeps that died in the hero's lane (by its position: pos 2 mid, pos 1 and 5 the safe lane,
// pos 3 and 4 the off lane), and LH/lane = lhLane / lane: unlike LH%, it also counts creeps lost while away.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const runsDir = path.join(root, "datasets/runs");
const fail = msg => {
    console.error(msg);
    process.exit(1);
};
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const showAll = process.argv.includes("--all");
if (!args.length || args.length > 2) fail("Usage: npm run cs -- <batch> [<baseline>] [--all]");

const dirOf = name => {
    const d = fs.existsSync(name) ? path.resolve(name) : path.join(runsDir, name);
    if (!fs.existsSync(d)) fail(`No batch ${name}`);
    return d;
};

// Hero -> position (1-5) from the game's general.lua that match-setup wrote (fixed lineups only).
function slotsOf(dir, g) {
    const f = path.join(dir, "cfg", `g${g}`, "Customize", "general.lua");
    const out = {};
    if (!fs.existsSync(f)) return out;
    const text = fs.readFileSync(f, "utf8");
    for (const team of ["Radiant", "Dire"]) {
        const m = text.match(new RegExp(`Customize\\.${team}_Heros = \\{([\\s\\S]*?)\\n\\}`));
        if (!m) continue;
        (m[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1)).forEach((h, i) => (out[h] = i + 1));
    }
    return out;
}
// Enemy lane creeps that died in the lane of a hero of `team` ("radiant" / "dire") at position `pos`.
function laneTotal(lanes, team, pos) {
    if (!lanes || !team || !pos) return null;
    const enemy = team === "radiant" ? "dire" : "radiant";
    const safe = team === "radiant" ? "bot" : "top";
    const off = team === "radiant" ? "top" : "bot";
    const lane = pos === 2 ? "mid" : pos === 1 || pos === 5 ? safe : off;
    return (lanes[enemy] || {})[lane] ?? null;
}

// {game: {t300: heroes, t600: heroes, newTeam, drill}} for one batch.
function load(name) {
    const dir = dirOf(name);
    const mf = path.join(dir, "manifest.json");
    const manifest = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, "utf8")) : { games: {} };
    const games = {};
    for (const f of fs.readdirSync(dir)) {
        const m = f.match(/^console\.g(\d+)(?:\.smoke)?\.log$/);
        if (!m) continue;
        const g = Number(m[1]);
        const rec = { newTeam: (manifest.games[g] || {}).newTeam, drill: manifest.drill || null, slots: slotsOf(dir, g) };
        for (const line of fs.readFileSync(path.join(dir, f), "latin1").split(/\r?\n/)) {
            const i = line.indexOf("CSREC {");
            if (i < 0) continue;
            try {
                const j = JSON.parse(line.slice(i + 6));
                rec[`t${j.t}`] = j.heroes;
                if (j.lanes) rec[`lanes${j.t}`] = j.lanes;
            } catch (e) {
                // a line cut off by a stopped server
            }
        }
        if (rec.t600 || rec.t300) games[g] = rec;
    }
    return { name, manifest, games };
}

// Rows to show: hero-in-game records at 10:00 (with the 5:00 numbers alongside).
function rows(batch) {
    const out = [];
    for (const [g, rec] of Object.entries(batch.games)) {
        const at10 = rec.t600 || {};
        const at5 = rec.t300 || {};
        for (const [hero, r] of Object.entries(at10)) {
            const isNew = r.team && rec.newTeam ? r.team === rec.newTeam : null;
            if (rec.drill) {
                if (!(r.lhNear > 0 || r.dnNear > 0)) continue; // frozen in the fountain
            } else if (!showAll && isNew === false) continue;
            const lane = laneTotal(rec.lanes600, r.team, rec.slots[hero]);
            out.push({ game: Number(g), hero: hero.replace("npc_dota_hero_", ""), isNew, r, r5: at5[hero] || {}, lane, pos: rec.slots[hero] });
        }
    }
    return out.sort((a, b) => a.game - b.game || a.hero.localeCompare(b.hero));
}

const pct = (a, b) => (b > 0 ? `${Math.round((100 * a) / b)}%` : "-");
const n = v => (typeof v === "number" ? v : 0);
const pad = (s, w) => String(s).padStart(w);
const padr = (s, w) => String(s).padEnd(w);

function table(batch, list) {
    console.log(`\n${batch.name}${batch.manifest.drill ? ` (drill ${batch.manifest.drill})` : ""}: ${Object.keys(batch.games).length} games with CSREC`);
    console.log(`${padr("game", 5)}${padr("hero", 22)}${pad("LH5", 5)}${pad("LH10", 6)}${pad("DN10", 6)}${pad("LH%", 6)}${pad("near", 6)}${pad("ally", 6)}${pad("deny'd", 7)}${pad("missed", 7)}${pad("DN%", 6)}${pad("dnNear", 7)}${pad("lane", 6)}${pad("LH/lane", 8)}`);
    for (const x of list) {
        const r = x.r;
        console.log(
            `${padr(`g${x.game}`, 5)}${padr(x.hero + (x.isNew === false ? " (old)" : ""), 22)}${pad(n(x.r5.lh), 5)}${pad(n(r.lh), 6)}${pad(n(r.dn), 6)}` +
                `${pad(pct(n(r.lhLane), n(r.lhNear)), 6)}${pad(n(r.lhNear), 6)}${pad(n(r.lhAlly), 6)}${pad(n(r.lhDenied), 7)}${pad(n(r.lhMissed), 7)}` +
                `${pad(pct(n(r.dnLane), n(r.dnNear)), 6)}${pad(n(r.dnNear), 7)}${pad(x.lane ?? "-", 6)}${pad(x.lane ? pct(n(r.lhLane), x.lane) : "-", 8)}`
        );
    }
    summary("total", list);
    // By position, when there is more than one.
    const positions = [...new Set(list.map(x => x.pos).filter(Boolean))].sort();
    if (positions.length > 1) for (const p of positions) summary(`pos ${p} (${list.filter(x => x.pos === p).length})`, list.filter(x => x.pos === p));
}

function summary(label, list) {
    if (!list.length) return;
    const sum = k => list.reduce((s, x) => s + n(x.r[k]), 0);
    const sum5 = list.reduce((s, x) => s + n(x.r5.lh), 0);
    const withLane = list.filter(x => x.lane);
    const laneSum = withLane.reduce((s, x) => s + x.lane, 0);
    const laneLh = withLane.reduce((s, x) => s + n(x.r.lhLane), 0);
    console.log(
        `${padr(label, 27)}${pad((sum5 / list.length).toFixed(1), 5)}${pad((sum("lh") / list.length).toFixed(1), 6)}${pad((sum("dn") / list.length).toFixed(1), 6)}` +
            `${pad(pct(sum("lhLane"), sum("lhNear")), 6)}${pad(sum("lhNear"), 6)}${pad(sum("lhAlly"), 6)}${pad(sum("lhDenied"), 7)}${pad(sum("lhMissed"), 7)}` +
            `${pad(pct(sum("dnLane"), sum("dnNear")), 6)}${pad(sum("dnNear"), 7)}${pad(laneSum || "-", 6)}${pad(laneSum ? pct(laneLh, laneSum) : "-", 8)}` +
            `   (LH5/LH10/DN10 are means per hero)`
    );
}

const a = load(args[0]);
const la = rows(a);
if (!la.length) fail(`${args[0]}: no CSREC lines (games from before the CSREC recorder, or none reached 5:00)`);
table(a, la);

if (args[1]) {
    const b = load(args[1]);
    if (!!a.manifest.drill !== !!b.manifest.drill || (a.manifest.drill || "") !== (b.manifest.drill || ""))
        fail(`\nDo not compare ${a.manifest.drill || "match"} with ${b.manifest.drill || "match"} batches.`);
    const lb = rows(b);
    table(b, lb);
    // Paired by game and hero.
    const key = x => `${x.game}:${x.hero}`;
    const mb = new Map(lb.map(x => [key(x), x]));
    const pairs = la.filter(x => mb.has(key(x))).map(x => [x, mb.get(key(x))]);
    if (!pairs.length) return console.log("\nNo hero-in-game pairs in common.");
    const d = f => pairs.reduce((s, [x, y]) => s + f(x) - f(y), 0) / pairs.length;
    const rate = (list, num, den) => {
        const t = list.reduce((s, x) => s + n(x.r[den]), 0);
        return t > 0 ? list.reduce((s, x) => s + n(x.r[num]), 0) / t : 0;
    };
    const A = pairs.map(p => p[0]);
    const B = pairs.map(p => p[1]);
    // Spread of the per-pair LH10 difference, for a rough standard error.
    const diffs = pairs.map(([x, y]) => n(x.r.lh) - n(y.r.lh));
    const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
    const sd = Math.sqrt(diffs.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, diffs.length - 1));
    const se = sd / Math.sqrt(diffs.length);
    console.log(`\n${a.name} minus ${b.name}, ${pairs.length} hero-in-game pairs:`);
    console.log(`  LH5  ${d(x => n(x.r5.lh)) >= 0 ? "+" : ""}${d(x => n(x.r5.lh)).toFixed(1)}`);
    console.log(`  LH10 ${mean >= 0 ? "+" : ""}${mean.toFixed(1)} (± ${se.toFixed(1)} standard error)`);
    console.log(`  DN10 ${d(x => n(x.r.dn)) >= 0 ? "+" : ""}${d(x => n(x.r.dn)).toFixed(1)}`);
    console.log(`  LH%  ${(100 * rate(A, "lhLane", "lhNear")).toFixed(0)}% vs ${(100 * rate(B, "lhLane", "lhNear")).toFixed(0)}%`);
    console.log(`  DN%  ${(100 * rate(A, "dnLane", "dnNear")).toFixed(0)}% vs ${(100 * rate(B, "dnLane", "dnNear")).toFixed(0)}%`);
    const laneRate = list => {
        const w = list.filter(x => x.lane);
        const t = w.reduce((s, x) => s + x.lane, 0);
        return t > 0 ? w.reduce((s, x) => s + n(x.r.lhLane), 0) / t : 0;
    };
    console.log(`  LH/lane ${(100 * laneRate(A)).toFixed(0)}% vs ${(100 * laneRate(B)).toFixed(0)}%`);
}
