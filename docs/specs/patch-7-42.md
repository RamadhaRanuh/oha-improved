# Patch 7.42 deployment spec

The destination of the [Patch 7.42 support](../wayfinder/patch-7-42/map.md) map (2026-11-20). Everything below is decided; the deployment session applies it without deciding anything. Each line links the ticket that holds the reasoning. Grilling decisions were taken on the agent's recommendation; the user waived the human side of grilling for this map.

Covers 7.41b-f (number and recipe-cost changes only; nothing to do) and 7.42 (client build 6986).

## Setup

- Branch `patch-7-42` from `smarter-bot-behaviour` HEAD, worktree `../oha-wt/patch742` (node_modules junction as in TESTING.md; `rmdir` it before `git worktree remove`). [07](../wayfinder/patch-7-42/tickets/07-where-the-update-lands-and-ships.md)
- Patch-only commits, one per area, each after `npm run build` and `npm run check`. TS sources change with their Lua. Nothing is pushed.
- Never edit or commit untracked files. Of the dirty FretBots files, only three clean lines of `SettingsDefault.lua` change. [09](../wayfinder/patch-7-42/tickets/09-which-dirty-or-untracked-files-the-update-may-touch.md)

## Gate 1: must ship tonight

### Commit 1: items [10](../wayfinder/patch-7-42/tickets/10-how-removed-items-are-replaced-in-builds.md)

- Replace removed build items in place:
  - Khanda becomes `item_caduceus` for Bounty Hunter pos 1-3 and Zeus pos 1-2.
  - Khanda becomes `item_greater_crit` for Luna pos 1 (shared) and Morphling pos 1-2.
  - Khanda becomes `item_ethereal_blade` for Tinker pos 2-3.
  - Helm of the Overlord becomes `item_vladmir` for Beastmaster pos 3.
  - Lycan pos 3-5: delete the Helm of the Overlord entry.
- `aba_item.lua`:
  - Add `GetItemComponents` entries and list entries for Caduceus, Bloodslinger, Ristul's Devotion, Sabatons (`item_berserkers_sabatons`), Skypiercer, Starforge and Quarterstaff.
  - Remove `item_javelin` from `sBasicItems`.
  - Comment out the Helm of the Overlord and Khanda entries ("removed in 7.42").
- `ability_item_usage_generic.lua`: register `item_caduceus` with the Force Staff handler (:2406).
- `typescript/bots/FunLib/aba_site.ts:1250`: Beastmaster's farm gate checks `item_helm_of_the_dominator`. Rebuild.
- `item_purchase_generic.lua` guard: on `PURCHASE_ITEM_INVALID_ITEM_NAME` or `PURCHASE_ITEM_DISALLOWED_ITEM`, print once and pop the item.

### Commit 2: neutrals [12](../wayfinder/patch-7-42/tickets/12-how-neutral-items-are-given-on-742.md)

- **Buff/NeutralItems.lua** and **FretBots/SettingsNeutralItemTable.lua**:
  - Use four tiers, each the flat union of the 7.42 pools (lists ready in [research/neutral-items.md](../wayfinder/patch-7-42/research/neutral-items.md)).
  - Drop the cycled-out items, and `item_desolator_2` everywhere.
  - Use the 7.42 enchantment tiers: Greedy at T3, the former T5 sets at T4, and Vast, Wise and Boundless removed.
- **Timings:**
  - Buff: 0/17/32/52 min, halved in turbo.
  - `FretBots/SettingsDefault.lua` lines 63, 68 and 70: `maxPerTier = {5,5,5,5}`, `timings = {0, 300, 1200, 3000}`, `timingsDefault = {0, 900, 1800, 3000}`.
- **FretBots/neutrals_data.lua:** drop `item_desolator_2` and the cycled-out entries where they would be given by name.

### Commit 3: heroes [11](../wayfinder/patch-7-42/tickets/11-how-each-broken-hero-is-handled.md)

- **Level-up guard** in `ability_item_usage_generic.lua` (the "Skipped to level up" branch, about :325): when `GetLevel() >= GetMaxLevel()`, pop the entry and try the next one in the same tick.
- **Meepo:** delete the Megameepo/Fling fetches and handlers (`hero_meepo.lua:161-162, 186-187, 703-776` and their call sites). Make one time-boxed attempt at the `未能购买物品 item_tango : 0` loop.
- **Chen:** remove the `chen_summon_convert` fetch and handler.
- **Beastmaster:** in both skill builds, index 4 becomes 3.
- **Juggernaut:** remove the Swift Slash `abilityD` / `ConsiderD` path.

### Commit 4: docs

- `docs/PATCH_UPDATE_GUIDE.md`:
  - "Last updated for: Patch 7.42 (November 2026)".
  - Lessons: innate transitions that the notes never mention (Beastmaster Inner Beast); diff d2vpkr hero KV flags, not only slot names; hero-file errors are swallowed, so smoke by casts and inventory; obsolete items stay in `items.txt`, so a name check against `items.txt` passes while the shop refuses them.
- `CLAUDE.md` and `docs/ARCHITECTURE.md`: "Patch 7.42".

### Gate 1 verification [14](../wayfinder/patch-7-42/tickets/14-how-the-update-is-verified.md)

1. Run `npm run build` and `npm run check`. Then run a throwaway name gate:
   - No removed item or ability name may remain outside comments in tracked `bots/` or `typescript/bots/`.
   - Every build item and every Buff/FretBots neutral name must be in `research/data/items-7.42.md` (shop items) or the 7.42 neutral pools.
2. Swap pairs 5-8 of the worktree's `measurement-lineups.md` (uncommitted) to the lineups of [15](../wayfinder/patch-7-42/tickets/15-what-current-code-does-on-742-headless.md). Run four smokes at once: `npm run batch -- smoke none --game=<17|21|25|29> --until=35 --name=p742a-g<n>`.
3. **Pass** needs every one of these:
   - `smokecheck` PASS.
   - No `未能购买物品` except the known Meepo tango line, if that was not fixed.
   - No `Skipped to level up` for Beastmaster.
   - Lycan, Beastmaster, Morphling and Tinker inventories still change after 30:00.
   - Meepo casts `meepo_earthbind`; Chen casts `chen_holy_persuasion`.
   - A 7.42-only neutral shows in `ITEM` lines by 16:00.
4. Compare against `research/data/pre-patch-smoke-analysis.txt` (run the same analyser). Each fix round has at most two replays; if a fix still fails after that, report it instead.
5. Merge Gate 1 into `smarter-bot-behaviour` in the main checkout:
   - `git stash` the user's FretBots edits, merge, then `git stash pop`.
   - Check that the pop applied cleanly, because `SettingsDefault.lua` is in both.

## Gate 2: ships if verified in time

- **Heroes** [11](../wayfinder/patch-7-42/tickets/11-how-each-broken-hero-is-handled.md):
  - Chaos Knight Armageddon: point cast at the target, when a Phantasm illusion is alive and the target is within 1200.
  - Chen Zealot: cast when castable and Chen is not retreating.
  - Lone Druid's bear: leash within 1100, or 1300 with Scepter.
  - Monkey King: with Shard, aim the retreat Boundless Strike at the escape point.
  - Brewmaster Liquid Courage: use an entity order.
  - Meepo: Universal treads count as AGI.
- **Items and neutrals** [10](../wayfinder/patch-7-42/tickets/10-how-removed-items-are-replaced-in-builds.md), [12](../wayfinder/patch-7-42/tickets/12-how-neutral-items-are-given-on-742.md):
  - Heaven's Halberd range 500.
  - A Brick handler: enemy hero within 600, preferring one with a barrier.
  - Flicker: cast only without hero damage in the last 3 s, or to dispel.
  - Witchbane: point cast at the target's location.
  - Correct the enchantment cast-range values (`ability_item_usage_generic.lua:1464-1482`).
- **Map** [13](../wayfinder/patch-7-42/tickets/13-which-map-and-timing-fixes-are-applied.md):
  - Dire fountain: in the first Gate 2 smoke, an uncommitted probe P1 prints the building units' names and locations at 0:00. Hardcode the measured position in `jmz_func.lua:9`, `ability_item_usage_generic.lua:31`, `utils.ts:26` (TP point, same offset) and `mode_farm_generic.lua:22`.
  - Tormentor first spawn: 15 min (turbo 7.5), at `mode_side_shop_generic.lua:65`.
  - `IsRoshanAlive()`: bound of `max(5, 11 - kills)` min (turbo halved, floor 2.5), with kills counted from `GetRoshanKillTime()` changes.
- **Verification:** Gate 1's pass still holds, and each Gate 2 hero ability appears in `CAST` lines. Then merge as in Gate 1.

## Lobby checklist for the user (Buff and FretBots are not loaded headless)

- After `script_reload_code bots/FretBots` (or Buff), bots receive neutrals at the new times, and only 7.42 items.
- No console errors from `FretBots/` or `Buff/`.
- See whether a script-given neutral replaces the engine's own neutral or sits next to it, and what level enchantments come in at.
- Lycan, Beastmaster, Morphling, Tinker, Luna, Zeus and Bounty Hunter finish their builds.

## Deferred

The map's "Not yet specified" section lists the deferred work:
- Scepter and Shard extras.
- New items in builds.
- Talent picks (31 heroes).
- Neutral pool emulation.
- Mid ward spot and Glyph probes.
- New mechanics (Greater Horn of Battle, Glyph charges).
