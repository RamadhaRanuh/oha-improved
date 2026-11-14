# Smarter bot behaviour: implementation spec

Status: **v1, 2026-11-13.** This is the destination of the wayfinder map [Smarter bot behaviour](../wayfinder/bot-behavior/map.md). Every decision here is recorded in a closed ticket on that map; section 15 indexes them. Implementation sessions build from this document and do not re-decide anything in it. Numbers marked *tunable* are starting values, to be adjusted only from lobby results.

> **Provenance.** The grilling decisions behind this spec were made on the agent's recommendation, under the human's standing instruction "All grilling session uses your recommendation" (2026-11-13). No in-game observation has been made yet. The code audit and the research findings are the evidence. Phase 0 (section 4) is where the human's lobbies first test them.

## 1. Goal and success

Improve the **generic behaviour layer**: the `bots/mode_*_generic.lua` files and the `FunLib` modules they call. Per-hero `BotLib/` logic, items, picking, FretBots/Buff and patch upkeep are out of scope.

Success is measured two ways, for each stage:

1. **Win rate:** a 32-game confirm run in which the stage's flags-on team wins 22 or more against flags-off (section 13).
2. **Human feel:** the [human-like checklist](../wayfinder/bot-behavior/assets/human-like-checklist.md) scores better than the baseline on the items for that stage's system, with no item getting worse.

**Baseline** is commit `cb814c6`, which is the same as the flags-off code paths.

## 2. Ground rules for every implementation session

- **Feature flags.** Every behaviour change is behind a per-team flag (section 3.1). With every flag off, a team must run exactly the baseline code paths. A flag-off branch calls the original function unmodified, and reviewers check this in the diff.
- **Language.** New logic goes in TypeScript under `typescript/bots/FunLib/behavior/`, compiled to `bots/FunLib/behavior/` with `npm run build` (or `npm run dev` while iterating).
  - Mode entry files `bots/mode_*_generic.lua` stay hand-written Lua and only branch on flags and delegate.
  - When TypeScript calls a `J.*` function that `typescript/bots/FunLib/jmz_func.d.ts` does not declare, add the declaration in the same change.
  - Add every new generated file to section 13 of `docs/ARCHITECTURE.md`.
- **Fair play.** Use the legitimate bot API only. Do not touch FretBots or Buff.
- **One owner per decision.** A hero target has one owner, the fight module. Team-level choices (focus, fight state, group intent, defenders, farm areas, gank target) are made only in the team brain (section 3.3).
- **Desire scale.** New code returns desires from the tier table (section 3.2) and never above 1.
- **Performance rules** (section 11.1) apply to all new code.
- **Testing.** Only the human runs lobbies. Each session ends with the build passing, flag-off reviewed as unchanged, and a lobby checklist handed to the human (section 12).

## 3. Stage 0: foundations

### 3.1 Feature flags

Add to `bots/Customize/general.lua`:

```lua
-- Behaviour feature flags per team. All false = baseline behaviour (commit cb814c6).
Customize.Behavior = {
    Radiant = { arbiter = false, laning = false, fight = false, retreat = false,
                group = false, farm = false, roam = false, humanfeel = false, escape = false },
    Dire    = { arbiter = false, laning = false, fight = false, retreat = false,
                group = false, farm = false, roam = false, humanfeel = false, escape = false },
}
```

`behavior/flags.ts` exports `IsOn(name: string): boolean`. It picks `Radiant` or `Dire` from `GetTeam()` and treats a missing table or key as `false`. The result is cached per name after the first read, because flags do not change during a game.

Once a stage passes its confirm run, its flag defaults to `true` for both teams in the shipped `general.lua`. Measurement games then set the measured team's flags explicitly.

### 3.2 Desire tiers and the arbiter (flag `arbiter`)

`behavior/desire_tiers.ts`:

| Tier | Value | Used for |
|---|---|---|
| `SURVIVE` | 0.96 | about to die, standing in a lethal zone |
| `FORCED` | 0.90 | team committed to a fight, defending high ground or the ancient |
| `HIGH` | 0.75 | joining an engagement, assigned group push or defence, laning last hit or deny due now |
| `MODERATE` | 0.50 | laning baseline, farming, gank approach |
| `LOW` | 0.25 | fill-in activity |
| `NONE` | 0 | |

New code may interpolate between adjacent tiers with `RemapValClamped`.

`behavior/arbiter.ts` exports `Finalize(bot, mode: BotMode, raw: number): number`. With flag `arbiter` on, every `GetDesire()` on that team returns `Finalize(bot, BOT_MODE_X, raw)`. This wraps the existing return value in each mode entry file and leaves the internals untouched.

1. **Legacy values above 1 are compressed** into 0.95..0.99, keeping their order: `v > 1` becomes `0.95 + min(v - 1, 0.5) * 0.08`. Negative values become 0.
2. **Incumbent bonus.** If `bot:GetActiveMode() == mode` and `raw > 0.1`, add `0.12` (*tunable*; it was 0.06 until the S0b screen, see section 12), capped at 1. A mode that is already running then has to be beaten clearly before it is replaced, which also gives the tie-break that ryndrb's laning uses.
3. **Thrash counter** (debug only). `Utils.DebugMode` counts active-mode changes per bot per minute and prints them once a minute. Phase 0 uses this for the baseline thrash rate.

With the flag off, `Finalize` is not called.

### 3.3 Team brain skeleton

`behavior/team_brain.ts` exports `Get(): TeamView`. The view is memoised per team in 0.25 s buckets of `DotaTime()`. The brain is a pure function of inputs any bot on the team can read, so it gives the same answer whether Lua state is shared within the team or each bot has its own sandbox (section 3.3.1).

```ts
interface EnemyInfo { id: PlayerID; unit: Unit | null; visible: boolean;
  lastSeenLoc: Vector; lastSeenAge: number; firstSeenThisSighting: number;
  hpFrac: number; rawPower: number }
interface Engagement { id: string; center: Vector; allyIds: PlayerID[]; enemyIds: PlayerID[];
  state: "none" | "engage" | "hold" | "disengage"; stateSince: number;
  ratio: number; focusId: PlayerID | null; focusSince: number; initiatorId: PlayerID | null }
interface GroupIntent { kind: "none" | "push" | "defend" | "roshan"; lane: Lane | null;
  memberIds: PlayerID[]; since: number }
interface FarmArea { kind: "lane" | "jungle"; lane?: Lane; anchor: Vector }
interface GankPlan { targetId: PlayerID; gankerIds: PlayerID[]; since: number }
interface TeamView { time: number; enemies: EnemyInfo[]; engagements: Engagement[];
  group: GroupIntent; defenders: Partial<Record<Lane, PlayerID[]>>;
  farm: Record<PlayerID, FarmArea>; gank: GankPlan | null }
```

Stage 0 builds `enemies` and leaves the other fields empty or `"none"`. Each later stage fills in its own field. Helpers: `EngagementOf(bot)`, `IsGroupMember(bot)`, `DefenderLane(bot)`, `FarmAreaOf(bot)`, `IsGanker(bot)`.

#### 3.3.1 Convergence rules

These keep separate per-bot computations, if that is how the engine runs them, giving the same answer:

- **Only team-observable inputs.** No `RandomInt` inside the brain. Per-bot randomness (section 10) is applied by the reading mode, not the brain.
- **Stable keys.** Engagements are keyed by the sorted enemy player ids in them. Commitment times (`stateSince`, `focusSince`, `since`) are recorded in a module-level table keyed by those ids. Every computation reaches the same transitions at the same bucket times.
- **Unit lists come from `global_cache`** with a TTL of at least 0.25 s.

### 3.4 Match recorder

`bots/tools/match_recorder.lua` runs in the server-side VM. It is loaded with `sv_cheats 1; script_reload_code bots/tools/match_recorder`, never from FretBots, and does not modify it.

- **Snapshots:** at 10:00 and 20:00 it stores net worth and kills per team, towers destroyed per team, and last hits per hero (at 10:00).
- **At `DOTA_GAMERULES_STATE_POST_GAME`** it prints one line through the original `print`:

```
MATCHREC {"winner":"radiant|dire","duration":s,"flags":{"radiant":{...},"dire":{...}},
 "lineup":{"radiant":[...],"dire":[...]},"kills":{...},"towers":{...},"nw10":{...},"nw20":{...},
 "nwEnd":{...},"lh10":{...},"seed":{...}}
```

- **Winner:** taken from the destroyed `npc_dota_fort`, as `FretBots/GameState.lua:51-53` does.
- **Flags:** read from `Customize.Behavior`.
- **Seeds:** the per-bot personality seeds (section 10) come from the console log lines each bot prints at game start with the `MATCHSEED` prefix through the original `print`. The recorder only needs to note that they exist; analysis joins on the timestamp.

The console log is captured by launching Dota with `-console -condebug`.

### 3.5 Deployment

1. Rename `<dota>/game/dota/scripts/vscripts/bots` to `bots_backup_2026-10`.
2. Run `mklink /J "<dota>\game\dota\scripts\vscripts\bots" "<repo>\bots"`.

The game then runs this repo's `bots/` directly. Run `npm run build` before each lobby.

## 4. Phase 0: in-game checks and baseline observation (human)

Phase 0 runs after the stage 0 code exists and before stage 1 is tuned.

**Checks** (a few minutes each, Local Host, cheats on):

| Id | Check | Pass |
|---|---|---|
| P0-1 | Game loads from the junction | A one-line `print` added to `hero_selection.lua` (bypassing the silencer) appears in the console |
| P0-2 | Lua state per team | A counter in a `require`d module, incremented and printed by every bot, counts 1..5 per team and does not run 1..10 |
| P0-3 | Console log | `-condebug` writes `game/dota/console.log` and it contains the P0-1 line |
| P0-4 | Recorder | A finished bot-only game produces one `MATCHREC` line with the correct winner |
| P0-5 | Timescale fidelity | The same lineup played 3 times at 1x and 3 times at speed S, where S is the highest of 4, 3, 2 with a steady frame rate. Mean game length within 15%, mean kills within 20% |
| P0-6 | Engine cadence | Prints from `GetDesire()` show its period. A `team_desires.lua` stub with `TeamThink()` printing once shows whether it is called. Delete the stub afterwards |

If **P0-2 fails** (the teams share state), use the fallback measurement in section 13. The brain design is unaffected.

**Results (2026-11-14, match 9089167058):** P0-1, P0-2, P0-3, P0-4 and P0-6 pass. Each team has its own Lua state, shared by its 5 bots. `GetDesire` runs about every 0.32 s of game time, and `TeamThink` runs every frame. **P0-5 was skipped by the human's decision: S = 4 is used without the fidelity test.** If 4x results ever look out of line with games watched at 1x, run P0-5 then. The record is in [results/phase0.jsonl](results/phase0.jsonl), and the observations are in the baseline audit's "Observed in game" section. `-condebug` continues the log in `console.<matchid>.log` once a match ID is assigned, and `npm run phase0` reads both.

**Baseline observation** (carried over from ticket 07):

- Play 2 bot-only baseline games at 1x and 1 human-played game.
- Score the human-like checklist for the baseline.
- Record the thrash counter.
- Watch one default-attack hero and one default-laning hero with `dota_bot_select_debug` and `dota_bot_select_debug_attack`. Write down how they choose targets, whether they harass, and how they handle tower aggro.
- On one of the nine override heroes, check whether its Tango use, retreat or harass ever happens.
- Add the results to [assets/baseline-weaknesses-code-audit.md](../wayfinder/bot-behavior/assets/baseline-weaknesses-code-audit.md) under a new "Observed in game" heading.

If they contradict the stage order in section 14, raise it before stage 1 starts.

## 5. Stage 1: laning (flag `laning`)

> **Changed after the S1 screen (v2, hybrid).** With our own laning `Think()` (below), the same lineup lost about 20 last hits by 10:00 against Valve's laning (Puck 20 against 38-41 vs Templar Assassin, twice). Now, with the flag on, `mode_laning_generic.lua` defines no `Think()` of its own, so Valve's laning Think (or the shim's, for the heroes Valve's breaks) does the walking, last hitting and denying, as in plain OHA and Beginner AI. Laning desire is a flat `MODERATE` in the laning phase. Trades (step 6) and stepping out of a longer-range harasser's range run as short `HIGH` bursts in team roam (`Laning.BurstDesire` / `Laning.BurstThink`). During a burst `bot.laningHoldUntil` is set; the retreat creep-aggro rule and the farm/retreat anti-chase rules skip only then. Tango, tower aggro and danger are left to OHA's item usage, Valve's laning and retreat. The step list below describes v1 and is kept for the record.


Module `behavior/laning.ts`. When the flag is on, `bots/mode_laning_generic.lua` defines `Think()` for **every** hero, delegating to `Laning.Think(bot)`. Neither the shim's `Think()` (lines 175-215) nor the override's runs. When the flag is off, the file is unchanged, including the fall-through defect.

### 5.1 Desire

- **Keep the shim's off-conditions** (`mode_laning_generic.lua:32-92`): enemies near the ancient, recent hero damage while not stronger, team pushing tier 2 or high ground.
- **During the laning phase** (`J.IsInLaningPhase()`):
  - `HIGH` if a last hit or deny is due within 0.6 s (section 5.3);
  - `SURVIVE` for one tick if the Tango rule fires;
  - otherwise `MODERATE`.
- **After the laning phase:** keep the existing ladder tail.
- **The shim's `0.9` last-hit return is removed** under this flag, and so is team roam's `1.5` last-hit return while `J.IsInLaningPhase()` is true (guard at `mode_team_roam_generic.lua:128`). Laning owns lane creeps during the laning phase.

### 5.2 Think priority

The first step that issues an action returns.

1. **Consumables.** Eat a Tango on a tree within 400 when missing at least 115 HP and not damaged by a hero in the last 2 s (from override lines 71-75).
2. **Danger.** Estimate the incoming damage over 2 s: the sum of `GetEstimatedDamageToTarget(true, bot, 2.0, DAMAGE_TYPE_ALL)` from enemy heroes within 1000 that are attacking or facing the bot, plus the damage of an enemy tower targeting the bot. If it exceeds 35% of current health (*tunable*), move to the safe point (section 5.4) and stop.
3. **Tower aggro.** If an enemy tower's `GetAttackTarget()` is the bot:
   - if an allied creep is within the bot's attack range and inside the tower's range, issue `Action_AttackUnit(allyCreep, true)` once to drop aggro;
   - otherwise move to the safe point.

   *Verify in game that attacking an allied creep drops aggro. If it does not, use the move only.*
4. **Last hit.** Pick a creep from enemy creeps within attack range + 300 that `J.WillKillTarget` says will die to one attack arriving after attack point plus projectile travel.
   - Prefer ranged creeps, then flagbearers, then melee creeps (from ryndrb).
   - **Partner rule:** a support (position 4 or 5) skips the creep if an allied core is within 800 of it and can reach attack range before it dies. A core never yields to a support.
   - If the creep is out of range, move to it only when the hit is due within 0.6 s. Otherwise go to step 6 and wait.
5. **Deny.** Pick an allied creep below 50% health that one attack kills, if no last hit is due within 1.2 s.
6. **Trade.** Harass when all of these hold:
   - an enemy hero is within attack range + 100;
   - fewer than 2 enemy creeps are within 500 of the bot (that is the creep-aggro radius);
   - the bot's health fraction is at least the enemy's minus 0.10;
   - no last hit is due within one attack duration;
   - the bot is a core, or a support with no core partner within 800 who is about to last-hit.

   Cores trade only when no movement is needed. After the attack lands (one attack point plus 0.1 s), move 300 toward the safe point to release creep aggro. This "step back" counts as part of the trade.
7. **Wave discipline.** Never attack a creep that is not a last hit or deny during the laning phase. This keeps the wave from being pushed into the enemy tower.
8. **Position.** Move to the hold point (section 5.4). Re-issue the move only if the hold point moved more than 150, or 0.4 s have passed since the last order (move throttle, section 11.1).

### 5.3 "Due" timing

A creep's death time is estimated from its health and the sum of the incoming attacks from allied creeps targeting it (`GetIncomingTrackingProjectiles` plus melee attackers' damage at their attack rate). "Due within t" means that time is less than t plus the bot's attack point.

### 5.4 Hold point and safe point

- **Front:** our own lane front, `GetLaneFrontLocation(GetTeam(), lane, 0)`. If the enemy front amount is lower, use the enemy front instead (shim lines 204-211).
- **Hold point:** the front moved back by `max(ownRange, 250, longestEnemyRange) + roleOffset`.
  - `roleOffset` is 0 for a melee core, 100 for a ranged core and 150 for a support (*tunable*).
  - It is shifted 320 sideways (perpendicular to the lane) when a lane partner is within 300, as ryndrb does.
- **Safe point:** the front moved back by 1200, clamped so it is never in front of our own outermost tower in that lane.
- **Lane:** taken from position (override lines 40-55), not `GetAssignedLane()`.

### 5.5 Done when

- With the flag on, every hero uses this `Think()` during the laning phase.
- The checklist laning items are scored.
- The screen and confirm runs pass (section 13).

## 6. Stage 2: fight (flag `fight`)

Modules: `behavior/fight.ts`, plus the brain's `engagements`.

### 6.1 Engagements (brain)

- **Grouping.** Group the visible enemy heroes (and enemies last seen at most 3 s ago) by single-link distance of 1200. A group is an engagement if any ally is within 1600 of one of its enemies.
- **Allies in the engagement:** allies within 1600 of the engagement's enemies, or with travel time to its center of 4 s or less.
- **Missing enemies.** Each enemy unseen for at most 8 s whose last-seen location is within 5 s of travel of the center is added to the enemy side at 0.75 weight.
- **Power ratio:**
  - `ourDPS` = sum of `ally:GetOffensivePower() / 5` (it is a 5 s figure);
  - `theirDPS` = sum of `enemy:GetRawOffensivePower() / 5`;
  - `ourEHP` and `theirEHP` = summed current health;
  - `ratio` = `(ourDPS / theirEHP) / (theirDPS / ourEHP)`, the ratio of kill speeds.
- **States**, with hysteresis:
  - `none` to `engage` when `ratio >= 1.25` (*tunable*);
  - `engage` to `hold` when `0.8 < ratio < 1.25` for 1.5 s;
  - `engage` or `hold` to `disengage` when `ratio <= 0.8`, or 2 or more allies in the engagement die within 5 s;
  - `disengage` to `none` when no ally is within 1200 of an enemy.
  - **Minimum dwell** is 3 s in `engage` before `disengage`, except on ally deaths.
  - **Numbers guard:** never `engage` while visible enemies exceed allies by 2 or more, unless `ratio >= 2`.
- **Focus target.** For each enemy, `ttk` = its health divided by the summed `ourDPS` of allies within 1200 of it.
  - `score = sqrt(rawPower) / ttk`, times 0.5 if it is more than 1000 from the engagement's allies' centroid.
  - Score is 0 under the skip list: Borrowed Time, Aeon Disk, Enrage, Battle Trance, Cold Embrace, Shallow Grave, Blade Mail active (score times 0.2 instead), untargetable (`J.CanBeAttacked` false), or `J.IsSuspiciousIllusion`.
  - **Stickiness:** keep the current focus unless the new best scores at least 1.3 times as much, or the current one is invalid, not visible for 1.5 s, or more than 1600 from the center.
  - **Chase leash:** if the focus has been chased for 5 s and its health dropped less than 10%, exclude it from focus for 6 s.
- **Initiator.** The ally in the engagement with the highest `initiator` weight in `HeroRolesMap` (ties go to higher health), excluding humans. The initiator is `null` if the best weight is 0.

### 6.2 Attack mode desire

`bots/mode_attack_generic.lua`: when the flag is on, every hero gets `GetDesire`, `Think`, `OnStart` and `OnEnd` from `fight.ts`. The nine-hero `dofile` path is kept only for the flag off.

| Situation | Desire |
|---|---|
| Hard-off conditions (dead, illusion, fountain) | `NONE` |
| The bot's engagement is `engage` and the bot is a participant | `FORCED`; scaled toward `HIGH` as the bot's health goes from 0.35 to 0.20 |
| `hold` and an enemy is within attack range + 200 | `HIGH` |
| `hold` otherwise | `MODERATE` |
| `disengage` or no engagement | `NONE` |
| Laning phase | Only the `engage` row applies. Harass belongs to laning |

The hero-specific windows from the override (Marci Unleash, Muerta Pierce the Veil with more than 3 s left) return `FORCED` whenever the engagement is not `disengage`.

### 6.3 Think

1. **Escape hooks**, for all heroes, from override lines 236-265: move 800 away from Pugna or Rubick while life-drained or from Razor while linked; step out of range of an attacker in Helm of the Undying or Wraith King's scepter form.
2. **Follower hold.** When the engagement has just entered `engage` and the bot is not the initiator, hold at least 700 from the nearest enemy. Stop holding when the initiator is within 300 of an enemy, any enemy in the engagement is stunned, rooted or hexed, or 1.5 s have passed.
3. **Target:** `t` = the focus target.
   - If `t` is farther than attack range + 400 and another non-skip enemy is within attack range, attack that one instead, without changing the published focus.
   - Always call `bot:SetTarget(t)`.
4. **Melee:** `Action_AttackUnit(t, true)`, issued again only when the target changes or every 1 s.
5. **Ranged:** if a melee enemy is within 300 and the bot's last attack landed more than its attack point ago, move 200 directly away and then attack again. This is basic kiting; there is no orb-walk. Otherwise attack `t`.
6. **No focus** (fog): move to the best of five offsets around the focus's last-seen position by `GetUnitPotentialValue` (override lines 387-408), for at most 3 s.

### 6.4 Team roam under `fight`

In `mode_team_roam_generic.lua` `GetDesireHelper()`, when `fight` is on, skip these:

- `ConsiderHelpWhenCoreIsTargeted`;
- `ConsiderHelpAlly`;
- any `CarryFindTarget`/`SupportFindTarget` result that is a hero.

Creep, courier, tower, ward and special-unit targets stay.

### 6.5 Non-hero bot units

Lone Druid's bear and other bot-controlled units in the old nine-hero table run the same attack mode. They are counted as allies in engagements with `GetOffensivePower()` if the call returns a value, and otherwise with 0.5 times their owner's. They never initiate.

### 6.6 Done when

- One hero target per bot comes from `fight.ts`, and team roam no longer sets hero targets.
- Focus is shared, which can be checked by printing focus ids in debug mode.
- The checklist fight items are scored, and the screen and confirm runs pass.

## 7. Stage 3: retreat (flag `retreat`)

Module `behavior/retreat.ts`, wrapping `mode_retreat_generic.lua`.

- **`SURVIVE`** when either holds:
  - health after the projected 3 s incoming damage (the same estimate as section 5.2 step 2, widened to 1200, plus tower and creep damage) is below 15% of max;
  - health is below 20% and an enemy hero is within 900.
- **Committed fight.** While the bot's engagement is `engage`, retreat may only return `SURVIVE`. Every other retreat desire is suppressed, so the bot stays in an even fight.
- **Team disengage.** While the engagement is `disengage`, every participant returns `HIGH`, for at least 2 s and until no enemy hero is within 1200.
- **Otherwise** run the baseline `GetDesireHelper()` and map its result through the arbiter's compression.
- **Retreat path.** Candidate destinations are our alive towers within 4000 and the fountain.
  - Cost is travel distance plus 1500 for each visible enemy (or one seen within 3 s) within 600 of the straight path.
  - Move through one waypoint offset 600 sideways if that lowers the cost. Plan again every 0.5 s.
  - Use the TP scroll if the bot is not damaged for 3 s and the destination is more than 5000 away. This hooks the existing item code's TP use and does not duplicate it.
- **Re-entry.** After a retreat ends in base, hold retreat desire at `MODERATE` until health reaches 0.55, or 0.40 with a regeneration modifier.

**Done when:** the checklist retreat items are scored, and the screen and confirm runs pass.

**Built (2026-11-15, `behavior/escape.ts`, its own flag `escape`)**: the retreat path, after human game 9090116913 (16 of 30 bot deaths after laning came 8+ s after the bot had chosen to retreat, often at 50-90% health). `mode_retreat_generic.lua` had no Think, so the engine walked straight to the fountain. With enemy heroes seen within 2000 in the last 3 s, the bot compares routes home: direct, through one of our towers on the way, a sidestep of 900 or 1600 to either side, or through a healthy ally that is not retreating. Cost is travel time plus 4 x, per threat, the longest time it could be waiting at a point of the next 1500 units before the bot arrives (at most 6 s, halved within 700 of our towers). Re-planned every 0.4 s, keeping the current route unless another is more than 15% + 0.3 cheaper. The TP-home rule stays with the item code; the "1500 per enemy near the path" cost above was replaced by the race estimate.

## 8. Stage 4: push and defend grouping (flag `group`)

Brain fields `group` and `defenders`. `aba_push.ts` and `aba_defend.ts` read them when the flag is on, and their lane tactics stay as they are.

**Built (2026-11-14, `behavior/group.ts`)** after human game 9089923826 (bots spread out while five humans moved together). It keeps its own state, updated once a second, instead of the brain fields. It covers the push intent (8.1, without the "lane won" start), the defence assignments (8.2), and one addition: **regroup**. After laning, once 3 enemies have been seen together in the last 20 s, bots more than 2500 from the rally point walk to it, and their farm, runes, wards, shops and roaming are capped at `LOW` through the arbiter. The rally point is the push or defence gather point, or else the first healthy core by position. Without a team push, lone pushing is capped at `LOW`. The push stop rule "3 or more unseen" only applies while the lead is under 2.

### 8.1 Group push intent

**Built early (2026-11-14, `behavior/siege.ts`):** the high-ground gate and Roshan first, after the human saw bots push tier 4 with all five enemies alive. A lane whose enemy tier-1 and tier-2 towers are down is at high ground. Pushing it (and hitting the ancient) is held to `VERY_LOW` unless we have 2+ more heroes alive, the enemy has 2 or fewer, or we hold the Aegis and are not outnumbered. In that held state, after 20:00, with Roshan alive, no Aegis and not outnumbered, `mode_roshan_generic.lua` gives 0.8 so the team takes Roshan first. The rest of this section (intent, members, lane choice) is still to build.

Recompute every 1 s.

**Start** a push when any of these hold:

- our alive heroes minus their alive heroes is 2 or more;
- 2 or more enemies died in the last 20 s and none of ours did;
- an ally holds the Aegis;
- game time is past 30:00 and their alive heroes are 3 or fewer;
- **lane won** (added after Phase 0): before 12:00, every enemy hero seen in one lane in the last 10 s is dead or below 0.3 health, and our creep wave there is within 1500 of their tier 1 tower. Only the allies already in that lane are members, and nobody else is pulled in. *Tunable.*

This **replaces the `StartToPushTime` gate** while the flag is on.

**Roshan** (added after Phase 0): after 20:00, when a push would start from the kill conditions above, Roshan is alive and no enemy is seen within 2500 of the pit, the intent is Roshan first. `GroupIntent.kind` gains `"roshan"`, and `mode_roshan_generic.lua` gives members `HIGH`. The push intent follows once the Aegis is taken, using the Aegis condition. Abort under the push stop rules.

- **Lane:** the lane whose lowest-tier enemy building is nearest the team's centroid, preferring a lane where our creep wave is within 1500 of that building.
- **Members:** alive allies with health of at least 0.5 that are not assigned to defend.

**Stop** when any of these hold:

- 3 or more enemies have been unseen for 5 s while the push target is past the river;
- our alive heroes are equal to or fewer than theirs;
- 2 of ours died in the last 10 s.

**Desires in `aba_push`:**

- `HIGH` for members in the intent lane;
- `FORCED` at tier 3 or high ground with 4 or more members present;
- non-members are capped at `LOW`. This keeps lone split-push logic, but it cannot outrank the group.

### 8.2 Defence assignments

- **Threat per lane:** the sum of `rawPower` of enemies within 1600 of our lowest standing building in that lane, plus 0.5 per enemy creep wave there.
- **Defenders needed:**
  - a creep wave only: 1 (the nearest support);
  - 1 enemy hero: 2;
  - 2 to 3 enemy heroes: 3;
  - 4 or more, or high ground: all.
- **Who defends:** the needed number, chosen by lowest travel time (counting a ready TP scroll).
- **Together.** With more than one defender, they gather 1200 behind the building and engage once at least `needed - 1` have arrived, or after 6 s.
- **Desires in `aba_defend`:**
  - assigned defenders get `HIGH`, or `FORCED` at high ground or the ancient;
  - everyone else is capped at `LOW` unless the ancient itself is threatened.

**Done when:** the checklist push and defend items are scored, and the screen and confirm runs pass.

## 9. Stage 5: farm allotment (flag `farm`)

Brain field `farm`, recomputed every 10 s and kept until it is recomputed.

- **Areas:**
  - each lane where an allied creep wave is meeting the enemy's;
  - four jungle areas: our triangle, our main jungle, and the enemy main jungle and triangle. Enemy areas are eligible only when 2 or more enemies are dead, or all enemies were seen within 5 s on the far side of the map.
- **Order:** cores choose in position order (1, then 2, then 3). Each takes the area with the best `value - danger - distance/1000`, and an area is taken by at most one core.
  - `value` = 1 for a lane, 0.8 for a jungle area.
  - `danger` = 0.3 per enemy last seen within 2000 of the area in the last 10 s, plus 0.5 if the area is past the river and 3 or more enemies have been unseen for 6 s.
- **Supports** get no lane area while a core is alive and not retreating. They may farm jungle areas no core holds.
- **`mode_farm_generic.lua`** uses the allotted area instead of `J.GetMostFarmLaneDesire()` when the flag is on. Its desire is capped at `LOW` when the allotted area's danger is 0.5 or more.
- **A human on the team** counts as holding the lane they are standing in.

**Done when:** the checklist farming items are scored, and the screen and confirm runs pass.

## 10. Stage 6 and stage 7

### 10.1 Stage 6: roam and gank (flag `roam`)

Brain field `gank`, recomputed every 1 s.

- **Target:** a visible enemy hero in a lane that has one of our laners in it, with either health below 0.5, or a position more than 600 past its own lane front toward our side and more than 2500 from its own tower.
- **Gankers:**
  - position 4;
  - position 5 after the laning phase;
  - position 2 holding a power rune.

  A ganker commits only if its travel time is 15 s or less (25 s with a ready TP scroll or twin gate), the plan's power ratio including the laner is at least 1.5, and its gank cooldown has expired.
- **Approach:** a waypoint through the river or jungle that stays at least 900 from the lane front, until within 1200 of the target. Then the fight module takes over through the engagement.
- **Abort:**
  - the target has been unseen for 4 s;
  - the target is above 0.8 health and within 1000 of its tower;
  - our laner died.

  After an abort or a completed gank, that ganker's cooldown is 30 s.
- **Code:** `mode_roam_generic.lua` `CheckLaneToGank` is replaced by `IsGanker(bot)` and the plan when the flag is on. No other roam branch changes (Tango, base heal, hero special cases).

### 10.2 Stage 7: human feel (flag `humanfeel`)

- **Reaction time.** Each bot draws `r` from a uniform 0.18 to 0.32 s at its first `GetDesire()` and prints it with the `MATCHSEED` prefix.
  - The reading modules (fight, retreat, laning danger) ignore an enemy for decisions until `DotaTime() - firstSeenThisSighting >= r`.
  - The brain itself stays deterministic (section 3.3.1).
- **Personality.** Each bot also draws an aggression value `a` from a uniform -0.1 to 0.1.
  - It scales that bot's own threshold for joining an engagement: the bot treats `engage` as `hold` unless `ratio >= 1.25 * (1 - a)`.
  - It scales farm desire by `1 - a`.
- **With human teammates:**
  - humans never count as the initiator;
  - a bot never takes a last hit within 600 of a human core in lane unless the human is more than 800 from the creep;
  - human pings keep their current handling.
- **No added last-hit errors.** Valve's difficulty jitter stays the only last-hit imperfection.

The move throttle is not part of this flag; it always applies in new code (section 11.1).

**Done when:** for this stage, success means "not worse" on win rate (13 or more of 32) and better on the "overall feel" checklist items.

## 11. Cross-cutting constraints

### 11.1 Performance budget

- **No `GetUnitList` in any `Think()` or `GetDesire()` per call.** Use `global_cache`, with a TTL of at least 0.25 s.
- **The brain updates at most 4 times a second per team.** Per bot, if state turns out not to be shared.
- **`Think()` work stays small:** linear in the units within 1600, with no hero-by-hero nested loops.
- **Move orders are throttled:** re-issue only if the destination moved more than 150 or 0.4 s have passed. Attack orders are re-issued only on a target change or every 1 s.
- **Respect `Customize.ThinkLess`.**
- **Check.** In each screen, the human notes the frame rate with all flags on against all off at the chosen timescale. A drop over 10%, or the timescale becoming unstable, blocks the stage.

### 11.2 Protecting the nine override heroes

- **With flags off,** the nine heroes run exactly the baseline: the `override_generic` files and the shim.
- **With flags on,** they run the same modules as everyone else. Their special cases live on as the general hooks in sections 6.2 and 6.3.
- **Lineups:** every confirm run includes at least three of the nine. Screens include Io and Lone Druid at least once per stage from stage 2.
- **`Utils.BuggyHeroesDueToValveTooLazy` is kept** for the flag-off path and is not extended.

## 12. Implementation sessions

Each session is one agent session. It ends with `npm run build` passing, the flag-off paths reviewed as unchanged, the generated Lua committed with its TypeScript source, and a lobby checklist for the human. Each session after S0b needs the previous session's lobby results.

| Session | Scope | Files | Human's lobby step |
|---|---|---|---|
| S0a | Flags, desire tiers, arbiter (3.1, 3.2), recorder (3.4) | `Customize/general.lua`, `behavior/flags.ts`, `desire_tiers.ts`, `arbiter.ts`, `Finalize` wrap in each `mode_*_generic.lua`, `tools/match_recorder.lua` | Junction (3.5), Phase 0 checks P0-1 to P0-6 |
| S0b | Brain skeleton with `enemies` (3.3), debug thrash counter | `behavior/team_brain.ts` | Baseline observation (section 4); arbiter-only screen |
| S1 | Laning (5) | `behavior/laning.ts`, `mode_laning_generic.lua`, team roam guard | Screen, then confirm (laning + arbiter) |
| S2 | Engagements and focus (6.1) | `team_brain.ts` | Debug-print check of shared focus in one game |
| S3 | Fight mode (6.2 to 6.5) | `behavior/fight.ts`, `mode_attack_generic.lua`, team roam guards | Screen, then confirm. **End of milestone 1** |
| S4 | Group push and defence (8) | `team_brain.ts`, `aba_push.ts`, `aba_defend.ts`, `mode_roshan_generic.lua` | Screen, then confirm |
| S5 | Retreat (7) | `behavior/retreat.ts`, `mode_retreat_generic.lua` | Screen, then confirm |
| S6 | Farm allotment (9) | `team_brain.ts`, `mode_farm_generic.lua` | Screen, then confirm |
| S7 | Gank (10.1) | `team_brain.ts`, `mode_roam_generic.lua` | Screen, then confirm |
| S8 | Human feel (10.2) | `behavior/humanfeel.ts`, readers in fight, retreat and laning | Screen, confirm ("not worse"), human-played checklist |

After every confirm run that passes, flip that flag's default to `true` and commit.

**S0b arbiter screen, cut short by the human's decision (2026-11-14).** Two games were played, not eight. The new team won 1 of 2, and in both games the Dire side won with either lineup, which points to a side effect, not the code. Mode changes per bot per minute were 21.4 for the arbiter team against 24.8 for baseline, a steady but small cut of about 13%. Decision: raise the incumbent bonus to 0.12 and do not finish the arbiter-only screen. The S1 laning screen tests `laning` and `arbiter` together. If it fails, rerun it with `arbiter` off before blaming laning. Records: [results/s0b-arbiter-screen.jsonl](results/s0b-arbiter-screen.jsonl). Tooling: `npm run match -- <game> <flags>` sets up a screen or confirm game, and `npm run report` scores the logs.

## 13. Measurement protocol

- **Lobby:** Local Host, Enable Cheats, both teams Unfair, FretBots and Buff not loaded. Run `sv_cheats 1; host_force_frametime_to_equal_tick_interval 1; host_timescale S` with S from P0-5, then `script_reload_code bots/tools/match_recorder`.
- **Teams:** the measured team has the stage's flags on, plus all previously passed flags. The other team has all flags off (baseline).
- **Lineups:** set with `Customize.Radiant_Heros` / `Dire_Heros`. There are 8 fixed lineup pairs, each a standard 1-5 composition. At least three of the nine override heroes appear across them. Each pair is played in four rotations (new-as-A on Radiant, new-as-A on Dire, new-as-B on Radiant, new-as-B on Dire).
  - The lineup list is written in S0a as `docs/specs/measurement-lineups.md`, picked from heroes with complete `BotLib` builds.
- **Screen:** 8 games (2 pairs). If new wins 2 or fewer, stop and fix.
- **Confirm:** 32 games (8 pairs). The stage passes at 22 or more wins (one-sided binomial p = 0.025), or 13 or more for human-feel-only stages. If timescale fidelity failed, games run at 1x: 16 games, passing at 12 or more.
- **Fallback** if P0-2 fails: each flag set plays 16 games against Valve's built-in bots. The stage passes if the new set's win rate is at least 15 points higher than the baseline set's.
- **Records:** `MATCHREC` lines are appended to `docs/specs/results/<stage>.jsonl` by the human, or the same fields are copied by hand from the post-game screen.

## 14. Stage order and why

1. **Stage 0:** foundations and Phase 0.
2. **Stage 1:** laning. It is self-contained, has a known defect and sets up the whole game.
3. **Stage 2:** fight. It has the biggest effect on wins, and needs the brain and the arbiter.
4. **Stage 4:** grouping, push, defence and Roshan.
5. **Stage 3:** retreat. It only makes sense once there is fight commitment.
6. **Stage 5:** farm.
7. **Stage 6:** gank.
8. **Stage 7:** human feel.

The ranking rule is expected win-rate effect divided by risk, subject to dependencies, with human feel as the tie-break. Revisit the order only if Phase 0 observations contradict the code audit.

**Changed after Phase 0 (2026-11-14):** grouping (stage 4) now comes before retreat (stage 3). The stage numbers are kept as names. The human's main observations were lone heroes dying while the team does something else, and games not being closed out (one tower by 20:00, an 87-minute game with a 4,000 lead at 20:00). Both are grouping problems. Fight still comes first, because grouping without shared fight commitment feeds. Retreat can wait, because the fight stage's `disengage` already pulls the team out together.

## 15. Decision index

All on the map [Smarter bot behaviour](../wayfinder/bot-behavior/map.md):

| Topic | Ticket |
|---|---|
| Running and recording matches | [01](../wayfinder/bot-behavior/tickets/01-how-a-baseline-vs-new-match-can-be-run-and-recorded.md) |
| Valve defaults and takeover options | [02](../wayfinder/bot-behavior/tickets/02-what-valves-default-attack-and-laning-do.md) |
| API perception and command limits | [03](../wayfinder/bot-behavior/tickets/03-what-the-bot-api-lets-a-bot-perceive-and-command.md) |
| Human-like checklist | [04](../wayfinder/bot-behavior/tickets/04-what-human-like-looks-like-behaviour-by-behaviour.md) |
| TypeScript vs Lua | [05](../wayfinder/bot-behavior/tickets/05-whether-new-behaviour-code-is-written-in-typescript-or-lua.md) |
| Measurement | [06](../wayfinder/bot-behavior/tickets/06-how-baseline-vs-new-matches-are-measured.md) |
| Baseline weaknesses | [07](../wayfinder/bot-behavior/tickets/07-record-the-baselines-weaknesses-per-system.md) |
| Takeover | [08](../wayfinder/bot-behavior/tickets/08-whether-attack-and-laning-are-taken-over-for-every-hero.md) |
| Team coordination | [09](../wayfinder/bot-behavior/tickets/09-where-team-level-coordination-lives.md) |
| Stage order | [10](../wayfinder/bot-behavior/tickets/10-which-system-is-designed-first.md) |
| Laning design | [11](../wayfinder/bot-behavior/tickets/11-how-laning-works-for-every-hero.md) |
| Fight design | [12](../wayfinder/bot-behavior/tickets/12-how-bots-pick-targets-and-commit-to-fights-as-a-team.md) |
| Retreat design | [13](../wayfinder/bot-behavior/tickets/13-how-retreat-is-tied-to-the-teams-fight-state.md) |
| Farm design | [14](../wayfinder/bot-behavior/tickets/14-how-farm-is-shared-between-cores.md) |
| Push and defend design | [15](../wayfinder/bot-behavior/tickets/15-how-push-and-defend-are-grouped.md) |
| Gank design | [16](../wayfinder/bot-behavior/tickets/16-how-ganks-are-chosen-and-called-off.md) |
| Mode arbitration | [17](../wayfinder/bot-behavior/tickets/17-how-mode-switching-is-stabilised.md) |
| Human feel | [18](../wayfinder/bot-behavior/tickets/18-human-feel-mechanics.md) |
| Performance budget | [19](../wayfinder/bot-behavior/tickets/19-performance-budget-and-how-it-is-checked.md) |
| Nine override heroes | [20](../wayfinder/bot-behavior/tickets/20-how-the-nine-override-heroes-are-protected.md) |
| Spec shape and sessions | [21](../wayfinder/bot-behavior/tickets/21-shape-of-the-spec-and-implementation-sessions.md) |
