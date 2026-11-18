# Measurement lineups

Fixed lineup pairs for screen and confirm runs ([spec](smarter-bot-behaviour.md) section 13). Written in session S0a; change it only between stages, never in the middle of a run.

## How these were picked

- Every hero has a complete `BotLib` build: `sRoleItemsBuyList['pos_1']` to `['pos_5']` in `bots/BotLib/hero_<name>.lua`. Io (`hero_wisp.lua`) uses one shared build for all positions, which counts as complete.
- Each hero sits in a position its `aba_hero_pos_weights.ts` row rates highly (one of its two highest weights).
- Each side is a standard 1-5 composition: carry, mid, offlane, soft support, hard support.
- Four of the nine override heroes (`Utils.BuggyHeroesDueToValveTooLazy`) appear: Io, Primal Beast, Marci, Hoodwink (version 1 also had Lone Druid). Section 11.2 asks for at least three.
- **Screens use pairs 1 and 2.** Pair 2 holds Io (version 1 also had Lone Druid, dropped in version 2).
- No hero from Appendix List A ("weak") in `Customize/general.lua` is used.

## Version 2 (2026-11-18): balanced pairs

Version 1 (session S0a, see git history before 2026-11-18) was lopsided for OHA against OHA: lineup 6A won 1 of 78 games against 6B, 4A 79 of 100, 5A 28 of 84, 7A 29 of 68. The new team plays each lineup in 2 of a pair's 4 games, so a lopsided pair hands it about half of its games whatever it does, and a 90% target could not be reached. Version 2 keeps every pair's heroes in their positions and swaps heroes between A and B, position by position, so that the predicted chance of A beating B is near 0.5. Pair 2 also drops Lone Druid (3 wins in 104 games, bear item bug) and Skywrath Mage for Drow Ranger and Ogre Magi, because no swap balanced it otherwise. Pair 7 could only be brought to 0.41. The model is rough at lineup level (it gave 6A 0.19 where the record is 1 of 78), so balance is checked in real games: a plain-OHA-against-plain-OHA batch on version 2. Since 2026-11-18 match-setup also writes `Weak_Hero_Cap = 5`, so every listed hero is played. Batches on version 1 cannot be compared with version 2.

## Pairs

Positions are listed 1 to 5, the order `Customize.Radiant_Heros` / `Dire_Heros` expects. Names are internal names without the `npc_dota_hero_` prefix.

| Pair | Side | Pos 1 | Pos 2 | Pos 3 | Pos 4 | Pos 5 |
|---|---|---|---|---|---|---|
| 1 | A | juggernaut | puck | axe | earthshaker | crystal_maiden |
| 1 | B | luna | templar_assassin | centaur | lion | witch_doctor |
| 2 | A | drow_ranger | lina | tidehunter | ogre_magi | wisp |
| 2 | B | phantom_assassin | death_prophet | mars | jakiro | warlock |
| 3 | A | medusa | zuus | primal_beast | shadow_shaman | dazzle |
| 3 | B | sven | viper | legion_commander | hoodwink | lich |
| 4 | A | drow_ranger | sniper | slardar | marci | vengefulspirit |
| 4 | B | faceless_void | dragon_knight | bristleback | ogre_magi | crystal_maiden |
| 5 | A | kez | templar_assassin | axe | earthshaker | warlock |
| 5 | B | juggernaut | lina | mars | skywrath_mage | witch_doctor |
| 6 | A | luna | death_prophet | centaur | lion | crystal_maiden |
| 6 | B | medusa | sniper | tidehunter | hoodwink | lich |
| 7 | A | phantom_assassin | zuus | legion_commander | jakiro | dazzle |
| 7 | B | drow_ranger | viper | bristleback | shadow_shaman | vengefulspirit |
| 8 | A | faceless_void | puck | primal_beast | marci | jakiro |
| 8 | B | sven | dragon_knight | slardar | ogre_magi | witch_doctor |

Predicted chance that lineup A beats B, OHA against OHA (sum of hero logits from `bots/FunLib/hero_win_rates.lua`): 1 0.51, 2 0.50, 3 0.48, 4 0.49, 5 0.49, 6 0.51, 7 0.41, 8 0.50.

## Rotations

Each pair is played four times (section 13). "New" is the team with the stage's flags on.

| Rotation | Radiant | Dire | Flags on for |
|---|---|---|---|
| 1 | A | B | Radiant |
| 2 | B | A | Dire |
| 3 | B | A | Radiant |
| 4 | A | B | Dire |

So in rotations 1 and 2 the new team plays lineup A, and in rotations 3 and 4 it plays lineup B, once on each side.

## Setting a game up

In `bots/Customize/general.lua`, for pair 2 rotation 1:

```lua
Customize.Radiant_Heros = {
    'npc_dota_hero_lone_druid', 'npc_dota_hero_lina', 'npc_dota_hero_mars',
    'npc_dota_hero_skywrath_mage', 'npc_dota_hero_wisp',
}
Customize.Dire_Heros = {
    'npc_dota_hero_phantom_assassin', 'npc_dota_hero_death_prophet', 'npc_dota_hero_tidehunter',
    'npc_dota_hero_jakiro', 'npc_dota_hero_warlock',
}
```

and set the measured stage's flags (plus every flag that has already passed) to `true` under `Customize.Behavior.Radiant`, with `Customize.Behavior.Dire` all `false`.

Check at the start of each game that the picks match: a misspelt name falls back to a random hero (see the notes at the top of `general.lua`).
