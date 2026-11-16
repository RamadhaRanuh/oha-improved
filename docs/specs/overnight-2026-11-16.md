# Overnight run, 2026-11-15 to 2026-11-16

**Goal (approved 2026-11-15):** new bot beats plain OHA.

- **Long-term target:** 90% or more of games.
- **Overnight milestone:** 60% or more on a 32-game headless batch. Start: about 45% (3/8, 2/8, 3/8 in the bisect batches).

**Order of work:**

1. Fix the extra early retreat deaths (`escape` suspected).
2. First learned fight/run model (spec step 3, flag `learned`).
3. Mid- and late-game scripted fixes from the logs.

All games are headless batches (`npm run batch`), 8x timescale. "New team" means the flagged team. Plain OHA is the other.

## Result

Morning summary, 08:00 on 2026-11-16. The loop continues after this (user: "continue the loop until the 90% winrate").

- **Milestone:** `group` alone won 20 of 32 (62.5%) on the first 32-game check. A replay of games 1-16 then went 7 of 16, so over 48 games it is **27/48 (56%)**: a small edge over plain OHA, not yet a clear 60%.
- **The other flags:** `escape` 15/31 (strong on lineup pairs 1-4, weak on 5-8), `arbiter` 8/16, `laning` 7/16, `humanfeel` 5/10, `roam` 3/9. Combinations did no better than `group` alone (`group`+`escape` 10/16, +`arbiter` 7/16). The full 6-flag set loses.
- **Learned fight/run model:** not kept. Three versions lost (0/6, 0/3, 1/6). The 10 s and 30 s outcome scores miss what a death costs later, and every version forced too many decisions.
- **Where games are lost:** after 20:00. The new team's extra deaths are retreats started too late, below 40% health, while a `group` role (push, siege, defence, regroup, gather) still outbid retreat. Flag `bail` (ede78b1) drops those roles below 55% health; 32-game check `group-bail` running.
- **Lost time:** 03:31-06:39, when WSL shut down with the session and killed the running games.

## Keep rule (from 08:30, after the retro)

The overnight numbers came from 16-game screens with exploration on, read before they finished. The `group` result fell from 20/32 to 27/48 with no code change: that was chance, not a regression. Among 6 flags that each truly win 50%, the best of 6 over 16 games averages 10.5 wins; `group`'s 11/16 is what luck alone gives the winner. From now on:

1. **Eval batches only.** Explore 0 (the `npm run batch -- start` default); `--data` batches are for the decision dataset and are never used to judge a change.
2. **Whole lineup pairs**, 32 games (all 8 pairs) for a keep decision. `report` shows each pair's result.
3. **Decide on complete batches only.** `report` prints the 95% range and gives a verdict only once every game has finished. Stop a batch early only on a crash.
4. **Against a baseline run at the same time:** `npm run batch -- compare <change> <baseline>`. Keep a change only on "BETTER"; on "inconclusive" add games or drop it.
5. **One change at a time**, built on the current kept set. A screen's winner must win again on a new batch before anything is built on it.
6. **Noise floor:** `ev-aa` (plain OHA on both teams, 16 games) should come out inconclusive.

Detecting a real 60% against 50% needs about 200 games; 32 games show a real 75% or better. So the batches can confirm large gains, which is what the 90% goal needs.

## Batches

| Batch | New team flags | Games | New team won | nw10 new-old | lh10 new-old | Notes |
|---|---|---|---|---|---|---|
| screen-rec6 | arbiter, laning, group, roam, humanfeel, escape | 8 | 3 | −1,681 | −20 | baseline for tonight; early deaths +2.3/game |
| bis-nohumanfeel | same minus humanfeel | 8 | 2 | −533 | −10 | early deaths +1.9/game |
| bis-nolaning | same minus laning | 8 | 3 | −392 | −4 | early deaths −0.6/game (only batch without extra early deaths) |
| data1 | 6 flags, explore 3% | 24 | 12 | −1,611 | −12 | data batch; early deaths +2.7/game; 14,149 forced rows |
| bis-noescape | 6 flags minus escape | 16 | 4 | −1,307 | −8 | early deaths +3.1/game: escape is not the cause |
| fixlane1 | 6 flags + laning burst fix | 15 of 16 | 8 | −1,238 | −16 | early deaths +1.5/game (from +2.3 to +2.7); best batch so far; fix kept (7d9d7be) |
| learned1 | 6 flags + laning fix + learned (model from data1) | 6 of 16 | **0** | −1,687 | −19 | stopped; model not kept |

## Changes

| Commit | What | Kept because |
|---|---|---|
| 978f34f | batch runner: free port per game across batches (two batches collided and crashed) | tooling |
| 7d9d7be | laning: no lane burst below 55% health or while retreating | fixlane1: early deaths +1.5/game against +2.3 to +2.7; 8 of 15 wins |
| d2b3feb | trainer `npm run train-fight`, flag `learned` (off by default), deaths-before-10:00 in the batch report | tooling; decision log checked in fixlane1 |

## Log

- **20:30** First `bis-noescape` attempt crashed: its games shared ports with `data1`. Fixed (978f34f) and restarted.
- **20:45** Trainer `npm run train-fight` and flag `learned` (behavior/decision_log) written; waiting for `data1` forced rows.
- **21:30** Escape is not the cause of the early deaths: without `escape`, early deaths were +3.6/game (9 games so far) and the new team won 1 of 9. Only removing `laning` removed the extra early deaths (−0.6/game). With `laning` on, early deaths often had laning (1) or team roam (16, where lane bursts run) in the last 7 s. Cause found: lane bursts bid HIGH (disengage up to 1.0) plus the arbiter's incumbent bonus, which can outbid retreat. Fix: no burst below 55% health or while retreating. Testing in `fixlane1` (16 games).
- **21:35** `data1` done: 12/24 wins. Losses are already −2,700 net worth at 10:00 and −5,200 at 20:00 (kills −7 by 20:00); wins are about even at 10:00. The lane decides most losses, then minutes 10-20 widen the gap.
- **21:36** First model trained on `data1` (14,149 forced rows). Held-out check: when the forced action matched the model's confident choice the score was 0.44, when it went against it 0.18 (uplift 0.26 ± 0.11, margin 0.3; the model acts on about 30% of decisions). Exported to `bots/FunLib/behavior/learned_fight_model.lua`. Eval batch `learned1` (16 games, 6 flags + laning fix + `learned`) runs next to `fixlane1` (same without `learned`). LEARNED lines appear only for the flagged team.
- **22:14** `learned1` lost all 6 finished games (`fixlane1`, the same without `learned`: 4 of 9). The model forced fights about twice as often as runs, through the whole game. Its offline check looked positive, but forced episodes give 4 correlated rows each, so the real uncertainty is about twice what was printed. The 10 s score also misses what a death costs later (respawn, lost farm, objectives). Model not kept (saved as `datasets/learned_fight_model.data1.lua`, not in `bots/`). Next model needs a longer-horizon score.
- **22:14** The laning burst fix did not reduce early deaths (+2.8/game); reverted.
- **22:20** No flag set has beaten plain OHA so far. Started a single-flag screen: each flag alone against plain OHA, 16 games, with explore 0.03 so the games are also training data. First `solo-arbiter` and `solo-laning`.
- **22:50** `fixlane1` with 15 of 16 games done: 8 wins, early deaths +1.5/game. The 22:14 call ("did not help") came from 9 games; with the full batch the fix meets the keep rule, so it is back in (7d9d7be). Early numbers from the first single-flag batches: `arbiter` alone +1,979 nw10 and −2.8 early deaths per game (4 games). Started `solo-group` and `solo-roam`.
- **00:00** Single-flag screen so far (each flag alone against plain OHA, 16 games): `arbiter` 8/16 (nw10 +406, early deaths −0.1), `laning` 7/14 (nw10 −325, early deaths +0.8; run before the burst fix), `group` 5/6 (nw10 +1,145), `roam` 2/4. No single flag causes extra deaths in minutes 10-20, so the extra team-roam deaths in the 6-flag games come from flags interacting. Next: `humanfeel` and `escape` alone (running), then build up from `group`.
- **00:05** `laning` alone finished 7/16 (nw10 −443, early deaths +0.7): mildly negative on its own. Started `combo-group-escape`.
- **00:10** 14 games were running at once (miscounted), Windows dropped to 3.8 GB free and Claude Code stopped a background wait task. Stopped `combo-group-escape` (restart later); cap is now 10 games at once.
- **00:55** Single-flag screen: `group` 9/12 (nw10 −143, early deaths +0.7), `escape` 5/6 (nw10 +1,597, early deaths −4.0), `humanfeel` 3/6, `roam` 3/9 (nw10 −116). Stopped `solo-roam` at 9 games: it does not help alone. Restarted `combo-group-escape` (16 games) in its 2 slots.
- **01:20** `group` 11/15, `escape` 7/9 (nw10 +633, early deaths −1.4), `humanfeel` 5/10 (nw10 −747, early deaths +2.3). Stopped `solo-humanfeel` at 10 games: no gain alone and extra early deaths. Started `combo-gea` (`group`, `escape`, `arbiter`; 16 games).
- **01:45** `solo-group` done: **11/16** (nw10 −379, early deaths +1.2). `escape` 9/12. Second model trained on the 30 s outcome (FIGHTOUT30) from 30 games (17,517 forced rows): held-out uplift 0.31 ± 0.10 overall, but all of it comes from "fight" calls (0.44); its "run" calls show none (0.07 ± 0.13). Saved as `datasets/learned_fight_model.h30.lua`. Eval `learned-h30a` (`group`, `escape`, `learned`, games 1-8, one at a time in the free slot) against `combo-group-escape`.
- **02:12** `solo-escape` done: **11/16** (nw10 +681, early deaths −1.6). Combos are doing worse than either flag alone so far: `group`+`escape` 4/8, `group`+`escape`+`arbiter` 6/11. Started `solo-escape-b` (escape alone, games 17-32: lineup pairs 5-8, not yet seen) so `escape` alone gets the 32-game milestone check.
- **02:38** `combo-gea` done: 7/16. `combo-group-escape` 5/10. `learned-h30a` lost 3 of 3 (nw10 −2,144) and was stopped: the model forced about 160 decisions per game before 10:00, and in lane every forced run or fight costs farm. Change (1339ad3, flag `learned` only): act only on the model's fight calls, only after 10:00. Eval when slots free. Started `solo-group-b` (group alone, games 17-32) for `group`'s 32-game check.
- **03:05** `combo-group-escape` 9/14. On the new lineups (games 17-32) the single flags are weaker so far: `escape` 2/6, `group` 1/4. Deaths by phase over 56 finished games (solo-group, solo-escape, combo-group-escape and the two -b batches): in the new team's losses it dies 7.8 / 10.3 / 42.2 times in minutes 0-10 / 10-20 / 20+ against plain OHA's 5.2 / 9.1 / 22.6; in its wins 4.6 / 8.2 / 26.1 against 6.2 / 12.1 / 36.5. Most deaths in every group happen in retreat mode (4). Losses are decided after 20:00, but the pattern is a snowball in both directions, not one scripted behaviour that only the new team has.
- **03:31 to 06:39** Gap: the Claude Code session stopped after 03:05 (the user had to log in again), and WSL shut down at about 03:31, which killed every running game. The games that had finished by then are kept: `combo-group-escape` 10/16 (done), `solo-group-b` 9/14, `solo-escape-b` 2/9 (plus one game without a result).
- **06:40** Restarted the unfinished games: `solo-escape-c` (escape, games 27-32) and `solo-group-c` (group, games 31-32). The other 2 slots run `learned-h30b`, the first test of the changed model (1339ad3: fight calls only, after 10:00), on games 1-4 with `group` and `escape`. A held-open `wsl.exe sleep` keeps WSL up.
- **07:06** **32-game check for `group` alone: 20/32 (62.5%)** (games 1-16: 11, 17-30: 9 of 14, 31-32: 0 of 2). `escape` alone: 15/31 (48%; 11/16 on pairs 1-4, but 4/15 on pairs 5-8); it does not hold up. `learned-h30b` 1/2 so far (nw10 +1,375). Started `solo-group-d` (`group`, a replay of games 1-16: the match setup has only 32 games) and `learned-h30c` (games 5-8).
- **07:32** Changed model (fight calls only, after 10:00) with `group`+`escape`: **1 of 6** (`learned-h30b` 1/4, `learned-h30c` 0/2), against 10/16 for `group`+`escape` without it. Its teams were ahead at 10:00 (nw10 +789 and +3,038; the model does nothing before then), so its forced fights after 10:00 throw the lead. Stopped; model not kept. `solo-group-d` (replay of games 1-16) 5/8.
- **07:40** User extended the loop: keep going until 90%.
- **07:50** Late-game deaths (after 20:00) in the 32 `group` games, by how the retreat went: the new team dies 11.6 times per game after starting its retreat below 40% health (plain OHA 7.5); other classes are about even. In most of those, retreat desire was already 0.5 or more while another mode held: attack, team roam (mostly `regroup` and `gather`), push and defence. These are the `group` roles: push and siege commit bid 0.75-0.85 down to 35% health, defence at least HIGH at any health, regroup HIGH down to 40%, gather at any health. New flag `bail` (ede78b1): below 55% health a bot drops all of them.
- **08:00** `solo-group-d` done: 7/16, so `group` alone is 27/48 (56%). Started `group-bail` (`group`+`bail`, all 32 games, 10 at once).
- **08:30** Retro of the night's method (see Keep rule). `npm run batch` now has eval/data kinds (explore 0 unless `--data`), whole-pair games, the 95% range and verdict in `report`, `compare`, `stop`, a WSL keepalive per batch, and reclaims stale port locks. `match-setup` takes `none` (plain OHA on both teams). Stopped `group-bail` (a data batch: 5/10). Started three eval batches at the same time: `ev-group-bail` (32), `ev-group` (32, the baseline), `ev-aa` (16, the noise floor).
