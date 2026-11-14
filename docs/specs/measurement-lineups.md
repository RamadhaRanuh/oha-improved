# Measurement lineups

Fixed lineup pairs for screen and confirm runs ([spec](smarter-bot-behaviour.md) section 13). Written in session S0a; change it only between stages, never in the middle of a run.

## How these were picked

- Every hero has a complete `BotLib` build: `sRoleItemsBuyList['pos_1']` to `['pos_5']` in `bots/BotLib/hero_<name>.lua`. Io (`hero_wisp.lua`) uses one shared build for all positions, which counts as complete.
- Each hero sits in a position its `aba_hero_pos_weights.ts` row rates highly (one of its two highest weights).
- Each side is a standard 1-5 composition: carry, mid, offlane, soft support, hard support.
- Five of the nine override heroes (`Utils.BuggyHeroesDueToValveTooLazy`) appear: Lone Druid, Io, Primal Beast, Marci, Hoodwink. Section 11.2 asks for at least three.
- **Screens use pairs 1 and 2.** Pair 2 holds both Io and Lone Druid, so every screen includes them (section 11.2, from stage 2).
- No hero from Appendix List A ("weak") in `Customize/general.lua` is used.

## Pairs

Positions are listed 1 to 5, the order `Customize.Radiant_Heros` / `Dire_Heros` expects. Names are internal names without the `npc_dota_hero_` prefix.

| Pair | Side | Pos 1 | Pos 2 | Pos 3 | Pos 4 | Pos 5 |
|---|---|---|---|---|---|---|
| 1 | A | juggernaut | puck | axe | earthshaker | crystal_maiden |
| 1 | B | luna | templar_assassin | centaur | lion | witch_doctor |
| 2 | A | lone_druid | lina | mars | skywrath_mage | wisp |
| 2 | B | phantom_assassin | death_prophet | tidehunter | jakiro | warlock |
| 3 | A | medusa | zuus | primal_beast | hoodwink | lich |
| 3 | B | sven | viper | legion_commander | shadow_shaman | dazzle |
| 4 | A | drow_ranger | sniper | bristleback | marci | vengefulspirit |
| 4 | B | faceless_void | dragon_knight | slardar | ogre_magi | crystal_maiden |
| 5 | A | kez | templar_assassin | mars | earthshaker | warlock |
| 5 | B | juggernaut | lina | axe | skywrath_mage | witch_doctor |
| 6 | A | luna | death_prophet | centaur | hoodwink | crystal_maiden |
| 6 | B | medusa | sniper | tidehunter | lion | lich |
| 7 | A | phantom_assassin | viper | legion_commander | jakiro | dazzle |
| 7 | B | drow_ranger | zuus | bristleback | shadow_shaman | vengefulspirit |
| 8 | A | faceless_void | dragon_knight | slardar | ogre_magi | witch_doctor |
| 8 | B | sven | puck | primal_beast | marci | jakiro |

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
