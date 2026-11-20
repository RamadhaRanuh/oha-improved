# Which item code stalls or misfires in 7.42

Ticket: [03](../tickets/03-which-item-code-stalls-or-misfires.md). Sources: the code at `smarter-bot-behaviour` (`c3389e8` plus the dirty tree), d2vpkr 7.42 `scripts/npc/items.txt` (raw, matches the installed client), [items-7.42.md](data/items-7.42.md), [patchnotes-7.42.md](data/patchnotes-7.42.md) lines 119-544, and 124 headless 7.41 batch logs in `datasets/runs/*/console.g*.log`. Line numbers are for the current tree.

## Summary

| Item | Referenced at | Runtime effect on 7.42 | Severity | Fix |
|---|---|---|---|---|
| `item_angels_demise` (Khanda) | `BotLib/hero_bounty_hunter.lua:67,90,113` (pos 1-3), `hero_luna.lua:42` (pos 1, copied to 2-5), `hero_morphling.lua:60,74` (pos 1, 2; pos 3-5 copy pos 1), `hero_tinker.lua:38,58` (pos 2, 3; pos 1 copies 3), `hero_zuus.lua:49,85` (pos 2, 1) | The purchase queue stops at Khanda. At best the bot waits until it holds more than 2x the item's cost (about 11.2k gold if `GetItemCost` returns 5600) for 180 cumulative seconds, then skips it. At worst it never buys another build item. Everything after Khanda is delayed or never bought (Luna: Satanic, Butterfly, Moon Shard...). Details below. | **stall** | Replace it in every build (ticket 10). Add the guard below. |
| `item_helm_of_the_overlord` | `hero_beastmaster.lua:76` (pos 3, 3rd entry after the outfit and HotD), `hero_lycan.lua:92` (pos 3, copied to 4-5) | The same stall, and earlier in the game: Beastmaster pos 3 stalls around minute 10 with Aghs, Blink, Halberd, AC and Heart all behind it. If the recipe is still returned as a component, the bot first buys an Ultimate Orb (2800) it cannot finish. | **stall** | Replace it in builds. Remove it from `aba_item.lua:785`. |
| `item_helm_of_the_overlord` | `FunLib/aba_site.lua:1104` / `typescript/bots/FunLib/aba_site.ts:1250` (Beastmaster farm timing) | `not HasItem(HotO) and NW < 14000` is now true until 14k net worth, so Beastmaster prefers farming over grouping until then. | misfire | Change it to the replacement item in the **.ts** and rebuild. |
| `item_helm_of_the_overlord` | `ability_item_usage_generic.lua:2969,2991` | Dead branch: no bot can own the item. | none | Optional cleanup. |
| `item_angels_demise` | `FunLib/aba_item.lua:810` | `GetItemComponents(...)[1]` evaluates at load and does not throw (see A1). Either it is nil or it still holds Phylactery + Soul Booster. | none (feeds the stall) | Comment it out with `-- removed in 7.42`. |
| `item_javelin` | `FunLib/aba_item.lua:154` (`sBasicItems`), `aba_chat.lua:22` | `sBasicItems` is read only by `Item.HasBasicItem` (`aba_item.lua:1405`), and nothing calls that function. The chat table only translates names. No build lists Javelin. Maelstrom, MKB and Bloodthorn use `GetItemComponents`, so they take the 7.42 recipes. | none | Remove it from `sBasicItems` (cosmetic). |
| `item_helm_of_the_overlord` | `aba_chat.lua:179` | Name translation only. | none | Optional. |
| Recipe changes (Bloodthorn, Butterfly, MKB, Maelstrom, MoM, Halberd, Abyssal, Harpoon, Crimson, Orb of Corrosion, Witch Blade) | `aba_item.lua:574-777`, all via `GetItemComponents(x)[1]` | They pick up the 7.42 recipes from the client. The hardcoded arrays (`phase_boots:702`, `power_treads*:706-712`, `ultimate_scepter:756`, `yasha:768`) still match 7.42 (items-7.42.md:180,187,241,259). No build lists a component the 7.42 recipes dropped (grep for claymore, broadsword, orb_of_venom, javelin, talisman and diadem as standalone entries: only Slark's broadsword, which feeds Shadow Blade). | none | None for 7.42. Pre-existing: `item_broken_bfury:914` (Claymore, an old recipe) and `item_broken_silver_edge:912` do not match current recipes. Only the PvN-mode `PvN_antimage:989` uses one. |
| Heaven's Halberd active | `ability_item_usage_generic.lua:2887` `nCastRange = 700` | 7.42 cast range is 500, so the bot orders Disarm from up to 700 and walks 200 units into the target first. | misfire (minor) | Use `hItem:GetCastRange()` or 500. |
| Meteor Hammer / Starforge active | No `ConsiderItemDesire` entry anywhere (grep) | Never cast. This was already true before 7.42, and Starforge inherits it. | missing | Add a ground-target entry (ticket for new items). |
| Tranquil Boots "Break" renamed to "Respite" | No `modifier_item_tranquil*` reference in Lua or TS. In items.txt the values are still `break_time`, `break_count`, `break_threshold` | The rename is in the UI only. | none | None. |
| Crimson Guard | `ability_item_usage_generic.lua:1885,1903` (`modifier_item_crimson_guard_nostack`), `mode_side_shop_generic.lua:258` (`_extra`) | Modifier names are not in items.txt and cannot be checked from data. Nothing in the patch suggests a rename. | unknown, low | Confirm in game (ticket 15). |
| `advanced_item_strategy` | `typescript/bots/FunLib/advanced_item_strategy.ts` lines 215 and 218 use invalid names `item_pipe_of_insight` and `item_battlefury` | No Lua file `require`s it, so it is dead code with no runtime effect. If it is ever wired in, those names hit the same stall. | none today | Fix the names in the .ts only if it gets wired in. |
| `enemy_role_estimation` | `.ts` lists core items such as `item_daedalus`, `item_desolator_2` and `item_stormcrafter` | It only reads enemy inventories. No removed item is listed. The new carry items (Skypiercer, Sabatons, Starforge) do not count toward "core". | minor misfire | Optionally add the new items, in the .ts. |

New items (Quarterstaff, Bloodslinger, Caduceus, Ristul's Devotion, Sabatons, Skypiercer, Starforge, Greater Horn): none is referenced anywhere except `item_quarterstaff`, which is already in `sBasicItems:164` (unused). No hero buys them, so nothing breaks. Gaps are listed under "New-item needs".

## A. What happens to a removed item in a purchase list

### A1. The removed items still exist in the 7.42 data, marked obsolete

`items.txt` still defines all three, plus the recipes, with `"IsObsolete" "1"`:

- `item_javelin` (items.txt:417): cost 900, `IsObsolete 1`.
- `item_recipe_angels_demise` (3254): cost 0, `ItemPurchasable 0`, `IsObsolete 1`, requirements `item_phylactery;item_soul_booster`. `item_angels_demise` (3281): `ItemPurchasable` is set to `0` (with `IsObsolete 1`) and again to `1` further down, cost 5600.
- `item_recipe_helm_of_the_overlord` (9061): cost 300, `ItemPurchasable 0`, `IsObsolete 1`, requirements `item_helm_of_the_dominator;item_ultimate_orb`. `item_helm_of_the_overlord` (9086): `ItemPurchasable 0`, `IsObsolete 1`, cost 5650.

They are missing from every `shops.txt` pool (items-7.42.md lines 9-19), and that is why they are "removed". The other obsolete items in 7.42 are already absent from every buy list: `eternal_shroud`, `wraith_pact`, `hood_of_defiance`, `necronomicon*`, `iron_talon`, `stout_shield`, `nether_shawl`, `tome_of_knowledge` and others.

So the API does not see these as unknown names. It sees defined items that cannot be bought. The repo does not establish how `GetItemComponents`, `GetItemCost` and `GetItemStockCount` treat an obsolete item: Valve documents only "returns components / cost / stock count" (`docs/BOT_API_REFERENCE.md:554-581`, `bots/API/api_global.lua:121-132`). What is established:

- `GetItemComponents(name)` returns a table, never nil, even for names that do not exist. `aba_item.lua:821-831` indexes `GetItemComponents('item_new_1')[1]` through `item_new_6` at load, inside the `require` that every bot depends on. If the function returned nil, that line would throw and no bot would run. For an empty result, `[1]` is nil and `Item[name]` stays nil. `Item.GetComponentList` (`aba_item.lua:554-558`) relies on the same assumption.
- In 124 batch logs of 7.41 games with debug prints on (`[Purchase] Skipping item_boots` lines show that `print` works), the failure print `未能购买物品` never appears. The failure branch therefore never ran on 7.41 builds.

### A2. How a list entry is expanded

1. At load, `item_purchase_generic.lua:47-50` copies `sBuyList` in reverse into `bot.purchaseListInReverseOrder`. Item names are not validated at any point. `J.SetUserHeroInit` (`jmz_func.lua:39-56`) can swap in a Customize list; none of the Customize files mention the removed items.
2. When there is no current target, `item_purchase_generic.lua:1195-1207` takes the top entry and calls `Item.GetBasicItems({name})` (`aba_item.lua:1177-1208`). It recurses through `Item[v]`, and if `Item[v] == nil` it returns `v` itself as a "basic item" (`1194-1196`). It skips components the hero already holds (`IsItemInHero`, slots 0-8, `1144-1174`).
3. The components are interleaved (`1198-1202`), copied to `currBuyingBasicItemRefList`, and counted.
4. Each frame, while the list is non-empty, `GeneralPurchase` (`192-363`; Turbo: `TurboModeGeneralPurchase` `366-437`) buys the last entry:
   - `itemCost = GetItemCost(name)` (`199`). Purchases are gated on `bot:GetGold() >= cost` (`307`).
   - On `PURCHASE_ITEM_SUCCESS` it pops (`344-348`).
   - On failure: if `GetItemStockCount(name) < 1` it pops silently (`350-353`). Otherwise it prints `未能购买物品 <name> : <code>` and does **not** pop (`354-355`). Then `_antiSpamPurchase` (`158-165`) retries every 0.4 s.
   - The return code is never checked for `PURCHASE_ITEM_INVALID_ITEM_NAME` or `PURCHASE_ITEM_DISALLOWED_ITEM` (constants listed at `docs/BOT_API_REFERENCE.md:1704-1712`).
5. When the list is empty but the target is not in the inventory (`1210-1246`):
   - It rebuilds the missing parts via `Item.GetReducedPurchaseList`, at most 3 times per game in total (`bot.rebuildCount`, `1228`). The counter resets only on ARDM or position swap (`563`, `628`).
   - After that, `countInvCheck` increases by one per second **only while** `botGold > 2 * GetItemCost(target)` and `botGold >= 2000` (`1242-1243`).
   - The target is skipped once `countInvCheck > 180` (normal mode), or `> 30` in ARDM (`1220`).

### A3. The outcomes for Khanda and Helm of the Overlord

Which branch runs depends on two unknowns: whether `GetItemComponents` still returns the obsolete recipe (C), and whether `GetItemStockCount` of an unbuyable item is `< 1` (S).

| Case | What the bot does | Result |
|---|---|---|
| **C yes** (Khanda resolves to Phylactery + Soul Booster) | It buys every basic part, so Phylactery and Soul Booster get assembled (5600 g). The obsolete zero-cost recipe probably does not combine them into Khanda, which is unverified. The list empties, `IsItemInHero(Khanda)` stays false, and the rebuild finds nothing missing. | **Stall** until gold > ~11.2k has been held for 180 s. The bot hoards gold and buys nothing else from its build, which for a carry late in the game means roughly 10-15 min. It ends up holding two items it did not plan to build. |
| **C yes**, HotO resolves to HotD + Ultimate Orb + `item_recipe_helm_of_the_overlord` | HotD is already owned, so it is skipped. The bot buys the Ultimate Orb (secret shop), then the recipe purchase fails (`ItemPurchasable 0`). | With S `<1`: silent pop, then 3 rebuilds that each re-add the recipe and fail again, then the gold > ~11.3k for 180 s stall. With S `>=1`: **permanent stall**, printing every 0.4 s. |
| **C no** (`Item[x]` is nil) | The basic list is `{ 'item_angels_demise' }`. The bot saves up to `GetItemCost` (5600 if it returns the data cost, 0 if not), then the purchase fails. | With S `<1`: silent pop. `GetReducedPurchaseList` re-adds the item 3 times, then the gold > 2x cost for 180 s stall. With S `>=1`: **permanent stall**. `countInvCheck` only counts up in the empty-list branch, so nothing ever skips the item. |

**In every case the build stalls, from many minutes up to the whole game.** In the silent-pop cases no `未能购买物品` line appears. Ticket 15 should therefore check the `ITEM team= hero=` lines too: for those heroes, no `+item_` after the item before Khanda or HotO, and gold climbing in MATCHREC. Grepping for the failure print alone is not enough. A one-off probe at load would settle C and S: `print(name, GetItemCost(name), #GetItemComponents(name), GetItemStockCount(name), IsItemPurchasedFromSecretShop(name))` for the two items and their recipes.

### A4. Recommended fixes

1. **Builds (required):** replace all 12 occurrences listed in the summary. This is ticket 10's choice, for example Caduceus or Bloodthorn for Khanda's casters and carries, and Vladmir's or Ristul's Devotion for HotO.
2. **Generic guard (cheap insurance for this and every later patch):** in `GeneralPurchase` and `TurboModeGeneralPurchase`, capture the result once (currently `ActionImmediate_PurchaseItem` is called twice on failure, `344`/`355` and `424`/`433`). If the result is `PURCHASE_ITEM_INVALID_ITEM_NAME` or `PURCHASE_ITEM_DISALLOWED_ITEM`, print once, call `_resetCurrentTarget()`, and pop `purchaseListInReverseOrder`. This only helps when the API returns one of those codes. Alternatively, add a short `Item.tRemovedItems` set to `aba_item.lua` and filter `sBuyList` at `item_purchase_generic.lua:47` (and the ARDM rebuild at `477`, position swap at `600-617`). The set catches the item before any parts are bought, so it also covers case C yes.
3. `aba_item.lua:785,810`: comment the lines out with `-- removed from game in 7.42`, following `PATCH_UPDATE_GUIDE.md` 2A. `:154`: drop `item_javelin`.
4. `aba_site.ts:1250`: replace HotO, then regenerate `aba_site.lua`.

## B. TS-generated Lua (the fix goes to the .ts)

These Lua files carry the TSTL header. Each one maps to `typescript/<same path>.ts`: `BotLib/hero_wisp`, `FunLib/aba_buff`, `aba_defend`, `aba_hero_pos_weights`, `aba_hero_roles_map`, `aba_matchups`, `aba_push`, `aba_role`, **`aba_site`**, **`advanced_item_strategy`**, `captain_mode`, **`enemy_role_estimation`**, `global_cache`, `spell_prob_list`, `utils`, `version`, all of `FunLib/behavior/*` (alone, arbiter, decision_log, desire_tiers, flags, group, rng, roshsafe, siege, team_brain, thrash, trace), and `ts_libs/dota/{enums,heroes,index,interfaces}`, `ts_libs/utils/{native-operators,http_utils/http_req}`. `bots/ts_libs/enums.lua` and `bots/ts_libs/matchups.lua` have the header but no .ts at the same path.

Item-relevant ones: `aba_site` (HotO line, plus `item_meteor_hammer` at `.lua:1145` for a farm timing that still works), `advanced_item_strategy` (dead code), `enemy_role_estimation`, and `hero_wisp` (buy list has Sange and Halberd, both still valid). `aba_item.lua`, `item_purchase_generic.lua`, `ability_item_usage_generic.lua`, `aba_chat.lua` and all other `BotLib/hero_*.lua` files are hand-written Lua.

## C. Active-item audit (`ConsiderItemDesire`, dispatched at `ability_item_usage_generic.lua:1000-1030`)

- Dispatch scans slots `{5,4,3,2,1,0,15,16}` only (`1000`), never the backpack (6-8). **Greater Horn of Battle** can be used from the backpack, but the bot will only use it from the main inventory.
- Heaven's Halberd: `nCastRange = 700` (`2887`), but the real range is 500. See the summary table. Mana cost 50 is not checked in the code.
- Solar Crest (`4421`): iterates `J.GetAlliesNearLoc(bot:GetLocation(),1000)` and has no explicit self branch. Since 7.42, self-cast gives a full barrier and half the other bonuses, so a deliberate self-cast when the bot is attacked would add value. The code does not cause any misfire.
- Abyssal Blade (`1137`): `nCastRange = 620` against a real range of 175. This predates 7.42 and works as a walk-up. No 7.42 change is needed.
- Armlet (`1280`): toggling no longer breaks invisibility. The code has no invisibility guard to remove.
- Force Staff (`2406`), Hurricane Pike (`3035`), Pipe (`3852`), Bloodstone (`1703`), Crimson Guard (`1867`): only numbers changed. No code change.
- Phylactery: passive, no entry, nothing needed.
- Blood Grenade (`6864`): still valid. Bloodslinger shares its cooldown but has a separate name, so it needs its own entry.

## D. New-item needs (no current reference, nothing breaks)

AbilityBehavior is from the patch notes. Item usage needs a `ConsiderItemDesire` entry only for actives.

| Item | `aba_item.lua` | Active / usage entry |
|---|---|---|
| `item_quarterstaff` | Already in `sBasicItems:164`. No component line needed (basic). | none |
| `item_bloodslinger` | `Item['item_bloodslinger'] = GetItemComponents(...)[1]` | **ground** AoE, range 1200, radius 300, health cost 75. Copy Blood Grenade's logic with `'ground'`. |
| `item_caduceus` | component line | **unit** (Force, same as Force Staff). Alias it to `item_force_staff`'s entry, the way HotO aliased HotD (`2991`). |
| `item_ristuls_devotion` | component line | none (passive aura) |
| `item_berserkers_sabatons` | component line. Add to `tBootsUpgrades` (`item_purchase_generic.lua:124`) and the ARDM `tSkipBoots` checks (`465-473`, `1177-1181`) so a later basic boots entry is not bought again. | **toggle** like Armlet (`1280`). Needs its own modifier name, which is unknown until tested in game. |
| `item_skypiercer` | component line | **unit** Disarm, range 500. Alias it to the Halberd entry (with range fixed). |
| `item_starforge` | component line | **ground** (Meteor Hammer; neither has an entry). Also add it to `sTopItems` if it should never be sold. |
| `item_horn_of_battle_greater` | none (Tormentor drop, not bought) | **none-target** global (`'none'` cast). Must be usable from the backpack, see C. |
