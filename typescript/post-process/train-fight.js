// Learned fight / run model (docs/specs/learned-fight-decisions.md, step 3).
//
//   npm run train-fight -- <dataset.csv>... [--trees=150] [--depth=3] [--margin=0.2] [--out=bots/FunLib/behavior/learned_fight_model.lua]
//
// Input: CSVs from `npm run decisions` (FIGHTDEC joined with FIGHTOUT). Trains on the FORCED rows only:
// exploration forced fight or run at random (50/50) for 4 s, so they compare the two actions in the same
// situations without the bias of the bots' own choices.
//
// Score of a decision (spec step 3): kills - 1.5 x died - 0.5 x allyDeaths + nwGain / 300, over the 10 s after it.
// Model: two small gradient-boosted regression tree ensembles (one per action) predicting the score.
// Policy: fight if pred(fight) - pred(run) > margin, run if < -margin, else leave it to the bot's own rules.
//
// Evaluation: 5-fold cross-validation by match. On held-out forced rows where the model is confident,
// "agree" is the mean score when the forced action matched the model's choice, "disagree" when it did not.
// A useful model has agree clearly above disagree. Also prints the always-fight / always-run values.
// Writes the final model (trained on all forced rows) as a Lua table.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const opts = { trees: 150, depth: 3, margin: 0.2, lr: 0.05, minLeaf: 40, out: path.join(root, "bots/FunLib/behavior/learned_fight_model.lua") };
const files = [];
for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([a-zA-Z]+)=(.*)$/);
    if (m) opts[m[1]] = m[1] === "out" ? path.resolve(m[2]) : Number(m[2]);
    else files.push(a);
}
if (!files.length) {
    console.error("Usage: npm run train-fight -- <dataset.csv>... [--trees=150] [--depth=3] [--margin=0.2]");
    process.exit(1);
}

// ---- features (must match FEATURES in behavior/learned.ts) ----
const FEATURES = [
    ["hp", r => +r.hp],
    ["mp", r => +r.mp],
    ["lvl", r => +r.lvl],
    ["allies", r => +r.allies],
    ["enemies", r => +r.enemies],
    ["sideDiff", r => +r.allies + 1 - +r.enemies],
    ["allyHp", r => +r.allyHp],
    ["enemyHp", r => +r.enemyHp],
    ["lvlDiff", r => +r.allyLvl / (+r.allies + 1) - +r.enemyLvl / Math.max(+r.enemies, 1)],
    ["missing", r => +r.missing],
    ["near", r => +r.near],
    ["nearHp", r => +r.nearHp],
    ["inc", r => Math.min(+r.inc, 5)],
    ["out", r => Math.min(+r.out, 5)],
    ["teamOut", r => Math.min(+r.teamOut, 10)],
    ["ult", r => +r.ult],
    ["towerAlly", r => Math.min(+r.towerAlly, 5000)],
    ["towerEnemy", r => Math.min(+r.towerEnemy, 5000)],
    ["home", r => +r.home],
    ["laning", r => +r.laning],
    ["minute", r => +r.t / 60],
    ["pos", r => +r.pos],
];
// --horizon=30: score from the FIGHTOUT30 columns (deaths, kills and net worth over 30 s instead of 10 s).
const score = r =>
    opts.horizon === 30
        ? +r.kills30 - 1.5 * +r.died30 - 0.5 * +r.allyDeaths30 + +r.nwGain30 / 300
        : +r.kills - 1.5 * +r.died - 0.5 * +r.allyDeaths + +r.nwGain / 300;

// ---- load ----
const rows = [];
for (const f of files) {
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean);
    const cols = lines[0].split(",");
    for (const line of lines.slice(1)) {
        const v = line.split(",");
        const r = {};
        cols.forEach((c, i) => (r[c] = v[i]));
        // --all=1 (testing only): unforced rows too. They carry the bots' own choice bias.
        if ((r.forced !== "1" && !opts.all) || (r.act !== "fight" && r.act !== "run")) continue;
        if (opts.horizon === 30 && (r.died30 === undefined || r.died30 === "")) continue;
        rows.push({ match: r.match, act: r.act, x: FEATURES.map(([, fn]) => fn(r)), y: score(r) });
    }
}
const matches = [...new Set(rows.map(r => r.match))];
console.log(`${rows.length} forced rows (fight ${rows.filter(r => r.act === "fight").length}, run ${rows.filter(r => r.act === "run").length}) from ${matches.length} games`);
if (rows.length < 400) {
    console.error("Too few forced rows to train. Run a data batch with --explore=0.03.");
    process.exit(1);
}

// ---- gradient-boosted regression trees (squared loss, histogram splits on <= 32 quantile bins) ----
const BINS = 32;
function edgesOf(data, j) {
    const vals = data.map(r => r.x[j]).sort((a, b) => a - b);
    const out = new Set();
    for (let q = 1; q < BINS; q++) out.add(vals[Math.floor((q / BINS) * (vals.length - 1))]);
    return [...out].sort((a, b) => a - b); // split "x <= edge"
}
function binOf(edges, v) {
    let lo = 0, hi = edges.length; // first edge >= v
    while (lo < hi) { const m = (lo + hi) >> 1; if (edges[m] >= v) hi = m; else lo = m + 1; }
    return lo; // bin k means edges[k-1] < v <= edges[k]
}
function buildTree(idx, bins, edges, resid, depth) {
    const n = idx.length;
    let sum = 0;
    for (const i of idx) sum += resid[i];
    const mean = sum / n;
    if (depth === 0 || n < 2 * opts.minLeaf) return { v: mean };
    let best = null;
    for (let j = 0; j < FEATURES.length; j++) {
        const nb = edges[j].length + 1;
        const cnt = new Float64Array(nb), sm = new Float64Array(nb);
        for (const i of idx) { const k = bins[i][j]; cnt[k]++; sm[k] += resid[i]; }
        let nl = 0, sl = 0;
        for (let k = 0; k < nb - 1; k++) {
            nl += cnt[k]; sl += sm[k];
            const nr = n - nl;
            if (nl < opts.minLeaf || nr < opts.minLeaf) continue;
            const sr = sum - sl;
            const gain = (sl * sl) / nl + (sr * sr) / nr;
            if (!best || gain > best.gain) best = { j, k, gain };
        }
    }
    if (!best) return { v: mean };
    const li = [], ri = [];
    for (const i of idx) (bins[i][best.j] <= best.k ? li : ri).push(i);
    return { f: best.j, t: edges[best.j][best.k], l: buildTree(li, bins, edges, resid, depth - 1), r: buildTree(ri, bins, edges, resid, depth - 1) };
}
const evalTree = (t, x) => (t.v !== undefined ? t.v : x[t.f] <= t.t ? evalTree(t.l, x) : evalTree(t.r, x));
function fit(data) {
    const edges = FEATURES.map((_, j) => edgesOf(data, j));
    const bins = data.map(r => r.x.map((v, j) => binOf(edges[j], v)));
    const base = data.reduce((a, r) => a + r.y, 0) / data.length;
    const pred = data.map(() => base);
    const all = data.map((_, i) => i);
    const trees = [];
    for (let k = 0; k < opts.trees; k++) {
        const resid = data.map((r, i) => r.y - pred[i]);
        const t = buildTree(all, bins, edges, resid, opts.depth);
        trees.push(t);
        data.forEach((r, i) => (pred[i] += opts.lr * evalTree(t, r.x)));
    }
    return { base, trees };
}
const predict = (m, x) => m.trees.reduce((a, t) => a + opts.lr * evalTree(t, x), m.base);

// ---- cross-validation by match ----
const folds = 5;
const shuffled = [...matches].sort((a, b) => (hash(a) % 1000) - (hash(b) % 1000));
function hash(s) {
    let h = 7;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h;
}
let agree = 0, nAgree = 0, disagree = 0, nDis = 0, confident = 0, total = 0;
let fightSum = 0, nFight = 0, runSum = 0, nRun = 0;
let modelRows = []; // per held-out row: forced act, model choice, score
for (let k = 0; k < folds; k++) {
    const test = new Set(shuffled.filter((_, i) => i % folds === k));
    const train = rows.filter(r => !test.has(r.match));
    const held = rows.filter(r => test.has(r.match));
    if (!held.length) continue;
    const mf = fit(train.filter(r => r.act === "fight"));
    const mr = fit(train.filter(r => r.act === "run"));
    for (const r of held) {
        total++;
        if (r.act === "fight") { fightSum += r.y; nFight++; } else { runSum += r.y; nRun++; }
        const d = predict(mf, r.x) - predict(mr, r.x);
        if (Math.abs(d) <= opts.margin) continue;
        confident++;
        const choice = d > 0 ? "fight" : "run";
        modelRows.push({ act: r.act, choice, y: r.y });
        if (choice === r.act) { agree += r.y; nAgree++; } else { disagree += r.y; nDis++; }
    }
}
function se(arr) {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1) / arr.length);
}
const ag = modelRows.filter(r => r.act === r.choice).map(r => r.y);
const di = modelRows.filter(r => r.act !== r.choice).map(r => r.y);
console.log(`held-out: always fight ${(fightSum / nFight).toFixed(3)} (n=${nFight}), always run ${(runSum / nRun).toFixed(3)} (n=${nRun})`);
console.log(`model confident on ${confident}/${total} rows (margin ${opts.margin})`);
for (const c of ["fight", "run"]) {
    const ag2 = modelRows.filter(r => r.choice === c && r.act === c).map(r => r.y);
    const di2 = modelRows.filter(r => r.choice === c && r.act !== c).map(r => r.y);
    if (ag2.length > 1 && di2.length > 1) {
        const m = a => a.reduce((x, y) => x + y, 0) / a.length;
        console.log(`  model says ${c}: forced ${c} ${m(ag2).toFixed(3)} (n=${ag2.length}), forced the other ${m(di2).toFixed(3)} (n=${di2.length}), uplift ${(m(ag2) - m(di2)).toFixed(3)} +- ${(2 * Math.sqrt(se(ag2) ** 2 + se(di2) ** 2)).toFixed(3)}`);
    }
}
if (ag.length > 1 && di.length > 1) {
    const diff = agree / nAgree - disagree / nDis;
    const s = Math.sqrt(se(ag) ** 2 + se(di) ** 2);
    console.log(`  agree ${(agree / nAgree).toFixed(3)} (n=${nAgree})  disagree ${(disagree / nDis).toFixed(3)} (n=${nDis})  uplift ${diff.toFixed(3)} +- ${(2 * s).toFixed(3)} (2 SE)`);
    console.log(diff > 2 * s ? "  -> the model has real signal" : "  -> no clear signal yet: more data, or a larger margin");
}

// ---- final model on all forced rows, written as Lua ----
const mf = fit(rows.filter(r => r.act === "fight"));
const mr = fit(rows.filter(r => r.act === "run"));
const luaTree = t => (t.v !== undefined ? `{v=${t.v.toFixed(5)}}` : `{f=${t.f + 1},t=${t.t},l=${luaTree(t.l)},r=${luaTree(t.r)}}`);
const luaModel = m => `{ base = ${m.base.toFixed(5)}, trees = {\n${m.trees.map(t => "    " + luaTree(t)).join(",\n")}\n} }`;
const lua = `-- Generated by typescript/post-process/train-fight.js (docs/specs/learned-fight-decisions.md, step 3). Do not edit.
-- ${rows.length} forced rows from ${matches.length} games; trees=${opts.trees} depth=${opts.depth} lr=${opts.lr}.
-- Features (index order): ${FEATURES.map(([n]) => n).join(", ")}
return {
features = { ${FEATURES.map(([n]) => `'${n}'`).join(", ")} },
lr = ${opts.lr},
margin = ${opts.margin},
fight = ${luaModel(mf)},
run = ${luaModel(mr)},
}
`;
fs.writeFileSync(opts.out, lua);
console.log(`model -> ${path.relative(root, opts.out)} (${(lua.length / 1024).toFixed(0)} KB)`);
