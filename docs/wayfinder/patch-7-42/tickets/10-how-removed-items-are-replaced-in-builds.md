---
title: How removed items are replaced in hero builds
label: wayfinder:grilling
status: closed
assignee: orchestrator
blocked-by: [03-which-item-code-stalls-or-misfires.md, 08-what-ships-tonight-and-what-waits.md]
---

## Question

For each build entry naming a removed item (Khanda, Helm of the Overlord), what does it become, and do new 7.42 items enter builds in this update?

## Resolution

Decided on the agent's recommendation (user waived HITL for this map), 2026-11-20, from [the item audit](../research/items.md). All of this is **Gate 1**: both removed build items stall the purchase queue (the game knows the names but marks them obsolete, and `item_purchase_generic.lua` never checks the return code).

**Rule:** replace each removed item with the closest still-sold item at the same place in the build, so the rest of the build order is unchanged. Builds are not otherwise redesigned.

| Hero, positions | Removed | Becomes | Why |
|---|---|---|---|
| Bounty Hunter pos 1-3 | Khanda | `item_caduceus` | The build already buys Phylactery, which Khanda upgraded; Caduceus is 7.42's Phylactery upgrade (+Force Staff) |
| Zeus pos 1-2 | Khanda | `item_caduceus` | Same: Phylactery is already in the build |
| Luna pos 1 (shared by all positions) | Khanda | `item_greater_crit` | Physical carry; no Phylactery in the build |
| Morphling pos 1-2 | Khanda | `item_greater_crit` | Same |
| Tinker pos 2-3 | Khanda | `item_ethereal_blade` | Caster; no Phylactery in the build |
| Beastmaster pos 3 | Helm of the Overlord | `item_vladmir` | Keeps the Helm of the Dominator plus an aura for his summons |
| Lycan pos 3-5 | Helm of the Overlord | (entry removed) | `item_vladmir` already follows it |

Also in Gate 1:

- **Caduceus support:** an `aba_item.lua` entry via `GetItemComponents`. Its Force active reuses the Force Staff handler (`ability_item_usage_generic.lua:2406`), registered under `item_caduceus`. The Empower Spell passive needs no code.
- **Registry for the other new items** (Bloodslinger, Ristul's Devotion, Sabatons, Skypiercer, Starforge, Quarterstaff): `aba_item.lua` lists and `GetItemComponents` entries only. No build uses them yet; they come in a later update (fog).
- **Beastmaster farm gate** `aba_site.ts:1250`: `item_helm_of_the_overlord` becomes `item_helm_of_the_dominator` (edit the `.ts`, then rebuild).
- **`item_javelin`** is removed from `sBasicItems` (unused list). The `aba_chat.lua` rows stay; they are only display names.
- **Insurance guard** in `item_purchase_generic.lua`: when a purchase returns `PURCHASE_ITEM_INVALID_ITEM_NAME` or `PURCHASE_ITEM_DISALLOWED_ITEM`, print once and pop the item, so a name missed here costs one item, not the whole build.

Gate 2: Heaven's Halberd cast range 700 becomes 500 (`ability_item_usage_generic.lua:2887`).

Not done (fog or out of scope): actives for Meteor Hammer and Starforge (an older gap), Greater Horn of Battle (needs a handler and backpack scanning; it is a new mechanic), `advanced_item_strategy` (dead code, nothing requires it).
