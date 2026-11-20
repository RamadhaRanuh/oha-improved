---
title: What the deployment must include tonight and what waits
label: wayfinder:grilling
status: closed
assignee: orchestrator
blocked-by: []
---

## Question

Tonight's lobby is the deadline. Which severity classes (error, stall, misfire, missing) and which areas (abilities, items, neutrals, map, talents, docs) must the deployment cover, and which are deferred?

## Resolution

Decided on the agent's recommendation (user waived HITL for this map), 2026-11-20.

Two gates, merged separately so the lobby is safe even if time runs out:

- **Gate 1, must ship:** every **error** and **stall** (Lua errors, nil calls, skill builds that point at missing or moved slots, purchase lists naming removed items), the neutral and enchantment tables for 4 tiers (wrong or missing items are a stall for that system), the registry entries for new items that any build or fallback names, and the `PATCH_UPDATE_GUIDE.md` "Last updated for" line with 7.42 lessons.
- **Gate 2, ships if verified in time:** **misfire** fixes for reworked abilities (wrong cast type or target, e.g. a vector-targeted Primal Split), and **missing** logic only where it is cheap and the ability is on the base kit (not Scepter or Shard sub-abilities). Cheap map fixes the audit marks as affecting behaviour (fountain, Tormentor first spawn).
- **Deferred (fog):** Scepter and Shard sub-abilities, new 7.42 items in builds beyond replacing removed ones, talent preferences, using new mechanics (Greater Horn of Battle, Glyph charges), re-tuning for number changes.
- **Ordering inside a gate:** heroes the bots actually pick first. Hero-pool weighting is whatever `hero_selection.lua` uses today; the deployment does not change it.
