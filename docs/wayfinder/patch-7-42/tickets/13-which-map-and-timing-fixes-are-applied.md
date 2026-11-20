---
title: Which map position and timing fixes are applied
label: wayfinder:grilling
status: closed
assignee: orchestrator
blocked-by: [05-which-map-positions-and-timings-742-moves.md, 08-what-ships-tonight-and-what-waits.md]
---

## Question

Of the positions and timings the map audit lists, which change in this update, and is each hardcoded anew or read at runtime?

## Resolution

Decided on the agent's recommendation (user waived HITL for this map), 2026-11-20, from [the map audit](../research/map-and-timings.md).

All map fixes are **Gate 2** (none of them raises an error or stalls; the old Dire fountain point is about 300 units from the new one, well inside the fountain's own area).

- **Dire fountain:** measure it with probe P1 in the first Gate 2 smoke game: a temporary, uncommitted print at 0:00 of every building unit's name and location, `GetShopLocation(team, SHOP_HOME)`, and `IsLocationPassable` of the old point. Then **hardcode the measured coordinates** in all five places (`jmz_func.lua:9`, `ability_item_usage_generic.lua:31`, `utils.ts:26` rebuilt to `utils.lua`, `mode_farm_generic.lua:22`, and the TP point next to it). Reading the fountain at runtime is not adopted: it is unconfirmed, and the constants are read in 140+ places that expect a fixed vector. The TP point moves by the same offset as the fountain.
- **Tormentor first spawn:** `mode_side_shop_generic.lua:65` becomes 15 min (turbo 7.5, the old turbo-to-normal ratio). One line.
- **Roshan respawn:** `IsRoshanAlive()` (`jmz_func.lua:4985`) counts Roshan kills from changes of `GetRoshanKillTime()` and uses `max(5, 11 - kills)` minutes (turbo: halved, floor 2.5) as its bound. Probe P4 (four Roshan kills) is not run; the bound is conservative and documented as unverified.
- **Not changed:** Glyph (2 charges; the gate on `GetGlyphCooldown()` can only make bots glyph less, not error; P5 deferred), mid ward, mine and rune go-out spots (P2 deferred to fog: a ward on a blocked spot fails silently), Twin Gates (only commented-out code), camps, towers and runes (read at runtime), the Buff XP table (number-only, out of scope).
