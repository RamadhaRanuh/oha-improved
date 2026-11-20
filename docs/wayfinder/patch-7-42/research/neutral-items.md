# Neutral items and enchantments on 7.42: how bots get them, what breaks

Ticket: [04](../tickets/04-how-neutral-items-reach-bots-and-what-742-breaks.md). Researched 2026-11-20, read only.

Sources: repo code at `c3389e8` plus the working tree; `research/data/neutral_items-7.42.txt` (d2vpkr, same build as the local client; byte-identical to the scratchpad copy); `research/data/patchnotes-7.42.md` lines 545-924; d2vpkr `items.txt` for 7.42 (scratchpad `d2/items.txt`; it has `item_red_ledger`, `item_brick`, so it is the 7.42 file); the dota2-bot-dev skill's `references/items.md` for the 7.41 tier snapshot.
Tags: **[Confirmed]** read in a primary source; **[Inferred]** follows from code, not run; **[Unverified]** needs a lobby check.

## 1. Which path gives bots neutrals

Three possible paths. In a plain lobby, none of them is shown to give bots anything.

| Path | What starts it | Runs in |
|---|---|---|
| Game crafting (madstones, `item_madstone_bundle`, `item_tierN_token`) | always on | engine |
| Buff (`bots/Buff/Buff.lua`) | console: `sv_cheats 1; script_reload_code bots/Buff/buff` | server VM |
| FretBots (`bots/FretBots.lua`) | console: `sv_cheats 1; script_reload_code bots/FretBots` after hero selection starts | server VM |

- **[Confirmed]** No bot-side code crafts or picks neutrals. A grep for `madstone`, `craft` or `token` over `bots/` (Buff and FretBots excluded) finds nothing. The bot API has no crafting call: it is missing from the skill's `api-*.md` and from `docs/BOT_API_REFERENCE.md`. Bot code only *reads* slot 16 (`FunLib/aba_item.lua:1023-1070`, `:1287-1345`). Those helpers index `tNeutralItemLevelList`, which is never defined, and nothing calls them, so this is dead code.
- **[Unverified]** Whether the engine crafts for bot players by itself. Check in a lobby with no script loaded: look at `GetItemInSlot(16)` on a bot at about 16:00.
- **[Confirmed]** Buff and FretBots only run from the console. `bots/Buff/README.md` gives the command for Buff. `FretBots.lua:1-3` refuses to start before hero selection, and `research/match-running-and-recording.md:114` records how FretBots is loaded. No tracked bot file requires either one. `hero_selection.lua:163,171` reads only the data files `FretBots/matchups_data` and `FretBots/HeroNames`. `docs/TESTING.md:44` says FretBots is not loaded in headless games. So the eval batches had no Buff or FretBots neutrals.
- Use **either Buff or FretBots, not both**. Both give items into slot 16 and both remove enchantments.
- **Buff**: `Buff.lua:83-103` is a single 1 s timer. It calls `NeutralItems.GiveNeutralItems` (line 84), then GPM, then XP.
- **FretBots**: `BonusTimers:Register` (`BonusTimers.lua:516-527`) starts `NeutralItemFindTimer` (`:153-202`). That calls `AwardNeutralToBot` (`:106-147`), which draws 5 random items of the tier from `AllNeutrals` (`NeutralItems.lua:214-231`) and gives the bot the one it scores highest (`:309-326`).
  - `NeutralItemFindTimer___` (`:205-325`) is dead: it is never registered. It is the only caller of `GetBestItems` and so of `StaticNeutralsMatchup` (`FretBots/neutrals_data.lua`, required at `:19`). That table is stale (it still lists 7.41 items) but never read.
  - `NeutralItemDoleTimer` is not registered either.

### Untracked and dirty files
- **[Confirmed]** Nothing tracked loads `bots/Buff/script/` (`neutrals.py`, `neutrals_data.lua`, `matchups*`), `Buff/{Spells,SpellsMore,Towers,Facets}.lua`, `bots/API/` or the untracked FunLib files. `Buff.lua:7-12` loads only tracked Buff files plus `FretBots.Chat`. A `git grep` for those paths returns no hits, and every require or dofile in tracked FretBots and Buff files resolves to a tracked file.
- The user's uncommitted edits in `AwardBonus.lua`, `BonusTimers.lua`, `Settings.lua` and `SettingsDefault.lua` are all about the magic-resistance cap and the backend difficulty cap. None of them is about neutrals.
- **SettingsDefault.lua does need a neutral edit.** Lines 63, 68 and 70 (`maxPerTier`, `timings`, `timingsDefault`) are clean lines inside that dirty file.
- **No edit needed** in `AwardBonus.lua`, `BonusTimers.lua` or `Settings.lua`. The 5-slot arrays in `BonusTimers.lua:50,58,62-70` are harmless: the loops are driven by `Settings.neutralItems.maxPerTier` (`:81,169,192`) and `timings[tier+1]` (`:131`), and the code that uses `maxTier=5` (`:380`) belongs to the unregistered dole timer.
- Files to change, all clean: `Buff/NeutralItems.lua`, `FretBots/SettingsNeutralItemTable.lua`, and optionally the comment in `FretBots/NeutralItems.lua:425-441`.

## 2. How tier count and timing are encoded

**Buff** (`Buff/NeutralItems.lua`):
- Tier count is hardcoded as 5 flags (`:6-10`), 5 arrays (`Tier1NeutralItems` `:13-41`, T2 `:43-67`, T3 `:69-93`, T4 `:95-121`, T5 `:123-145`) and 5 `if` blocks.
- Timings are written inline: T1 at 0 (`:231`), T2 at 17:00 (`:248`), T3 at 27:00 (`:265`), T4 at 37:00 (`:282`), T5 at 60:00 (`:299`). In turbo they are 8.5, 13.5, 18.5 and 30 min.
- Enchantments are a flat list with `tier = 1..5` (`:147-206`). `GetRandomEnhanByTier(nTier)` (`:208`) picks one at random.

**FretBots**:
- `SettingsDefault.lua:63` `maxPerTier = {5,5,5,5,5}`; `:68` `timings = {0, 420, 1020, 2020, 3600}` (the bot lead); `:70` `timingsDefault = {0, 1020, 1620, 2020, 3600}`; `:72` `variance = {30, 240}`.
- The difficulty shift is `(timingsDefault[t] - timings[t]) * (1 - min(difficultyScale, 2))` (`NeutralItems.lua:442-445`).
- Item tiers are set per row in `SettingsNeutralItemTable.lua`: T1 `:13-40`, T2 `:47-74`, T3 `:82-99`, T4 `:112-135`, T5 `:141-163`. Enchantments are rows with `tier = 1..5`: T1 `:171-176`, T2 `:179-188`, T3 `:191-200`, T4 `:203-212`, T5 `:215-222`.
- Set against 7.41's real tiers (0/15/25/35/60 min, per skill `items.md`), `timingsDefault` was already stale for T2-T4.

**Enchantment level (both scripts)**:
- **[Inferred]** Both scripts call `CreateItem(enhancement.name)` + `AddItem` and never `SetLevel` (`Buff/NeutralItems.lua:334-336`, `FretBots/NeutralItems.lua:139-141`; a grep for `SetLevel` in FretBots and Buff only finds hero abilities in `SpellsMore.lua`). So the `tier` field only chooses which *name* is given. The enchantment is probably always level 1.
- **[Unverified]** Check `GetLevel()` on a given enchantment in a lobby.
- In 7.42's KV the number after each enchantment is its level at that neutral tier (§4).

## 3. What a 4-tier 7.42 game does with the current tables

- **An extra fifth tier.**
  - Buff gives "T5" items at 60:00, after the game's last tier (50:00).
  - FretBots gives them at about 3600 s plus variance.
  - The game's T4 power arrives early: Buff gives old-T4 items at 37:00, FretBots at 2020 s (33.7 min), against 50:00 in the game.
  - FretBots T3 is at 1020 s (17 min) against 30:00 in the game.
- **Cycled-out items are still given, and they work.**
  - **[Confirmed]** Every cycled-out name is still defined in 7.42 `items.txt` with `ItemIsNeutralActiveDrop 1`: dagger_of_ristul `:15263`, duelist_gloves `:15614`, occult_bracelet `:15001`, essence_ring `:13361`, medallion_of_courage `:10361`, poor_mans_shield `:3698`, searing_signet `:16979`, cloak_of_flames `:14231`, flayers_bota `:18053`, giant_maul `:17469`, unrelenting_eye `:16758`, spider_legs `:12989`, enchantments vast/wise/boundless/greedy `:16247/16553/16526/16608`.
  - So `CreateItem` succeeds and bots hold out-of-rotation items that humans cannot get. That is a fairness issue, not a crash.
- **One name does not exist: `item_desolator_2`** (Buff `:125`, FretBots `SettingsNeutralItemTable.lua:148`).
  - 7.42 `items.txt` has only `item_stygian_desolator` (`:12011`). The 7.41 `neutral_items.txt` snapshot (skill `items.md:35`) used `item_desolator_2`, so the item was either renamed or always mismatched. Either way it is cycled out now.
  - **[Inferred]** When it rolls, `CreateItem` returns nil and `item:SetPurchaseTime(0)` throws. **[Unverified]** This assumes `HasRoomForItem` with a bad name returns true.
  - Both Timers libraries run callbacks under `xpcall` and do not re-arm a timer that errors (`Buff/Timers.lua:61-91`, `FretBots/Timers.lua:62-92`).
  - In Buff that kills the single timer, so neutrals, GPM and XP all stop for the rest of the game. This can only happen from 60:00.
  - In FretBots it kills `NeutralItemFindTimer`, and only neutral awards stop.
- **Enchantments land on the wrong tier.**
  - Buff gives Greedy, Vast and Vampiric at T2 and T3, Brawny and the other base enchantments at T4, and Boundless and Wise at T5.
  - FretBots gives Greedy at T2 and the base set at T4. In 7.42, T4 is only the old-T5 set plus Timeless.
  - The level is probably always 1 anyway (§2).
- **Misfire in item logic.** `ability_item_usage_generic.lua:1464-1482` adds cast range for enchantments by game time:
  - Keen-eyed is +125/+135 in the code but +100/+120 in the 7.42 KV (`items.txt:16669`). Also, the `>=15 min` branch is tested first, so +135 is never reached.
  - Mystical adds +100 at 35 min, but 7.42 Mystical has no cast range.
  - Boundless is +350 in the code and 275 in the KV, and Boundless is no longer in the pool.
  - These are small range misestimates, not errors.

## 4. Exact 7.42 tiers and enchantments (from `neutral_items-7.42.txt`)

Each tier has 4 pools of 3 items, and the game picks 1 item per pool at game start. The KV has `trinket_options 5`, `enhancement_options` 4 at T1 and 5 at T2-T4, and `craft_cost` 6/10/10/14 (T4 `recraft_cost 6`). Unlimited Madstone starts at 65:00 (KV `:5`; notes `:548-555`).

```lua
-- Tier 1, 0:00 (KV :10-102)
{ -- pool_a
  "item_chipped_vest", "item_ash_legion_shield", "item_possessed_mask",
  -- pool_b
  "item_dormant_curio", "item_red_ledger", "item_weighted_dice",
  -- pool_c
  "item_polliwog_charm", "item_seeds_of_serenity", "item_foragers_kit",
  -- pool_d
  "item_kobold_cup", "item_stonefeather_satchel", "item_pogo_stick" }
-- Tier 2, 15:00 (KV :103-199)
{ "item_psychic_headband", "item_safety_bubble", "item_metamorphic_mandible",
  "item_jidi_pollen_bag", "item_brick", "item_crippling_crossbow",
  "item_imp_claw", "item_gunpowder_gauntlets", "item_defiant_shell",
  "item_partisans_brand", "item_spellslinger", "item_mana_draught" }
-- Tier 3, 30:00 (KV :200-295)
{ "item_prophets_pendulum", "item_dandelion_amulet", "item_idol_of_screeauk",
  "item_balmhook", "item_rattlecage", "item_stormcrafter",
  "item_enchanters_bauble", "item_ceremonial_robe", "item_harmonizer",
  "item_vile_phial", "item_serrated_shiv", "item_revenants_brooch" }
-- Tier 4, 50:00 (KV :296-383)
{ "item_fallen_sky", "item_flicker", "item_minotaur_horn",
  "item_mind_breaker", "item_divine_regalia", "item_heavy_blade",            -- Witchbane
  "item_helm_of_the_hivemind", "item_dezun_bloodrite", "item_conjurers_catalyst",
  "item_giants_ring", "item_demonicon", "item_riftshadow_prism" }
```

Enchantments, written as `name=level`. Each attribute group is what a hero of that attribute is offered. Buff and FretBots ignore attribute, so the union line is the flat list to paste.

| Neutral tier | global | str | agi | int | universal | union (flat) |
|---|---|---|---|---|---|---|
| 1 | quickened=1, vital=1 | brawny=1, tough=1 | alert=1, brawny=1 | mystical=1, tough=1 | alert=1, mystical=1 | quickened, vital, brawny, tough, alert, mystical (all lvl 1) |
| 2 | quickened=2, vital=2 | brawny=2, tough=2, crude=1 | alert=2, brawny=2, nimble=1 | mystical=2, tough=2, keen_eyed=1 | alert=2, mystical=2, titanic=1 | above 6 at lvl 2; crude, nimble, keen_eyed, titanic lvl 1 |
| 3 | quickened=3, greedy=1 | brawny=3, tough=3, crude=2 | alert=3, brawny=3, nimble=2 | mystical=3, tough=3, keen_eyed=2 | alert=3, mystical=3, titanic=2 | quickened, brawny, tough, alert, mystical lvl 3; crude, nimble, keen_eyed, titanic lvl 2; greedy lvl 1 (vital drops out) |
| 4 | timeless, evolved, fleetfooted, vampiric | hulking | audacious | feverish | manic | those 8, lvl 1 |

The notes agree: base enchantments now have levels 1-3, Crude, Nimble, Keen-eyed and Titanic have 2-3, Greedy only appears at T3, and the old T5 set plus Timeless moves to T4 (notes `:830-924`). Vast, Wise and Boundless are in no pool.

**Diff against the current tables.**
- T1: add red_ledger, seeds (from T2), pogo (from T2). Drop duelist_gloves, occult_bracelet, dagger_of_ristul.
- T2: add safety_bubble, brick, imp_claw, psychic_headband, jidi, gunpowder, partisans, spellslinger (from T3), and metamorphic_mandible (from T4). Drop essence_ring, searing_signet, poor_mans_shield, medallion.
- T3: add balmhook, ceremonial_robe, vile_phial, revenants_brooch, pendulum, dandelion, idol, rattlecage, bauble (from T4), and harmonizer (from T5). Drop cloak_of_flames, unrelenting_eye.
- T4: add flicker, mind_breaker, helm_of_the_hivemind, giants_ring, and fallen_sky, minotaur, regalia, heavy_blade, dezun, demonicon, riftshadow (from T5). Drop giant_maul, flayers_bota.
- T5: delete. desolator_2 and spider_legs are cycled out.
- Most "new" names are already commented out in Buff (e.g. safety_bubble `:18`, ceremonial_robe `:79,111`, mind_breaker `:105`, giants_ring `:132`) and in FretBots (`SettingsNeutralItemTable.lua`: safety_bubble `:22`, imp_claw `:60`, mind_breaker `:108`, ceremonial_robe `:111`, flicker `:117`, giants_ring `:143`), so their rows and role weights can be uncommented and retiered. Red Ledger, Brick, Balmhook, Vile Phial, Helm of the Hivemind and Revenant's Brooch need new rows.

**Suggested FretBots settings** (options, not decided):
- `maxPerTier = {5,5,5,5}` and `timingsDefault = {0, 900, 1800, 3000}`.
- `timings = {0, 300, 1200, 3000}`. This keeps the old lead of -600 s at T2 and T3 and no lead at the last tier.
- Buff: 0 / 15 / 30 / 50 min. **[Unverified]** The turbo times; the KV has none.
- Both scripts: set the enchantment level from the table above (`enha:SetLevel(n)` or the equivalent; **[Unverified]** that this API works on items).
- Optional: simulate the pools by choosing 1 of 3 per pool per team at game start, so bots pick from the same 4 options humans see.

## 5. Item actives: new 7.42 neutrals and dead handlers

Dispatch: `ability_item_usage_generic.lua:1000-1030` loops over slots 0-5, 15 and 16 and calls `X.ConsiderItemDesire[name]` only if `J.CanCastAbility(hItem)` (`FunLib/jmz_func.lua:861-874`), which rejects passives. A handler for an item nobody holds, or for a passive item, never runs. **[Confirmed]**

7.42 pool items with an active and no handler (AbilityBehavior from `items.txt`):

| Item | KV | Behaviour | Value for bots |
|---|---|---|---|
| `item_red_ledger` (T1) `:18826` | NO_TARGET, IMMEDIATE, CD 120, no mana | casting only rerolls the bounty list (notes `:568-575`); the gold works passively | skip; no handler needed |
| `item_brick` (T2) `:18351` | UNIT_TARGET enemy, range 600, CD 30, no mana, 150 phys + 200 barrier dmg, proj 1400 | worth adding: cast on an enemy hero in a fight, especially one with a barrier | add `sCastType='unit'` handler |
| `item_kobold_cup` (T1) `:17269` | NO_TARGET, CD 40, 40 mana, +10% MS aura 1000 r, 8 s | already in the pool before 7.42, no handler (old gap) | optional: cast on team engage or team retreat |

- `item_flicker` (T4, `:12902`) has a handler at `:6204`. It casts when silenced or rooted while attacking, and on retreat when `WasRecentlyDamagedByAnyHero(3.0)`.
  - In 7.42 Flicker does **not move** the hero if it took enemy-player damage in the last 3 s (notes `:751-753`). The retreat case then gives only a basic dispel, and the bot wastes the blink.
  - Fix: on retreat, cast only when not damaged in the last 3 s, or keep the cast for dispel only.
- `item_heavy_blade` (Witchbane) has a handler at `:6505` that uses `sCastType='unit'`. The 7.42 KV says `POINT | AOE`, radius 300, range 700 (`items.txt:14758`). **[Unverified]** whether a unit order works on a point item. This is not new in 7.42 (the 7.41 type was not checked).
- Other actives in the 7.42 pools already have handlers: ash_legion_shield `:6013`, polliwog `:7985`, seeds `:7151`, stonefeather `:7246`, pogo `:6438`, psychic_headband `:7450`, mandible `:6150`, jidi `:6105`, crossbow `:8130`, mana_draught `:7970`, idol `:6094`, fallen_sky `:6290`, minotaur `:8218`, demonicon `:7903`, riftshadow `:6183`.
- All the other new or returning items are PASSIVE: safety_bubble, imp_claw, balmhook, ceremonial_robe, revenants_brooch, vile_phial, giants_ring, helm_of_the_hivemind, mind_breaker (and foragers_kit, dezun, regalia, harmonizer, conjurers).

**Dead handlers for cycled-out items** (harmless; they never run unless Buff or FretBots still hand the item out):
- dagger_of_ristul `:7214`
- essence_ring `:5991`
- medallion_of_courage `:3590`
- flayers_bota `:6055`
- spider_legs `:6196`

Handlers that are dead because the item is now passive:
- stormcrafter `:6385`
- revenants_brooch `:6564`

The other cycled-out items (duelist, occult, poor man's, searing, cloak, giant_maul, unrelenting_eye, stygian) have no handlers. Leaving the dead handlers costs nothing. Delete them only for tidiness.

**Cross-ticket notes** (item registry, not neutrals):
- `aba_item.lua:313,796` still lists `item_revenants_brooch` as a shop item (`GetItemComponents(...)[1]`). In 7.42 it is a neutral with `ItemPurchasable 0` (`items.txt:15582`).
- `aba_chat.lua:239` and `enemy_role_estimation.lua:143` (and its `.ts`) name `item_desolator_2`, which is only a lookup key there and harmless.

## Open questions for a lobby run
1. With no Buff or FretBots loaded, does a bot ever get a slot-16 item (engine auto-craft)?
2. What does `GetLevel()` return on an enchantment from `CreateItem`, and does `SetLevel` raise it?
3. What do `HasRoomForItem` and `CreateItem` do with a bad name (`item_desolator_2`)?
