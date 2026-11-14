# Valve's default attack and laning modes, and how other scripts replace them

Research for ticket [02](../tickets/02-what-valves-default-attack-and-laning-do.md). Researched 2026-11-12 against baseline commit `cb814c6`.

Every claim is tagged:

- **[C]** confirmed: read directly in this repo's code or git history, or in another project's source or README.
- **[D]** documented by Valve, taken from the `dota2-bot-dev` skill reference `references/architecture.md`, which summarises the Valve Developer Community page. The VDC page itself returned HTTP 403 to every fetch in this session, so these were not re-read at the source.
- **[I]** inferred from code or API semantics; not observed in a running game.
- **[R]** community-reported (forum, workshop discussion); unverified.

## Summary

1. Valve does not document what the default attack and laning modes do. The defaults are closed C++; only their existence, call cadence and debug overlays are documented. Anything more specific is inference or needs an in-game observation.
2. The nine-hero override is not this project's invention. Upstream `ryndrb/dota2bot` gates the same two files on the same hero list (minus Lone Druid's bear). No source states why those heroes break under the defaults.
3. The local laning override is probably not doing most of what it appears to do: the shim in `bots/mode_laning_generic.lua` issues a positioning move after the override's `Think()` returns, on every frame (see "Shim fall-through").
4. Among the public scripts read, nobody replaces attack and laning for all heroes while staying inside the mode system. Projects either keep Valve's `Think()` for both (and tune desires), or abandon the mode system altogether with a full takeover.
5. The main known costs of taking over are: per-frame Lua work for ten bots, losing default behaviours that cannot be reproduced from Lua (VUL-FT documents bounty-rune pickup as one), and taking responsibility for `bot:SetTarget()`, which 168 files here read through `J.GetProperTarget`.

## 1. What the default attack and laning modes do

### Documented

- [D] Modes are scored continuously; the highest-scoring mode is active and is the only thing that issues actions for that bot. A function not implemented in a `mode_<mode>_generic.lua` file falls back to the default C++ implementation. This is why a file that defines only `GetDesire()` keeps Valve's `Think()`.
- [D] `GetDesire()` is called about every 300 ms and returns 0..1. `Think()` is called every frame while the mode is active. `OnStart()`/`OnEnd()` fire on mode transitions.
- [D] Difficulty changes last-hit timing: Passive/Easy randomise by up to 0.4 s on enemy creeps and 0.2 s on allied creeps; Medium by 0.2 s / 0.1 s. This implies the default laning logic both last-hits and denies, and times the attack.
- [D] `dota_bot_select_debug` draws the selected bot's last-hit target (blue) and attack target (red). `dota_bot_select_debug_attack` shows how much that bot wants to attack each nearby enemy. This implies the default attack mode computes a per-enemy attack desire rather than a single yes/no.
- [D] "Hero power" is the average damage a hero could deal to each enemy over 5 s, plus stun duration and half its slow duration, respecting mana and cooldowns. It is offence only and ignores durability.
- [C] The ModDota API page is a function reference only. It does not describe default mode behaviour. Relevant entries: `SetTarget` "Causes no actions, but is used for coordinating between modes and ability/item usage"; `GetEstimatedDamageToTarget` "Uses no positional/situation info"; `GetLaneFrontLocation` "Always ignores towers". Source: <https://docs.moddota.com/lua_bots/>.

### Not documented (the gap)

Nothing found in a primary source describes, for the defaults: how the attack target is chosen, what inputs raise attack desire, whether laning harasses, how tower aggro or creep aggro is handled, how the bot positions relative to the lane front, or what either mode ignores. The debug overlays above are the only first-party way to observe these.

### Inferred and community-reported

- [I] The default attack mode sets the bot's target. `J.GetProperTarget` reads `bot:GetTarget()` first and falls back to `GetAttackTarget()` (`bots/FunLib/jmz_func.lua:335-347`), and 168 Lua files call it; `J.IsGoingOnSomeone` treats `BOT_MODE_ATTACK` as "fighting" (`jmz_func.lua:1539-1547`) and 162 files call it. Per-hero ability logic for the ~118 non-override heroes therefore depends on the default mode publishing a target.
- [I] Default laning positions the bot near the lane front. Both local replacements re-implement this with `GetLaneFrontLocation` minus the longest enemy attack range, which suggests the authors were imitating observed behaviour.
- [R] Default mode files can return desires above 1 (reported range 0 to about 1.4) in a 2017 r/dota2AI thread. Unverified.
- [R] A Steam workshop discussion states that scripts keeping Valve's laning decide who takes last hits from built-in hero data rather than from script roles. Unverified.

### Evidence from this repo about default weaknesses

These are things the authors worked around, which points at what the defaults get wrong. All [C] as code; the weakness itself is [I].

- Laning desire is overridden for everyone (`bots/mode_laning_generic.lua:32-122`) with a fixed time/level ladder: 0.268 in the first 10 s, 0.446 until 9:00 and level 7, 0.369 until 12:00 and level 11, then 0.2 and finally 0.01. `adamqqqplay/dota2ai` uses the same ladder, so the numbers are inherited.
- Laning is switched off when enemies are near the ancient, when the bot was recently hit by a hero and is not stronger, and when the team is pushing tier 2 or high ground (`mode_laning_generic.lua:72-92`). The default evidently stays in lane in those cases.
- A pos 1 bot with a human pos 5 gets a scripted last-hit `Think()` (`mode_laning_generic.lua:97-108`, `175-216`), which suggests default last-hitting was judged not good enough for a carry a human is supporting.
- The commented-out "switching modes too often" guard (`mode_laning_generic.lua:62-70`) records mode thrash around laning.

## 2. Why nine heroes have overrides

- [C] The table lists Muerta, Marci, Lone Druid's bear, Primal Beast, Dark Willow, Elder Titan, Hoodwink, Io and Kez (`bots/FunLib/utils.lua:723-733`, `typescript/bots/FunLib/utils.ts:36-46`).
- [C] It was introduced in `f676370` (2024-06-26) with seven heroes. The same commit contains a commented-out block that force-moved a "buggy bot" back to its assigned lane front when it was more than 1500 units away in the first three minutes, with the log text "Relocating the buggy bot". A similar commented-out block remains in `bots/FunLib/aba_global_overrides.lua:352-365`.
- [C] `1e49d33` (2024-07-19): "Generic implementation of attack and laning logic for buggy heroes such as IO, Muerta, etc, as the initial step for better support." The files were first under `FunLib/bugged_heroes_generic/`. Io and the bear were added then; Kez later.
- [C] `bots/hero_selection.lua:115-139` says of the weak-hero list "some have bugs from Valve side" and labels Marci, Lone Druid, Primal Beast, Dark Willow, Hoodwink and Io "Buggys (as of 2024/8/1)". The README lists "Better support for bugged heroes".
- [C] Upstream `ryndrb/dota2bot` has the same gate as `J.IsNonStableHero` with eight heroes (Lone Druid commented out): `FunLib/jmz_func.lua` around line 5263.
- [I] The symptom was that these heroes did not lane or fight under the default modes (the relocation hack only makes sense if they wandered off or stood still). **No source states the actual cause.** It is not simply "heroes Valve never wrote a default bot for", because other such heroes are not on the list.
- [C] `cb814c6` (2026-04-02, the baseline) rewrote both override files. Its message lists the intent: damage-based engagement checks, target multipliers, kiting, fog chase and desire smoothing for attack; lane-partner last-hit suppression, combined safety retreat and tower avoidance for laning. `90a555a` the day before added last-hit priority over harass, "cores never harass", tower-aggro drop and support-only harass.

## 3. What the two override files do

Paths below are relative to `bots/`. Since the default is undocumented, "differently from the default" can only be stated as "what is explicitly scripted here".

### 3.1 Attack override: `FunLib/override_generic/mode_attack_generic.lua`

Wiring: `mode_attack_generic.lua:12-21` loads it with `dofile` and defines all four mode functions, only for heroes in the table. Other heroes get no functions from this file, so the default runs.

**Desire** (`Generic.GetDesire`, lines 30-223). Every return except one passes through `GetActualDesire` (lines 414-419), an exponential smoothing with alpha 0.3.

| Step | Lines | Rule |
|---|---|---|
| Hard off | 31-36 | Dead, illusion, or under fountain fury swipes: `NONE` (unsmoothed). |
| One-shot clear | 38 | If `Think()` found nothing to do last frame (`bClearMode`), return 0 once (unsmoothed). |
| Creep damage | 56-64 | Laning phase: if creeps targeting the bot within 600 would deal 25% or more of current health over 5 s, `NONE`. |
| Ultimate windows | 67-77 | Marci Unleash or Muerta Pierce the Veil with more than 3 s left, enemies present, not outnumbered by 2+, HP above a threshold: `ABSOLUTE`. |
| Per-enemy check | 84-160 | For each visible enemy hero within 1600 (laning) or 6 s of travel (later): sum 3 s estimated damage of allies who can reach it in 6 s and are attacking or near it, plus allied tower damage (97-114); sum 3 s estimated damage to the bot from every enemy within 6 s of travel with HP at least 25%, plus enemy tower damage (124-139). |
| Laning poke | 117-121 | Laning, not damaged by a hero in 3 s or a creep in 2 s, allies at least equal in number, enemy inside attack range, not retreating: `VERYHIGH`. |
| Engage test | 141-158 | `b1`: team stronger, ally damage at least 20% of enemy health, own health above 1.15x incoming. `b2`: numbers at least equal, ally damage at least 30%, same health test. `b3`: a team-fight location is within 10 s of travel. Any true: `VERYHIGH`, or `ABSOLUTE` for `b3`, or `MODERATE` if the enemy is far. During laning, if already attacking and a tower is hitting the bot: `VERYLOW` (148-152). |
| Help ally | 163-194 | Supports always, cores after laning: if an ally within 4000 is attacking a hero and numbers are at least equal or that ally is stronger: `VERYHIGH`, remembering the ally's location. |
| Fog chase | 197-218 | Target lost for 0.5 to 3 s, last seen within 1200 of its extrapolated position, numbers at least equal or stronger: `VERYHIGH`. |
| Default | 222 | `NONE`. |

**Target choice** (`Generic.Think`, lines 283-338). Enemy heroes within 1200 are scored, skipping illusions and targets under Borrowed Time, Reaper's Scythe, Wraith King scepter form, Battle Trance, Enrage, Cold Embrace, Blade Mail or Aeon Disk (286-297). Score is a product (324-327):

`min(1, attackRange / distance)` x `(1 - enemyHP%) x 5 s damage from allies already in attack mode` x hero multiplier x `exp(remap(allies - enemies, -4..4 -> 0..1.6)) - 1`

Hero multipliers are hard-coded (302-318): Sniper 4, Lina and Shadow Fiend 3, Jakiro 2.5, Drow and Crystal Maiden 2, Bristleback facing away and Enchantress at level 6+ 0.5, cores x1.5, supports x0.5, enemies within 800 of their tower x0.5 in early and mid game. If nothing scores above 0 it falls back to `J.GetAttackableWeakestUnit` (336-338).

**Think actions**, in order:

1. Run 800 units away from Pugna or Rubick while life-drained, or from Razor while linked (236-252).
2. Step out of range of an attacker in Helm of the Undying or Wraith King scepter form (255-265).
3. Outside a team fight, if a tower is targeting the bot and all units targeting it would deal 20% or more of health in 3 s, move 800 away from the tower (268-279).
4. With a target: `SetTarget`, then melee moves to the target and attacks in range (350-360); ranged attacks in range, and if the target cannot be attacked holds roughly 100 inside max range (362-376).
5. Otherwise move to the helped ally's location (381-384), or to the best of five offsets around the last-seen position by `GetUnitPotentialValue` (387-408).
6. If none applied, set `bClearMode` so the next `GetDesire()` returns 0 (410).

**Observations** (all [C] from reading; consequences [I]):

- The score is multiplicative and includes `(1 - enemyHP%)`, so every full-health enemy scores 0. At the start of a fight target selection therefore rests on the weakest-unit fallback, not on the multipliers. The damage term counts team members in attack mode within 1200 of the enemy (`J.GetSpecialModeAllies`, `FunLib/jmz_func.lua:3189-3208`), which includes the bot itself, so it rewards piling onto a target allies are already fighting.
- Smoothing means a jump from 0 to `VERYHIGH` takes two `GetDesire()` ticks (about 0.6 s) to pass the 0.446 laning desire and five or more to approach its target. It also delays leaving a fight. `bClearMode` and the hard-off returns bypass smoothing but do not reset `fLastAttackDesire`.
- `Think()` reads `botLocation`, `botHealth` and `botName` that are only refreshed in `GetDesire()`, so they are up to 300 ms stale.
- `J.ScoreEnemyTarget` and `J.GetBestTeamTarget` (`FunLib/jmz_func.lua:3547`, `3632`), added in the same commit as "team target scoring", have no callers outside `jmz_func.lua`. The override does not use them.
- `GetDesire()` runs a nested loop (each enemy x each ally, then each enemy again) with several `J.GetAlliesNearLoc` / `J.GetEnemiesNearLoc` calls per enemy. `Think()` re-scores all nearby enemies every frame.

### 3.2 Laning override: `FunLib/override_generic/mode_laning_generic.lua`

Wiring is a wrapper, not a clean delegate. `mode_laning_generic.lua` defines `GetDesire()` for all heroes and `Think()` only when the hero is in the table **or** is pos 1 with a human pos 5 (`mode_laning_generic.lua:175`). That condition is evaluated once, at file load.

**Desire.** The shim runs first (`mode_laning_generic.lua:32-109`): the global off-conditions, then `0.9` if a last-hittable creep exists during the laning phase (97-108), then the override's `X.GetDesire` (line 109). The override (`override_generic/mode_laning_generic.lua:18-38`) returns `ABSOLUTE` if a Tango should be eaten, else the same ladder with a longer tail (0.228 until level 15 and 12k average core net worth, then `VERYLOW` instead of 0.01). It also assigns the lane from position instead of `GetAssignedLane()` (40-55).

**Think in the override** (`X.Think`, lines 60-162), in order: eat Tango (71-75); retreat 1200 behind the lane front if a hero is targeting the bot after recent hero damage, a tower is targeting it, or creeps damaged it outside tower aura (78-84); drop tower aggro by attacking an enemy creep near the tower (87-97); back off 800 from an enemy tower when fewer than 3 enemy creeps are near (100-106); last-hit, with a support deferring to a live core partner within 800 (109-125); deny an allied creep under 49% that one hit kills (128-132); support-only harass of the first enemy within attack range + 150 when at most one enemy creep is within 600 (135-142); otherwise move to the lane front minus the longest enemy attack range plus a random 300 offset, re-issued every 0.05 to 0.2 s (145-161).

Last-hit choice is the first creep in the list that `J.WillKillTarget` says will die to one attack after the projectile delay, with a Quelling Blade bonus (167-186). There is no preference between creep types and no pre-positioning in this file.

**Shim fall-through** ([C] as code, [I] as effect). The shim's `Think()` (`mode_laning_generic.lua:176-215`) does this each frame:

1. Its own last-hit check using an 800-radius creep list and a "nearly killable" creep to walk towards (177-191), returning if it acted.
2. Its own deny (193-198), returning if it acted.
3. Calls the override's `Think()` (200-202) **without returning afterwards**.
4. Always issues `Action_MoveToLocation` to the lane-front position (204-214).

`Action_*` commands replace the bot's current action, so step 4 supersedes whatever the override issued in step 3 in the same frame. If that holds in game, the override's Tango use, safety retreat, tower-aggro drop, tower avoidance, lane-partner deferral and harass never take effect for the nine heroes; they effectively run the shim's last-hit, deny and stand-at-lane-front. The lines date from 2024-12 and 2025-01, before the override was rewritten, so the rewrite in `cb814c6` did not account for them. This needs a one-line in-game check (does a buggy hero ever eat a Tango or step back from tower aggro while laning) and is worth recording as a baseline defect either way.

Two further consequences: the support deferral in the override is bypassed because the shim's own last-hit check runs first and only defers when another core is within 700 and the bot is pos 3-5; and the override's Tango `ABSOLUTE` desire is only reached when the shim has not already returned 0.9 for a last hit.

## 4. How other public scripts structure attack and laning

File links point at each repo's default branch as fetched on 2026-11-12.

| Project | Attack | Laning | Team-level state |
|---|---|---|---|
| [ryndrb/dota2bot](https://github.com/ryndrb/dota2bot) (direct ancestor of this repo's layout) | [`mode_attack_generic.lua`](https://github.com/ryndrb/dota2bot/blob/HEAD/mode_attack_generic.lua): whole file wrapped in `if J.IsNonStableHero(...)`, so default for everyone else | [`mode_laning_generic.lua`](https://github.com/ryndrb/dota2bot/blob/HEAD/mode_laning_generic.lua): scripted `GetDesire()` for all, scripted `Think()` only for the eight heroes | None; no `team_desires.lua` |
| [adamqqqplay/dota2ai](https://github.com/adamqqqplay/dota2ai) (Ranked Matchmaking AI) | No `mode_attack_generic.lua` at all: pure default | [`mode_laning_generic.lua`](https://github.com/adamqqqplay/dota2ai/blob/HEAD/mode_laning_generic.lua): 49 lines, `GetDesire()` ladder only, default `Think()` | [`team_desires.lua`](https://github.com/adamqqqplay/dota2ai/blob/HEAD/team_desires.lua) implements push-lane desires |
| [furiouspuppy/Dota2_Bots](https://github.com/furiouspuppy/Dota2_Bots) | None at repo root: default | [`mode_laning_generic.lua`](https://github.com/furiouspuppy/Dota2_Bots/blob/HEAD/mode_laning_generic.lua): `OnStart()` only | `team_status.lua` helper |
| [yewchi/vulft](https://github.com/yewchi/vulft) (VUL-FT) | [`mode_attack_generic.lua`](https://github.com/yewchi/vulft/blob/HEAD/mode_attack_generic.lua): stub returning desire 0 | [`mode_laning_generic.lua`](https://github.com/yewchi/vulft/blob/HEAD/mode_laning_generic.lua): stub returning desire 0 | Own task/analytics libraries; [`team_desires.lua`](https://github.com/yewchi/vulft/blob/HEAD/team_desires.lua) returns zeros |
| [Nostrademous/Dota2-FullOverwrite](https://github.com/Nostrademous/Dota2-FullOverwrite) | [`modes/fight.lua`](https://github.com/Nostrademous/Dota2-FullOverwrite/blob/HEAD/modes/fight.lua) inside its own mode system | [`modes/laning.lua`](https://github.com/Nostrademous/Dota2-FullOverwrite/blob/HEAD/modes/laning.lua) | `team_think.lua`, `global_game_state.lua`, `enemy_data.lua` |

Findings, all [C] from the files and READMEs:

- **Desire-only on top of defaults** is the mainstream approach (adamqqqplay, ryndrb for 100+ heroes, this repo). ryndrb's laning `GetDesire()` adds one anti-thrash trick this repo lacks: if laning's desire exactly ties the active mode's desire, it subtracts 0.05 (lines 11-23). It also separates lane partners sideways by 320 units and prefers ranged creeps, then flagbearers, when choosing last hits and denies.
- **Scripted `Think()` for a short hero list** is the ryndrb pattern this repo copied. The baseline attack override here is a reworked version of ryndrb's: same `bClearMode` idiom, same Pugna/Razor escapes, same fog chase idea.
- **Full takeover** projects stop using Valve's modes. VUL-FT runs everything from `bot_generic.lua` with its own task blueprints ([`lib_task/blueprint/fight/`](https://github.com/yewchi/vulft/tree/HEAD/lib_task/blueprint/fight) holds separate files for harass, kill commit, chase, bait, rolling disengage and punish-overcommit). Nostrademous implements a per-hero `Think()` and its own `Desire`/`Think`/`OnStart`/`OnEnd` mode classes with a team-think layer; its README calls it a work in progress and it covers a few dozen heroes.
- furiouspuppy's README states the limitation of staying inside the mode system: "my bots still fall victim to the decision making of the default bot code quite often".
- No project read here replaces attack and laning `Think()` for every hero while keeping Valve's other modes. That middle path is untested ground in public code.

Not checked: BOT EXPERIMENT (Arizona Fauzie) and the `insraq/dota2bots` and `lenLRX/Dota2_DPPO_bots` repos were found but their attack/laning files were not read.

## 5. Known costs of taking over a mode for all heroes

- **Default behaviour that cannot be reproduced.** [C] VUL-FT's developer README says its author could not make full-takeover bots pick up river bounty runes and had to hand control back to default bots for under 1.5 s near a rune ([`README.dev.md`](https://github.com/yewchi/vulft/blob/HEAD/README.dev.md), [`partial_full_handover.lua`](https://github.com/yewchi/vulft/blob/HEAD/partial_full_handover.lua)). It also warns that mixing default and scripted control risks "item management being interrupted by default bots". That is evidence for full takeover, not for a single-mode takeover, but it shows defaults do things the API does not expose.
- **Unknown default internals.** [I] Because the defaults are undocumented, a takeover cannot list what it is dropping. Candidates that the local overrides had to re-implement by hand: positioning at the lane front, tower-aggro handling, creep-aggro handling, last-hit timing against projectile delay, and the difficulty-based last-hit randomisation ([D] the difficulty modifiers are stated to still apply to taken-over bots, but whether the last-hit timing jitter applies to a scripted `Action_AttackUnit` is not stated).
- **Target publication.** [I] A scripted attack mode must call `bot:SetTarget()` itself, as the override does at line 347, or the 168 files that use `J.GetProperTarget` lose their target.
- **Performance.** [D] `Think()` runs every frame per bot; `GetUnitList` lists can be long and should not be iterated every frame; `GetNearby*` radius must stay below 1600. [C] VUL-FT's README says it avoids abstraction specifically for per-frame cost. [C] This repo's history shows performance work on the same files (`997b76b` "Changed frame calc frequency", `ce8ed32` "cache think"). [I] The baseline attack override's nested hero loops run for at most one or two bots per game today; extending them to ten bots multiplies that cost and has not been measured.
- **Regression surface.** [I] Moving ~118 heroes off behaviour that has been stable for years onto new Lua changes every hero at once, and only in-game lobbies can verify it.
- **Thrash.** [I] A scripted desire competes with the fixed ladders in other modes. The override's smoothing and ryndrb's tie-break are both attempts to manage this; neither is proven.

## What this means for the takeover decision

Realistic options, with the trade-offs each carries:

1. **Keep the defaults, tune desires only.** Lowest risk and cost, and it is what the most widely used scripts do. It cannot fix anything inside default `Think()`: target choice, trading, creep equilibrium and tower-dive behaviour stay Valve's. The "feel more human" goal is hard to reach this way.
2. **Take over laning `Think()` for all heroes, keep default attack.** Laning is the more self-contained mode and two working reference implementations exist (this repo's, ryndrb's). The shim already runs a scripted laning `Think()` for pos 1 with a human support, so there is some field exposure. Cost: last-hit quality for every hero now depends on `J.WillKillTarget`, and the fall-through defect has to be fixed first or the result cannot be evaluated.
3. **Take over attack for all heroes, keep default laning.** Highest potential gain for bot-vs-bot results (focus fire, disengage) and the natural home for team-level targeting. Highest risk: every hero's ability logic keys off attack mode and its target, the baseline override has never run on more than nine heroes, and its scoring gives every full-health enemy a score of 0, as noted above.
4. **Take over both for all heroes.** Maximum control and one consistent model. Combines the risks of 2 and 3, and no public script has done it inside the mode system, so there is no reference for what breaks.
5. **Staged takeover behind a switch.** Extend the existing table-gate idea: a per-hero or per-team flag choosing default or scripted, widened as lobbies confirm it. Costs a second code path to maintain while both exist, but allows A/B lobbies (one team default, one scripted) and protects the nine override heroes. It also fits the map's requirement that only a human can run lobbies.
6. **Full takeover via `bot_generic.lua`.** Out of proportion to the destination. It discards the mode system that every other file in this repo is built on, and VUL-FT documents default behaviours that could not be recovered.

Whichever is chosen, two facts should feed the decision: the laning override's real behaviour is unverified because of the shim fall-through, and nobody knows what the default attack mode does well, so a short in-game observation with `dota_bot_select_debug` and `dota_bot_select_debug_attack` on a default hero is the cheapest way to replace inference with evidence.

## Open unknowns

- What the default attack mode actually uses to choose targets and raise desire. Only observable in game with the debug overlays.
- Why the nine heroes break under the defaults, and whether they still do on 7.41a.
- Whether the shim fall-through cancels the override's actions in practice.
- Whether difficulty last-hit jitter applies to scripted attacks.
- Per-frame cost of the attack override at ten bots.
- The Valve wiki page could not be fetched in this session; its content here comes from the skill reference summary.

## Sources

Local (baseline `cb814c6`):

- `bots/mode_attack_generic.lua`, `bots/mode_laning_generic.lua`
- `bots/FunLib/override_generic/mode_attack_generic.lua`, `bots/FunLib/override_generic/mode_laning_generic.lua`
- `bots/FunLib/utils.lua:723-733`, `typescript/bots/FunLib/utils.ts:36-46`
- `bots/FunLib/jmz_func.lua` (`GetProperTarget`, `IsGoingOnSomeone`, `ScoreEnemyTarget`, `GetBestTeamTarget`)
- `bots/hero_selection.lua:110-139`, `bots/FunLib/aba_global_overrides.lua:352-365`
- Commits `f676370`, `1e49d33`, `997b76b`, `715c6a0`, `90a555a`, `cb814c6`
- `dota2-bot-dev` skill, `references/architecture.md`

Web:

- Valve Developer Community, Dota Bot Scripting: <https://developer.valvesoftware.com/wiki/Dota_Bot_Scripting> (not fetchable this session, HTTP 403)
- ModDota Lua bot API: <https://docs.moddota.com/lua_bots/>
- <https://github.com/ryndrb/dota2bot>
- <https://github.com/adamqqqplay/dota2ai>
- <https://github.com/furiouspuppy/Dota2_Bots>
- <https://github.com/yewchi/vulft>
- <https://github.com/Nostrademous/Dota2-FullOverwrite>
