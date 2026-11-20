# What the current code does on 7.42, headless

Ticket: [15](../tickets/15-what-current-code-does-on-742-headless.md). 2026-11-20, headless build 6986, code `c3389e8`, flags `none`, four games (`datasets/runs/pre742-g17`, `-g21`, `-g25`, `-g29`), each stopped at 37-44 min. Per-hero levels, items and casts: [data/pre-patch-smoke-analysis.txt](data/pre-patch-smoke-analysis.txt). Per-hero `Ability1-6` flag changes between d2vpkr 6976 and 6986: [data/ability-flag-diff-6976-6986.txt](data/ability-flag-diff-6976-6986.txt).

## Observed

| Hero | Observed | Cause | Already on 7.41? |
|---|---|---|---|
| Lycan | No item change after 21:54 | Helm of the Overlord in the pos-3 build (silent pop-and-retry path, no failure print) | no (new removal) |
| Beastmaster | Holds Helm of the Dominator plus loose parts from 35:24; 1,037 `Skipped to level up beastmaster_inner_beast`; level 20 but stopped spending skill points at 10 | Overlord stall, plus Inner Beast is innate (hidden, max level 1) while both skill builds level index 4 | skill stall yes (~1,000 skips per game in 7.41 batches); item stall new |
| Morphling, Tinker | Hold Phylactery and parts for 10-20 min, never finish | Khanda in the build | new |
| Meepo | Earthbind never cast in 37 min; 1,021 `未能购买物品 item_tango : 0` | Removed Megameepo fetched every tick (the error is swallowed, nothing in the log); the tango line is new in 7.42, cause unknown (Meepo is now Universal; clones?) | Meepo not in older lineups |
| Chen | Holy Persuasion never cast; level 14 at 37 min | Removed `chen_summon_convert` fetched (swallowed error), Zealot reworked | not in older lineups |
| Chaos Knight, Undying, Dazzle | Armageddon, Zombie Bite, Through the Realm never cast | No logic (Bite and Through the Realm need Shard, not bought) | new |
| Weaver | `weaver_time_lapse_ally` cast 4 times | Generic usage already reaches it; the predicted misfire is not observed | new |
| Brewmaster | Primal Split cast 6 times | The vector-targeted cast still goes through | new |
| Lone Druid | Level 13 at 37 min, hero holds boots, tango, flask only; 3,943 bear `spirit_bear_return` skips | Pre-existing (192 older logs show the same skip) | yes |
| Invoker | Exort and talent skips | Pre-existing (20-24 older logs) | yes |
| Morphling, Lifestealer | `[WARN] ... seems to be an ultimate ... not learnable OR hidden` | Ability-list warning; the ultimates are still cast | not in older lineups |

- **No Lua runtime errors are logged** beyond the usual 20 `error in error handling`, although the audits predicted two nil calls (Meepo, Chen). Hero-file errors are swallowed somewhere, so **a clean `smokecheck` does not prove a hero works**. Missing casts and frozen inventories are the signal.
- **Bots get 7.42 neutral items headless** (Balmhook, Brick, Red Ledger, Vile Phial, Safety Bubble, from 0:00), with neither Buff nor FretBots loaded. The engine gives neutrals to bot players on its own. This corrects [the neutral audit](neutral-items.md), which found no such path in code.
- Other new-ish warnings: `No function for the usage of ability: mud_golem_hurl_big_boulder` and `frogmen_water_bubble_small` (dominated creeps, 7.42 creep changes), `chen_martyrdom`.
