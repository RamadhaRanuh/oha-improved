# Baseline weaknesses: code audit

Asset for [Record the baseline's weaknesses per system](../tickets/07-record-the-baselines-weaknesses-per-system.md). Written 2026-11-13 from reading baseline commit `cb814c6`. Line numbers refer to that commit.

This is the part of the ticket that can be done without running a game. Each item is a weakness that is **confirmed in the code**. Its effect in game is **inferred** unless stated otherwise. The in-game observation is Phase 0 of the spec.

## Cross-cutting

- **Three separate fight brains.** Hero targets are chosen by (a) Valve's default attack mode for about 118 heroes, (b) `FunLib/override_generic/mode_attack_generic.lua` for the nine override heroes, and (c) `mode_team_roam_generic.lua` for every hero (`ConsiderHelpWhenCoreIsTargeted`, `ConsiderHelpAlly`, `CarryFindTarget`, `SupportFindTarget`, all calling `bot:SetTarget`). They score targets differently, so bots on one team can pick different targets in the same fight.
- **Desires outside 0..1 are used as priorities.** `mode_team_roam_generic.lua` returns `1.5` for any last-hittable creep (line 130) and `BOT_MODE_DESIRE_ABSOLUTE * 1.5 / 1.2 / 1.09` in target finders. `mode_farm_generic.lua` (lines 85, 100) and `mode_retreat_generic.lua` (lines 284, 294, 775) return `ABSOLUTE * 1.1` or `* 1.5`. Which mode wins is decided by these hand-picked numbers, not by any shared scale.
- **Mode thrash.** The commented-out guard in `mode_laning_generic.lua:62-70` records it. Only the attack override smooths its desire. Nothing else has hysteresis.
- **Team decisions have no owner.** There is no `team_desires.lua`, so `GetFarmLaneDesire`, `GetPushLaneDesire` and `GetDefendLaneDesire` return Valve's defaults, and each mode reads them per bot.
- **Conflicting beliefs about Lua state.** `jmz_func.lua:3540-3542` says each bot has its own sandbox. Other code relies on module state being shared within a team (see `research/perception-and-command-inventory.md` section 3.1). One of the two is wrong.

## Laning

- **The shim cancels the override.** `mode_laning_generic.lua:200-214` calls the override's `Think()` and then always issues a lane-front move. For the nine heroes this probably cancels Tango use, the safety retreat, the tower-aggro drop and harass (research ticket 02).
- **Team roam competes for last hits.** Team roam's `1.5` last-hit desire beats laning's `0.9` and `0.446`, so during laning, last hits for every hero may be taken by team roam's `Think()`. Its harass and deny rules differ from laning's.
- **No wave management.** Neither scripted laning path avoids attacking non-last-hit creeps, pulls, or manages creep equilibrium. Default laning `Think()` (most heroes) is unknown.
- **Harass is support-only and has no step-back,** so enemy creep aggro is not released (override lines 135-142).
- **The laning desire ladder is time-only** (0.268 / 0.446 / 0.369 / 0.2 / 0.01). It ignores lane state.

## Attack and fight

- **Full-health enemies score 0** in the override's target score, so fights open on the weakest-unit fallback.
- **The team target scorer is dead code.** `J.ScoreEnemyTarget` and `J.GetBestTeamTarget` (`jmz_func.lua:3547-3640`) have no callers outside `jmz_func.lua`.
- **No team-level commit or disengage.** Each bot's engage test (override lines 141-158) and team roam's `#nearbyAllies >= #nearbyEnemies` rule are separate per-bot judgements.
- **Smoothing slows both entering and leaving a fight.** It takes about 0.6 s to pass laning desire.
- **`Think()` reads state up to 300 ms old** (`botLocation`, `botHealth`).

## Retreat

- **Retreat is decided per bot from its own health and nearby counts** (`mode_retreat_generic.lua:120-399`). It has no link to whether the team is committed to a fight, so one bot can leave an even fight.
- **Many branches return fixed tiers or `ABSOLUTE * 1.1`,** which overrides everything else.
- **No retreat pathing rule** beyond the default; whether bots retreat through enemies is to be observed.

## Farming

- **The farm-lane choice reads Valve's default team desires** (`J.GetMostFarmLaneDesire`). No module splits farm between cores.
- **The farm desire cap ramps with time only** (`nFarmCap`, 0.3 to 0.6, line 367). It has no map-awareness rule for missing enemies.

## Push and defend

- **Push is gated on a fixed time,** `StartToPushTime = 16 * 60` (`aba_push.ts:15`). It is not tied to a won fight, enemy deaths or Roshan.
- **Each bot decides per lane whether to push or defend** (`bot.PushLaneDesire[lane]`). No owner decides how many defend or who groups. `Customize.Force_Group_Push_Level` is the only grouping knob.

## Roam and gank

- **`mode_roam_generic.lua` (2015 lines) is a grab bag.** Besides ganking it holds Tango use, waiting in base to heal, fountain exit, chain-frost avoidance, Tinker and Snapfire special cases, and twin-gate use.
- **The gank lane is chosen by distance and simple state** (`CheckLaneToGank`, lines 1011-1105, desire remapped from distance 4000..600). It has no check on whether the target is out of position, and no abort rule beyond the desire dropping.

## Performance

- **171 `GetUnitList` call sites, almost all uncached.** Only `aba_push` uses `global_cache`. `Customize.ThinkLess` exists as a global throttle.

## Observed in game

Phase 0, 2026-11-14 (spec section 4). Sources: the human's notes from watching baseline games, and match 9089167058 (bots only, all flags off, 4x after the first minute, record in [docs/specs/results/phase0.jsonl](../../../specs/results/phase0.jsonl)).

**The human's notes:**

1. **Fights are clunky.** One hero pushes alone and is ganked while the others farm or push elsewhere. Nothing tells the team to help or to stay together.
2. **Early harass and pushing are weak.** Bots do not push when they are ahead.
3. **Bots do not close out games.** This is the human's main complaint.
4. **No individual judgement.** Decisions look global, as if every bot ran the same plan. The human wants each bot to have its own mind plus a shared team mind, as players do.

**From the match record:**

- **The game lasted 87.6 minutes** (5254 s) with 107 kills. Radiant led by 4,000 net worth at 20:00 and still took over an hour more to win.
- **One tower fell in the first 20 minutes** (towers destroyed by 20:00: Radiant 1, Dire 0). This supports note 2 and the fixed `StartToPushTime` gate above.
- **Farm went to the wrong heroes.** At 10:00 Ogre Magi had 51 last hits and Mars 46, against 30 for Gyrocopter, 28 for Sniper and 7 for Lina.

**From the console log:**

- **Invalid orders:** 302 tries to sell unsellable items, 61 tries to use an item from the stash, and 28 tries to pick up an item with no room.
- **A bot stuck in the fountain with a full inventory** (seen by the human). Cause: the "go complete items" teleport in `ability_item_usage_generic.lua` had no distance check and no cooldown, so a bot whose stash could not be used kept teleporting home. Its mode check was also always true (`~= A or ~= B`). Both are fixed in the same change that added this section.
- **20 `Script Runtime Error: error in error handling` lines,** all between 10:06 and 10:07:30 (a stretch of fights), with no file or line. The recorder still took every snapshot, so they are not from the recorder. Cause unknown; watch for them in later games.
- **166 `GetDesire` calls over 2 ms,** spread over all ten heroes.

**What this means for the stage order:** notes 1 and 3 point at fight and grouping. Group push (stage 4) moves ahead of retreat (stage 3), as recorded in spec section 14.
