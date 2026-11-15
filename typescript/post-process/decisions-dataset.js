// Builds the fight decision dataset (docs/specs/learned-fight-decisions.md, step 1) from Dota console logs.
//
//   npm run decisions                         every console.<matchid>.log in <dota>/game/dota
//   npm run decisions -- <log>...             the given logs
//   npm run decisions -- --out=<file.csv>     output path (default datasets/fight_decisions.csv)
//
// Joins each FIGHTDEC line with its FIGHTOUT line (same id) and adds the match ID, whether the bot's team
// won, and whether the `fight` / `retreat` flags were on for its team (from the MATCHREC line).
// Decisions without an outcome (game ended inside the horizon) are dropped. Prints a short summary.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const dotaDir = path.join(__dirname, "../../../..");
let out = path.join(root, "datasets/fight_decisions.csv");
const files = [];
for (const a of process.argv.slice(2)) {
    const m = a.match(/^--out=(.+)$/);
    if (m) out = path.resolve(m[1]);
    else files.push(a);
}
const logs = files.length
    ? files
    : fs
          .readdirSync(dotaDir)
          .filter(f => /^console\.\d+\.log$/.test(f))
          .map(f => path.join(dotaDir, f));

const kv = s => {
    const o = {};
    for (const part of s.trim().split(/\s+/)) {
        const i = part.indexOf("=");
        if (i > 0) o[part.slice(0, i)] = part.slice(i + 1);
    }
    return o;
};

const rows = [];
const summary = [];
for (const log of logs) {
    const text = fs.readFileSync(log, "utf8");
    if (!text.includes("FIGHTDEC ")) continue;
    const matchId = (path.basename(log).match(/console\.(\d+)\.log/) || [])[1] || path.basename(log);
    let rec = null;
    const decs = new Map();
    const outs = new Map();
    for (const line of text.split(/\r?\n/)) {
        let i = line.indexOf("FIGHTDEC ");
        if (i >= 0) {
            const o = kv(line.slice(i + 9));
            decs.set(o.id, o);
            continue;
        }
        i = line.indexOf("FIGHTOUT ");
        if (i >= 0) {
            const o = kv(line.slice(i + 9));
            outs.set(o.id, o);
            continue;
        }
        i = line.indexOf("MATCHREC {");
        if (i >= 0) {
            try {
                rec = JSON.parse(line.slice(i + 9));
            } catch (e) {
                /* partial line */
            }
        }
    }
    let joined = 0;
    for (const [id, d] of decs) {
        const o = outs.get(id);
        if (!o) continue;
        const side = d.team === "2" ? "radiant" : "dire";
        const flags = rec && rec.flags ? rec.flags[side] || {} : {};
        rows.push({
            match: matchId,
            ...d,
            won: rec ? (rec.winner === side ? 1 : 0) : "",
            flagFight: flags.fight ? 1 : 0,
            flagRetreat: flags.retreat ? 1 : 0,
            died: o.died,
            kills: o.kills,
            allyDeaths: o.allyDeaths,
            hpEnd: o.hp,
            nwGain: o.nwGain,
        });
        joined++;
    }
    summary.push(`${matchId}: ${decs.size} decisions, ${joined} with outcome${rec ? `, winner ${rec.winner}` : ", no MATCHREC"}`);
}

if (!rows.length) {
    console.log("No FIGHTDEC lines found. Set the game up with `npm run match` (it turns the decision log on) and play.");
    process.exit(0);
}
const cols = Object.keys(rows[0]);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, [cols.join(","), ...rows.map(r => cols.map(c => r[c] ?? "").join(","))].join("\n") + "\n");
for (const s of summary) console.log(s);
const by = {};
for (const r of rows) {
    const k = `${r.act}${r.forced === "1" ? "*" : ""}`;
    by[k] = by[k] || { n: 0, died: 0, kills: 0 };
    by[k].n++;
    by[k].died += Number(r.died);
    by[k].kills += Number(r.kills);
}
for (const [k, v] of Object.entries(by)) {
    console.log(`  act=${k.padEnd(7)} n=${String(v.n).padStart(6)}  died/decision=${(v.died / v.n).toFixed(3)}  kills/decision=${(v.kills / v.n).toFixed(3)}`);
}
console.log(`${rows.length} rows -> ${path.relative(root, out)}  (* = forced by exploration)`);
