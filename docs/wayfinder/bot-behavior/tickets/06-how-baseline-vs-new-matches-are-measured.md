---
title: How baseline-vs-new matches are measured
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [01-how-a-baseline-vs-new-match-can-be-run-and-recorded.md]
---

## Question

How is 'new bots beat the baseline' measured in practice?

Covers: what exactly the baseline is (commit `cb814c6` alone, or with the uncommitted working-tree changes), lobby settings (difficulty, FretBots off, hero pool fixed or random, sides swapped), how many games make a result believable, which numbers are logged besides win/loss, and how much of the human's time one comparison may cost.

Added after the match-running research: also covers which folder is edited and tested (this repo, or the separate copy the game loads in `vscripts/bots`) and how the two are kept in step, and which of the 13 unconfirmed in-game checks must be run before the setup is fixed.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **Baseline** is the tree at `cb814c6`. The uncommitted FretBots edits do not matter, because FretBots is off in every measurement game.
- **The untracked files** (`bots/API/`, `aba_synergy.lua`, `FunLib/MinionLib/`, the `Buff/` additions and the rest) are not loaded by any tracked file. This was checked with `git grep`; the live minion library is `FunLib/minion_lib/`. They are not part of the baseline, and are ruled out of scope (see the map).
- **Folder:** all editing happens in this repo. The existing `vscripts/bots` copy is renamed to `vscripts/bots_backup_2026-10`, and `vscripts/bots` becomes a directory junction to this repo's `bots/` (`mklink /J`). There is one source of truth and no sync step.
- **Head-to-head with one tree:** new behaviour sits behind per-team feature flags (`Customize.Behavior.Radiant` / `.Dire`, read with `GetTeam()`). With every flag off, a team runs baseline code paths unchanged. A measurement game runs one team all-on and the other all-off. This depends on the two teams not sharing Lua state, which Phase 0 check P0-2 confirms.
  - **Fallback** if they do share it: run each flag set against Valve's built-in bots and compare win rates against that fixed opponent.
- **Lobby:** Local Host, cheats on, both teams on Unfair, FretBots not loaded, Buff off. Heroes are fixed with `Customize.Radiant_Heros` / `Dire_Heros`.
  - Each lineup pair (A, B) is played in four rotations: new-as-A on Radiant, new-as-A on Dire, new-as-B on Radiant and new-as-B on Dire.
  - Across all pairs, the lineups include at least three of the nine override heroes.
- **Sample sizes:** a **screen** of 8 games (2 lineup pairs) after each stage. Stop and fix if new wins 2 or fewer.
  - A **confirm** run of 32 games (8 lineup pairs). New "beats baseline" at **22 or more wins out of 32** (one-sided binomial p = 0.025).
  - For a change whose goal is human feel, 13 or more wins counts as "not worse".
- **Recording:** a standalone server-side recorder, `bots/tools/match_recorder.lua`, separate from FretBots and not touching it. It is loaded with `script_reload_code bots/tools/match_recorder`.
  - At post-game it prints one `MATCHREC {json}` line: winner, duration, flag set per team, lineup, kills, towers destroyed, net worth per team at 10:00, 20:00 and the end, and per-hero last hits at 10:00.
  - The console log is captured with `-condebug`.
  - **Fallback:** the human copies the same fields from the post-game screen.
- **Speed:** `host_force_frametime_to_equal_tick_interval 1`, and `host_timescale` at the highest value of 2, 3 or 4 that passes the fidelity check (P0-5). If none passes, games run at 1x and the confirm run shrinks to 16 games (12 or more wins, p = 0.038).
- **Human time:** at most about 6 hours of mostly unattended game time per confirm run, and about 1.5 hours per screen. Human-feel scoring adds one human-played game per flag set per stage.
- **Phase 0 in-game checks.** These are a subset of the 13 from ticket 01, plus two from the perception inventory:
  - **P0-1:** the game runs from the junction.
  - **P0-2:** Lua state is isolated between teams and shared within a team (one counter test).
  - **P0-3:** the console log is written to a file, and a `print` that bypasses the silencer reaches it.
  - **P0-4:** the recorder loads and sees the winner at post-game.
  - **P0-5:** timescale fidelity. The same lineup is played at 1x and at the chosen speed, 3 games each, and game length and kills stay in range.
  - **P0-6:** `GetDesire()` frequency, and whether `TeamThink` is called (informational).
  - Not needed: mixed Workshop scripts, HTTP, `io`/`os`, enemy net worth in fog and console start.
