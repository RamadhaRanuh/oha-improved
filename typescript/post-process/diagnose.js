// Where a batch's games are won and lost (npm run diagnose -- <batch> [<batch> ...]). Run it on every
// complete batch before choosing the next change: pick targets that move the gold lead, not only deaths.
// Reads the DebugMode trace lines (POS / DEATH / GROUP / ALONE) in datasets/runs/<batch>/console.g*.log.
//
// Per batch, new team (flagged) against old team (plain OHA):
//   lead     mean net-worth lead at 10/15/20/30/40 min; games led by 5k+ at some point and how many won
//   mid      15:00-35:00 (games reaching 35:00): share of time per mode, gold gained, deaths, time with 2+ allies near
//   heroes   gold per minute 15:00-35:00 for the same hero on each side; the largest gaps
//   deaths   per game by phase (<10, 10-20, 20-35, 35+ min) and, after 20:00, by distance to the enemy ancient
//   blocks   GROUP regroup seconds and ALONE farm blocks per game (flag `group`)
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "../..");
const MID_A = 900, MID_B = 2100;
const MODE = { 1: "lane", 2: "attack", 3: "roam", 4: "retreat", 7: "rune", 8: "pushT", 9: "pushM", 10: "pushB", 11: "defT", 12: "defM", 13: "defB", 16: "teamroam", 17: "farm", 19: "evasive", 20: "roshan", 22: "ward" };

function readGame(file, nt) {
    const text = fs.readFileSync(file, "utf8");
    const w = text.match(/"winner":"([a-z]+)"/);
    if (!w || !text.includes("] POS ")) return null;
    const g = { winner: w[1], lead: [], maxT: 0, modes: { new: {}, old: {} }, samples: { new: 0, old: 0 }, grouped: { new: 0, old: 0 }, nwA: {}, nwB: {}, side: {}, deaths: { new: [], old: [] }, regroup: 0, aloneFarm: 0 };
    const nw = { 2: {}, 3: {} };
    const pos = { 2: {}, 3: {} };
    let regroupAt = null;
    for (const l of text.split("\n")) {
        let m = l.match(/\] POS team=(\d) hero=(\S+) t=([\d.-]+) x=(-?\d+) y=(-?\d+) .* mode=(\d+) nw=(\d+)/);
        if (m) {
            const t = +m[3], who = m[1] === nt ? "new" : "old";
            nw[m[1]][m[2]] = +m[7];
            g.side[m[2]] = who;
            g.maxT = Math.max(g.maxT, t);
            const min = Math.floor(t / 60);
            if (min >= 0) {
                const s = k => Object.values(nw[k]).reduce((a, v) => a + v, 0);
                g.lead[min] = s(nt) - s(nt === "2" ? "3" : "2");
            }
            if (t >= MID_A && g.nwA[m[2]] === undefined) g.nwA[m[2]] = +m[7];
            if (t <= MID_B) g.nwB[m[2]] = [t, +m[7]];
            if (t >= MID_A && t <= MID_B) {
                const name = MODE[m[6]] || `m${m[6]}`;
                g.modes[who][name] = (g.modes[who][name] || 0) + 1;
                g.samples[who]++;
                pos[m[1]][m[2]] = [t, +m[4], +m[5]];
                let near = 0;
                for (const [h, p] of Object.entries(pos[m[1]])) if (h !== m[2] && t - p[0] < 2.5 && Math.hypot(p[1] - +m[4], p[2] - +m[5]) < 1500) near++;
                if (near >= 2) g.grouped[who]++;
            }
            continue;
        }
        m = l.match(/DEATH team=(\d) hero=\S+ t=(-?\d+) (.*)/);
        if (m) {
            const parts = m[3].trim().split(" ");
            const last = parts[parts.length - 1].split(",");
            const d = +(last.find(x => /^d\d/.test(x)) || "d-1").slice(1);
            g.deaths[m[1] === nt ? "new" : "old"].push([+m[2], d]);
            continue;
        }
        m = l.match(/\] GROUP team=(\d) t=(\d+) regroup (start|end)/);
        if (m && m[1] === nt) {
            if (m[3] === "start") regroupAt = +m[2];
            else if (regroupAt !== null) { if (regroupAt >= MID_A && regroupAt <= MID_B) g.regroup += +m[2] - regroupAt; regroupAt = null; }
            continue;
        }
        if (l.includes("] ALONE team=" + nt) && l.includes("blocked=farm")) g.aloneFarm++;
    }
    return g;
}

const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const k1 = x => (Number.isNaN(x) ? "  -  " : `${x >= 0 ? "+" : ""}${(x / 1000).toFixed(1)}k`);

function diagnose(name) {
    const dir = path.join(root, "datasets/runs", name);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    const games = [];
    for (const g of Object.keys(manifest.games)) {
        const f = path.join(dir, `console.g${g}.log`);
        if (!fs.existsSync(f)) continue;
        const newSide = manifest.games[g].newTeam;
        const r = readGame(f, newSide === "radiant" ? "2" : "3");
        if (r) games.push({ g, won: r.winner === newSide, ...r });
    }
    if (!games.length) return console.log(`== ${name}: no finished games with trace lines`);
    console.log(`== ${name} (flags ${manifest.flags}): ${games.length} games, new team won ${games.filter(x => x.won).length}`);

    // lead
    const at = min => avg(games.map(x => x.lead[Math.min(min, x.lead.length - 1)]).filter(v => v !== undefined));
    const led = games.filter(x => Math.max(...x.lead.filter(v => v !== undefined)) >= 5000);
    console.log(`  lead     10m ${k1(at(10))}  15m ${k1(at(15))}  20m ${k1(at(20))}  30m ${k1(at(30))}  40m ${k1(at(40))} (a game that ended counts its final lead) | led by 5k+: ${led.length} games, won ${led.filter(x => x.won).length}; never: ${games.length - led.length}, won ${games.filter(x => x.won).length - led.filter(x => x.won).length}`);

    // mid
    const mid = games.filter(x => x.maxT >= MID_B);
    if (mid.length) {
        for (const who of ["new", "old"]) {
            const modes = {};
            let n = 0, grouped = 0, gain = 0, deaths = 0;
            for (const x of mid) {
                for (const [k, v] of Object.entries(x.modes[who])) modes[k] = (modes[k] || 0) + v;
                n += x.samples[who];
                grouped += x.grouped[who];
                for (const [h, s] of Object.entries(x.side)) if (s === who && x.nwA[h] !== undefined && x.nwB[h]) gain += x.nwB[h][1] - x.nwA[h];
                deaths += x.deaths[who].filter(([t]) => t >= MID_A && t <= MID_B).length;
            }
            const top = Object.entries(modes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${Math.round((100 * v) / n)}%`).join(", ");
            console.log(`  mid ${who}  (${mid.length} games) gold +${Math.round(gain / mid.length)}  deaths ${(deaths / mid.length).toFixed(1)}  2+ allies near ${Math.round((100 * grouped) / n)}% | ${top}`);
        }
        // heroes
        const H = {};
        for (const x of mid)
            for (const [h, s] of Object.entries(x.side)) {
                if (x.nwA[h] === undefined || !x.nwB[h]) continue;
                const gpm = ((x.nwB[h][1] - x.nwA[h]) / (x.nwB[h][0] - MID_A)) * 60;
                ((H[h] = H[h] || { new: [], old: [] })[s]).push(gpm);
            }
        const both = Object.entries(H).filter(([, v]) => v.new.length && v.old.length).map(([h, v]) => [h, avg(v.new) - avg(v.old), avg(v.new), avg(v.old)]);
        if (both.length) {
            both.sort((a, b) => a[1] - b[1]);
            console.log(`  heroes   gpm 15-35m, same hero on both sides (${both.length} heroes): new ${Math.round(avg(both.map(b => b[2])))} old ${Math.round(avg(both.map(b => b[3])))} | largest gaps: ${both.slice(0, 5).map(b => `${b[0]} ${Math.round(b[1])}`).join(", ")}`);
        }
    }

    // deaths
    const phase = (who, a, b) => avg(games.map(x => x.deaths[who].filter(([t]) => t >= a && t < b).length)).toFixed(1);
    const band = who => {
        const late = games.flatMap(x => x.deaths[who].filter(([t, d]) => t >= 1200 && d >= 0));
        const c = [4000, 7000, 10000, 13000, Infinity].map((hi, i, arr) => late.filter(([, d]) => d < hi && d >= (i ? arr[i - 1] : 0)).length / games.length);
        return c.map(v => v.toFixed(1)).join("/");
    };
    for (const who of ["new", "old"]) console.log(`  deaths ${who}  <10m ${phase(who, -99, 600)}  10-20m ${phase(who, 600, 1200)}  20-35m ${phase(who, 1200, 2100)}  35m+ ${phase(who, 2100, 1e9)} | after 20:00 by distance to enemy ancient <4k/4-7k/7-10k/10-13k/13k+: ${band(who)}`);
    console.log(`  blocks   regroup ${Math.round(avg(mid.map(x => x.regroup)))} s/game (15-35m)  ALONE farm blocks ${avg(games.map(x => x.aloneFarm)).toFixed(1)}/game (logged at most once per 20 s per hero)`);
}

const names = process.argv.slice(2);
if (!names.length) {
    console.log("Usage: npm run diagnose -- <batch> [<batch> ...]");
    process.exit(1);
}
for (const n of names) diagnose(n);
