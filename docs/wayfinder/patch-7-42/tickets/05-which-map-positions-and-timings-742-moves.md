---
title: Which hardcoded map positions and timings 7.42 moves
label: wayfinder:research
status: closed
assignee: agent-05
blocked-by: []
---

## Question

Search Lua and TS for hardcoded positions and times that the 7.42 general notes (lines 1-118 of `research/data/patchnotes-7.42.md`) change: Dire fountain (`jmz_func.lua`, `utils.ts`), mid T1/T2 towers, Twin Gates, flooded and stream-end camps, safelane T1 camp spawn boxes, Tormentor first spawn (20:00 to 15:00), Roshan respawn timer, Glyph (2 charges), siege creep timing, Wisdom Shrine, rune positions. For each: file and line, whether it matters to bot behaviour, and whether the new value can be read at runtime (`GetTower`, `GetShopLocation`, a fountain unit) instead of hardcoded. Mark which values need a headless probe to measure.

## Resolution

Five live hardcodes need 7.42 edits:
- **Dire fountain**: `jmz_func.lua:9`, `ability_item_usage_generic.lua:31`, `utils.ts:26` (TP point, feeds aba_push and aba_defend) and `mode_farm_generic.lua:22`. The estimate is (6714, 6161); a probe must measure it.
- **Tormentor first spawn**: `mode_side_shop_generic.lua:65`, change 20 to 15.
- **Roshan max respawn**: `jmz_func.lua:4985` assumes a fixed 11 min. Count kills and shrink the bound to a 5 min minimum.

Possibly affected:
- **Glyph**: the `GetGlyphCooldown()` gate at `ability_item_usage_generic.lua:8324`. A probe must show what it returns with 2 charges.
- **Mid ward spots**: `aba_ward_utility.lua`, because the mid river geometry changed. A probe should check passability.

Read at runtime already, so no change: towers (`GetTower`), camps (`GetNeutralSpawners`) and runes (`GetRuneSpawnLocation`). Twin gates are only commented-out code, and siege creep timing has no hardcode. Probes P1-P5 are listed in the findings.
Findings: [research/map-and-timings.md](../research/map-and-timings.md)
