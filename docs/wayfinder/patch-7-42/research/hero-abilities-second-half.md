# Hero ability code vs 7.42: Chen to Spirit Bear (second half)

Ticket: [02](../tickets/02-which-hero-ability-code-breaks-second-half.md). Scope: `patchnotes-7.42.md` lines 1713-2529 (64 hero entries, Chen to the unnamed Spirit Bear entry), structural changes only.

## Sources

- **Valve notes**: `research/data/patchnotes-7.42.md` lines 1713-2529.
- **Hero slots**: `research/data/heroes-pre-7.42.md` vs `heroes-7.42.md` (I diffed every hero in range).
- **Ability KV**: d2vpkr `dota/scripts/npc/heroes/npc_dota_hero_*.txt` and `npc_units.txt`. 7.42 is master, commit `5efc826` ("Client 6978", 2026-11-18). Pre-7.42 is its parent, `78d4387` (units: `4c0b3dc`). Cast behaviours and talent meanings below come from these files, not from the patch summary.
- **Code**: `bots/BotLib/hero_*.lua`, `bots/FunLib/aba_skill.lua` (GetAbilityList / GetTalentBuild), `bots/FunLib/minion_lib/primal_split.lua`, `bots/FunLib/aba_hero_sub_units.lua`, `bots/FunLib/spell_list.lua`, `bots/FunLib/spell_prob_list.lua` / `typescript/bots/FunLib/spell_prob_list.ts`, `bots/FunLib/rubick_hero/`.

## Summary

| hero | problem | severity | fix | files:lines |
|---|---|---|---|---|
| Meepo | `meepo_megameepo` and `meepo_megameepo_fling` removed. `MegaMeepo` is nil, so `X.ConsiderMegaMeepo()` indexes nil on every tick. That aborts SkillsComplement before Earthbind (and the Fling consider) | **error** | delete the MegaMeepo and Fling handles and considers. Optionally add the Shard Divided We Stand carry plus `meepo_fling_release` (see notes) | `bots/BotLib/hero_meepo.lua:161-162,167-168,186-187,212-216,228-233,703-776`; stale `bots/FunLib/spell_list.lua:477-478` |
| Chen | `chen_summon_convert` no longer exists: it is not in 7.41 slots either (pre-existing), and only appears in deprecated facets. `SummonConvert:IsFullyCastable()` indexes nil, so Holy Persuasion and Divine Favor never cast. The 7.42 Zealot rework is the natural place to fix it | **error** (pre-existing) | replace SummonConvert with `chen_zealot` (active, NO_TARGET, resurrects the Zealot) | `bots/BotLib/hero_chen.lua:149,155,181-186,491-533`; stale `bots/FunLib/spell_list.lua:130` |
| Lone Druid (bear) | Scepter disarm range is now 1100 -> 1300, no longer global. Code still treats Scepter as "no leash" | misfire | drop the Scepter exemptions and keep the bear within about 1100 (1300 with Scepter) | `bots/BotLib/hero_lone_druid_bear.lua:106-111`; `bots/mode_farm_generic.lua:404` |
| Lone Druid (bear) | new Scepter ability `lone_druid_spirit_bear_summon_druid` (bear slot 3) has no cast logic | missing | bear casts it (NO_TARGET) once the druid's spirit is stored | `bots/BotLib/hero_lone_druid_bear.lua:65-98` |
| Chaos Knight | Fundamental Forging removed. New innate `chaos_knight_armageddon` in slot 3 is an active point/directional charge. Skill-build indices are unaffected | missing | add ConsiderArmageddon, cast with `ActionQueue_UseAbilityOnLocation` | `bots/BotLib/hero_chaos_knight.lua:162-164,176-225` |
| Undying | new Shard ability `undying_bite` in slot 3. Ceaseless Dirge moved from slot 3 to slot 4. Build indices (1,2,3,6) are unaffected | missing | add ConsiderZombieBite (unit target, enemy) | `bots/BotLib/hero_undying.lua:124-168` (Shard is bought at lines 37/69/90) |
| Brewmaster | Fire brewling gets `brewmaster_fire_pull` ("Cinder Dash"), which is unit target + vector targeting. The fire block is empty | missing | add a fire-brewling cast via `Action_UseAbilityOnEntity`. The vector direction cannot be set (see notes) | `bots/FunLib/minion_lib/primal_split.lua:52-53` |
| Chen | the new Zealot active, the creep's `chen_anoint`, and Holy Persuasion's new self-cast (recall creeps) are all unused | missing | covered by the Chen error fix. Optionally add self-cast Holy Persuasion for recall | `bots/BotLib/hero_chen.lua:162-201,309-372` |
| Monkey King | with Shard, Boundless Strike now jumps to the target point instead of the full distance. The retreat branch aims at the chasing enemy, so MK lands on the chaser | misfire (low) | when Shard is held and MK is retreating, skip that branch or aim at a point away from the enemy | `bots/BotLib/hero_monkey_king.lua:151,268-289` |
| Brewmaster | Liquid Courage is cast with `ActionQueue_UseAbilityOnLocation(LiquidCourage, allyHero)`, which passes a unit where a vector is expected. This is pre-existing, Shard only. 7.42 only changes the passive's trigger | misfire (pre-existing) | use `ActionQueue_UseAbilityOnEntity` | `bots/BotLib/hero_brewmaster.lua:196-200,543-569` |
| Meepo | Meepo is now Universal. `J.ShouldSwitchPTStat` sends non-STR/AGI/INT heroes to STR treads in fights (was AGI) | misfire (low) | optional: special-case Universal as AGI in the treads logic | `bots/FunLib/jmz_func.lua:2886-2908` |

No stall found. Each slot shift in this half (Chaos Knight, Undying, Lycan, Nyx, Meepo, Spirit Bear) touches only indices 4/5. No hero in range uses index 4 or 5 in `tAllAbilityBuildList` or in `sAbilityList[4|5]` (I grepped for both), and `aba_skill.lua:102-108` pins the ultimate to index 6.

## Per-hero notes

### Meepo (error)
- **Slots**: 7.41 slots were `earthbind, poof, ransack, petrify, megameepo, divided_we_stand` plus extras `geomancy, megameepo_fling`. 7.42 slots are `earthbind, poof, ransack, petrify, geomancy, divided_we_stand` plus extra `meepo_fling_release`. The attribute changed from agi to uni.
- **The error**: `MegaMeepo = bot:GetAbilityByName('meepo_megameepo')` (lines 161, 186) now returns nil. `X.ConsiderMegaMeepo()` (line 212) runs on every tick that Poof or Dig did not cast, and fails at `MegaMeepo:IsTrained()` (line 704). Earthbind (line 219) and the Fling consider (line 228, which would also hit nil at line 739) are never reached. Every Meepo clone runs the same file, so all of them are affected.
- **Fix**: remove lines 161-162, 167-168, 186-187, 212-216, 228-233, 703-776. Wrapping both calls in `J.CanCastAbility` would also stop the error, but removing them is cleaner.
- **Dig**: `meepo_petrify` is now Scepter-granted, not Shard. KV: `NO_TARGET | HIDDEN | ROOT_DISABLES`, `IsGrantedByScepter`. `X.ConsiderDig` (line 669) uses `IsTrained`, so no break. Only the item build's intent changes (`hero_meepo.lua` buys the Shard at lines 37/60, the Scepter at 41/64).
- **New Shard ability (missing)**: `meepo_divided_we_stand` is upgraded by Shard. KV for slot 5: `PASSIVE`, target team FRIENDLY, types HERO|BASIC, `HasShardUpgrade`. With Shard it becomes unit target on your own Meepo or a friendly creep: cast range 250, 40 mana, 25/20/15/10s cooldown. The carried unit is dropped after 5s.
- **Fling (missing)**: the follow-up is `meepo_fling_release`. KV: `POINT | UNIT_TARGET | AOE | HIDDEN | NOT_LEARNABLE`, team BOTH, `IsGrantedByShard`, linked to DWS. It throws the carried unit 600-900 range at an enemy, a Meepo or a point. Cast sequence: `ActionQueue_UseAbilityOnEntity(DWS, meepoOrCreep)`, then `Action_UseAbilityOnEntity(FlingRelease, enemy)` or `...OnLocation`.
- **Unverified**: whether DWS reports `IsPassive()` false at runtime once Shard is held. `J.CanCastAbility` rejects passives, so check this in game.
- **Skill build**: `{2,3,6,1,...}` is unaffected. The Meepo branch in `aba_skill.lua:179-206` only reads indices 1/2/3/6.
- **spell_list.lua:477-478**: stale megameepo entries. Only Morphling reads this file (`hero_morphling.lua:6`), so they are harmless, but remove them.

### Chen (error, pre-existing; plus missing Zealot logic)
- **Slots**: unchanged (`penitence, holy_persuasion, divine_favor, zealot, generic_hidden, hand_of_god`), so the build is unaffected.
- **The error**: line 149 fetches `chen_summon_convert`, which is absent in both 7.41 and 7.42 slots. In d2vpkr it survives only as an icon replacement inside deprecated facets (`npc_dota_hero_chen.txt:58-115`). `X.ConsiderSummonConvert()` (line 181) runs after Hand of God and Penitence decline, then fails at `SummonConvert:IsFullyCastable()` (line 492). As a result Holy Persuasion (line 188) and Divine Favor (line 195) are never considered. This is not caused by 7.42, but the 7.42 Zealot rework is what replaces this mechanic.
- **New Zealot active**: `chen_zealot` is `NO_TARGET`, `Innate`. Notes: no mana cost, cooldown 60s minus 1s per hero level, resurrects the anointed Zealot. Cast with `bot:Action_UseAbility(Zealot)` when the Zealot is dead and `J.CanCastAbility(Zealot)` holds.
- **Unverified**: whether the active is inactive while the Zealot lives. Guard with `IsFullyCastable`/`IsActivated`.
- **Anoint (missing)**: each persuaded or dominated creep gets `chen_anoint`. KV: `NO_TARGET | IMMEDIATE | IGNORE_CHANNEL`, cooldown 0. The creep itself casts it to become the Zealot, and Chen can have only one. This is optional minion logic: anoint the best persuaded neutral via `Minion.MinionThink`.
- **Martyrdom**: the Zealot keeps `chen_martyrdom` (unit target, team BOTH, range 500). It is unchanged.
- **Holy Persuasion self-cast**: KV target team is BOTH. Notes: targeting Chen himself teleports all his creeps to him after a 6/5/4/3s delay and puts the ability on a 3s cooldown. To use it: `Action_UseAbilityOnEntity(HolyPersuasion, bot)` when creeps are far away and a fight or push is starting. Optional.
- **Holy Persuasion as written**: `ConsiderHolyPersuasion` reads `max_units` and `level_req`, both still present. Persuaded creeps no longer get bonus damage or speed from it (Zealot gives that now); that is a number change only.
- **Ambiguous (runtime check)**: the Zealot is "considered a creep-hero". Check whether it shows up in `GetNearbyHeroes(..., false)` ally counts, the way the Spirit Bear is special-cased.

### Lone Druid and Spirit Bear (misfire + missing)
- **Druid slots**: unchanged.
- **Bear slots** (`npc_units.txt`, `npc_dota_lone_druid_bear1`): 7.41 was `return, entangle, savage_roar_bear, spirit_link, fetch, demolish`. 7.42 is `return, entangle, savage_roar_bear, summon_druid, fetch, demolish`, with `spirit_link` moved to Ability7.
- **Bear build**: `{1,2,1,2,1,6,...,3}` (`hero_lone_druid_bear.lua:23-25`). Indices 1-3 are unchanged. Index 6 stays `demolish` provided nothing in slots 3-5 is skipped. `summon_druid` has no NOT_LEARNABLE flag in KV, so GetAbilityList keeps it at index 4, where spirit_link used to sit. Low risk, but print `sAbilityList` for the bear once in game.
- **Scepter leash (misfire)**: notes line 2520 changes the Scepter disarm range from global to +200 (1100 -> 1300).
  - `hero_lone_druid_bear.lua:106-111` skips Return when the bear is more than 3000 away and holds `item_ultimate_scepter`.
  - `mode_farm_generic.lua:404` lets the bear farm alone when `bot:HasScepter()` and the druid is invalid.
  - Both assume no leash. The bear now farms or fights disarmed beyond 1300. Fix: remove the Scepter exemption. Better still, return or move back once the bear is beyond about 1100/1300, matching `aba_hero_sub_units.lua:272`, which already uses 1100.
- **Summon Druid (missing)**: `lone_druid_spirit_bear_summon_druid`. KV: `NO_TARGET`, `IsGrantedByScepter`. Notes: passive "spirit storage" plus an active usable 0.5s after the druid's "death"; 100 mana, 120s cooldown, 0.5s cast point. It respawns the druid at the bear with full HP and mana.
  - Add a consider to the bear's `X.SkillsComplement` (`hero_lone_druid_bear.lua:73-98`) that casts `bear:Action_UseAbility(SummonDruid)` when `J.CanCastAbility` holds and no enemy hero is within about 900.
  - It must not be gated on `Utils.GetLoneDruid(bear).hero:IsAlive()`, as `ConsiderQ` is at line 102.
  - Ambiguous: the notes do not say whether the stored druid reads `IsAlive()` false. Check in game.

### Chaos Knight (missing)
- **Slots**: 7.41 was `bolt, rift, strike, generic_hidden, fundamental_forging, phantasm`. 7.42 is `bolt, rift, strike, armageddon, generic_hidden, phantasm`, plus extra `chaos_knight_armageddons_flank_end`.
- **What the code reads**: only `sAbilityList[1]`, `[2]` and `[6]` (lines 162-164) and build `{1,2,3,...,6}`. No break.
- **Armageddon KV**: `chaos_knight_armageddon` is `POINT | DIRECTIONAL | ROOT_DISABLES`, `Innate`, cast range 0 (notes: global), 30s cooldown, 50 mana, 0.4s cast point.
- **When it can be cast**: only while at least one Phantasm illusion from an active cast is alive. Use `J.CanCastAbility` (it checks IsHidden/IsActivated).
- **What it does**: up to 1s of preparation, then CK and every controlled illusion within 1300 charge to the point, crossing terrain. Casting any other ability ends the charge, so return early from SkillsComplement while `modifier_chaos_knight_armageddon*` is active. The modifier name is unknown; check in game.
- **Cast**: `ActionQueue_UseAbilityOnLocation(Armageddon, targetLoc)` right after Phantasm, toward a fight or the attack target.
- **Flank end**: `armageddons_flank_end` is the hidden no-target cancel. Leave it alone.
- **Rubick**: `spell_list`/`spell_prob_list` need no change (it's an innate).

### Undying (missing)
- **Slots**: 7.41 was `decay, soul_rip, tombstone, ceaseless_dirge, generic_hidden, flesh_golem`. 7.42 is `decay, soul_rip, tombstone, bite, ceaseless_dirge, flesh_golem`. The build `{1,3,...,2,6}` and the name-based handles (lines 124-127) are unaffected.
- **Zombie Bite KV**: `undying_bite` is `UNIT_TARGET | ATTACK`, team ENEMY, types HERO|BASIC, flag MAGIC_IMMUNE_ENEMIES (can target debuff-immune units), range 400, 18s cooldown, 70 mana, `IsGrantedByShard`.
- **Cast**: `ActionQueue_UseAbilityOnEntity(Bite, target)` on a hero target in a fight (silences, slows and turns it melee for 3s), or on a non-ancient creep while farming (instant kill plus a 20s zombie).
- **Tombstone**: no longer upgraded by Shard. `ConsiderTombstone` (lines 525-555) has no Shard logic, so no change.

### Brewmaster (missing + pre-existing misfire)
- **Cinder Dash**: the fire brewling unit (`npc_dota_brewmaster_fire_1`) now has `Ability1 = brewmaster_fire_pull` ("Cinder Dash"), and immolation/phase shifted down a slot.
  - KV: `UNIT_TARGET | VECTOR_TARGETING | IGNORE_BACKSWING`, team BOTH, HERO|BASIC, range 150, 8s cooldown, 50 mana, `pull_distance` 400-700, `damage` 50-200 to enemies.
  - `minion_lib/primal_split.lua:52-53` has an empty fire block, so there is no break, but the ability is unused.
- **Vector targeting**: the bot API has no vector-target order. OHA casts Marci Rebound with `ActionQueue_UseAbilityOnEntity` and marks it "vector targeted; not reliable" (`hero_marci.lua:345`). Pangolier Swashbuckle is cast with `Action_UseAbilityOnLocation`.
  - Recommendation: `hMinionUnit:Action_UseAbilityOnEntity(CinderDash, enemy)` with the brewling already facing toward allies.
  - The default direction when no vector is supplied is unverified: test it, or treat this as optional.
- **Primal Split**: still `NO_TARGET`, so the `Action_UseAbility(PrimalSplit)` calls at lines 183/206 are fine.
- **Liquid Courage KV**: now `PASSIVE | FORCE_KEYBIND | FORCE_NO_INNATE_UI`, `Innate`, `HasShardUpgrade` (400 damage over 7s triggers it, 15s internal cooldown). Without Shard, `J.CanCastAbility` rejects it because it is passive.
- **Liquid Courage, pre-existing bug**: with Shard, `ConsiderLiquidCourage` returns an ally hero and the code casts `ActionQueue_UseAbilityOnLocation` (line 199). Use `OnEntity`. The Shard cast type is not stated in 7.42 notes; the existing code assumes an ally unit target. Verify.

### Monkey King (low misfire)
- **Change**: the Shard Boundless Strike now jumps to the targeted position. Every cast passes a point (line 151).
- **Offensive branches**: they target the enemy's (extrapolated) location, so MK now lands on the target. That is acceptable.
- **Retreat branch** (lines 268-289): it targets the chasing enemy, which now drops MK onto the chaser. Fix: add `not J.HasAghanimsShard(bot)` to that branch, or aim at a point beyond the enemy, out of the cast range.

### Other heroes in range: checked, no ability-code change needed
- **Lycan**: Apex Predator was replaced by passive innate `lycan_pack_hunter` in the same slot (4). The code never references either (lines 131-135); Wolf Bite's consider is already commented out (line 166).
- **Nyx Assassin**: innate `neuro_sting` was replaced by passive `scarab_metabolism` in the same slot. `nyx_assassin_unburrow` is still present; Mind Flare reads `max_mana_as_damage_pct` only.
- **Doom**: `doom_bringer_lvl_pain` is passive and hidden, and the code never targets allies.
- **Abaddon**: Mist Coil gets the Scepter (AoE attack), Borrowed Time loses it, and the self-damage became a health cost. The code reads `self_damage` (line 208) but never uses it. Borrowed Time is not cast by the hero file. Optional: Scepter-aware Mist Coil AoE.
- **Ancient Apparition**: the Ice Blast release is now castable during channels. Behaviour only.
- **Disruptor**: Shard on Kinetic Field and the fence get passive Repulsion procs. No cast change.
- **Muerta**: Spectral Slug gets 2 charges. `IsFullyCastable` handles charges.
- **Number-only, no structural change**: Spectre, Ursa, Spirit Breaker, Gyrocopter, Alchemist, Invoker, Silencer, OD, Shadow Demon, Treant, Ogre, Rubick, Naga, KotL, Io, Visage, Slark, Medusa, Troll, Centaur, Magnus, Timbersaw, Bristleback, Tusk, Skywrath, Elder Titan, Legion, Techies, Ember, Earth Spirit, Underlord, TB, Phoenix, Oracle, WW, Arc Warden, Dark Willow, Pangolier, Grimstroke, Hoodwink, Void Spirit, Snapfire, Mars, Ringmaster, Dawnbreaker, Marci, Primal Beast, Kez, Largo.
- **rubick_hero / spell lists**: no file in `bots/FunLib/rubick_hero/` for a hero in this range names a removed ability. `spell_prob_list.lua`/`.ts` have nothing 7.42-stale in this range. Their only stale name, `brewmaster_primal_companion`, predates 7.42 and is nil-safe through `J.CanCastAbility`.

## Talent picks that changed (no fix, list only)

How the pick is resolved: `GetTalentBuild` (`aba_skill.lua:135-148`) picks file position 1/3/5/7 when `tN[1]==0`, else 2/4/6/8. Old and new meanings come from which ability value each `special_bonus_*` modifies in the pre and 7.42 KV.

| hero (list) | level | old pick -> new pick |
|---|---|---|
| Ancient Apparition | 10 | +30 Cold Feet DPS -> +150 Cold Feet break distance |
| Ancient Apparition | 15 | -2s Ice Vortex CD -> Bone Chill slows 2% |
| Gyrocopter | 15 | +25 Flak Cannon damage -> -10s Call Down CD |
| Invoker list 1 (QW) | 25 | 2x Quas/Wex/Exort bonuses -> +2 Chaos Meteors |
| Invoker list 2 (QE) | 20 | +2 Chaos Meteors -> 2x Quas/Wex/Exort bonuses |
| Naga Siren | 20 | +1 Mirror Image illusion -> -6s Mirror Image CD |
| Naga Siren | 25 | -10s Mirror Image CD -> +1 Mirror Image illusion |
| Medusa | 15 | +1 Gorgon's Grasp volley -> +50 Gorgon's Grasp initial radius |
| Skywrath Mage | 10 | +1.5 mana regen -> +5 Shield of the Scion barrier |
| Abaddon | 10 | +8 HP regen on Aphotic Shield -> +125 Mist Coil cast range (same name `abaddon_7`) |
| Abaddon | 15 | +35 Mist Coil damage/heal -> -Borrowed Time CD (sides swapped) |
| Abaddon | 25 | 350 AoE Mist Coil -> 2 Aphotic Shield charges |
| Elder Titan | 10 | +150 Echo Stomp wake damage -> +65 Echo Stomp damage |
| Elder Titan | 15 | +75 Echo Stomp damage -> +3.5% Astral Spirit MS per hero |
| Legion Commander | 10 | -2s Overwhelming Odds CD -> +30 OO attack speed |
| Techies | 10 | -2s Proximity Mines CD -> +150 mana |
| Techies | 25 | -0.8s mine activation delay -> Sticky Bomb 1.5s stun (same name `techies_4`) |
| Arc Warden lists 1 and 3 (pos1, pos2 physical) | 20 | -4s Magnetic Field CD -> +7 all attributes |
| Mars | 10 | +100 God's Rebuke distance -> Bulwark front/side damage reduction |
| Muerta | 15 | +3% max HP regen in The Calling -> +2 Calling revenants |

These replaced talents are on the side the bots do not pick, so their picks are unchanged: Chen (15 picks `chen_8`, Penitence), Lycan (20 picks `lycan_1`, Shapeshift duration), Nyx (25 picks +80 agility), Snapfire (20), Muerta (20), Legion (25), Gyrocopter (25), Medusa (10).
