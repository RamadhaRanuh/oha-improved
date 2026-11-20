---
title: How neutral items and enchantments reach the bots, and what 7.42's four tiers break
label: wayfinder:research
status: closed
assignee: agent-04
blocked-by: []
---

## Question

Read `bots/Buff/NeutralItems.lua`, `bots/FretBots/NeutralItems.lua`, `bots/FretBots/SettingsNeutralItemTable.lua`, `bots/FretBots/neutrals_data.lua` and any neutral use in `ability_item_usage_generic.lua` and `FunLib`. Answer: which path gives bots neutrals in a normal lobby (Buff, FretBots, the game's own crafting, or several); when each runs; how tier timings and tier count are encoded; what a 4-tier game with 5-tier tables does (tier 5, items that no longer exist, enchantments on the wrong tier). Compare with `research/data/neutral_items-7.42.txt` and the 7.42 notes (lines 545-924) and list the exact new tier membership, enchantment tiers and timings. List new neutrals with actives (Red Ledger, Brick, Flicker) and existing active logic whose items cycled out. Note which of these files have uncommitted user edits (`git status`).

## Resolution

Bots get neutrals only from Buff or FretBots. Both are server scripts that run only when someone types `script_reload_code` at the console, so they never ran in the headless evals. The bot API cannot craft, and whether the engine crafts for bots on its own is unverified. Both scripts hardcode 5 tiers with stale timings: Buff in `Buff/NeutralItems.lua`, FretBots in `SettingsNeutralItemTable.lua` plus `SettingsDefault.lua:63,68,70` (the only dirty file that needs a neutral edit). On 7.42 they give a fifth tier the game no longer has, early T4 power and cycled-out items. Those items still exist in `items.txt`, so they work. The exception is `item_desolator_2`, which no longer exists and may kill the timer at 60:00. Enchantments are probably always level 1 and land on the wrong tiers. Paste-ready 4x4 pools, enchantment levels, and the Brick/Flicker handler gaps: [research/neutral-items.md](../research/neutral-items.md).
