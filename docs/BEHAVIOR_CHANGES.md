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
    Radiant = { arbiter = true, laning = true, fight = true, retreat = true, group = true,
                farm = true, roam = true, humanfeel = true, escape = true },
    Dire    = { ... },
}
```

A missing table or key counts as off.

| Flag | What it switches on | Main modules |
|---|---|---|
| `arbiter` | Desire tiers, a bonus for the running mode (fewer mode flips), mode-change counting | `behavior/arbiter`, `behavior/desire_tiers`, `behavior/thrash` |
| `laning` | Lane trades, stepping out of harass range, camp pulls, lotus pool pickup | `behavior/laning`, `behavior/pull`, `behavior/lotus` |
| `fight` | One shared fight state per engagement: engage, hold or disengage, plus focus target and initiator | `behavior/fight` |
| `retreat` | Retreat rules tied to the fight state, laning burst danger, cancelling a TP into a lost fight | `mode_retreat_generic.lua`, `behavior/tpcancel` |
| `group` | Team defence assignments, group pushes, regrouping, high-ground gate and Roshan first, no lone trips into danger | `behavior/group`, `behavior/siege`, `behavior/alone` |
| `farm` | Stacking camps, jungling after repeated lane deaths, farm allotment | `behavior/camps`, `behavior/jungle` |
| `roam` | Smoke ganks, counter-gank teleports | `behavior/gank` |
| `humanfeel` | Varied pre-horn plans (feint, bounty steal, ambush, camp block), per-game randomness | `behavior/prehorn`, `behavior/rng` |
| `escape` | Retreat route that keeps away from chasing enemies | `behavior/escape` |

### Match tooling

Run these from `typescript/`:

```
npm run match -- play arbiter,laning,fight,retreat,group,farm,roam,humanfeel,escape   # human-vs-bot: flags on both teams, debug prints on
npm run match -- play none                                                            # plain OHA baseline
npm run match -- reset                                                                # restore general.lua and utils.lua (do this before committing)
```

To record a game, load the recorder from the in-game console:

```
sv_cheats 1; script_reload_code bots/tools/match_recorder
```

It records human-played heroes and K/D/A as well.

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

### Fight (`fight`)

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

### Retreat (`retreat`) and escape (`escape`)

- **Fight-aware retreat:**
  - `fight_outnumbered` 0.88;
  - `fight_disengage` 0.88;
  - `fight_survive` 0.96;
  - `fight_lane_burst` 0.9 during laning, when the enemies near us can kill us in 3 s;
  - pre-horn: retreat when outnumbered.
- **TP cancel:** a TP into a spot that has become a lost fight is stopped mid-channel.
- **Escape route:** when enemies were seen within 2000 in the last 3 s, the bot compares routes home:
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

### Farm (`farm`)

- Supports stack our camps at x:53.
- A core that keeps dying in lane may jungle for a while and come back once caught up.
- Camp lists are refreshed every minute.

### Roam (`roam`)

- **Smoke gank:** a squad gathers, smokes, and goes for a lone visible enemy away from its towers.
- **Counter-gank TP:** a healthy bot with a ready TP joins an ally fighting at one of our towers, when that evens the numbers.

### Human feel (`humanfeel`)

- **Pre-horn plans:** one plan per game, with per-bot spot jitter and timing:
  - standard;
  - feint;
  - bounty steal;
  - ambush;
  - camp block (sentry or body block).
- **Per-game randomness** (`behavior/rng`): a Park-Miller generator seeded from real time. Valve's `RandomFloat` gave the same sequence every game, so the same plan came up every time.

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

Earlier rounds fixed the following:

- stale enemy handles throwing errors in the fight code;
- focus-leash log spam;
- a pull-plan log flood (Lua `nil` vs TypeScript `undefined`);
- the same pre-horn plan every game;
- an attack mode that stayed on beating SURVIVE;
- team roam beating retreat;
- a lane engage capping lane retreat.

## 5. Tests and debugging

- Each module has a Lua unit test with stubbed game APIs (kept outside the repo). The current runs:

  | Test | Result |
  |---|---|
  | group | 40/40 |
  | fight | 57/57 |
  | escape | 21/21 |
  | arbiter | all pass |
  | pull | 34 |
  | prehorn | 76 |
  | jungle | 24 |

- With debug prints on (`play` turns them on), the console log (`game/dota/console.<matchid>.log`) has one line per decision. Lines start with:
  - `GROUP`, `FIGHT`, `ESCAPE`, `SIEGE`, `GANK`, `PREHORN`, `PULL` and `JUNGLE`: one per decision;
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
- **Smarter escape items:** blinking or forcing along the escape route instead of straight at the ancient.
