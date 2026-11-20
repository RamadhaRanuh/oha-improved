---
title: Which item code stalls or misfires in 7.42
label: wayfinder:research
status: closed
assignee: agent-03
blocked-by: []
---

## Question

Find every reference to removed items (`item_javelin`, `item_helm_of_the_overlord`, `item_angels_demise`) in Lua and TS, and say what each does at runtime: does a removed item in `sRoleItemsBuyList` or a fallback build stall the purchase queue (read `item_purchase_generic.lua` and `FunLib/aba_item.lua`)? List hardcoded component arrays the 7.42 recipe changes break (Bloodthorn, Butterfly, MKB, Maelstrom, Mask of Madness, Heaven's Halberd, Abyssal Blade, Harpoon, Crimson Guard, Orb of Corrosion, Witch Blade). For each new item (Quarterstaff, Bloodslinger, Caduceus, Ristul's Devotion, Sabatons, Skypiercer, Starforge, Greater Horn of Battle): what `aba_item.lua` and `ability_item_usage_generic.lua` need (registry entry; active logic: unit, ground, toggle or none). Audit existing `ConsiderItemDesire` entries whose active changed (Solar Crest self-cast, Heaven's Halberd range 500, Phylactery, Tranquil Boots rename, Force Staff, Armlet, Meteor Hammer). Note other files carrying item lists (`aba_chat.lua`, `aba_site.lua` and its TS, `advanced_item_strategy` and its TS, `enemy_role_estimation.lua`).

## Resolution

Khanda (`item_angels_demise`, 12 build entries in BH, Luna, Morphling, Tinker and Zeus) and Helm of the Overlord (Beastmaster and Lycan pos 3, both early in their lists) **stall the purchase queue**. They are still in 7.42 `items.txt`, but marked `IsObsolete 1` and unbuyable. `item_purchase_generic.lua` never checks the purchase return code. A failure either retries forever (`:350-355`, nothing pops) or pops silently and then waits until the bot has held more than 2x the item cost for 180 s (`:1220,1242`). Either way, every later build item is delayed by minutes or never bought.

Javelin and the recipe changes are harmless (`GetItemComponents`, unused `sBasicItems`). Smaller misfires: the Beastmaster farm timing in `aba_site.ts:1250`, and the Halberd cast range hardcoded to 700 (`ability_item_usage_generic.lua:2887`). Meteor Hammer and Starforge have no active usage, and the dispatcher never scans backpack slots, which matters for Greater Horn. The Tranquil "Respite" rename is UI-only.

The fixes are to replace the build entries and to add a removed-item or return-code guard. Ticket 15 must also check `ITEM` lines, because the silent-pop case prints no `未能购买物品`. Details: [research/items.md](../research/items.md).
