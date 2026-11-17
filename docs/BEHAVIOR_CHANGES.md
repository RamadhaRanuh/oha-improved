# Smarter bot behaviour: what changed

This document summarises the behaviour work on the `smarter-bot-behaviour` branch: what each part does, how to switch it on, and what was fixed after playtests. The design and the reasoning behind each stage are in [specs/smarter-bot-behaviour.md](specs/smarter-bot-behaviour.md). The file map is in [ARCHITECTURE.md](ARCHITECTURE.md).

Everything sits behind **feature flags**. With every flag off, the bots behave exactly as plain Open Hyper AI (OHA).

## 1. Why

In games against people, plain OHA bots:

- fight alone, and run only when nearly dead;
- push weakly in the early game, and throw at high ground with all five enemies alive;
- don't close out games when ahead;
- play the same way every game (the same pre-horn spots, the same rune timing), so a person learns them in two games.

Each stage below targets one of these problems and was checked against logs from real human-vs-bot games.

## 2. Flags

Flags are set per team in `bots/Customize/general.lua`:

```lua
Customize.Behavior = {
    Radiant = { arbiter = true, laning = true, group = true, roam = true },
    Dire    = { ... },
}
```

A missing table or key counts as off.

**Current base (2026-11-17, kept by eval batches against plain OHA):** `group,fixes,corefarm,roshsafe`. The older recommended set (`arbiter`, `laning`, `group`, `roam`, `humanfeel`, `escape`, section 4a) predates those batches; `laning` and `roam` screened negative on the base, `arbiter` was inconclusive, and `escape` and `humanfeel` failed their screens and were removed (below). The fight/run decision is being replaced by a learned policy ([specs/learned-fight-decisions.md](specs/learned-fight-decisions.md)).

| Flag | What it switches on | Main modules |
|---|---|---|
| `arbiter` | Desire tiers, a bonus for the running mode (fewer mode flips), mode-change counting | `behavior/arbiter`, `behavior/desire_tiers`, `behavior/thrash` |
| `laning` | Lane trades, stepping out of harass range, camp pulls, lotus pool pickup | `behavior/laning`, `behavior/pull`, `behavior/lotus` |
| `group` | Team defence assignments, group pushes, regrouping, high-ground gate and Roshan first, no lone trips into danger | `behavior/group`, `behavior/siege`, `behavior/alone` |
| `roam` | Smoke ganks, counter-gank teleports | `behavior/gank`, `behavior/tpcancel` |
| `learned` | Learned fight/run policy acting on fight calls after 10:00 (parked: lost 1 of 6) | `behavior/decision_log` |
| `noregroup` | With `group`: no regroup walk to the rally point (in test) | `behavior/group` |
| `farmfree` | With `group`: farming is not moved off the enemy half when enemies are missing (in test) | `mode_farm_generic.lua` |
| `fixes` | Bug fixes for the new team (see the commits that added it) | several |
| `corefarm` | With `group`: cores (pos 1-3) keep farming instead of joining group walks | `behavior/group` |
| `roshsafe` | Roshan attempts abort when a hero gets low or a hero dies (v2; kept 2026-11-17: 20/32 vs 19/32, Roshan deaths after 30:00 27 to 0) | `behavior/roshsafe`, `mode_roshan_generic.lua` |

**Tested and removed (2026-11-16, 32-game eval batches against `group`):** `bail` (group roles dropped below 55% health; 13/32 vs 18/32), `yield` (retreat outbids attack and group modes below 45% health; 14/32 vs 15/32), `siegecut` (a hero lead alone no longer opens high ground; 15/32 vs 17/32). How changes are tested and judged: [TESTING.md](TESTING.md).

**Tested and removed (2026-11-17, screens on the base `group,fixes,corefarm` against the pooled baseline, gold at 30:00, all Gold FAIL):**
- `fight` (−5.9k): one shared fight state per engagement (engage, hold or disengage), one focus target and an initiator; it replaced Valve's attack mode for every hero. Module `behavior/fight`, removed.
- `retreat` (−3.9k): retreat rules tied to the fight state (`fight_outnumbered`, `fight_disengage`, `fight_survive`, `fight_lane_burst`, `too_deep`), evasive-maneuvers and tower-dive exceptions, and cancelling a TP into a lost fight (item-usage hooks into `behavior/tpcancel`).
- `farm` (−3.3k): supports stacking camps in the laning phase, and jungling after repeated lane deaths. Module `behavior/jungle`, removed; the stacking part of `behavior/camps`, removed.

All three had already lost the bot-vs-bot games of 2026-11-15 (section 4a). Kept for the remaining flags: `behavior/tpcancel` (`roam`: counter-gank TPs skip a lost fight; nothing calls its mid-channel cancel now) and the camp list in `behavior/camps` (`humanfeel`: camp block; removed with `humanfeel`, below). Sections 3 to 4a below keep their history.

**Tested and removed (2026-11-17, screen `sc-gfcr-escape` on the base `group,fixes,corefarm,roshsafe` against the pooled baseline):** `escape`, Gold FAIL: gold at 30:00 −2.2k (range −4.1k to −0.2k), −2.5k adjusted for the 10:00 lead (+0.2k at 10:00). It walked retreating bots home along a route away from the chasing enemies (a scripted `Think` in `mode_retreat_generic.lua`); without it the engine walks straight to the fountain. Module `behavior/escape`, removed. The fountain guard in retreat (section 4a) now runs for `arbiter` only. Alone against plain OHA it had won 15/31 on 2026-11-16.

**Tested and removed (2026-11-17, screen `sc-gfcr-humanfeel` on the base `group,fixes,corefarm,roshsafe` against the pooled baseline):** `humanfeel`, Gold FAIL: gold at 30:00 −3.3k (range −6.2k to −0.4k), already −0.9k at 10:00 (range −1.6k to −0.2k), so the harm started in the laning phase. It gave each game one pre-horn plan (standard, feint, bounty steal, ambush or camp block) with per-bot spot jitter and timing, through a desire and a scripted `Think` in `mode_rune_generic.lua` before 0:00; without it the rune mode runs as it did with the flag off. Modules `behavior/prehorn` and `behavior/camps` (its only user was the camp block), removed. Kept: `behavior/rng`, the per-game random generator, which `behavior/decision_log` (`learned`) uses for its explore roll. The pre-horn retreat rule in `mode_retreat_generic.lua` (reason `prehorn`) runs for every team and stays. Alone against plain OHA it had won 5/10 on 2026-11-16.

### Match tooling

Run these from `typescript/`:

```
npm run match -- play arbiter,laning,group,roam   # human-vs-bot: flags on both teams, debug prints on
npm run match -- play none                         # plain OHA baseline
npm run match -- reset                             # restore general.lua and utils.lua (do this before committing)
```

To record a game, load the recorder from the in-game console:

```
sv_cheats 1; script_reload_code bots/tools/match_recorder
```

It records human-played heroes and K/D/A as well.

Every `npm run match` setup also turns on the fight decision log (`FIGHTDEC` / `FIGHTOUT` lines for every bot on both teams). Add `--explore=0.03` for data-collection games. `npm run decisions` builds `datasets/fight_decisions.csv` from the logs. See [specs/learned-fight-decisions.md](specs/learned-fight-decisions.md).

## 3. The modules

All modules are TypeScript in `typescript/bots/FunLib/behavior/`, compiled to Lua in `bots/FunLib/behavior/` with `npm run build`. Every module is called under `pcall` from the mode files. An error prints once as `BEHAVIOR_ERROR <module> ...` and the mode carries on.

### Foundations (`arbiter`)

- **Desire tiers:**

  | Tier | Desire |
  |---|---|
  | SURVIVE | 0.96 |
  | FORCED | 0.9 |
  | HIGH | 0.75 |
  | MODERATE | 0.5 |
  | LOW | 0.25 |

- **Compression:** legacy desires above 1 are compressed into 0.95–0.99, keeping their order.
- **Incumbent bonus:** the running mode gets +0.12, so it must be clearly beaten before it is replaced. Every mode except retreat is capped at 0.95, just under SURVIVE. Without that cap, a defend mode at FORCED kept bots in place while retreat said "about to die".
- **Team brain** (`team_brain`): a shared memory of every enemy (last seen spot and time, health, power) for all five bots of a team.

### Laning (`laning`)

- Valve's own laning Think does the last hitting and denying; it out-farmed a custom one by about 20 last hits by 10:00.
- What Valve's laning lacks runs as short bursts through team roam: trades when ahead, and stepping out of harass range.
- **Pulls:** position 5 pulls the safe lane. Position 4 pulls the offlane, or the offlaner when it is alone in its lane. Timing comes from the real creep wave.
- **Lotus pool:** a nearby support picks lotuses. Valve's own lotus mode never ran.

### Fight (`fight`, removed 2026-11-17)

- Enemies in contact are grouped into engagements. Each engagement has a ratio: how much faster we kill them than they kill us.
- **States, with hysteresis:**
  - `none` → `engage`: the ratio is 1.25 or more after laning, or 2.0 or more during laning.
  - `engage` → `hold`: the ratio falls between the engage and disengage thresholds for 1.5 s.
  - `engage` or `hold` → `disengage`: the ratio drops to 0.8 or below, or two allies in the fight die within 5 s.
- **Shared target and initiator:** the team has one focus target (`SetTarget`, so hero spell code uses it too). Followers wait for the initiator.
- **Safeguards:**
  - No engage unless an enemy is actually visible.
  - No engage when more enemies are unaccounted for than we have allies there (a likely trap), unless the target is low.
  - Human enemies scale the ratio down (HUMAN_FACTOR 0.75).
  - An enemy out of sight counts at 50% of max health or more, never at the health it had when last seen nearly dead.
  - Below 15% health a bot leaves unless it is finishing a kill.

### Retreat (`retreat`) and escape (`escape`), both removed 2026-11-17

- **Fight-aware retreat** (`retreat`):
  - `fight_outnumbered` 0.88;
  - `fight_disengage` 0.88;
  - `fight_survive` 0.96;
  - `fight_lane_burst` 0.9 during laning, when the enemies near us can kill us in 3 s;
  - pre-horn: retreat when outnumbered.
- **TP cancel** (`retreat`): a TP into a spot that has become a lost fight is stopped mid-channel.
- **Escape route** (`escape`): when enemies were seen within 2000 in the last 3 s, the bot compares routes home:
  - direct;
  - through one of our towers;
  - a sidestep to either side;
  - through a healthy ally.

  Cost is travel time plus how long a chasing enemy could be waiting at a point of the next 1500 units. Ground near our towers counts as half the danger. The bot plans again every 0.4 s. Without this flag, the engine walks straight to the fountain.

### Grouping (`group`)

- **Defence:** after laning (team-wide laning test: before 10:00, or before 14:00 while the bots' average net worth is under 8000).
  - A tower needs defenders when 2+ enemies are near it, or 1 is near and the tower is being hit.
  - Defenders needed: 2 for one enemy, 3 for two or three, all bots for four or more or a tier-3 tower.
  - Defenders are picked by travel time (a TP counts). They meet behind the tower before going in.
- **Group push:** starts on a hero lead of 2+, a won fight while still ahead, the Aegis, or after 30:00 against 3 or fewer.
  - Members meet behind the lane front first. The gather clock waits while most of them are at Roshan.
  - Ends when we are no longer ahead in heroes, 2 deaths within 10 s, enemies missing after gathering, or after 120 s.
  - Without a team push, lone pushing is capped at LOW.
- **Regroup:** once 3 enemies have been seen together, far-away bots walk back to the push point, the defence point, or the first healthy core. Their farm, runes, wards and shopping are capped while they do.
- **Siege:** no high-ground push unless we have the numbers (2+ more heroes alive, 2 or fewer enemies alive, or the Aegis). Otherwise Roshan first, then one committed high-ground lane.
- **Alone:** no lone farming or warding deep in enemy territory while enemies are missing, and no lone tower defence against 2+.

### Farm (`farm`, removed 2026-11-17)

- Supports stack our camps at x:53.
- A core that keeps dying in lane may jungle for a while and come back once caught up.
- Camp lists are refreshed every minute.

### Roam (`roam`)

- **Smoke gank:** a squad gathers, smokes, and goes for a lone visible enemy away from its towers.
- **Counter-gank TP:** a healthy bot with a ready TP joins an ally fighting at one of our towers, when that evens the numbers.

### Human feel (`humanfeel`, removed 2026-11-17)

- **Pre-horn plans:** one plan per game, with per-bot spot jitter and timing:
  - standard;
  - feint;
  - bounty steal;
  - ambush;
  - camp block (sentry or body block).
- **Per-game randomness** (`behavior/rng`): a Park-Miller generator seeded from real time. Valve's `RandomFloat` gave the same sequence every game, so the same plan came up every time. Kept for `learned`.

## 4. Fixes from human-vs-bot playtests (latest round)

| Game | Problem seen | Fix |
|---|---|---|
| 9090005145 | Group defence pulled laners out of lane from −0:06 | No defences during laning. After laning, a defence needs 2+ enemies or the tower being hit |
| 9090005145 | Regroup flipped on and off every second (12:00–14:00) | `jmz.IsInLaningPhase()` reads the calling bot's net worth. Group now uses one team-wide laning test |
| 9090005145 | Push cancelled 9 s in ("enemies unseen") before gathering; another timed out with 0/5 gathered while the team took Roshan | Unseen check only after gathering; the gather clock pauses while most members are at Roshan |
| 9090005145 | Bots held in defend mode while retreat said "about to die" (FORCED 0.9 + bonus = 1.0) | Incumbent bonus capped at 0.95 for every mode except retreat |
| 9090005145 | Team wipe at 49:06: three bots engaged at ratio 1020 against one enemy they couldn't see, last seen nearly dead | An enemy out of sight counts at 50% of max health or more; hold → engage also needs a visible enemy and no likely trap |
| 9090005145 | Push started after a won fight at 4v4 and ended a second later | A won-fight push needs more heroes alive than the enemy |
| 9090005145 | "regroup start" logged repeatedly with no rally point | Logged only on a real start, plus `regroup end why=no_rally` |
| 9090116913 | Lion and Jakiro stopped to eat a tango while three enemies chased them | No tango while retreating hard with an enemy hero within 1600 (`mode_roam_generic.lua`) |
| 9090116913 | Defend, push and regroup (0.75 + 0.12 = 0.87) beat "outnumbered, back off" (0.85) | `fight_outnumbered` raised to 0.88 |
| 9090116913 | 16 of 30 deaths after laning came while already retreating, on the straight walk home | New `escape` flag: retreat route that avoids chasers |

## 4a. Bot-vs-bot results and fixes (2026-11-15)

The new bot against plain OHA, both teams bots (`npm run match`, lineups from `docs/specs/measurement-lineups.md`). Pair 1:
- lineup A: Juggernaut, Puck, Axe, Earthshaker, Crystal Maiden;
- lineup B: Luna, Templar Assassin, Centaur, Lion, Witch Doctor.

With plain OHA on both sides, lineup B beat lineup A 51–3 and 67–13 (games 1 and 2, OHA side), and 54–31 earlier (9089218870).

| Match | New bot: side, lineup | Flags on (new bot) | Kills (new – OHA) | Result |
|---|---|---|---|---|
| 9090959010 | Radiant, A | all 9 | 3 – 51 | lost |
| 9090987563 | Dire, A | all 9 | 13 – 67 | lost |
| 9091005196 | Radiant, B | all 9 | 14 – 47 | lost |
| 9091028639 | Dire, B | 7 (`fight`, `retreat` off) | 49 – 63 | lost |
| 9091057862 | Radiant, pair 2 (Io not picked: buggy list) | 5 (also `laning`, `farm` off) | 24 – 47 | lost (no baseline for pair 2) |
| 9091087510 | Dire, B | 5 | 50 – 22 | won |
| 9091139294 | Dire, B | 6 (5 + `laning`) | 52 – 27 | won |
| 9091167580 | Radiant, A | 6 | 60 – 78 | lost, close (76 min, towers 11–11) |

**Conclusions** (one game per step, so directional):
- `fight` and `retreat` did most of the damage.
- `farm` cost the rest.
- `laning` is neutral.
- With the recommended 6 flags the bot is about even with plain OHA: a close game with the weaker lineup, a smaller margin than OHA's with the stronger one.

**Why `fight` and `retreat` lost.** With `fight` on, Valve's attack mode is replaced, and bots attack heroes only on the module's engage or hold call. Rules tuned on human-vs-bot games made that call rare:
- engaging needed 2x strength in laning;
- a "trap" check blocked most engages after laning, because in bot vs bot most enemies are out of sight;
- OHA's "help an ally" was off after laning;
- `fight_disengage` and `fight_outnumbered` made caught bots run at full health instead of fighting back.

**Fixes made during the screen.** They're kept, but the flags stay off:
- **Fight:**
  - laning engage at 1.6x instead of 2.0x;
  - the trap check only blocks below a 2x edge, and logs `FIGHT ... trap`;
  - OHA's help-ally is off only while the bot's engagement has a decision (`OwnsHeroTargets(bot)`);
  - the lane veto no longer cancels the team's engage;
  - a "caught" rule (enemy within 450 and at least as fast, health above 45%) makes the bot fight back instead of running, and logs `FIGHT ... caught`.
- **Farm:** stacking only in the laning phase (supports stacked every minute until 51:00).
- **Retreat (all flagged teams):**
  - **The bug:** 9091079067 had all five bots standing in their fountain in retreat mode for 3–4 game minutes at full health. The retreat formula itself was negative there (`RETREATSTUCK` lines), so the cause is elsewhere.
  - **The guard:** at the fountain with health above 90%, mana above 80% and no enemy within 1600, retreat returns 0.
  - **Scope:** the guard runs only for teams with `arbiter` or `escape` on, so plain OHA is untouched (`arbiter` only since `escape` was removed on 2026-11-17).

**Speed:** the Windows client never reached the timescale it was given. Games set to `host_timescale` 4 or 8 ran at 2–3x, because the client renders every tick. Headless Linux games in WSL hold the target (see the spec, step 0).

Earlier rounds fixed the following:

- stale enemy handles throwing errors in the fight code;
- focus-leash log spam;
- a pull-plan log flood (Lua `nil` vs TypeScript `undefined`);
- the same pre-horn plan every game;
- an attack mode that stayed on beating SURVIVE;
- team roam beating retreat;
- a lane engage capping lane retreat.

## 5. Tests and debugging

Headless bot-vs-bot testing, the trace lines and how a change is judged: [TESTING.md](TESTING.md).

- Each module has a Lua unit test with stubbed game APIs (kept outside the repo). The current runs:

  | Test | Result |
  |---|---|
  | group | 40/40 |
  | arbiter | all pass |
  | pull | 34 |

- With debug prints on (`play` turns them on), the console log (`game/dota/console.<matchid>.log`) has one line per decision. Lines start with:
  - `GROUP`, `SIEGE`, `GANK` and `PULL`: one per decision;
  - `MODES`: once a minute per bot;
  - `THRASH`: mode-change counts;
  - `DEATH`: the last 8 s of each bot death (health, mode, retreat desire and reason, enemies and allies near).

## 6. Known gaps and next steps

- **Team fight coordination:** chained stuns, saving BKB and big ultimates, and starting a fight with the initiator's spell.
- **Vision:**
  - ward before Roshan and before pushes;
  - remove enemy wards in the area being fought over;
  - treat several missing enemies as a smoke gank.
- **Push timing on item and level spikes:** push when key items finish or ultimates come online, and go straight from Roshan to a high-ground push.
- **Buyback:** save gold for buyback late in the game.
- **Wave clear when defending:** clear the creep wave with spells from a safe distance.
- **Smarter escape items:** blinking or forcing away from the chasing enemies instead of straight at the ancient.
