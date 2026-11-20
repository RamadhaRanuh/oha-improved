---
title: How neutral items are given to bots on 7.42
label: wayfinder:grilling
status: closed
assignee: orchestrator
blocked-by: [04-how-neutral-items-reach-bots-and-what-742-breaks.md, 09-which-dirty-or-untracked-files-the-update-may-touch.md]
---

## Question

How do the neutral and enchantment tables change: a flat 4-tier list, or the 7.42 pools with one pick per pool at game start? Which timings, and which actives get logic?

## Resolution

Decided on the agent's recommendation (user waived HITL for this map), 2026-11-20, from [the neutral audit](../research/neutral-items.md).

- **Facts that shape it.** Bots get neutrals only from Buff or FretBots, both console-started server scripts that headless games do not load. Tonight's lobby is the only test of this path. Bot code cannot craft.
- **Gate 1 (both scripts):** four tiers. Tier membership becomes the flat union of the 7.42 pools, ready to paste from the audit: 12 items per tier, cycled-out items removed, and `item_desolator_2` removed everywhere, because a nil `CreateItem` at 60:00 would kill Buff's shared timer and with it neutrals, GPM and XP. Enchantment lists per tier follow 7.42: Greedy only at T3; the Evolved, Timeless and other former T5 sets at T4; Vast, Wise and Boundless removed.
- **Timings keep each script's old offset from the game's own tier times.** Buff: 0/17/32/52 min (it ran 2 min behind the game), turbo halved. FretBots `SettingsDefault.lua`: `maxPerTier = {5,5,5,5}`, `timings = {0, 300, 1200, 3000}`, `timingsDefault = {0, 900, 1800, 3000}`.
- **`SettingsDefault.lua` is dirty**, but the three lines are clean lines away from the user's edits (difficulty and magic-resistance caps). Per [Which dirty or untracked files the update may touch](09-which-dirty-or-untracked-files-the-update-may-touch.md), the edit goes in the worktree; the merge into the main checkout stashes the user's edits and re-applies them. The user hears about this before deployment.
- **Pools per game are not emulated** (bots draw from the full 12 of a tier, while humans see one option per pool). Fairness only, not breakage: moved to fog.
- **Gate 2:** a Brick handler (unit target, enemy, range 600; cast on an enemy hero in a fight, preferring one with a barrier). Flicker cast only when the hero took no hero damage in the last 3 s, or to dispel a debuff. Witchbane cast as a point at the target's location (now `POINT | AOE`, range 700). Correct the stale enchantment cast-range values (`ability_item_usage_generic.lua:1464-1482`).
- **Not done:** Red Ledger (its active only rerolls the bounty list), Kobold Cup (an older gap), dead handlers for cycled-out items (harmless), enchantment level via `SetLevel` (a pre-existing gap; lobby check first).
- **Lobby checks** for the deployment spec: does the engine craft for bot players by itself; what level an enchantment from `CreateItem` gets; neutrals arrive at the new times.

**Correction (2026-11-20, after [the before-patch smoke games](../research/pre-patch-smoke.md)):** bots got 7.42 neutral items headless with neither Buff nor FretBots loaded, so the engine gives neutrals to bot players itself, and the first lobby check above is answered. The decision stands: Buff and FretBots still hand out their own tables when started, so their tables still move to 7.42. Whether a Buff or FretBots item replaces or sits beside the engine's item stays a lobby check.
