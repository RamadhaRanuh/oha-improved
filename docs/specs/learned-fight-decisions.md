# Learned fight decisions

Status: **v1, 2026-11-15.** Step 1 is built. Steps 0, 2, 3, 4 and 5 are planned. Step 5 (per-hero skill use) is the agreed next improvement after the team-level work.

## 1. Why

The hand-tuned fight and retreat rules (`behavior/fight`, `mode_retreat_generic.lua`, flags `fight` and `retreat`) keep failing in both directions:

- Rules tuned on human-vs-bot games (9090005145, 9090116913) made the bots lose every bot-vs-bot game that followed:

  | Game | Match | Kills (new – plain OHA) |
  |---|---|---|
  | 1 | 9090959010 | 3 – 51 |
  | 2 | 9090987563 | 13 – 67 |
  | 3 | 9091005196 | 14 – 47 |

- Each patch fixed one failure and moved the problem somewhere else: no help for allies, then running when caught, then offlaners pushed out of lane.
- Testing is too slow to tune by hand. One game at a time at 4x is about 4 games an hour, and a 32-game confirm run takes a day.

The fight-or-run choice is a good fit for a learned policy:

- **It's narrow:** fight, hold or run.
- **It's frequent:** about 100 fight-state changes per game, and many more per-bot decisions.
- **It's measurable within seconds:** kills, deaths and gold over the next 10 s.

## 2. Goal

A learned model chooses fight or run for each bot in a fight. It sits behind a new flag `learned`, replaces the fight/run decision of the `fight` and `retreat` flags, and beats both those rules and plain OHA in the measurement rotation (`docs/specs/measurement-lineups.md`).

**Not goals:**

- Learning the whole game the way OpenAI Five did. That's out of reach in compute and simulation speed.
- Live learning inside a match.
- Replacing laning, items or macro decisions. Those are for later (step 4).

## 3. Design choices

| Choice | Decision | Why |
|---|---|---|
| Learning style | Offline batches: collect logged games, train, evaluate, repeat | About 4 games per hour per instance is too slow for online RL |
| Model | Logistic regression or small gradient-boosted trees first; a small neural net only if those plateau | Little data (thousands of rows), easy to check, small enough to export |
| Where it runs | Inline in Lua, as an exported table of weights or trees | No server, no latency, still works when the scripts are shared. Localhost HTTP (`CreateHTTPRequest`, see `bots/ts_libs/utils/http_utils/http_req.lua`) only if live learning is ever needed |
| Exploration | About 3% random forced actions, in data games only | Logged data otherwise only covers what the current rules do |
| Opponent | Plain OHA first, then a mix with earlier model versions | Training only against OHA overfits to OHA's habits |
| Speed-up | Headless Linux Dota, several games at once (step 2) | One Windows client runs one game |

## 4. Steps

### Step 0: headless feasibility check (done)

Get one headless Dota game running in WSL2 on the Linux build:

1. Install with `steamcmd` (app 570).
2. Launch with `-dedicated -fill_with_bots +sv_cheats 1 +host_timescale N +map start` (options from TimZaman's `dotaservice`, 2019).
3. Play one game with these scripts and check that a `MATCHREC` line appears in its log.

Also measure the highest timescale that still holds a steady tick rate.

- **Time box:** one session.
- **If it fails:** parallel games are off. Keep the single-client loop and get more data per game (step 1 already logs both teams).

**Needs from the user:** WSL2 installed, CPU core count, RAM, and about 80 GB of free disk space (the Linux install is 77 GB).

**Result (2026-11-15): works.**

- **Install:** WSL2 Ubuntu, running as root. steamcmd is in `/opt/steamcmd` and the game in `/opt/dota2`. The user logs in to steamcmd themselves.
- **Launch:**
  - Run `game/bin/linuxsteamrt64/dota2` directly. `dota.sh` stops with a FATAL error because it needs the Steam "sniper" runtime.
  - Set `LD_LIBRARY_PATH=bin/linuxsteamrt64` and `ENABLE_PATHMATCH=1`.
  - Copy `/opt/steamcmd/linux64/steamclient.so` to `/root/.steam/sdk64/`. Without it, Steamworks init fails with a FATAL error.
- **Script:** `headless_full.sh <run> <timescale> [port]` (kept in `C:\Users\Public`, copied to `/opt/oha-runs`).
  - It feeds console commands through a fifo.
  - When the pick phase starts, it loads `bots/tools/match_recorder`.
  - It stops the server after the `MATCHREC` line.
  - The bot scripts are a copy in `/opt/dota2/game/dota/scripts/vscripts/bots`. Copy them again after every change.
- **Speed:** at `host_timescale 8`, the game runs at about 7.3x real time on one core (94% CPU) and uses about 1.2 GB of RAM. The Windows client manages only 2–3x, because it renders every tick.
- **Parallel:** `headless_par.sh <n> <timescale>` starts n games on separate ports and logs memory use.

### Step 1: decision log (built)

**Files:**

| Path | What it is |
|---|---|
| `typescript/bots/FunLib/behavior/decision_log.ts` | The logging module, compiled to `bots/FunLib/behavior/decision_log.lua` |
| `bots/mode_retreat_generic.lua` | Hook: `Tick` is called from retreat's `GetDesire` for every bot |
| `bots/mode_team_roam_generic.lua` | Hook: forced fights |
| `typescript/post-process/decisions-dataset.js` | `npm run decisions`: turns the logs into a CSV |
| `typescript/post-process/match-setup.js` | Turns logging on; `--explore=<p>` for data games |

**Config:** `Customize.DecisionLog = { enabled, explore }` in `bots/Customize/general.lua`.

- It's off by default.
- Every `npm run match` setup sets `enabled = true, explore = 0`.
- `--explore=0.03` sets the exploration rate for data games (see section 5).
- `npm run match -- reset` restores the file.

The log is independent of the behaviour flags, so it logs every bot on both teams, plain OHA included.

**Decision line.** Once a second per bot, while a visible enemy hero is within 1600:

```
FIGHTDEC id=2-3-1234 t=123.4 team=2 hero=juggernaut pos=1 lvl=5 hp=0.62 mp=0.40 nw=2000
  allies=1 allyHp=0.70 allyLvl=9 allyNw=3500 enemies=2 enemyHp=0.80 enemyLvl=10 missing=2
  near=450 nearHp=0.70 inc=0.55 out=0.30 teamOut=0.50 ult=0 towerAlly=99999 towerEnemy=900
  home=9000 laning=1 act=run forced=0
```

(This is one line in the log, wrapped here.)

| Field | Meaning |
|---|---|
| `allies`, `enemies` | Real heroes within 1600, excluding the bot itself |
| `allyHp` | Average health of the allies, the bot included |
| `allyLvl`, `allyNw` | Sums for the allies, the bot included |
| `enemyHp` | Average health of the enemies |
| `enemyLvl` | Sum of the enemies' levels |
| `missing` | Living enemies unseen for more than 3 s |
| `near`, `nearHp` | Distance to the nearest enemy, and its health |
| `inc` | Damage the enemies could deal the bot in 3 s with what they have ready (`GetEstimatedDamageToTarget`), divided by the bot's current health |
| `out` | The same estimate for the bot's damage on the nearest enemy, divided by that enemy's health |
| `teamOut` | `out` summed over the bot and its allies near that enemy |
| `ult` | 1 if the bot's ultimate is ready |
| `towerAlly`, `towerEnemy` | Distance to the nearest tower of each side within 1600 (99999 if none) |
| `home` | Distance from the bot's fountain |
| `act` | `fight` (attack mode, or team roam with a hero target), `run` (retreat or evasive), or `other`, read from the active mode |
| `forced` | 1 if exploration forced the action |

**Outcome line.** 10 s later:

```
FIGHTOUT id=2-3-1234 died=1 kills=0 allyDeaths=0 hp=0.00 nwGain=-150
```

| Field | Meaning |
|---|---|
| `died` | The bot died at any point in the window |
| `kills` | Enemies from the decision that died in the window |
| `allyDeaths` | Allies from the decision that died in the window |
| `hp` | The bot's health at the end of the window |
| `nwGain` | Change in the bot's net worth over the window |

**Exploration.** When `explore` is above 0: at a decision with no forced action running, with probability `explore` the bot is forced to fight or run (50/50) for 4 s.

- **Forced run:** retreat desire is lifted to 0.97, logged with the reason `explore_run`.
- **Forced fight:** retreat is capped at 0.05 (`explore_fight`), and team roam takes over at 0.97 and attacks the nearest enemy hero.
- **Ending early:** a forced fight ends early if its target dies, leaves vision or can't be attacked.
- **Randomness:** random numbers come from `behavior/rng`, which is seeded per game.

Use exploration only in data games, never in eval games.

**Dataset.** `npm run decisions` joins each decision with its outcome and adds:

- `match`;
- `won`: whether the bot's team won;
- `flagFight`, `flagRetreat`: the bot's team's flags, from `MATCHREC`.

It writes `datasets/fight_decisions.csv` (gitignored) and prints a summary of death and kill rates for each action.

### Step 2: parallel game runner (built)

`npm run batch` (`typescript/post-process/batch.js`, with `headless/game.sh` and `headless/batch.sh`):

```
npm run batch -- start 1-8 arbiter,laning,group,roam,humanfeel,escape [--parallel=8] [--timescale=8] [--explore=0.03] [--name=]
npm run batch -- status [<name>]
npm run batch -- report [<name>]
npm run decisions -- datasets/runs/<name>
```

- **Settings per game:** `match-setup.js --out=<dir>` writes each game's `general.lua` and `utils.lua` (lineup pair, side rotation, flags, decision log) into `datasets/runs/<name>/cfg/g<n>/`. The repo files are not touched.
- **Install:** one Linux Dota install. Each game gets its own copy of the repo's `bots` folder, bind-mounted over `vscripts/bots` in a private mount namespace (`unshare -m`), so games with different settings run side by side. The batch uses the `bots` folder as it was at start.
- **Queue:** at most `--parallel` games at once. A game is stopped after its `MATCHREC` line, or after 40 real minutes.
- **Output:** `datasets/runs/<name>/` gets `manifest.json`, `console.g<n>.log` per finished game, `status.log` and `mem.log`. `report` prints winner, length, kills and 10-minute net worth per game and the new team's win count.
- **Eval batch:** the 8-game screen or the 32-game confirm rotation.
- **Data batch:** same, with `--explore=0.03`. Both teams are logged.

**Measured (i9-14900HX, WSL with 15 GB):**

| Games at once | Speed per game | Total | RAM |
|---|---|---|---|
| 1 | about 5.7x over a full game (7.3x early) | 5.7x | about 1.2 GB |
| 4 | about 4.6x | about 16x | about 4.3 GB |
| 8 | about 3.6x | about 24x | about 8 GB |

`host_timescale 16` is no faster than 8 for one game: the server uses one full core.

**Not done yet:** restarting a game that hangs (it is stopped at 40 minutes and reported as "no MATCHREC").

### Step 3: learning loop (planned)

1. **Collect.** Run a data batch of about 20 games and build the dataset.
2. **Score.** Score each decision as `kills − 1.5 × died − 0.5 × allyDeaths + nwGain / 300`. The weights are tunable and get fixed before the first training run.
3. **Train.** Fit one model per action (fight, run) that predicts the score from the features. Training uses only rows where the action was taken. Forced rows are the unbiased part; unforced rows are weighted by how likely their action was under the policy that logged them.
4. **Policy.** In a fight, pick the action with the higher predicted score. A margin of about 0.2 falls back to the current rule, so small differences don't cause flip-flopping.
5. **Check offline.** Estimate the new policy's score on held-out batches, using the forced rows, before it plays.
6. **Export.** Write `bots/FunLib/behavior/learned_fight_model.lua`, a generated table of weights or trees. `behavior/fight` reads it when flag `learned` is on. `RetreatAdjust` and `AttackDesire` ask the model instead of the ratio rules. Survive still overrides everything.
7. **Evaluate.** Play an eval batch: `learned` against plain OHA, and against the previous model. Keep the new model only if it wins (screen: 6 or more of 8 games; confirm: the existing 22-of-32 rule).
8. **Repeat.** From the second round on, data batches mix in games against earlier models.

### Step 4: widen the scope (later)

Once fight/run clearly beats the hand-written rules: decide when to defend, push or group (`behavior/group`), then lane trading (`behavior/laning`).

### Step 5: per-hero skill use (next improvement after the team-level work)

**Today:**
- Every hero's spells are hand-written in `bots/BotLib/hero_<name>.lua`: one `ConsiderX()` per ability returns cast or don't, and the target, and `SkillsComplement()` sets the order.
- That's 127 heroes with about 4–6 abilities each.
- Quality varies a lot. Many abilities just cast on the first enemy in range.

The fight/run policy (steps 1–3) doesn't touch any of this.

**5a. Spell log (measure first).** A `SPELL` line per cast, like the decision log, behind `Customize.DecisionLog`:
- caster, ability, target type (hero, creep, ground, self or ally), range, and enemies and allies around the target;
- whether the target was disabled, its health, and the caster's mana;
- the outcome a few seconds later: target hit or not, damage dealt, target died, an ally followed up on a disabled target, mana left.

A report script ranks spells and heroes by:
- wasted casts: no target hit, a nuke on a creep wave while enemy heroes were near, a heal on a full-health ally;
- missed chances: an escape not used while chased to death, a disable not used on a channeling enemy;
- late ultimates: cast after the fight was decided.

**5b. Scripted fixes by priority.**
- Fix the worst offenders first, weighted by how often a hero is picked. Prefer shared helpers that fix a whole category at once:
  - AoE disables that hit one target when they could hit more;
  - escapes not used while chased;
  - wasted heals and buffs;
  - ultimate timing;
  - not casting on a channeling or teleporting enemy.
- Each fix is checked with A/B eval batches. A hero appears in only a small share of games, so this needs parallel headless games (step 2).
- Ability references use `sAbilityList[N]` (see CLAUDE.md), and TS sources are updated for TS-generated heroes (ARCHITECTURE.md section 13).

**5c. Learned cast-or-hold.** Once there's enough logged data:
- The scripts keep choosing the target and how to cast. A learned model decides only **cast now or hold**.
- There's one model per spell type (AoE disable, single-target disable, nuke, AoE nuke, escape, heal or save, buff, ultimate), shared across heroes. Grouping by type is what makes the data go far enough, since one hero appears in few games.
- Features: target health and whether it's disabled, enemies inside the area of effect, allies in range to follow up, danger to the caster, mana after the cast, cooldown length.
- Training follows step 3: exploration that sometimes holds or casts at random, offline training, export to a Lua table, and an A/B check behind a flag (`learnedSpells`).

**Order:** 5a, then 5b for the worst offenders, then 5c per spell type, starting with the type that has the most data.

## 5. Data volume

- **Measured:** game 9091057862 (44 min) logged 6,541 decisions across all 10 bots, every one with an outcome: 1,941 fight, 1,155 run, 3,445 other. The rate is highest in laning (about 360 a minute), when enemy heroes are almost always within 1600.
- **Exploration rate:** at 6,500 decisions a game, 10% exploration would force about 650 random actions. The default for data games is **3%**, about 200 forced decisions a game.
- **Games needed:** a first model needs a few thousand forced rows, so roughly 15–25 data games at 3%.
- **Time:** on one client that's 4–6 hours of play. With 4–6 parallel instances (the user's machine: i9-14900HX, 24 cores, 32 GB RAM, WSL2 Ubuntu), about 1 hour.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Headless launch options from 2019 no longer work | Step 0 is time-boxed. Fallback: single client with both teams logged |
| The model learns OHA's habits | Mix in games against itself, then human games |
| Bugs in other flags pollute the data (for example group defence sending bots in one at a time) | Finish the flag bisect (games 4+) before data batches. Data games run the bisected-good flags |
| Forced fights wreck the game state and skew later decisions | 3% exploration, 4 s windows, data games only. Eval games use explore 0 |
| The 10 s window misses longer outcomes (a dive that loses a tower) | Start at 10 s; try a second horizon (20 s) as an extra field if the first model looks short-sighted |
| Patch changes alter features (for example the damage estimates) | Features are relative (ratios, counts, distances); retrain after a patch |

## 7. Status log

- **2026-11-15:** steps 0 and 2 done. Headless Linux Dota runs in WSL; 8 games at once give about 24x real time.
  First batch, `screen-rec6` (games 1-8, flags arbiter, laning, group, roam, humanfeel, escape): the new team won 3 of 8, 0 errors, 58,353 decisions.
  The new team was behind in net worth at 10 minutes in 7 of 8 games (about 1,700 on average), so its early game needs a look.
- **2026-11-15:** step 5 (per-hero skill use: spell log, scripted fixes, learned cast-or-hold per spell type) added as the agreed next improvement after the team-level work.
- **2026-11-15:** spec written and step 1 built. Bisect game 4 started before the build, so the first logged game is game 5 (9091057862): 6,541 decisions, no errors, both teams logged. The data-game exploration default was lowered from 10% to 3%.
