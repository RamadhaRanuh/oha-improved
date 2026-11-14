// Phase 0 report (docs/specs/smarter-bot-behaviour.md section 4).
// Reads the Dota console log and scores checks P0-1 to P0-6 from the PHASE0 / MATCHREC lines.
//
//   npm run phase0                 reads every console log in <dota>/game/dota
//   npm run phase0 -- <path>...    reads the given logs
//
// With -condebug Dota writes console.log until a match gets its ID, then continues in
// console.<matchid>.log. All of them are read, oldest first.
// Move old logs away before the Phase 0 session so lines from older games do not mix in.
const fs = require("fs");
const path = require("path");

const dotaDir = path.join(__dirname, "../../../..");
const logPaths = process.argv.length > 2
    ? process.argv.slice(2)
    : fs.readdirSync(dotaDir)
          .filter(f => /^console(\.\d+)?\.log$/.test(f))
          .map(f => path.join(dotaDir, f))
          .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
const logPath = logPaths.join(", ");
const results = [];
const report = (id, status, detail) => results.push({ id, status, detail });

const existing = logPaths.filter(p => fs.existsSync(p));
if (!existing.length) {
    console.log(`No console log in ${process.argv.length > 2 ? logPath : dotaDir}`);
    console.log("P0-3 FAIL: launch Dota with -console -condebug, play, then run this again.");
    process.exit(1);
}
const lines = existing.flatMap(p => fs.readFileSync(p, "utf8").split(/\r?\n/));
const grab = re => lines.map(l => l.match(re)).filter(Boolean);
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (a, b) => (b === 0 ? 0 : (Math.abs(a - b) / b) * 100);

// P0-1 and P0-3
const p01 = grab(/PHASE0 P0-1 hero_selection loaded team=(\d+) vm=(\S+)/);
report("P0-1", p01.length ? "PASS" : "FAIL",
    p01.length ? `hero_selection probe printed ${p01.length} time(s), teams ${[...new Set(p01.map(m => m[1]))].join(", ")}`
               : "no 'PHASE0 P0-1' line: the game is not loading this repo's bots/ (check the junction and the lobby's script choice)");
report("P0-3", p01.length ? "PASS" : "FAIL", `console log found at ${logPath}` + (p01.length ? " and it holds the P0-1 line" : " but it lacks the P0-1 line"));

// P0-2
const p02 = grab(/PHASE0 P0-2 team=(\d+) count=(\d+) vm=(\S+)/);
if (!p02.length) {
    report("P0-2", "NO DATA", "no 'PHASE0 P0-2' lines (did bots load ability_item_usage_generic.lua?)");
} else {
    const byVm = {};
    for (const [, team, count, vm] of p02) {
        byVm[vm] = byVm[vm] || { teams: new Set(), max: 0 };
        byVm[vm].teams.add(team);
        byVm[vm].max = Math.max(byVm[vm].max, Number(count));
    }
    const vms = Object.entries(byVm);
    const shared = vms.some(([, v]) => v.teams.size > 1);
    const tooMany = vms.some(([, v]) => v.max > 5);
    const detail = vms.map(([vm, v]) => `vm ${vm}: team(s) ${[...v.teams].join("+")}, counted to ${v.max}`).join("; ");
    report("P0-2", shared || tooMany ? "FAIL" : "PASS",
        (shared ? "teams SHARE Lua state, use the section 13 fallback. " : "each team has its own Lua state. ") + detail);
}

// P0-4 and P0-5
const recs = [];
for (const m of grab(/MATCHREC (\{.*\})\s*$/)) {
    try { recs.push(JSON.parse(m[1])); } catch (e) { /* truncated line */ }
}
const engineWins = grab(/good guys win = ([01])/).map(m => (m[1] === "1" ? "radiant" : "dire"));
const loads = grab(/MATCHREC_INFO recorder loaded/).length;
if (!recs.length) {
    report("P0-4", "FAIL", loads ? `recorder loaded ${loads} time(s) but no MATCHREC line: did the game reach post-game?`
                                 : "recorder never loaded: run 'sv_cheats 1; script_reload_code bots/tools/match_recorder' in the pick phase");
} else {
    const winners = recs.map(r => r.winner);
    const unknown = winners.filter(w => w === "unknown").length;
    let cross = "";
    if (engineWins.length === recs.length) {
        const agree = winners.every((w, i) => w === engineWins[i]);
        cross = agree ? "; matches the engine's 'good guys win' lines" : `; DISAGREES with engine lines (${engineWins.join(", ")})`;
    }
    report("P0-4", unknown || cross.includes("DISAGREES") ? "CHECK" : "PASS",
        `${recs.length} MATCHREC line(s), winners: ${winners.join(", ")}${cross}. Compare with the post-game screen.`);

    const groups = {};
    for (const r of recs) {
        const ts = typeof r.timescale === "number" ? Math.round(r.timescale * 100) / 100 : "unknown";
        (groups[ts] = groups[ts] || []).push(r);
    }
    const kills = r => (r.kills && r.kills.end ? r.kills.end.radiant + r.kills.end.dire : 0);
    const base = groups[1];
    const fast = Object.keys(groups).filter(k => k !== "1" && k !== "unknown").map(Number).sort((a, b) => b - a);
    if (!base || !fast.length) {
        report("P0-5", "NO DATA", `games per timescale: ${Object.entries(groups).map(([k, v]) => `${k}x: ${v.length}`).join(", ")}. Needs 3 at 1x and 3 at the fast speed.`);
    } else {
        for (const s of fast) {
            const g = groups[s];
            const dDur = pct(mean(g.map(r => r.duration)), mean(base.map(r => r.duration)));
            const dKills = pct(mean(g.map(kills)), mean(base.map(kills)));
            const enough = g.length >= 3 && base.length >= 3;
            const pass = dDur <= 15 && dKills <= 20;
            report(`P0-5 (${s}x)`, !enough ? "NOT ENOUGH" : pass ? "PASS" : "FAIL",
                `1x: ${base.length} games, mean ${mean(base.map(r => r.duration)).toFixed(0)}s, ${mean(base.map(kills)).toFixed(1)} kills; ` +
                `${s}x: ${g.length} games, mean ${mean(g.map(r => r.duration)).toFixed(0)}s, ${mean(g.map(kills)).toFixed(1)} kills. ` +
                `Length differs ${dDur.toFixed(1)}% (limit 15), kills ${dKills.toFixed(1)}% (limit 20).`);
        }
    }
}

// P0-6
const gd = grab(/PHASE0 P0-6 getdesire mode=(\S+) team=(\d+) hero=(\S+) calls=(\d+) seconds=([\d.]+) period=([\d.]+)/);
report("P0-6 GetDesire", gd.length ? "MEASURED" : "NO DATA",
    gd.length ? `mean period ${mean(gd.map(m => Number(m[6]))).toFixed(4)}s game time (${(1 / mean(gd.map(m => Number(m[6])))).toFixed(1)} calls/s) over ${gd.length} sample(s)`
              : "no GetDesire timing lines (play at least 30 s of game time)");
const ttFirst = grab(/PHASE0 P0-6 teamthink first call team=(\d+)/);
const tt = grab(/PHASE0 P0-6 teamthink team=(\d+) calls=(\d+) seconds=([\d.]+) period=([\d.]+)/);
report("P0-6 TeamThink", ttFirst.length ? "CALLED" : "NOT CALLED",
    ttFirst.length ? `called for team(s) ${[...new Set(ttFirst.map(m => m[1]))].join(", ")}` + (tt.length ? `, mean period ${mean(tt.map(m => Number(m[4]))).toFixed(4)}s` : "")
                   : "no TeamThink line: the engine did not call it (or team_desires.lua is missing)");

// Lua errors anywhere in the log, useful for the arbiter-on sanity game.
const errs = lines.filter(l => /\.lua:\d+:/.test(l) || /script (runtime )?error/i.test(l));
report("Lua errors", errs.length ? "CHECK" : "NONE", errs.length ? `${errs.length} line(s), first: ${errs[0].trim().slice(0, 200)}` : "no Lua error lines");

const w = Math.max(...results.map(r => r.id.length));
console.log(`Phase 0 report for ${logPath}\n`);
for (const r of results) console.log(`${r.id.padEnd(w)}  ${r.status.padEnd(10)}  ${r.detail}`);
