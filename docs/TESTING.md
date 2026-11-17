# Testing a bot change against plain OHA

How to test a behaviour change headless, judge it, and keep or drop it. The flags themselves are in [BEHAVIOR_CHANGES.md](BEHAVIOR_CHANGES.md); the headless Dota install in WSL is in [specs/learned-fight-decisions.md](specs/learned-fight-decisions.md), step 0. The log of past rounds is [specs/overnight-2026-11-16.md](specs/overnight-2026-11-16.md).

The **new team** is the flagged team, the **old team** plays plain OHA. Each game number fixes a lineup and side (`npm run match`), and games 4p-3..4p form **lineup pair** p: both lineups on both sides. A **base** is the flag set kept so far; a change is the base plus one new flag.

## Who does what

- **Orchestrator** (the main session): the only one that starts, stops or replays games, so the 10-game cap holds. Owns tooling, judging (`compare`), keep / drop / merge and the overnight log; writes no behaviour code.
- **`oha-analyst`** (`.claude/agents/oha-analyst.md`, Sonnet, read-only, fresh per task): runs `diagnose` on finished batches and reports the top 3 gold leaks in at most 40 lines.
- **`oha-implementer`** (`.claude/agents/oha-implementer.md`, one per flag, kept alive until the flag is kept or dropped): writes the flagged change in `../oha-wt/<flag>` on branch `wt/<flag>`, passes `check`, hands back the commit and the smoke regexes. The orchestrator runs that worktree's smoke and batches from inside it (`npm run batch` there plays its `bots/`; results still land in the main checkout's `datasets/runs`), merges `wt/<flag>` into `smarter-bot-behaviour` when kept, and removes the worktree either way.
- Agents report only to the orchestrator; shared state is this file, the state table in the overnight doc and `npm run batch -- ledger`. Two changes in flight at most (two screen batches of 5 games).

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
   **Screen first** (faster): add `--screen` and every game stops at 31:00 game time, about half the real time of a full game. `compare` then gives the Gold verdict only, and a full baseline still pairs with it. Run the full eval batch only for a Gold PASS, to confirm on wins.
   **Screen length by where the change acts:** `--screen=<min>` stops every game one minute after `<min>` and `compare` reads the lead at `<min>:00` (the shortest screen among the batches compared; `--at=<min>` overrides). Laning-phase changes: `--screen=15`, about a quarter of a full game. Mid-game changes: `--screen` (30). Late-game changes (after 30:00: Roshan, siege, close-out): no screen, a full batch judged on paired wins.
   **Drafting changes:** `npm run batch -- start 1-64 <flags> --draft` (from a checkout with the draft code): both teams pick their own heroes, game g plays Draft_Seed ceil(g/2) with the new team Radiant on odd and Dire on even games. Judge against a `--draft` baseline over the same games (base flags without `draft`); `compare` refuses to mix free-draft and fixed-lineup batches.
   **Early stop:** at every check of a running batch, run `npm run batch -- early <batch> <pooled baseline> --stop`. It stops the batch when its paired gold lead is clearly worse, by an O'Brien-Fleming boundary fixed in advance (needs 8 paired games; at 16 of 32 the z must pass -2.86, at 24 -2.34), and logs the stop in the batch's status.log. It never stops for a good result. Backtest on 2026-11-17: `fight` would have stopped at 16 games, `farm` at 24, and the kept `corefarm` never. `--upto=<n>` replays the rule on a finished batch as if only its first n games were in.
6. **Judge** on complete batches only: `npm run batch -- compare ev-<base>-<flag> <baseline>[+<baseline>...]`.
   - **Gold verdict** first: the paired lead at 30:00, game by game. FAIL drops the flag.
     The baselines must have the change's flags minus the one under test: `compare` and `early` refuse otherwise (`--mismatch` overrides, e.g. for the base minus a flag). When the base changes, start a new baseline batch of it before screening on it (2026-11-17: a day of screens on `...,roshsafe` was judged against a pool without roshsafe).
     Judge against at least two pooled baselines of the base (`<screen>+<full>`): the same `group,fixes` code gave +0.1k (ev-gf) and -2.3k (sc-group-fixes) at 30:00, so one baseline can fake a +2k effect. A game counts for gold once its log passed 30:00, even if its server died later. `compare` also prints the paired lead at 10:00 (information only) for changes that act in the laning phase. For a change that acts only after 10:00 (code gated on game time), read the line "adjusted for the 10:00 lead" as its effect: before 10:00 both sides play the same code, so the 10:00 difference is draw noise that the snowball doubles by 30:00 (corefarm: +3.5k raw, +1.7k adjusted, +1.0k at 10:00 with no code acting).
   - PASS: confirm on wins. Keep on a win verdict of BETTER, or on Gold PASS with a win difference that is not negative while more games accumulate.
   - Inconclusive on both: drop it, or add games when the mechanism check showed a real effect.
7. **Close the round.** Kept: the base becomes `<base>,<flag>`. Dropped: remove its code (it is noise in the files that matter), with its result in the commit message. Log the round in the overnight doc; `npm run batch -- ledger` lists every batch.

Claim a win rate (the target is 90% against plain OHA) only from complete eval batches of 50+ games.

## Limits and timing

- **A game that died** (log stops, no MATCHREC, e.g. a server crash) leaves its batch incomplete for wins: `npm run batch -- rerun <batch> <game>` replays it into the same folder (the old log is kept as `.dead.log`). It replays the batch's own copy of `bots/` (`/opt/oha-runs/<batch>/base`). Only when that copy is gone does it use the checkout, and then it refuses when `bots/` differs from the batch's commit (FretBots excluded: not loaded headless); add `--force` only when the difference is behind flags that batch does not use, and say so in the log.
- **Merging while batches run is safe:** `batch start` copies `bots/` into the run in WSL, so games never read the checkout after launch.
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
