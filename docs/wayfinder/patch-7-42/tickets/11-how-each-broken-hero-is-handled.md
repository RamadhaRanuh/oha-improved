---
title: How each broken hero ability is handled
label: wayfinder:grilling
status: closed
assignee: orchestrator
blocked-by: [01-which-hero-ability-code-breaks-first-half.md, 02-which-hero-ability-code-breaks-second-half.md, 08-what-ships-tonight-and-what-waits.md]
---

## Question

For each hero the audits list: does the deployment write new cast logic, guard the ability off, or only fix names and indices? How are skill builds made robust to slot shifts?

## Resolution

Decided on the agent's recommendation (user waived HITL for this map), 2026-11-20, from the two audits ([first half](../research/hero-abilities-first-half.md), [second half](../research/hero-abilities-second-half.md)), the [before-patch smoke games](../research/pre-patch-smoke.md) and the d2vpkr flag diff ([data/ability-flag-diff-6976-6986.txt](../research/data/ability-flag-diff-6976-6986.txt)).

**How skill builds stay robust to slot shifts:** `aba_skill.lua` `GetAbilityList` is **not** changed (any change there shifts indices for every hero). Instead the level-up code (`ability_item_usage_generic.lua` around :325, the "Skipped to level up" branch) pops an entry, and tries the next one in the same tick, when the ability can never be upgraded again (`GetLevel() >= GetMaxLevel()`). Today such an entry blocks the queue until level 25. This fixes Beastmaster and covers future innate transitions. Entries waiting on a hero-level requirement still wait.

**Gate 1 (errors and stalls):**

| Hero | Change |
|---|---|
| Meepo | Delete the Megameepo and Fling fetches and handlers (`hero_meepo.lua:161-162, 186-187, 703-776` and their call sites) so Earthbind casts again. One attempt to find the `未能购买物品 item_tango : 0` loop (result code 0, 1,021 times); if not found within the time box, leave it (it only spams). |
| Chen | Remove the `chen_summon_convert` fetch and its handler, so Holy Persuasion and Divine Favor cast again. |
| Beastmaster | Both skill builds: index 4 (Inner Beast, innate since before 7.42) becomes 3 (Summon Raptors), so each basic ability still gets 4 points. The generic pop guard above is the backstop. |
| Juggernaut | Remove the Swift Slash `abilityD` / `ConsiderD` path (`hero_juggernaut.lua:133, 166-175, 510-516`): it now points at `generic_hidden`. |

**Gate 2 (misfires and cheap base-kit logic):**

| Hero | Change |
|---|---|
| Chaos Knight | `chaos_knight_armageddon` (innate active, point): cast at the attack target's location when a Phantasm illusion is alive and the target is within 1200. |
| Chen | `chen_zealot` (innate, no target): cast when castable and Chen is not retreating. |
| Lone Druid's bear | Drop the Scepter "no leash" exemptions; keep the bear within 1100 (1300 with Scepter) of the druid (`hero_lone_druid_bear.lua:106-111`, `mode_farm_generic.lua:404`). |
| Monkey King | With Shard and retreating, aim Boundless Strike at the escape location, not at the chaser (`hero_monkey_king.lua:268-289`). |
| Brewmaster | Liquid Courage: `ActionQueue_UseAbilityOnEntity` instead of the location order (line 199; pre-existing, Shard only). |
| Meepo | Treat Universal as AGI in `J.ShouldSwitchPTStat` (`jmz_func.lua:2886-2908`) for Meepo only. |

**No change:** Weaver (the predicted misfire was not observed: `weaver_time_lapse_ally` was cast 4 times), Brewmaster Primal Split (cast 6 times), Leshrac Nihilism (still works; retuning is optional), Pugna Life Drain, Nature's Prophet Curse (dead code, harmless), spell weight and probability lists and Rubick (name lookups with defaults), Morphling and Lifestealer ultimate warnings (the ultimates are cast).

**Deferred (fog):** Scepter and Shard extras (Beastmaster Thunderhide, Dazzle Through the Realm, Undying Zombie Bite, Lone Druid Summon Druid, Brewmaster's fire-brewling Cinder Dash, whose vector direction the API cannot set; Meepo's Shard carry and Fling; Chen's Anoint and self-cast recall), dominated 7.42 creep abilities (`mud_golem_hurl_big_boulder`, `frogmen_water_bubble_small`), talent picks (31 heroes listed across the audits).

**Out of scope:** Lone Druid's poor hero itemization and the bear's `spirit_bear_return` skips, and Invoker's skill skips: all pre-existing on 7.41, not caused by the patch.
