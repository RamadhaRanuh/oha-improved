// npm run herorates: per-hero strength of OHA bots against OHA bots, for the `heropick` flag.
//
// Games: the MATCHREC line of every finished game in datasets/runs/*/console.g<n>.log (the main checkout's,
// also when run from a worktree). Skipped: batches whose name starts with "smoke" or "dr-hp" and the batch
// dr-gfcr-b (held-out test of heropick, seeds 33-64), and the kept copies (.dead.log, .crashed.log,
// .smoke.log). A log copied into a second folder (a replayed game) counts once: games are keyed by their
// MATCHREC text. Both teams of every game count, plain and new code alike.
// Lineup source: MATCHREC.lineup; an older MATCHREC without it is rebuilt from the DRAFTPICK lines (team +
// hero, used when every hero is in MATCHREC.kda: a hero the engine refused is not) or else the POS lines.
//
// Model: ridge-regularised logistic regression on "Radiant won", one observation per game, features +1 per
// Radiant hero and -1 per Dire hero plus an intercept (the side). Lineups are confounded with heroes in the
// fixed-lineup batches (one lineup replayed hundreds of times), so every distinct matchup (Radiant 5-set vs
// Dire 5-set) has a total weight of at most 2: a game weighs min(1, 2 / copies of its matchup).
// The ridge strength is chosen by 5-fold CV on the held-out log-loss of the free-draft games (Draft_Seed set);
// the folds split free-draft games by seed (both sides of a seed in one fold) and fixed-lineup games by matchup.
// Rate per hero = 1 / (1 + exp(-coef)): 0.5 is average. Heroes in fewer than 5 games are left out (read as 0.5).
// Writes bots/FunLib/hero_win_rates.lua and prints the CV numbers and the top and bottom 10.
//
//   npm run herorates [-- --runs=<dir>] [--out=<file>]
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "../..");
const mainRoot = (() => {
    const r = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root, encoding: "utf8" });
    const common = (r.stdout || "").trim();
    return r.status === 0 && common ? path.dirname(path.resolve(common)) : root;
})();
const arg = name => {
    const a = process.argv.find(s => s.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3) : null;
};
const runsDir = path.resolve(arg("runs") || path.join(mainRoot, "datasets/runs"));
const outFile = path.resolve(arg("out") || path.join(root, "bots/FunLib/hero_win_rates.lua"));
const MAX_MATCHUP_WEIGHT = 2;
const MIN_GAMES = 5;
const FOLDS = 5;
const LAMBDAS = [0.1, 0.3, 1, 2, 3, 5, 10, 20, 30, 100];
const skipBatch = name => name.startsWith("smoke") || name.startsWith("dr-hp") || name === "dr-gfcr-b";

if (!fs.existsSync(runsDir)) {
    console.error(`No runs folder: ${runsDir}`);
    process.exit(1);
}

// ---- Read the games ----
const PREFIX = "npc_dota_hero_";
function lineupFromLog(text, rec) {
    const known = rec.kda && typeof rec.kda === "object" ? new Set(Object.keys(rec.kda)) : null;
    const valid = l => l.radiant.length === 5 && l.dire.length === 5 && (!known || [...l.radiant, ...l.dire].every(h => known.has(h)));
    const collect = re => {
        const l = { radiant: new Set(), dire: new Set() };
        for (const m of text.matchAll(re)) {
            const hero = m[2].startsWith(PREFIX) ? m[2] : PREFIX + m[2];
            if (m[1] === "2") l.radiant.add(hero);
            else if (m[1] === "3") l.dire.add(hero);
        }
        return { radiant: [...l.radiant], dire: [...l.dire] };
    };
    const draft = collect(/DRAFTPICK team=(\d) pos=\d+ hero=(\S+)/g);
    if (valid(draft)) return { lineup: draft, source: "draftpick" };
    const pos = collect(/POS team=(\d) hero=(\S+)/g);
    if (valid(pos)) return { lineup: pos, source: "pos" };
    return null;
}

const seen = new Set();
const games = []; // { radiant[], dire[], y, seed, batch }
const sources = { matchrec: 0, draftpick: 0, pos: 0, skipped: 0 };
let batches = 0;
for (const b of fs.readdirSync(runsDir, { withFileTypes: true })) {
    if (!b.isDirectory() || skipBatch(b.name)) continue;
    const dir = path.join(runsDir, b.name);
    let used = false;
    for (const f of fs.readdirSync(dir)) {
        if (!/^console\.g\d+\.log$/.test(f)) continue;
        const text = fs.readFileSync(path.join(dir, f), "utf8");
        const i = text.indexOf("MATCHREC {");
        if (i < 0) continue;
        const end = text.indexOf("\n", i);
        const json = text.slice(i + 9, end < 0 ? undefined : end).trim();
        // A hash, not the slice: a sliced string keeps the whole log text alive.
        const key = crypto.createHash("sha1").update(json).digest("hex");
        if (seen.has(key)) continue;
        let rec;
        try {
            rec = JSON.parse(json);
        } catch (e) {
            continue; // partial line
        }
        if (rec.winner !== "radiant" && rec.winner !== "dire") continue;
        seen.add(key);
        let lineup = rec.lineup;
        let source = "matchrec";
        if (!lineup || !Array.isArray(lineup.radiant) || !Array.isArray(lineup.dire) || lineup.radiant.length !== 5 || lineup.dire.length !== 5) {
            const r = lineupFromLog(text, rec);
            if (!r) {
                sources.skipped++;
                continue;
            }
            lineup = r.lineup;
            source = r.source;
        }
        sources[source]++;
        const seedM = text.match(/DRAFTFLAG team=\d[^\n]*? seed=(\d+)/);
        games.push({
            radiant: lineup.radiant.map(String),
            dire: lineup.dire.map(String),
            y: rec.winner === "radiant" ? 1 : 0,
            seed: seedM ? Number(seedM[1]) : null,
            batch: b.name,
        });
        used = true;
    }
    if (used) batches++;
}
if (games.length === 0) {
    console.error(`No finished games (MATCHREC) under ${runsDir}`);
    process.exit(1);
}

// ---- Features, weights, folds ----
const heroes = [...new Set(games.flatMap(g => [...g.radiant, ...g.dire]))].sort();
const idx = new Map(heroes.map((h, k) => [h, k + 1])); // column 0 is the intercept
const P = heroes.length + 1;
const matchupKey = g => `${[...g.radiant].sort().join(",")}|${[...g.dire].sort().join(",")}`;
const copies = new Map();
for (const g of games) copies.set(matchupKey(g), (copies.get(matchupKey(g)) || 0) + 1);
const fold = new Map();
const freeSeeds = [...new Set(games.filter(g => g.seed !== null).map(g => g.seed))].sort((a, b) => a - b);
freeSeeds.forEach((s, k) => fold.set(`seed:${s}`, k % FOLDS));
[...copies.keys()].sort().forEach((m, k) => fold.set(`m:${m}`, k % FOLDS));
const obs = games.map(g => ({
    cols: [0, ...g.radiant.map(h => idx.get(h)), ...g.dire.map(h => idx.get(h))],
    vals: [1, ...g.radiant.map(() => 1), ...g.dire.map(() => -1)],
    y: g.y,
    w: Math.min(1, MAX_MATCHUP_WEIGHT / copies.get(matchupKey(g))),
    free: g.seed !== null,
    fold: g.seed !== null ? fold.get(`seed:${g.seed}`) : fold.get(`m:${matchupKey(g)}`),
}));

// ---- Ridge logistic regression (Newton) ----
const sigmoid = z => 1 / (1 + Math.exp(-z));
const predict = (beta, o) => {
    let z = 0;
    for (let k = 0; k < o.cols.length; k++) z += beta[o.cols[k]] * o.vals[k];
    return sigmoid(z);
};
function solve(A, b) {
    // Cholesky: A is symmetric positive definite (ridge on every hero column, a tiny one on the intercept).
    const n = b.length;
    const L = A.map(r => r.slice());
    for (let j = 0; j < n; j++) {
        let s = L[j][j];
        for (let k = 0; k < j; k++) s -= L[j][k] * L[j][k];
        L[j][j] = Math.sqrt(Math.max(s, 1e-12));
        for (let i = j + 1; i < n; i++) {
            let t = L[i][j];
            for (let k = 0; k < j; k++) t -= L[i][k] * L[j][k];
            L[i][j] = t / L[j][j];
        }
    }
    const x = b.slice();
    for (let i = 0; i < n; i++) {
        for (let k = 0; k < i; k++) x[i] -= L[i][k] * x[k];
        x[i] /= L[i][i];
    }
    for (let i = n - 1; i >= 0; i--) {
        for (let k = i + 1; k < n; k++) x[i] -= L[k][i] * x[k];
        x[i] /= L[i][i];
    }
    return x;
}
function fit(train, lambda) {
    const beta = new Array(P).fill(0);
    for (let it = 0; it < 50; it++) {
        const g = beta.map((b, k) => (k === 0 ? 1e-6 * b : lambda * b));
        const H = Array.from({ length: P }, (_, i) => {
            const r = new Array(P).fill(0);
            r[i] = i === 0 ? 1e-6 : lambda;
            return r;
        });
        for (const o of train) {
            const p = predict(beta, o);
            const d = o.w * (p - o.y);
            const h = o.w * p * (1 - p);
            for (let a = 0; a < o.cols.length; a++) {
                g[o.cols[a]] += d * o.vals[a];
                for (let c = 0; c < o.cols.length; c++) H[o.cols[a]][o.cols[c]] += h * o.vals[a] * o.vals[c];
            }
        }
        const step = solve(H, g);
        let max = 0;
        for (let k = 0; k < P; k++) {
            beta[k] -= step[k];
            max = Math.max(max, Math.abs(step[k]));
        }
        if (max < 1e-8) break;
    }
    return beta;
}
const logloss = (p, y) => -(y * Math.log(Math.max(p, 1e-12)) + (1 - y) * Math.log(Math.max(1 - p, 1e-12)));

// ---- CV on the free-draft games ----
const nFree = obs.filter(o => o.free).length;
const cv = [];
for (const lambda of LAMBDAS) {
    let loss = 0;
    let hit = 0;
    for (let f = 0; f < FOLDS; f++) {
        const beta = fit(
            obs.filter(o => o.fold !== f),
            lambda
        );
        for (const o of obs) {
            if (o.fold !== f || !o.free) continue;
            const p = predict(beta, o);
            loss += logloss(p, o.y);
            if ((p > 0.5 ? 1 : 0) === o.y) hit++;
        }
    }
    cv.push({ lambda, loss: nFree ? loss / nFree : NaN, acc: nFree ? hit / nFree : NaN });
}
const best = nFree ? cv.reduce((a, b) => (b.loss < a.loss ? b : a)) : { lambda: 3, loss: NaN, acc: NaN };
const beta = fit(obs, best.lambda);

// ---- Output ----
const n = {};
const w = {};
for (const g of games) {
    for (const side of ["radiant", "dire"]) {
        for (const h of g[side]) {
            n[h] = (n[h] || 0) + 1;
            if ((side === "radiant") === (g.y === 1)) w[h] = (w[h] || 0) + 1;
        }
    }
}
const rows = heroes
    .filter(h => n[h] >= MIN_GAMES)
    .map(h => ({ hero: h, n: n[h], w: w[h] || 0, coef: beta[idx.get(h)], rate: sigmoid(beta[idx.get(h)]) }))
    .sort((a, b) => b.rate - a.rate || (a.hero < b.hero ? -1 : 1));

const date = new Date().toISOString().slice(0, 10);
const lines = [
    "-- Generated by `npm run herorates` (typescript/post-process/hero-rates.js). Do not edit by hand.",
    `-- ${date}: ${games.length} finished games from ${batches} batches in datasets/runs (${nFree} free-draft),`,
    "-- both teams of every game, plain OHA and flagged code alike.",
    "-- Ridge logistic regression on the winner (+1 per Radiant hero, -1 per Dire hero, side intercept), every",
    `-- distinct matchup weighing at most ${MAX_MATCHUP_WEIGHT} games; ridge ${best.lambda} chosen by ${FOLDS}-fold CV on the free-draft games`,
    `-- (held-out log-loss ${best.loss.toFixed(3)}, accuracy ${(best.acc * 100).toFixed(1)}%).`,
    `-- Rate = 1 / (1 + exp(-coef)), 0.5 is average. Heroes in fewer than ${MIN_GAMES} games are left out and read as 0.5.`,
    "-- Read by hero_selection.lua when the `heropick` flag is on for the team.",
    "-- hero = rate, -- raw wins/games",
    "return {",
];
for (const r of [...rows].sort((a, b) => (a.hero < b.hero ? -1 : 1))) lines.push(`\t${r.hero} = ${r.rate.toFixed(3)}, -- ${r.w}/${r.n}`);
lines.push("}");
fs.writeFileSync(outFile, lines.join("\n") + "\n");

console.log(`${games.length} games (${batches} batches, ${nFree} free-draft, ${copies.size} distinct matchups), ${heroes.length} heroes`);
console.log(`lineup source: MATCHREC ${sources.matchrec}, DRAFTPICK ${sources.draftpick}, POS ${sources.pos}, skipped ${sources.skipped}`);
console.log(`CV on free-draft games (${FOLDS} folds by seed; always-0.5 log-loss 0.693):`);
for (const c of cv) console.log(`  ridge ${String(c.lambda).padEnd(5)} log-loss ${c.loss.toFixed(4)}  accuracy ${(c.acc * 100).toFixed(1)}%${c === best ? "  <- chosen" : ""}`);
const show = r => `  ${r.rate.toFixed(3)}  coef ${r.coef >= 0 ? "+" : ""}${r.coef.toFixed(3)}  raw ${String(r.w).padStart(4)}/${String(r.n).padEnd(4)}  ${r.hero.replace(PREFIX, "")}`;
console.log(`${rows.length} heroes written (n >= ${MIN_GAMES}) -> ${outFile}`);
console.log("Top 10:");
for (const r of rows.slice(0, 10)) console.log(show(r));
console.log("Bottom 10:");
for (const r of rows.slice(-10)) console.log(show(r));
