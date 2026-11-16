# Testing a bot change against plain OHA

How to test a behaviour change headless, judge it, and keep or drop it. The flags themselves are in [BEHAVIOR_CHANGES.md](BEHAVIOR_CHANGES.md); the headless Dota install in WSL is in [specs/learned-fight-decisions.md](specs/learned-fight-decisions.md), step 0. The log of past rounds is [specs/overnight-2026-11-16.md](specs/overnight-2026-11-16.md).

The **new team** is the flagged team, the **old team** plays plain OHA. Each game number fixes a lineup and side (`npm run match`), and games 4p-3..4p form **lineup pair** p: both lineups on both sides. A **base** is the flag set kept so far; a change is the base plus one new flag.

## One round

1. **Diagnose.** Run `npm run diagnose -- <latest complete batches>`. Pick a target that moves the **gold lead** or wins: a mode share, a gold-per-minute gap, a phase where the lead turns. A target that only moves deaths is not enough: `bail`, `yield` and `siegecut` each moved their own death count and gained nothing.
2. **Write it behind a flag.** Add the name to `FLAGS` in `typescript/post-process/match-setup.js` and to `FlagName` in `typescript/bots/FunLib/behavior/flags.ts`, and read it with `IsOn("name")`. Hero-level code needs a flag too: without one both teams get the change and the test cannot see it.
3. **Check.** `npm run build` (when TypeScript changed), then `npm run check`: Lua syntax, raw `require("bots.x")` paths, post-process JS, flag names. Both run in seconds; never use a game as a syntax check.
4. **Smoke.** One game, with what the log must and must not show (JavaScript regexes; `{new}` and `{old}` stand for each team's number):

   ```
   npm run batch -- smoke group,noregroup --until=25 --expect="GROUP team={new} t=\d+ (defend|push)" --forbid="GROUP team={new} t=\d+ regroup"
   npm run batch -- smokecheck <name printed by smoke>
   ```

   `smokecheck` exits 2 until the game reaches `--until` minutes, then prints PASS (exit 0) or FAIL (exit 1) and stops the game, so a wait is `until npm run -s batch -- smokecheck <name>; [ $? -ne 2 ]; do sleep 60; done`. It fails on any `BEHAVIOR_ERROR` or runtime error other than the ~20 `error in error handling` lines every game prints (plain OHA too), on a missing `--expect` and on a present `--forbid`. Commit the flag after a PASS.
5. **Eval batch.** `npm run batch -- start 1-32 <base>,<flag> --parallel=5 --name=ev-<base>-<flag>`, explore 0 (the default). Baseline: reuse the existing batches of `<base>` when the base's code has not changed since they ran (code added behind other, off flags does not count; check the `commit` column of `npm run batch -- ledger`). Otherwise start a fresh baseline at the same time with the same games.
6. **Judge** on complete batches only: `npm run batch -- compare ev-<base>-<flag> <baseline>[+<baseline>...]`.
   - **Gold verdict** first: the paired lead at 30:00, game by game. FAIL drops the flag.
   - PASS: confirm on wins. Keep on a win verdict of BETTER, or on Gold PASS with a win difference that is not negative while more games accumulate.
   - Inconclusive on both: drop it, or add games when the mechanism check showed a real effect.
7. **Close the round.** Kept: the base becomes `<base>,<flag>`. Dropped: remove its code (it is noise in the files that matter), with its result in the commit message. Log the round in the overnight doc; `npm run batch -- ledger` lists every batch.

Claim a win rate (the target is 90% against plain OHA) only from complete eval batches of 50+ games.

## Limits and timing

- **10 games at once**, across all batches and smoke games: 11 crashed a server, 14 starved Windows. The port pool (27201-27210 in `headless/batch.sh`) enforces it; an 11th game waits for a port.
- A game takes about 20 minutes at timescale 8; 32 games at 5 at once take about 3 hours, two batches of 32 side by side about the same.
- `start` copies the bots folder: edits after it do not reach a running batch.
- What 32 games can show: a win difference of about 25 points, or a gold-lead difference of about 3k at 30:00. A 60% win rate needs about 200 games to tell apart from 50%.

## Lost games

`npm run batch -- report <name>` marks a game that ended without a result `no MATCHREC`; the batch folder's `status.log` and `/opt/oha-runs/<name>/g<n>/result.txt` say why (a port clash prints `Failed to open/bind server socket`). `status` prints `NOT RUNNING` when WSL died with games left.

Replay the same game numbers so lineup pairs stay whole: `npm run batch -- start <n,m,...> <flags> --partial --name=<name>-r`. When it ends, move `console.g<n>.log` in the original folder to `console.g<n>.crashed.log`, copy the replay's log in, and add a line to both status logs (`datasets/runs/<name>/status.log` and `/opt/oha-runs/<name>/status.log`): `g<n> replayed in <name>-r: <cause>`.

## Trace lines

With debug prints on (every batch turns them on), the console log has these lines. `diagnose` and `report` read them.

| Line | When | Fields |
|---|---|---|
| `POS` | every 2 s per hero | `team hero t x y hp mp lvl mode nw` |
| `ITEM` | inventory change | `team hero t +item -item` |
| `CAST` | ability or item cast | `team hero t ability lvl cd mp e a` (enemies, allies within 1200) |
| `DEATH` | each death | trail of the last 8 s: `-sec:hpX,mMODE,rDESIRE,reason,eN,aN,dDIST[,sSUB]`; d is the distance to the **enemy ancient** |
| `RETREAT` | once a minute per hero | retreat reasons with counts |
| `GROUP` | flag `group` | `defend|push|regroup lane=… start|gathered|update|end why=…` |
| `SIEGE`, `SIEGEGO` | flag `group` | high-ground gate and siege windows (`start … why=lead|aegis|few`, `end … dur=`) |
| `ALONE` | flag `group` | `blocked=farm|ward|defend missing=N`, at most once per 20 s per hero |
| `FIGHTDEC`, `FIGHTOUT`, `FIGHTOUT30` | every bot | fight decision log for the learned policy |
| `MATCHREC {json}` | game end | winner, duration, kills, nw10, lh10, lineup |

Mode numbers: 1 lane, 2 attack, 3 roam, 4 retreat, 7 rune, 8-10 push, 11-13 defend, 16 team roam, 17 farm, 19 evasive, 20 Roshan.

## Traps that cost smoke games

- `GetActiveModeDesire()` reads 0 while attack mode holds the bot (attack's desire lives in C++), and roam bids 1.0. To make retreat win, bid `BOT_MODE_DESIRE_ABSOLUTE` and hold it for a few seconds, not "active + a little".
- `GetRespawnTime()` needs the dead hero's own unit: bots cannot see enemy respawn times.
- TypeScript-to-Lua: `(x as any).Method()` compiles to `x.Method()` without `self` (use typed calls; add missing methods to `ts_libs/dota/interfaces.ts`), and `array.length` used as a condition is always true in Lua (compare with `> 0`).
- `git status` right after a build lists only real changes: the build re-adds files whose only change is line endings (tstl writes LF, `core.autocrlf` checks out CRLF), which stages nothing.
