
## GENERAL: Tormentor
- Reflect Damage reflection per minute decreased from 2% to 1.5%

# ITEMS

## Black King Bar (item_black_king_bar)
- Avatar now has a fixed duration and is not affected by buff duration amplification

## Consecrated Wraps (item_consecrated_wraps)
- All Attributes bonus decreased from +6 to +5
- Hallowed stacks are now item charges instead of a stack counter on the buff
  - All charges are consumed when the barrier is created
  - Charge Restore Time of Hallowed is not affected by effects that reduce or modify cooldowns
- Hallowed now starts with all 3 charges when Consecrated Wraps is purchased or built
  - Gaining max stacks requirement for the speedup buff is removed
  - Initial 3 charges don't provide the movement speed buff
- Hallowed charge gain time increased from 3s to 4s

## Gleipnir (item_gungir)
- Eternal Chains radius increased from 275 to 325
  - Effective radius increased from 350 to 400 due to item's built-in Area of Effect bonus

## Heaven's Halberd (item_heavens_halberd)
- Health Regen bonus increased from +6 to +6.5

## Helm of the Overlord (item_helm_of_the_overlord)
- Dominate cooldown decreased from 45s to 40s
- Dominate target unit's max health minimum increased from 1800 to 1900

## Holy Locket (item_holy_locket)
- Energy Charge incoming Heal Amplification increased from 10% to 15%
- Holy Blessing outgoing Heal Amplification decreased from 15% to 10%

## Mage Slayer (item_mage_slayer)
- Health Regen bonus decreased from +6 to +5.5
- Magic Resistance bonus decreased from 20% to 18%

## Sange (item_sange)
- Health Restoration bonus decreased from 16% to 12%

## Abyssal Blade (item_abyssal_blade)
- Health Restoration bonus decreased from 20% to 16%

## Sange and Yasha (item_sange_and_yasha)
- Health Restoration bonus decreased from 20% to 16%

## Kaya and Sange (item_kaya_and_sange)
- Health Restoration bonus decreased from 20% to 16%

# NEUTRAL_ITEMS

## Artifact changes (Artifact changes)

## Jidi Pollen Bag (item_jidi_pollen_bag)
- Pollinate radius increased from 700 to 900

## Conjurer's Catalyst (item_conjurers_catalyst)
- Spellover now has a 0.1s internal cooldown [Still can proc multiple times from a single instance of high damage]
- Spellover damage threshold increased from 100 to 200
- Spellover damage from hero targets increased from 40 to 80 [From 52 to 104 with Dormant Curio]
- Spellover damage from creep targets increased from 15 to 30 [From 19.5 to 39 with Dormant Curio]

## Enchanter's Bauble (item_enchanters_bauble)
- Enchant base Neutral Enchantment bonus decreased from 15% to 10%

## Idol of Scree'auk (item_idol_of_screeauk)
- False Flight duration increased from 5s to 6.5s [From 6.5s to 8.45s with Dormant Curio]

## Metamorphic Mandible (item_metamorphic_mandible)
- Pupate movement speed bonus increased from 15% to 20%

## Rattlecage (item_rattlecage)
- Reverberate projectile physical damage decreased from 110 to 90 [From 143 to 117 with Dormant Curio]

## Book of the Dead (item_demonicon)
- Demonic Warrior no longer has True Sight ability

## Minotaur Horn (item_minotaur_horn)
- Lesser Avatar bonus magic resistance increased from 50% to 60%

## Riftshadow Prism (item_riftshadow_prism)
- Refract cooldown decreased from 30s to 27s

## Enchantment changes (Enchantment changes)

## Crude (item_enhancement_crude)
- Health Restoration bonus decreased from +10/15/20% to +9/12/15%

# HEROES

## HERO Anti-Mage (npc_dota_hero_antimage)
### Mana Break (antimage_mana_break)
  - Max Mana Burned per hit increased from 1.6/2.4/3.2/4% to 1.8/2.7/3.6/4.5%
### Talents
  - Level 20 Talent Blink Cast Range decreased from +150 to +125

## HERO Bloodseeker (npc_dota_hero_bloodseeker)
### Rupture (bloodseeker_rupture)
  - Mana Cost increased from 100/150/200 to 125/175/225
### Talents
  - Level 25 Talent Max Thirst Move Speed decreased from +18% to +15%

## HERO Crystal Maiden (npc_dota_hero_crystal_maiden)
### Crystal Clone (crystal_maiden_crystal_clone)
  - Cooldown increased from 10s to 12s

## HERO Drow Ranger (npc_dota_hero_drow_ranger)
- Base Agility increased from 22 to 24
  - Damage at level 1 increased from 49-56 to 51-58
### Marksmanship (drow_ranger_marksmanship)
  - Enemy hero disable range decreased from 325 to 300
### Glacier (drow_ranger_glacier)
  - While on the glacier, Marksmanship now can be disabled by enemies in the proximity
### Talents
  - Level 25 Talent Multishot Waves increased from +1 to +2

## HERO Juggernaut (npc_dota_hero_juggernaut)
- Base Movement Speed increased from 300 to 305
### Bladeform (juggernaut_bladeform)
  - Base Agility per stack increased from 2.5% + 0.05% per level to 2.5% + 0.1% per level
### Talents
  - Level 20 Talent Blade Fury Damage per second increased from +100 to +120

## HERO Pudge (npc_dota_hero_pudge)
### Flesh Heap (pudge_innate_graft_flesh)
  - Strength gain per stack increased from 1.6 to 2.0

## HERO Sand King (npc_dota_hero_sand_king)
### Epicenter (sandking_epicenter)
  - Attack Slow decreased from 50/55/60 to 30/40/50
  - Aghanim's Scepter Stinger damage decreased from 50% to 40%

## HERO Tiny (npc_dota_hero_tiny)
- Intelligence gain increased from 2.2 to 2.4
### Tree Volley (tiny_tree_channel)
  - No longer applies cleave

## HERO Windranger (npc_dota_hero_windrunner)
- Base Health Regen increased by 0.5
### Powershot (windrunner_powershot)
  - Slow increased from 20/25/30/35% to 22/28/34/40%
### Gale Force (windrunner_gale_force)
  - Cooldown decreased from 30s to 25s

## HERO Shadow Shaman (npc_dota_hero_shadow_shaman)
- Intelligence gain decreased from 3.5 to 3.3

## HERO Slardar (npc_dota_hero_slardar)
### Guardian Sprint (slardar_sprint)
  - Cooldown increased from 29/25/21/17s to 33/28/23/18s

## HERO Tidehunter (npc_dota_hero_tidehunter)
- Base Strength decreased from 26 to 25
  - Damage at level 1 decreased from 51-57 to 50-56
### Leviathan's Catch (tidehunter_leviathans_catch)
  - Now gains fish on every even level instead of every level
### Talents
  - Level 15 Talent Gush Damage decreased from +100 to +90
  - Level 25 Talent Anchor Smash affects buildings now deals 50% damage to buildings

## HERO Enigma (npc_dota_hero_enigma)
### Event Horizon (enigma_event_horizon)
  - Movement Slow increased from 4% + 1% per level to 5% + 1% per level
### Demonic Summoning (enigma_demonic_conversion)
  - Fixed Eidolons not having an 8 attack damage spread
  - Eidolon Damage increased from 16/27/38/49 to 16/28/40/52
    - As a result, damage changed from 16/27/38/49 to 12-20/24-32/36-44/48-56

## HERO Tinker (npc_dota_hero_tinker)
### Deploy Turrets (tinker_deploy_turrets)
  - Missile speed increased from 1200 to 1350
  - Base activation time decreased from 0.3s to 0s
  - Aghanim's Scepter no longer makes activation faster

## HERO Necrophos (npc_dota_hero_necrolyte)
### Death Seeker (necrolyte_death_seeker)
  - Mana Cost increased from 125 to 160

## HERO Beastmaster (npc_dota_hero_beastmaster)
- Base Attack Speed decreased from 100 to 90
### Wild Axes (beastmaster_wild_axes)
  - Debuff Duration rescaled from 12s to 10/11/12/13s
### Talents
  - Level 10 Talent Armor decreased from +5 to +4
  - Level 10 Talent Wild Axes Damage Amp Per Stack decreased from +2% to +1.5%

## HERO Death Prophet (npc_dota_hero_death_prophet)
### Exorcism (death_prophet_exorcism)
  - Spirit Damage increased from 64 to 65/68/71 [From 62-67 to 62-68/65-71/68-74]

## HERO Phantom Assassin (npc_dota_hero_phantom_assassin)
- Strength gain increased from 2.0 to 2.2
### Phantom Strike (phantom_assassin_phantom_strike)
  - Duration increased from 2.5s to 3s
  - Bonus Attack Speed rescaled from 100/130/160/190 to 80/120/160/200
### Coup de Grace (phantom_assassin_coup_de_grace)
  - Critical Damage increased from 200/300/400% to 200/325/450%

## HERO Nature's Prophet (npc_dota_hero_furion)
### Wrath of Nature (furion_wrath_of_nature)
  - Base Damage increased from 90/130/170 to 100/140/180

## HERO Clinkz (npc_dota_hero_clinkz)
### Talents
  - Level 10 Talent Strafe Duration increased from +0.75s to +1s

## HERO Omniknight (npc_dota_hero_omniknight)
### Hammer of Purity (omniknight_hammer_of_purity)
  - Damage to heal increased from 30% to 35%
### Guardian Angel (omniknight_guardian_angel)
  - Duration increased from 4/4.5/5s to 4/4.75/5.5s
  - Aghanim's Scepter Bonus Health Restoration decreased from 100% to 50%
### Talents
  - Level 20 Talent Degen Aura Radius increased from +125 to +150

## HERO Night Stalker (npc_dota_hero_night_stalker)
- Base Health Regen decreased by 1.25

## HERO Broodmother (npc_dota_hero_broodmother)
- Base agility increased from 18 to 20
  - Damage at level 1 increased from 45-51 to 47-53

## HERO Jakiro (npc_dota_hero_jakiro)
### Dual Breath (jakiro_dual_breath)
  - Cooldown rescaled from 10s to 12/11/10/9s
### Liquid Fire (jakiro_liquid_fire)
  - Burn Damage rescaled from 15/25/35/45 to 12/24/36/48
### Macropyre (jakiro_macropyre)
  - Mana Cost decreased from 300/400/500 to 250/350/450
### Talents
  - Level 20 Talent Macropyre Damage increased from +20 to +25

## HERO Batrider (npc_dota_hero_batrider)
- Base Armor decreased by 1
### Firefly (batrider_firefly)
  - Cooldown increased from 45/40/35/30s to 48/42/36/30s
### Talents
  - Level 15 Talent Sticky Napalm Movement Slow increased from +0.5% to +0.75%

## HERO Chen (npc_dota_hero_chen)
### Holy Persuasion (chen_holy_persuasion)
  - Bonus Damage increased from 0/6/12/18% to 5/10/15/20%

## HERO Spectre (npc_dota_hero_spectre)
- Strength gain decreased from 2.4 to 2.3
### Dispersion (spectre_dispersion)
  - Max Radius decreased from 800 to 700
### Talents
  - Level 10 Talent Spectral Dagger Cooldown Reduction decreased from 4s to 3s

## HERO Ancient Apparition (npc_dota_hero_ancient_apparition)
### Bone Chill (ancient_apparition_bone_chill)
  - Aghanim's Scepter Strength Reduction bonus increased from 0.3 to 0.8

## HERO Doom (npc_dota_hero_doom_bringer)
### Scorched Earth (doom_bringer_scorched_earth)
  - Damage decreased from 20/35/50/65 to 20/30/40/50
### Doom (doom_bringer_doom)
  - Damage per second decreased from 25/45/66 to 22/44/66
### Talents
  - Level 10 Talent Devour grants 15% Magic Resistance replaced with +10% Magic Resistance
  - Level 15 Talent +66 Damage replaced with +1.5% Infernal Blade Max HP As Damage
  - Level 20 Talent +2.5% Infernal Blade Max HP As Damage replaced with +66 Damage

## HERO Gyrocopter (npc_dota_hero_gyrocopter)
### Flak Cannon (gyrocopter_flak_cannon)
  - Cooldown rescaled from 26/24/22/20s to 25s
### Call Down (gyrocopter_call_down)
  - Cooldown decreased from 90/75/60s to 75/65/55s

## HERO Alchemist (npc_dota_hero_alchemist)
- Base Agility decreased from 22 to 19
### Talents
  - Level 10 Talent +1 Acid Spray Armor Reduction replaced with +1% Corrosive Weaponry Slow / Damage Reduction Per Stack
  - Level 15 Talent +1% Corrosive Weaponry Slow / Damage Reduction Per Stack replaced with +1 Acid Spray Armor Reduction

## HERO Invoker (npc_dota_hero_invoker)
### Invoke (invoker_invoke)
  - Now grants Invoker an additional Ability Point at hero levels 6, 12, and 18
### Talents
  - Level 20 Talent +1 Orb Levels replaced with +50% Forged Spirit Armor Reduction

## HERO Silencer (npc_dota_hero_silencer)
### Talents
  - Level 15 Talent Global Silence Cooldown Reduction decreased from 20s to 15s

## HERO Lycan (npc_dota_hero_lycan)
### Shapeshift (lycan_shapeshift)
  - Cooldown decreased from 110/100/90s to 105/95/85s

## HERO Shadow Demon (npc_dota_hero_shadow_demon)
### Disruption (shadow_demon_disruption)
  - Illusion Duration decreased from 11/12/13/14s to 8/10/12/14s
### Talents
  - Level 15 Talent Movement Speed decreased from +25 to +20

## HERO Chaos Knight (npc_dota_hero_chaos_knight)
### Phantasm (chaos_knight_phantasm)
  - Cooldown increased from 75s to 85/80/75s
  - Number of Phantasms increased from 1/2/3 to 3
  - Phantasm Damage decreased from 100% to 50/75/100%

## HERO Meepo (npc_dota_hero_meepo)
- Base Movement Speed decreased from 315 to 310
- Strength gain decreased from 2.2 to 2.0
- MegaMeepo: Cooldown increased from 60s to 90s
- MegaMeepo: Duration decreased from 25s to 20s
### Ransack (meepo_ransack)
  - Health Steal (Heroes) decreased from 9/12/15/18 to 7/10/13/16
### Divided We Stand (meepo_divided_we_stand)
  - Max Health and Max Mana bonuses from items are now penalized by the number of Meepos (like other item bonuses)
  - No longer shares cooldowns of Town Portal Scrolls
### Talents
  - Level 10 Talent +40 Poof Damage replaced with -1.5s Earthbind Cooldown
  - Level 15 Talent -2.5s Earthbind Cooldown replaced with +40 Poof Damage
  - Level 20 Talent Ransack Health Steal decreased from +7 to +6

## HERO Treant Protector (npc_dota_hero_treant)
### Nature's Grasp (treant_natures_grasp)
  - Cooldown increased from 20/19/18/17s to 23/21/19/17s

## HERO Rubick (npc_dota_hero_rubick)
### Talents
  - Level 20 Talent Telekinesis Landing Damage decreased from 325 to 300

## HERO Nyx Assassin (npc_dota_hero_nyx_assassin)
### Vendetta (nyx_assassin_vendetta)
  - Duration decreased from 60s to 45/50/55s

## HERO Naga Siren (npc_dota_hero_naga_siren)
- Base Attack Speed decreased from 110 to 100
### Eelskin (naga_siren_eelskin)
  - Evasion per Naga decreased from 4.9% + 0.1% per level to 4% + 0.1% per level

## HERO Keeper of the Light (npc_dota_hero_keeper_of_the_light)
### Bright Speed (keeper_of_the_light_bright_speed)
  - Intelligence required for 1 movement speed increased from 2.5 to 3
### Spirit Form (keeper_of_the_light_spirit_form)
  - Cast Range Bonus decreased from 100/200/300 to 100/175/250
### Talents
  - Level 15 Talent Spirit Form Bright Speed Bonus decreased from +30% to +25%

## HERO Slark (npc_dota_hero_slark)
### Essence Shift (slark_essence_shift)
  - Duration decreased from 12.5s + 2.5s per level to 10s + 2.5s per level
### Talents
  - Level 20 Talent Essence Shift Duration decreased from +25s to +20s

## HERO Magnus (npc_dota_hero_magnataur)
- Agility gain increased from 2.0 to 2.2
  - Damage gain per level increased from 3.2 to 3.3

## HERO Timbersaw (npc_dota_hero_shredder)
### Whirling Death (shredder_whirling_death)
  - Damage rescaled from 75/120/165/210 to 60/120/180/240
### Timber Chain (shredder_timber_chain)
  - Damage increased from 45/100/155/210 to 45/105/165/225
### Chakram (shredder_chakram)
  - Pass Damage rescaled from 100/150/200 to 75/150/225

## HERO Tusk (npc_dota_hero_tusk)
### Bitter Chill (tusk_bitter_chill)
  - Attack Slow decreased from 17 + 3 per level to 12 + 3 per level
### Drinking Buddies (tusk_drinking_buddies)
  - No longer has an alt-cast
  - Bonus Armor decreased from 10 to 7

## HERO Skywrath Mage (npc_dota_hero_skywrath_mage)
- Base Mana Regen increased by 0.25

## HERO Elder Titan (npc_dota_hero_elder_titan)
### Momentum (elder_titan_momentum)
  - Bonus Speed to Armor increased from 3.6% + 0.4% per level to 5.0% + 0.5% per level

## HERO Techies (npc_dota_hero_techies)
### Talents
  - Level 10 Talent Magic Resistance decreased from +20% to +15%
  - Level 15 Talent Blast Off! Damage decreased from +200 to +175

## HERO Ember Spirit (npc_dota_hero_ember_spirit)
- Base Damage decreased by 3
  - Damage at level 1 decreased from 55-59 to 52-56
### Sleight of Fist (ember_spirit_sleight_of_fist)
  - Mana Cost increased from 60/65/70/75 to 75

## HERO Terrorblade (npc_dota_hero_terrorblade)
### Talents
  - Level 20 Talent Conjure Image Duration decreased from +10s to +8s

## HERO Phoenix (npc_dota_hero_phoenix)
- Base Attack Range decreased from 525 to 500
### Sun Ray (phoenix_sun_ray)
  - Aghanim's Shard no longer slows affected enemies by 10%

## HERO Arc Warden (npc_dota_hero_arc_warden)
### Talents
  - Level 20 Talent Magnetic Field Cooldown Reduction decreased from 5s to 4s
  - Level 20 Talent +200 Spark Wraith Damage replaced with +30s Spark Wraith Duration
  - Level 25 Talent +30s Spark Wraith Duration replaced with +240 Spark Wraith Damage
  - Level 25 Talent Runic Infusion All Attributes Bonus decreased from +1.5 to +1

## HERO Monkey King (npc_dota_hero_monkey_king)
### Changing of the Guard (monkey_king_transfiguration)
  - Cooldown increased from 3s to 5s
### Talents
  - Level 10 Talent Tree Dance Cast Range decreased from +350 to +300

## HERO Pangolier (npc_dota_hero_pangolier)
### Lucky Shot (pangolier_lucky_shot)
  - Attack Speed Reduction decreased from 40/80/120/160 to 35/70/105/140
### Rolling Thunder (pangolier_gyroshell)
  - Total Attack Damage as Damage decreased from 100% to 80%

## HERO Hoodwink (npc_dota_hero_hoodwink)
### Hunter's Boomerang (hoodwink_hunters_boomerang)
  - Debuff Duration decreased from 7s to 6s

## HERO Void Spirit (npc_dota_hero_void_spirit)
### Dissimilate (void_spirit_dissimilate)
  - Damage decreased from 120/200/280/360 to 105/185/265/345

## HERO Snapfire (npc_dota_hero_snapfire)
### Scatterblast (snapfire_scatterblast)
  - Cooldown decreased from 18/15/12/9s to 17/14/11/8s
  - Initial radius increased from 225 to 250

## HERO Dawnbreaker (npc_dota_hero_dawnbreaker)
### Break of Dawn (dawnbreaker_break_of_dawn)
  - Max Damage Increase decreased from 10% + 1% per level to 8% + 1% per level

## HERO Primal Beast (npc_dota_hero_primal_beast)
### Pulverize (primal_beast_pulverize)
  - Cooldown increased from 40/35/30s to 45/40/35s
### Talents
  - Level 10 Talent Damage decreased from +30 to +25

## HERO Largo (npc_dota_hero_largo)
### Encore (largo_encore)
  - Bonus Duration increased from 9% + 1% per level to 10% + 1% per level
### Croak of Genius (largo_croak_of_genius)
  - Mana Cost rescaled from 25/35/45/55 to 40
  - Duration increased from 12/18/24/30s to 15/20/25/30s
### Bullbelly Blitz (largo_song_fight_song)
  - Aghanim's Scepter Damage per stack decreased from 6/12/18 to 6/10/14
### Talents
  - Level 20 Talent Catchy Lick Damage increased from +170 to +200

# NEUTRAL CREEPS
{"name": "npc_dota_neutral_frostbitten_golem", "localized_name": "Ancient Frostbitten Golem", "neutral_creep_notes": [{"indent_level": 1, "note": "Time Warp Aura: Cooldown Reduction decreased from 10/11/12/14% to 8/9/10/11%"}]}
## GENERAL: Mechanics
- Units with flying vision no longer ignore vision restrictions of Roshan's pits. They can no longer see into them from outside and vice versa
  - Affects Clockwerk during Jetpack, Drow Ranger's Glacier, Monkey King during Tree Dance, Night Stalker during Dark Ascension, Treant Protector's Eyes in the Forest, and Visage's Familiars

## GENERAL: Tormentor
- Tormentor: Alleviation: Max health regen increased from 2% to 2.25%
- Tormentor: Alleviation: Duration increased from 10s to 15s

# ITEMS

## Bloodstone (item_bloodstone)
- Health bonus increased from +600 to +625
- Bloodpact cooldown increased from 30s to 35s
- Spell Weakness Aura damage from spells taken decreased from 12% to 10%

## Boots of Bearing (item_boots_of_bearing)
- Swiftness Aura allied movement speed decreased from 20 to 15

## Crella's Crozier (item_crellas_crozier)
- Rite of Rumusque movement speed steal increased from 5% to 6%

## Disperser (item_disperser)
- Suppress duration decreased from 5s to 4s

## Essence Distiller (item_essence_distiller)
- Soul Release radius when ground targeted increased from 400 to 450

## Harpoon (item_harpoon)
- Draw Forth can no longer move the Harpoon caster if they are rooted/leashed/bound
  - Still affects rooted/leashed/bound targets

## Heart of Tarrasque (item_heart)
- Recipe cost increased from 600 to 700. Total cost increased from 5100g to 5200g

## Mage Slayer (item_mage_slayer)
- Mage Slayer damage per second decreased from 40 to 35

## Silver Edge (item_silver_edge)
- Shadow Walk bonus movement speed decreased from 25% to 22%
- Shadow Walk cooldown increased from 20s to 22s

## Shiva's Guard (item_shivas_guard)
- Freezing Aura attack speed reduction decreased from 45 to 40

## Soul Ring (item_soul_ring)
- Cooldown increased from 25s to 30s

## Specialist's Array (item_specialists_array)
- Agility bonus increased from +12 to +15

# NEUTRAL_ITEMS

## Crude (item_enhancement_crude)
- Intelligence penalty increased from 6% to 9%

## Greedy (item_enhancement_greedy)
- Mana bonus decreased from 200/250 to 150/200

## Tough (item_enhancement_tough)
- Damage bonus decreased from +7/10/13/16 to +6/9/12/15

# HEROES

## HERO Anti-Mage (npc_dota_hero_antimage)
### Persecutor (antimage_persectur)
  - Minimum mana threshold for slow improved from 50% to 60%

## HERO Bane (npc_dota_hero_bane)
### Brain Sap (bane_brain_sap)
  - Mana Cost decreased from 120/130/140/150 to 105/120/135/150

## HERO Drow Ranger (npc_dota_hero_drow_ranger)
### Frost Arrows (drow_ranger_frost_arrows)
  - Bonus Damage increased from 10/15/20/25 to 12/18/24/30
### Gust (drow_ranger_wave_of_silence)
  - Mana Cost decreased from 70 to 55

## HERO Juggernaut (npc_dota_hero_juggernaut)
### Blade Fury (juggernaut_blade_fury)
  - Damage per second increased from 80/110/140/170 to 85/115/145/175

## HERO Mirana (npc_dota_hero_mirana)
### Sacred Arrow (mirana_arrow)
  - Damage increased from 60/150/240/330 to 60/160/260/360
### Talents
  - Level 15 Talent Leap Attack Speed increased from +90 to +100
  - Level 20 Talent Celestial Quiver Damage increased from +40 to +50

## HERO Morphling (npc_dota_hero_morphling)
### Waveform (morphling_waveform)
  - Will now be cast in the desired direction, if the target location is further than the cast range

## HERO Shadow Fiend (npc_dota_hero_nevermore)
### Shadowraze (nevermore_shadowraze1)
  - Mana Cost decreased from 80 to 75
### Presence of the Dark Lord (nevermore_dark_lord)
  - Armor Reduction rescaled from 3/4/5/6 to 2.5/4/5.5/7

## HERO Phantom Lancer (npc_dota_hero_phantom_lancer)
### Phantom Rush (phantom_lancer_phantom_edge)
  - Aghanim's Scepter bonus max rush distance decreased from +625 to +575 [From 1225/1300/1375/1450 to 1175/1250/1325/1400]

## HERO Puck (npc_dota_hero_puck)
### Talents
  - Level 15 Talent -15s Dream Coil Cooldown replaced with +2% Puckish Health and Mana Restoration
  - Level 25 Talent Dream Coil Pierces Debuff Immunity replaced with -30s Dream Coil Cooldown

## HERO Razor (npc_dota_hero_razor)
### Talents
  - Level 15 Talent Static Link Damage Steal increased from +5 to +6
  - Level 20 Talent Storm Surge Slow and Damage increased from +30% to +35%

## HERO Sand King (npc_dota_hero_sand_king)
- Base Attack Speed decreased from 110 to 100
### Stinger (sandking_scorpion_strike)
  - Slow Duration rescaled from 4/5/6/7s to 5s
### Epicenter (sandking_epicenter)
  - Base Radius decreased from 500 to 450

## HERO Storm Spirit (npc_dota_hero_storm_spirit)
### Galvanized (storm_spirit_galvanized)
  - Now gains a charge every 3 levels
### Talents
  - Level 10 Talent Overload Attack/Movement Speed Slow increased from +20/20% to +25/25%

## HERO Sven (npc_dota_hero_sven)
### Storm Hammer (sven_storm_bolt)
  - Mana Cost decreased from 110/115/120/125 to 110

## HERO Tiny (npc_dota_hero_tiny)
- Base Attack Speed decreased from 90 to 85
### Grow (tiny_grow)
  - Toss Bonus Damage increased from 50/175/300 to 50/200/350
### Talents
  - Level 10 Talent +8 Strength replaced with +2 Tree Grab Attacks
  - Level 15 Talent -8% Grow Attack Speed Reduction replaced with +10 Strength

## HERO Vengeful Spirit (npc_dota_hero_vengefulspirit)
### Vengeance Aura (vengefulspirit_command_aura)
  - Self Bonus increased from 20% to 25%

## HERO Windranger (npc_dota_hero_windrunner)
### Talents
  - Level 25 Talent Focus Fire Cooldown Advance on Kills decreased from 18s to 16s
  - Level 25 Talent Powershot Max HP Execution Threshold increased from 15% to 16%

## HERO Kunkka (npc_dota_hero_kunkka)
### Admiral's Rum (kunkka_admirals_rum)
  - Cooldown decreased from 60.5s - 0.5s per level to 50.5s - 0.5s per level

## HERO Lina (npc_dota_hero_lina)
### Light Strike Array (lina_light_strike_array)
  - Damage increased from 80/120/160/200 to 80/125/170/215
### Laguna Blade (lina_laguna_blade)
  - Damage increased from 380/565/750 to 400/580/760

## HERO Slardar (npc_dota_hero_slardar)
### Slithereen Crush (slardar_slithereen_crush)
  - Cooldown increased from 7s to 8.5/8/7.5/7s

## HERO Tidehunter (npc_dota_hero_tidehunter)
- Base Mana Regen decreased by 0.5

## HERO Witch Doctor (npc_dota_hero_witch_doctor)
### Voodoo Restoration (witch_doctor_voodoo_restoration)
  - Radius increased from 500/550/600/650 to 650

## HERO Lich (npc_dota_hero_lich)
### Sinister Gaze (lich_sinister_gaze)
  - Mana Drain per second increased from 20% to 25%

## HERO Tinker (npc_dota_hero_tinker)
### Deploy Turrets (tinker_deploy_turrets)
  - Updated sound effects

## HERO Beastmaster (npc_dota_hero_beastmaster)
- Base Strength decreased from 25 to 24
  - Damage at level 1 decreased from 50-54 to 49-53
- Drums of Slom: Damage Radius decreased from 600 to 525
- Drums of Slom: Drum Hit Damage decreased from 80 to 70
### Wild Axes (beastmaster_wild_axes)
  - Mana Cost increased from 50/55/60/65 to 65
### Summon Razorback (beastmaster_summon_razorback)
  - Boar Attack Damage decreased from 30/45/60/75 to 24/41/58/75

## HERO Queen of Pain (npc_dota_hero_queenofpain)
- Base Agility decreased from 22 to 20
### Shadow Strike (queenofpain_shadow_strike)
  - Cooldown rescaled from 13/10/7/4s to 11/9/7/5s
  - Aghanim's Scepter AoE decreased from 375 to 300

## HERO Venomancer (npc_dota_hero_venomancer)
### Poison Sting (venomancer_poison_sting)
  - Movement Slow decreased from 10% to 8%
### Snakebite (venomancer_snakebite)
  - Damage per second rescaled from 20/25/30/35 to 10/20/30/40
### Talents
  - Level 15 Talent Poison Sting Slow increased from +7% to +10%
  - Level 20 Talent +40% Snakebite Damage replaced with +100 Snakebite Initial Damage

## HERO Faceless Void (npc_dota_hero_faceless_void)
### Talents
  - Level 20 Talent Time Walk Cooldown Reduction decreased from 1.25s to 1s
  - Level 20 Talent Attack Speed during Chronosphere decreased from +100 to +80

## HERO Phantom Assassin (npc_dota_hero_phantom_assassin)
- Base Agility increased from 21 to 22
  - Damage at level 1 increased from 56-58 to 57-59
### Talents
  - Level 10 Talent Phantom Strike Duration increased from +0.6 to +0.8s

## HERO Templar Assassin (npc_dota_hero_templar_assassin)
- Base Movement Speed increased from 310 to 315

## HERO Viper (npc_dota_hero_viper)
### Nosedive (viper_nose_dive)
  - Cooldown increased from 20s to 25s

## HERO Nature's Prophet (npc_dota_hero_furion)
### Nature's Call (furion_force_of_nature)
  - Mana Cost decreased from 100 to 85/90/95/100
  - Treant Bonus Hero Damage increased from 4/8/12/16 to 6/10/14/18
### Talents
  - Level 20 Talent Sprout Damage increased from +170 to +220
  - Level 20 Talent Wrath of Nature Cooldown Reduction increased from 15s to 20s

## HERO Dark Seer (npc_dota_hero_dark_seer)
- Base Intelligence increased from 22 to 23
  - Damage at level 1 increased from 53-59 to 54-60

## HERO Omniknight (npc_dota_hero_omniknight)
### Repel (omniknight_martyr)
  - Cooldown decreased from 40/36/32/28s to 40/35/30/25s
### Hammer of Purity (omniknight_hammer_of_purity)
  - Damage increased from 20/40/60/80 to 25/45/65/85

## HERO Huskar (npc_dota_hero_huskar)
- Base Health Regen decreased by 0.25

## HERO Broodmother (npc_dota_hero_broodmother)
### Insatiable Hunger (broodmother_insatiable_hunger)
  - Spiderling Radius increased from 800 to 1200
### Spinner's Snare (broodmother_sticky_snare)
  - Mana Cost decreased from 100 to 70

## HERO Bounty Hunter (npc_dota_hero_bounty_hunter)
### Shuriken Toss (bounty_hunter_shuriken_toss)
  - Mana Cost increased from 75/80/85/90 to 75/85/95/105
### Shadow Walk (bounty_hunter_wind_walk)
  - Bonus Speed increased from 8/12/16/20% to 11/14/17/20%
### Track (bounty_hunter_track)
  - Mana Cost decreased from 60 to 50

## HERO Weaver (npc_dota_hero_weaver)
### The Swarm (weaver_the_swarm)
  - Mana Cost decreased from 110 to 110/105/100/95

## HERO Jakiro (npc_dota_hero_jakiro)
- Strength gain increased from 2.5 to 2.6
### Macropyre (jakiro_macropyre)
  - Mana Cost decreased from 250/350/450 to 225/325/425

## HERO Batrider (npc_dota_hero_batrider)
- Base Movement Speed decreased from 320 to 310
### Sticky Napalm (batrider_sticky_napalm)
  - Aghanim's Shard building damage decreased from 25% to 20%
### Firefly (batrider_firefly)
  - Damage per second decreased from 25/50/75/100 to 20/40/60/80
### Flaming Lasso (batrider_flaming_lasso)
  - Total Damage decreased from 200/350/500 to 125/250/375

## HERO Spectre (npc_dota_hero_spectre)
- Base Agility increased from 26 to 29
  - Damage at level 1 increased from 49-53 to 52-56
### Dispersion (spectre_dispersion)
  - Damage rescaled from 8/12/16/20% to 9/12/15/18%

## HERO Ancient Apparition (npc_dota_hero_ancient_apparition)
### Ice Blast (ancient_apparition_ice_blast)
  - Path Radius increased from 275 to 300
  - Base Area of Effect Radius increased from 275 to 300
### Talents
  - Level 20 Talent Chilling Touch Damage increased from +80 to +100

## HERO Doom (npc_dota_hero_doom_bringer)
### Scorched Earth (doom_bringer_scorched_earth)
  - Bonus HP Regen decreased from 7/8/9/10 to 6.66

## HERO Gyrocopter (npc_dota_hero_gyrocopter)
### Afterburner (gyrocopter_afterburner)
  - Duration increased from 4s to 5s

## HERO Alchemist (npc_dota_hero_alchemist)
### Greevil's Greed (alchemist_goblins_greed)
  - Bonus base/max Extra Gold per melted Scepter decreased from +6 to +3
### Acid Spray (alchemist_acid_spray)
  - Cooldown rescaled from 22/21/20/19s to 21s
### Chemical Rage (alchemist_chemical_rage)
  - Bonus Health Regen decreased from 60/90/120 to 50/85/120

## HERO Invoker (npc_dota_hero_invoker)
- Base Movement Speed decreased from 285 to 280

## HERO Outworld Destroyer (npc_dota_hero_obsidian_destroyer)
### Objurgation (obsidian_destroyer_objurgation)
  - Mana Cost decreased from 250 to 175
### Sanity's Eclipse (obsidian_destroyer_sanity_eclipse)
  - Radius increased from 450/500/550 to 500/525/550
### Talents
  - Level 20 Talent Astral Imprisonment Mana Capacity Steal increased from 10% to 12%

## HERO Lycan (npc_dota_hero_lycan)
### Feral Impulse (lycan_feral_impulse)
  - Health Regen increased from 1/3/5/7 to 2/4/6/8
### Talents
  - Level 10 Talent Wolves Damage increased from +10 to +14
  - Level 15 Talent Summon Wolves Health increased from +350 to +375

## HERO Brewmaster (npc_dota_hero_brewmaster)
### Primal Split (brewmaster_primal_split)
  - Cancel Split now has a 3s initial cooldown

## HERO Lone Druid (npc_dota_hero_lone_druid)
### Summon Spirit Bear (lone_druid_spirit_bear)
  - Mana Cost increased from 75 to 100
### Spirit Link (lone_druid_spirit_link)
  - Shared Lifesteal now follows general lifesteal rules and has a creep penalty of 40%
### Savage Roar (lone_druid_savage_roar)
  - Aghanim's Shard buff duration decreased from 5s to 4s
  - Aghanim's Shard bonus movement speed decreased from 15% to 10%
### Talents
  - Level 10 Talent -25s Summon Spirit Bear Cooldown replaced with +5s True Form Duration

## HERO Chaos Knight (npc_dota_hero_chaos_knight)
### Chaos Strike (chaos_knight_chaos_strike)
  - Critical Max increased from 140/180/220/260% to 150/190/230/270%

## HERO Treant Protector (npc_dota_hero_treant)
### Eyes In The Forest (treant_eyes_in_the_forest)
  - Added AoE indicator to cast
### Talents
  - Level 10 Talent Living Armor Heal Per Second decreased from +4 to +3

## HERO Ogre Magi (npc_dota_hero_ogre_magi)
- Strength gain decreased from 4.2 to 4.0

## HERO Rubick (npc_dota_hero_rubick)
- Agility gain decreased from 2.5 to 2.2
### Talents
  - Level 15 Talent Fade Bolt Cooldown Reduction increased from 3s to 4s
  - Level 15 Talent Stolen Spells Mana Cost Reduction decreased from 50% to 40%
  - Level 25 Talent Curiosity Bonuses decreased from 2x to 1.5x

## HERO Keeper of the Light (npc_dota_hero_keeper_of_the_light)
- Base Movement Speed decreased from 315 to 310

## HERO Io (npc_dota_hero_wisp)
### Tether (wisp_tether)
  - HP/Mana Transfer decreased from 60/80/100/120% to 55/75/95/115%
### Spirits (wisp_spirits)
  - Now remembers the radius of the spirits between casts

## HERO Troll Warlord (npc_dota_hero_troll_warlord)
### Whirling Axes (Ranged) (troll_warlord_whirling_axes_ranged)
  - Mana Cost decreased from 60 to 50
### Whirling Axes (Melee) (troll_warlord_whirling_axes_melee)
  - Damage increased from 50/100/150/200 to 75/120/165/210

## HERO Centaur Warrunner (npc_dota_hero_centaur)
- Base Strength increased from 27 to 28
  - Damage at level 1 increased from 63-65 to 64-66
- Strength gain increased from 4.2 to 4.3
### Talents
  - Level 25 Talent Hoof Stomp Duration increased from +0.8s to +1.0s

## HERO Magnus (npc_dota_hero_magnataur)
### Shockwave (magnataur_shockwave)
  - Slow Duration increased from 0.4/0.6/0.8/1.0s to 0.55/0.7/0.85/1.0s
### Talents
  - Level 15 Talent All Attributes per hero hit with Reverse Polarity increased from +12 to +14

## HERO Timbersaw (npc_dota_hero_shredder)
- Base Damage increased by 2
  - Damage at level 1 decreased from 46-50 to 48-52
- Base Intelligence increased from 23 to 24
### Reactive Armor (shredder_reactive_armor)
  - Bonus HP Regen increased from 0.4/0.5/0.6/0.7 to 0.5/0.6/0.7/0.8

## HERO Bristleback (npc_dota_hero_bristleback)
### Warpath (bristleback_warpath)
  - Damage per stack decreased from 15/20/25 to 12/16/20
### Hairball (bristleback_hairball)
  - Cooldown increased from 13s to 15s
### Talents
  - Level 25 Talent Bristleback Damage Threshold Reduction increased from 25 to 30

## HERO Tusk (npc_dota_hero_tusk)
### Drinking Buddies (tusk_drinking_buddies)
  - No longer castable while rooted

## HERO Skywrath Mage (npc_dota_hero_skywrath_mage)
### Mystic Flare (skywrath_mage_mystic_flare)
  - Cooldown decreased from 60/40/20s to 55/35/15s

## HERO Abaddon (npc_dota_hero_abaddon)
- Base Intelligence increased by 1
  - Damage at level 1 unchanged at 49-59
### Talents
  - Level 10 Talent Curse of Avernus DPS increased from +25 to +30

## HERO Elder Titan (npc_dota_hero_elder_titan)
### Echo Stomp (elder_titan_echo_stomp)
  - Damage increased from 60/100/140/180 to 65/110/155/200
  - Aghanim's Shard with alt-cast no longer swaps the position if Elder Titan is rooted

## HERO Techies (npc_dota_hero_techies)
- Base Mana Regen decreased by 0.5
- Intelligence gain decreased from 3.0 to 2.7
  - Damage gain per level decreased from 3.3 to 3.2
### M.A.D. (techies_mutually_assured_destruction)
  - Mana Pool as Regen rescaled from 0.08% + 0.02% per level to 0.1% + 0.01% per level
### Reactive Tazer (techies_reactive_tazer)
  - Explosion Radius decreased from 450 to 400

## HERO Ember Spirit (npc_dota_hero_ember_spirit)
- Base Strength decreased from 22 to 21

## HERO Earth Spirit (npc_dota_hero_earth_spirit)
- Base Strength increased from 22 to 23
  - Damage at level 1 increased from 47-51 to 48-52

## HERO Phoenix (npc_dota_hero_phoenix)
### Dying Light (phoenix_dying_light)
  - Missing Health as Damage decreased from 4% to 3.5%
### Sun Ray (phoenix_sun_ray)
  - Max Health as Heal per second decreased from 0.5/1/1.5/2% to 0.4/0.8/1.2/1.6%
### Supernova (phoenix_supernova)
  - Damage per second decreased from 60/90/120 to 50/80/110

## HERO Winter Wyvern (npc_dota_hero_winter_wyvern)
### Splinter Blast (winter_wyvern_splinter_blast)
  - Movement Slow decreased from 28/32/36/40% to 27/30/33/36%
### Talents
  - Level 10 Talent Cold Embrace Base Heal per Second decreased from +20 to +15

## HERO Arc Warden (npc_dota_hero_arc_warden)
- Base Agility increased from 20 to 22
  - Damage at level 1 increased from 51-57 to 52-58

## HERO Monkey King (npc_dota_hero_monkey_king)
- Base Agility decreased from 24 to 23
  - Damage at level 1 decreased from 53-57 to 52-56
### Primal Spring (monkey_king_primal_spring)
  - Movement Slow decreased from 35/50/65/80% to 30/40/50/60%

## HERO Dark Willow (npc_dota_hero_dark_willow)
### Terrorize (dark_willow_terrorize)
  - Radius increased from 400/450/500 to 450/500/550

## HERO Pangolier (npc_dota_hero_pangolier)
- Base Health Regen decreased by 1.0
### Swashbuckle (pangolier_swashbuckle)
  - Mana Cost increased from 75/80/85/90 to 85/90/95/100
### Roll Up (pangolier_rollup)
  - Mana Cost increased from 50 to 75
### Talents
  - Level 10 Talent Lucky Shot Armor Reduction decreased from +3 to +2

## HERO Hoodwink (npc_dota_hero_hoodwink)
- Base Damage increased by 3
- Base Agility decreased from 25 to 22
  - Damage at level 1 unchanged at 47-54
### Sharpshooter (hoodwink_sharpshooter)
  - Knockback to Hoodwink won't be applied if Hoodwink is rooted

## HERO Snapfire (npc_dota_hero_snapfire)
- Base Damage increased by 2
  - Damage at level 1 increased from 51-57 to 53-59

## HERO Mars (npc_dota_hero_mars)
### Dauntless (mars_dauntless)
  - HP Regen per extra enemy increased from 40% to 50%
### Spear of Mars (mars_spear)
  - Mana Cost decreased from 100/110/120/130 to 90/100/110/120

## HERO Dawnbreaker (npc_dota_hero_dawnbreaker)
- Base Damage decreased by 1
  - Damage at level 1 decreased from 56-60 to 55-59
### Solar Guardian (dawnbreaker_solar_guardian)
  - Landing Stun Duration decreased from 1.4/1.6/1.8s to 1.2/1.4/1.6s

## HERO Marci (npc_dota_hero_marci)
### Bodyguard (marci_bodyguard)
  - Cast Range increased from 500 to 600
### Talents
  - Level 15 Talent Dispose Damage increased from +100 to +115

## HERO Primal Beast (npc_dota_hero_primal_beast)
### Trample (primal_beast_trample)
  - Damage AoE decreased from 230 to 200

## HERO Muerta (npc_dota_hero_muerta)
- Base Attack Speed decreased from 115 to 110
### Supernatural (muerta_supernatural)
  - Maximum Stack Count increased from 1 per hero level to 5 + 1 per hero level

## HERO Largo (npc_dota_hero_largo)
### Talents
  - Level 20 Talent +200 Catchy Lick Damage replaced with 2x Catchy Lick Charges
  - Level 25 Talent 2x Catchy Lick Charges replaced with 2x Frogstomp Stomps / Interval

## HERO ? (?)
- Gold/Experience Bounty increased from 175 + 8 per Spirit Bear level up to 165 + 10 per Spirit Bear level
### Talents
  - Level 25 Talent Demolish Bonus Building Damage decreased from +20% to +15%
## GENERAL: Mechanics
- Dire Fountain: Rejuvenation Aura radius has been slightly increased
- Self-Cast on Town Portal Scroll's Teleport and other similar abilities now place the hero slightly closer to the Ancient
- Town Portal Scroll's Teleport and other similar ability effects now partially follow the channeling unit even if they move after starting their teleport.

# ITEMS

## Dagon (item_dagon)
- Recipe cost decreased from 1150 to 1100
  - Total cost decreased from 3050/4200/5350/6500/7650g to 3000/4100/5200/6300/7400g

## Mage Slayer (item_mage_slayer)
- Damage bonus decreased from +15 to +12

## Smoke of Deceit (item_smoke_of_deceit)
- Using Smoke of Deceit now broadcasts a chat message in allied chat

# NEUTRAL_ITEMS

## Artifacts (Artifacts)

## Flayer's Bota (item_flayers_bota)
- Bloodrush range increased from 1200 to 1500

## Idol of Scree'auk (item_idol_of_screeauk)
- False Flight bonus evasion increased from 25% to 35%

## Prophet's Pendulum (item_prophets_pendulum)
- Linger delayed damage is now non-lethal if the incoming damage source was non-lethal

## Dezun Bloodrite (item_dezun_bloodrite)
- Blood Invocation bonus AoE increased from 16% to 20%

## Fallen Sky (item_fallen_sky)
- Fallen Sky building impact damage increased from 75 to 110

## Harmonizer (item_harmonizer)
- Balance mana cost reduction per ability off cooldown increased from 5% to 7%

## Riftshadow Prism (item_riftshadow_prism)
- Refract illusion's outgoing damage increased from 50% to 60%

## Spider Legs (item_spider_legs)
- Skitter cooldown decreased from 20s to 15s
- Skitter duration decreased from 14s to 12s

## Witchbane (item_heavy_blade)
- Cleanse cast range increased from 500 to 700
- Cleanse: Mana Cost decreased from 150 to 50

## Enchantments (Enchantments)

## Alert (item_enhancement_alert)
- Night Vision bonus decreased from +0/150/225/300 to +0/125/175/225
- Attack Range bonus decreased from +0/0/0/100 to +0/0/0/80

## Timeless (item_enhancement_timeless)
- Spell Amplification bonus decreased from +6/16% to +5/12%

## Titanic (item_enhancement_titanic)
- Attack Speed penalty decreased from 10/12/14% to 9%

## Vital (item_enhancement_vital)
- Health Regen bonus increased from +2 to +2.25

# HEROES

## HERO Anti-Mage (npc_dota_hero_antimage)
- Base Agility increased from 24 to 25
  - Damage at level 1 increased by 1 (from 53-57 to 54-58)
### Blink (antimage_blink)
  - Mana Cost decreased from 65/60/55/50 to 60/55/50/45

## HERO Axe (npc_dota_hero_axe)
- Base Health Regen decreased by 0.5 [Sense of Foreboding increased from 0 to 0.5]
### Battle Hunger (axe_battle_hunger)
  - Cast Range decreased from 700/775/850/925 to 600/700/800/900

## HERO Bloodseeker (npc_dota_hero_bloodseeker)
### Bloodrage (bloodseeker_bloodrage)
  - No longer procs Magic Stick or its upgrades
### Rupture (bloodseeker_rupture)
  - Aghanim's Scepter health damage increased from 13% to 15%

## HERO Earthshaker (npc_dota_hero_earthshaker)
- Base Mana Regen increased by 0.25

## HERO Juggernaut (npc_dota_hero_juggernaut)
### Blade Fury (juggernaut_blade_fury)
  - Mana Cost decreased from 120 to 110

## HERO Mirana (npc_dota_hero_mirana)
### Celestial Quiver (mirana_celestial_quiver)
  - Max Charges increased from 2 + 1 per 7 levels to 2 + 1 per 6 levels
### Starstorm (mirana_starfall)
  - Second Meteor Damage increased from 70% to 80%

## HERO Morphling (npc_dota_hero_morphling)
- Base Strength decreased from 23 to 16
- Base Agility increased from 24 to 33
  - Damage at level 1 increased by 9 (from 36-45 to 45-54)
### Ebb and Flow (morphling_ebb_and_flow)
  - Agility to Attack Range increased from 20% to 25%
  - Strength to Cast Range increased from 20% to 25%
  - Strength to Slow Resistance increased from 20% to 25%
### Morph (morphling_replicate)
  - Aghanim's Scepter illusion incoming damage decreased from 300% to 200%

## HERO Puck (npc_dota_hero_puck)
- Agility gain decreased from 2.3 to 2.1
### Talents
  - Level 10 Talent Illusory Orb Damage decreased from +40 to +35

## HERO Pudge (npc_dota_hero_pudge)
- Base Agility increased from 11 to 13

## HERO Razor (npc_dota_hero_razor)
- Base attack speed increased from 100 to 110

## HERO Sand King (npc_dota_hero_sand_king)
- Strength gain increased from 2.3 to 2.5
  - Damage gain per level increased from 2.8 to 2.9

## HERO Storm Spirit (npc_dota_hero_storm_spirit)
- Base Attack Speed decreased from 115 to 110
### Talents
  - Level 25 Talent 2x Overload Attack Bounce damage decreased from 65% to 50%

## HERO Sven (npc_dota_hero_sven)
### Storm Hammer (sven_storm_bolt)
  - Stun Duration increased from 1/1.2/1.4/1.6s to 1/1.25/1.5/1.75s
### God's Strength (sven_gods_strength)
  - Slow Resistance increased from 30% to 40%

## HERO Tiny (npc_dota_hero_tiny)
### Insurmountable (tiny_insurmountable)
  - Strength to Slow Resist decreased from 20% to 15%
### Toss (tiny_toss)
  - Flight time decreased from 1.25s to 1.1s
### Tree Grab (tiny_tree_grab)
  - Cooldown increased from 15/12/9/6s to 16/13/10/7s
### Tree Throw (tiny_toss_tree)
  - Cast Range decreased from 1200 to 1000
### Grow (tiny_grow)
  - Aghanim's Shard movement slow increased from 25% to 35%
  - Aghanim's Shard slow duration increased from 2.5s to 3s
### Tree Volley (tiny_tree_channel)
  - Mana Cost decreased from 200 to 150

## HERO Vengeful Spirit (npc_dota_hero_vengefulspirit)
- Base Health Regen increased by 0.5
### Magic Missile (vengefulspirit_magic_missile)
  - Damage increased from 85/170/255/340 to 100/180/260/340

## HERO Lina (npc_dota_hero_lina)
### Dragon Slave (lina_dragon_slave)
  - Mana Cost decreased from 100/110/120/130 to 90/100/110/120

## HERO Lion (npc_dota_hero_lion)
### Finger of Death (lion_finger_of_death)
  - Damage per kill decreased from 30 to 25
### Talents
  - Level 15 Talent Hex Cooldown Reduction decreased from 2.5s to 2s

## HERO Shadow Shaman (npc_dota_hero_shadow_shaman)
### Mass Serpent Ward (shadow_shaman_mass_serpent_ward)
  - Gold Bounty decreased from 22-30 to 20-26
### Urnaconda (shadow_shaman_urnaconda)
  - Mana Cost increased from 115 to 140

## HERO Slardar (npc_dota_hero_slardar)
### Corrosive Haze (slardar_amplify_damage)
  - Armor Reduction decreased from 10/15/20 to 8/14/20

## HERO Riki (npc_dota_hero_riki)
### Backstab (riki_innate_backstab)
  - Effectiveness on allies increased from 25% to 30%
### Smoke Screen (riki_smoke_screen)
  - Cooldown rescaled from 17/15/13/11s to 15/14/13/12s
### Blink Strike (riki_blink_strike)
  - Bonus Damage rescaled from 15/30/45/60 to 25/35/45/55

## HERO Enigma (npc_dota_hero_enigma)
### Demonic Summoning (enigma_demonic_conversion)
  - Cooldown rescaled from 40/38/36/34s to 45/40/35/30s

## HERO Sniper (npc_dota_hero_sniper)
### Keen Scope (sniper_keen_scope)
  - No longer applies on denies or buildings

## HERO Warlock (npc_dota_hero_warlock)
### Upheaval (warlock_upheaval)
  - Cooldown decreased from 60/50/40/30s to 45/40/35/30s
### Talents
  - Level 25 Talent Fatal Bonds Targets increased from +4 to +5

## HERO Venomancer (npc_dota_hero_venomancer)
- Intelligence gain increased from 1.8 to 1.9
  - Damage gain per level increased from 3.0 to 3.1

## HERO Faceless Void (npc_dota_hero_faceless_void)
### Time Walk (faceless_void_time_walk)
  - Aghanim's Scepter Time Lock radius decreased from 400 to 325
### Time Dilation (faceless_void_time_dilation)
  - Radius decreased from 775 to 700

## HERO Wraith King (npc_dota_hero_skeleton_king)
- Base Damage increased by 2
  - Damage at level 1 increased from 60-62 to 62-64
### Vampiric Spirit (skeleton_king_vampiric_spirit)
  - Lifesteal rescaled from 14% + 1% per level to 20% + 0.5% per level
### Reincarnation (skeleton_king_reincarnation)
  - Aghanim's Scepter cooldown increased from 165/135/105s to 170/140/110s
### Talents
  - Level 10 Talent Vampiric Spirit Lifesteal decreased from +10% to +8%

## HERO Pugna (npc_dota_hero_pugna)
- Base Mana Regen increased by 0.25
### Nether Ward (pugna_nether_ward)
  - Cast Range increased from 150 to 175

## HERO Templar Assassin (npc_dota_hero_templar_assassin)
### Inner Peace (templar_assassin_inner_peace)
  - Time until meditation starts decreased from 0.25s to 0.2s
  - Meditation Time Until Max Bonus decreased from 2.05s - 0.05s per level to 1.85s - 0.05s per level
### Talents
  - Level 10 Talent Psionic Trap Slow increased from +10% to +15%

## HERO Dragon Knight (npc_dota_hero_dragon_knight)
### Dragon Tail (dragon_knight_dragon_tail)
  - AoE increased from 25 to 50
### Talents
  - Level 20 Talent Breathe Fire Damage increased from +200 to +220

## HERO Dazzle (npc_dota_hero_dazzle)
### Poison Touch (dazzle_poison_touch)
  - Bonus Slow Per Hit increased from 2/2.5/3/3.5% to 2.5/3/3.5/4%

## HERO Clockwerk (npc_dota_hero_rattletrap)
### Power Cogs (rattletrap_power_cogs)
  - Mana Cost increased from 60/65/70/75 to 75
  - Pushback and damage now apply against heroes with no mana
  - Damage rescaled from 50/125/200/275 to 55/110/165/220
### Talents
  - Level 15 Talent Hookshot Cooldown Reduction decreased from 10s to 8s

## HERO Leshrac (npc_dota_hero_leshrac)
### Pulse Nova (leshrac_pulse_nova)
  - Mana/Sec decreased from 25/45/65 to 20/40/60
### Nihilism (leshrac_greater_lightning_storm)
  - Slow increased from 30% to 40%

## HERO Nature's Prophet (npc_dota_hero_furion)
### Spirit of the Forest (furion_spirit_of_the_forest)
  - Treants that are alive now always contribute to the bonus damage, even if they are out of range
### Talents
  - Level 20 Talent Sprout Damage increased from +220 to +240

## HERO Dark Seer (npc_dota_hero_dark_seer)
- Base Health Regen increased by 0.5

## HERO Clinkz (npc_dota_hero_clinkz)
### Death Pact (clinkz_death_pact)
  - Mana Cost decreased from 60 to 50

## HERO Omniknight (npc_dota_hero_omniknight)
- Base Intelligence increased from 16 to 18

## HERO Huskar (npc_dota_hero_huskar)
### Burning Spear (huskar_burning_spear)
  - Burn Damage decreased from 5/10/15/20 to 4/8/12/16

## HERO Night Stalker (npc_dota_hero_night_stalker)
### Talents
  - Level 25 Talent Dark Ascension Cooldown Reduction decreased from 40s to 35s

## HERO Broodmother (npc_dota_hero_broodmother)
### Spawn Spiderlings (broodmother_spawn_spiderlings)
  - Spiderlings HP increased from 300 to 325

## HERO Bounty Hunter (npc_dota_hero_bounty_hunter)
### Big Game Hunter (bounty_hunter_big_game_hunter)
  - Bonus gold increased from 15% to 20%

## HERO Weaver (npc_dota_hero_weaver)
### Threads of Fate (weaver_threads_of_fate)
  - Slow Duration increased from 0.2s to 0.4s

## HERO Jakiro (npc_dota_hero_jakiro)
- Base Intelligence increased from 25 to 26
  - Damage at level 1 increased by 1 (from 52-60 to 53-61)
### Talents
  - Level 10 Talent Ice Path Damage increased from +75 to +100
  - Level 25 Talent Liquid Frost and Fire Max Health Damage increased from +3% to +3.5%

## HERO Spectre (npc_dota_hero_spectre)
- Base Strength increased from 21 to 22
- Agility gain decreased from 2.4 to 2.3
### Spectral Dagger (spectre_spectral_dagger)
  - Movement Speed Change rescaled from 10/14/18/22% to 14/16/18/20%
### Shadow Step (spectre_shadow_step)
  - Illusion Damage Taken rescaled from 200/185/170/155% to 175%
  - Cast Range rescaled from 825/950/1075/1200 to 1000
### Haunt (spectre_haunt)
  - Mana Cost increased from 125/150/175 to 125/175/225
  - Aghanim's Scepter fear duration increased from 1.5s to 2s

## HERO Ancient Apparition (npc_dota_hero_ancient_apparition)
### Cold Feet (ancient_apparition_cold_feet)
  - Damage per second increased from 20/40/60/80 to 25/45/65/85
### Chilling Touch (ancient_apparition_chilling_touch)
  - Cooldown decreased from 12/9/6/3s to 10/7.5/5/2.5s
  - Damage increased from 30/60/90/120 to 35/65/95/125

## HERO Doom (npc_dota_hero_doom_bringer)
- Intelligence gain increased from 1.9 to 2.1
### Devour (doom_bringer_devour)
  - Aghanim's Shard bonus AoE decreased from 20% to 15%

## HERO Spirit Breaker (npc_dota_hero_spirit_breaker)
### Charge of Darkness (spirit_breaker_charge_of_darkness)
  - Mana Cost decreased from 90/100/110/120 to 80/90/100/110
### Greater Bash (spirit_breaker_greater_bash)
  - Aghanim's Scepter creep damage decreased from 25% to 20%

## HERO Gyrocopter (npc_dota_hero_gyrocopter)
- Night Vision increased from 800 to 1000
### Flak Cannon (gyrocopter_flak_cannon)
  - No longer provides 200 Bonus Night Vision
### Call Down (gyrocopter_call_down)
  - Missile Slow increased from 50% to 60%
### Side Gunner (gyrocopter_side_gunner_spawn_ability)
  - No longer attacks 2 units at a time while Flak Cannon is active
### Talents
  - Level 25 Talent Flak Cannon Cooldown Reduction increased from 4s to 6s

## HERO Invoker (npc_dota_hero_invoker)
### Ghost Walk (invoker_ghost_walk)
  - Cooldown increased from 32s to 40s
### Chaos Meteor (invoker_chaos_meteor)
  - Contact Damage decreased from 55/80/105/130/155/180/205/220/235 to 55/75/95/115/135/155/175/195/215
### Ice Wall (invoker_ice_wall)
  - Movement Slow rescaled from 20/40/60/80/100/120/140/160/180% to 30/45/60/75/90/105/120/135/150%

## HERO Outworld Destroyer (npc_dota_hero_obsidian_destroyer)
- Min Base damage increased by 4
- Max Base damage increased by 1
  - Damage at level 1 increased from 49-61 to 53-62 [Damage spread decreased from 12 to 9]

## HERO Brewmaster (npc_dota_hero_brewmaster)
### Liquid Courage (brewmaster_liquid_courage)
  - Aghanim's Shard max HP regen per second increased from 2.5% to 3%
### Thunder Clap (brewmaster_thunder_clap)
  - Slow duration increased from 4s to 4/4.25/4.5/4.75s
### Talents
  - Level 10 Talent Brewlings Base Damage decreased from +14 to +13
  - Level 20 Talent Primal Split Cooldown Reduction decreased from 15s to 12s

## HERO Shadow Demon (npc_dota_hero_shadow_demon)
### Shadow Poison (shadow_demon_shadow_poison)
  - Mana Cost decreased from 45 to 40
  - Damage per additional stack over 5 stacks increased from 50 to 60

## HERO Chaos Knight (npc_dota_hero_chaos_knight)
### Phantasm (chaos_knight_phantasm)
  - Phantasm Damage increased from 50/75/100% to 60/80/100%

## HERO Ogre Magi (npc_dota_hero_ogre_magi)
- Base Strength increased from 25 to 26
  - Damage at level 1 increased by 1 (from 70-76 to 71-77)

## HERO Undying (npc_dota_hero_undying)
- Base Mana Regen increased by 0.25

## HERO Rubick (npc_dota_hero_rubick)
### Fade Bolt (rubick_fade_bolt)
  - Damage decreased from 100/175/250/325 to 85/165/245/325
  - Debuff Duration decreased from 10s to 9s

## HERO Disruptor (npc_dota_hero_disruptor)
- Base Movement Speed increased from 295 to 300
### Thunder Strike (disruptor_thunder_strike)
  - Mana Cost decreased from 125/130/135/140 to 115/120/125/130

## HERO Visage (npc_dota_hero_visage)
### Grave Chill (visage_grave_chill)
  - Attack Speed Drain rescaled from 25/40/55/70 to 35/45/55/65

## HERO Slark (npc_dota_hero_slark)
### Saltwater Shiv (slark_saltwater_shiv)
  - Cooldown decreased from 14/12/10/8s to 12/10.5/9/7.5s

## HERO Troll Warlord (npc_dota_hero_troll_warlord)
### Battle Trance (troll_warlord_battle_trance)
  - Movement Speed increased from 25/30/35% to 35%

## HERO Timbersaw (npc_dota_hero_shredder)
- Base Attack Speed decreased from 100 to 90
### Whirling Death (shredder_whirling_death)
  - Stat Loss Duration decreased from 11/12/13/14s to 7/9/11/13s
### Flamethrower (shredder_flamethrower)
  - Move Slow increased from 30% to 40%
### Talents
  - Level 20 Talent Chakram Slow increased from +5% to +6%
  - Level 20 Talent Exposure Therapy Heals Per Tree Destroyed increased from 10 to 12

## HERO Skywrath Mage (npc_dota_hero_skywrath_mage)
- Base Strength increased from 21 to 22

## HERO Abaddon (npc_dota_hero_abaddon)
- Base Attack Speed increased from 95 to 100
### Withering Mist (abaddon_withering_mist)
  - Heal Reduction increased from 24.5% + 0.5% per level to 29.5% + 0.5% per level

## HERO Elder Titan (npc_dota_hero_elder_titan)
### Natural Order (elder_titan_natural_order)
  - Radius increased from 350 to 375
### Earth Splitter (elder_titan_earth_splitter)
  - Movement Slow increased from 30/40/50% to 40/45/50%

## HERO Legion Commander (npc_dota_hero_legion_commander)
### Duel (legion_commander_duel)
  - Mana Cost increased from 75 to 80/100/120

## HERO Techies (npc_dota_hero_techies)
### Reactive Tazer (techies_reactive_tazer)
  - Disarm duration decreased from 2.4/2.7/3/3.3s to 2.25/2.5/2.75/3s
### Proximity Mines (techies_land_mines)
  - Debuff Duration decreased from 5s to 4s

## HERO Ember Spirit (npc_dota_hero_ember_spirit)
### Sleight of Fist (ember_spirit_sleight_of_fist)
  - Bonus Hero Damage decreased from 50/90/130/170 to 40/80/120/160

## HERO Earth Spirit (npc_dota_hero_earth_spirit)
### Stone Remnant (earth_spirit_stone_caller)
  - Passive bonus damage per unused charge increased from 2.5% to 3%

## HERO Phoenix (npc_dota_hero_phoenix)
### Fire Spirits (phoenix_fire_spirits)
  - Attack Speed Slow decreased from 50/80/110/140 to 35/70/105/140
### Talents
  - Level 20 Talent Max Health Sun Ray Damage decreased from +1.5% to +1.25%

## HERO Winter Wyvern (npc_dota_hero_winter_wyvern)
### Talents
  - Level 10 Talent Damage decreased from +35 to +30
  - Level 20 Talent Arctic Burn Slow decreased from +15% to +10%

## HERO Arc Warden (npc_dota_hero_arc_warden)
### Flux (arc_warden_flux)
  - Cast Range increased from 500/600/700/800 to 625/700/775/850
  - Movement Speed Slow increased from 14/21/28/35% to 20/25/30/35%

## HERO Dark Willow (npc_dota_hero_dark_willow)
- Base Intelligence increased from 21 to 22
  - Damage at level 1 increased by 1 (from 48-56 to 49-57)
### Cursed Crown (dark_willow_cursed_crown)
  - Cast Range increased from 600/625/650/675 to 700

## HERO Pangolier (npc_dota_hero_pangolier)
- Base Agility decreased from 18 to 17
  - Damage at level 1 decreased from 50-56 to 49-55
- Base Armor decreased by 1

## HERO Grimstroke (npc_dota_hero_grimstroke)
### Dark Portrait (grimstroke_dark_portrait)
  - Magic Resistance decreased from 95% to 90%
### Talents
  - Level 20 Talent Attacks to Destroy Phantom decreased from +3 to +2

## HERO Hoodwink (npc_dota_hero_hoodwink)
### Acorn Shot (hoodwink_acorn_shot)
  - Cooldown increased from 16/14/12/10s to 19/16/13/10s
### Scurry (hoodwink_scurry)
  - Bonus Movement Speed decreased from 20/25/30/35% to 15/20/25/30%

## HERO Snapfire (npc_dota_hero_snapfire)
### Boomstick (snapfire_boomstick)
  - No longer applies on denies or buildings
### Firesnap Cookie (snapfire_firesnap_cookie)
  - Aghanim's Shard heal amount decreased from 200 to 175
### Talents
  - Level 15 Talent Firesnap Cookie Cooldown Reduction decreased from 4s to 3s

## HERO Mars (npc_dota_hero_mars)
### Dauntless (mars_dauntless)
  - Radius increased from 700 to 900
### God's Rebuke (mars_gods_rebuke)
  - Now turns Mars in the cast direction when cast with Bulwark toggled on
### Arena Of Blood (mars_arena_of_blood)
  - Spear Damage increased from 80/160/240 to 80/170/260

## HERO Ringmaster (npc_dota_hero_ringmaster)
### Funhouse Mirror (ringmaster_funhouse_mirror)
  - Proportion Distortion Illusion damage increased from 28% to 100%
### Talents
  - Level 25 Talent Wheel of Wonder Radius and Range increased from +100 to +150

## HERO Dawnbreaker (npc_dota_hero_dawnbreaker)
### Starbreaker (dawnbreaker_fire_wreath)
  - Mana Cost increased from 100 to 110

## HERO Marci (npc_dota_hero_marci)
### Special Delivery (marci_special_delivery)
  - Cooldown decreased from 245s - 5s per level to 215s - 5s per level
### Bodyguard (marci_bodyguard)
  - Mana Cost decreased from 60/65/70/75 to 60

## HERO Kez (npc_dota_hero_kez)
### Switch Discipline (kez_switch_weapons)
  - Katana Bonus Agility Base Damage decreased from 16% to 12%
### Kazurai Katana (kez_kazurai_katana)
  - Cooldown increased from 20/15/10/5s to 24/18/12/6s
### Shodo Sai (kez_shodo_sai)
  - Cooldown increased from 20/15/10/5s to 24/18/12/6s
  - Parry Duration decreased from 2s to 1.5s
### Talents
  - Level 10 Talent +12% Magic Resistance replaced with +6% Switch Discipline Swap Bonuses [Katana Swap Bonus Damage from 12% to 18%. Sai Swap Movement Speed from 12% to 18%]

## HERO Largo (npc_dota_hero_largo)
### Encore (largo_encore)
  - Bonus Duration increased from 10% + 1% per level to 15% + 1% per level
### Amphibian Rhapsody (largo_amphibian_rhapsody)
  - Song Mana Costs increased from 20/32/44 to 25/35/45

## HERO ? (?)
- Base Health Regen decreased by 1.5
### Talents
  - Level 10 Talent Movement Speed decreased from +20 to +15
## GENERAL: Twin Gates
- Channeling the Twin Gate can now be interrupted by root

## GENERAL: Tormentor
- Now disjoints projectiles when moving between chasms

# ITEMS

## Abyssal Blade (item_abyssal_blade)
- Strength bonus increased from +26 to +30

## Butterfly (item_butterfly)
- Agility bonus decreased from +35 to +30
- Damage bonus increased from +25 to +30

## Chasm Stone (item_chasm_stone)
- Cost increased from 800 to 900

## Shiva's Guard (item_shivas_guard)
- Recipe cost decreased from 1350 to 1250. Total cost unchanged at 4500g

## Gleipnir (item_gungir)
- Recipe cost decreased from 400 to 300. Total cost unchanged at 4650g

## Crella's Crozier (item_crellas_crozier)
- Rite of Rumusque movement speed steal duration increased from 1.5s to 2s
- Rite of Rumusque Putrefaction Aura effect increased from 75% to 90%

## Divine Rapier (item_rapier)
- Spell Amplification from multiple Divine Rapiers no longer stacks

## Eye of Skadi (item_skadi)
- Cold Attack attack speed slow increased from 20% to 25%

## Hand of Midas (item_hand_of_midas)
- Attack Speed bonus increased from +35 to +40

## Heaven's Halberd (item_heavens_halberd)
- Disarm cooldown decreased from 16s to 15s

## Hurricane Pike (item_hurricane_pike)
- Hurricane Thrust buff duration decreased from 6s to 5s

## Kaya (item_kaya)
- Mana Regen Amplification decreased from 30% to 20%

## Meteor Hammer (item_meteor_hammer)
- Mana Regen Amplification decreased from 35% to 25%

## Kaya and Sange (item_kaya_and_sange)
- Mana Regen Amplification decreased from 40% to 30%

## Yasha and Kaya (item_yasha_and_kaya)
- Mana Regen Amplification decreased from 40% to 30%

## Mask of Madness (item_mask_of_madness)
- Berserk movement speed bonus on ranged heroes decreased from 8% to 6%
- Berserk now provides 15% slow resistance for ranged heroes and 30% for melee heroes, instead of 30% for any hero

## Orb of Frost (item_orb_of_frost)
- Frost no longer applies when attacking allies
- Frost health restoration reduction increased from 13% to 15%

## Orb of Corrosion (item_orb_of_corrosion)
- Corrosion health restoration reduction increased from 16% to 18%

## Orb of Venom (item_orb_of_venom)
- Poison Attack damage per second increased from 10 to 12

## Refresher Shard (item_refresher_shard)
- No longer provides +12 Health Regen, +6 Mana Regen, or +20 Damage

## Satanic (item_satanic)
- Unholy Rage cooldown increased from 30s to 40s

## Smoke of Deceit (item_smoke_of_deceit)
- Disguise now has a fixed duration and is not affected by buff duration amplification

## Urn of Shadows (item_urn_of_shadows)
- Mana Regen bonus decreased from +1.25 to +1
- When in Stash, no longer grants charges from nearby hero deaths

## Essence Distiller (item_essence_distiller)
- When in Stash, no longer grants charges from nearby hero deaths

## Spirit Vessel (item_spirit_vessel)
- When in Stash, no longer grants charges from nearby hero deaths

## Veil of Discord (item_veil_of_discord)
- Spell Weakness mana cost decreased from 50 to 25

# NEUTRAL_ITEMS

## Artifacts (Artifacts)

## Forager's Kit (item_foragers_kit)
- Forage time decreased from 1s to 0.75s

## Conjurer's Catalyst (item_conjurers_catalyst)
- Spellover non-hero explosion damage decreased from 30 to 20 [From 39 to 26 with Dormant Curio]
- Spellover damage threshold on illusions now only considers pre-amplification damage

## Enchanter's Bauble (item_enchanters_bauble)
- Enchant recraft bonus decreased from 40% to 35% [From 52% to 45.5% with Dormant Curio]

## Witchbane (item_heavy_blade)
- Cleanse cooldown decreased from 40s to 30s

## Enchantments (Enchantments)

## Greedy (item_enhancement_greedy)
- GPM Bonus decreased from +75/100 to +65/90

## Feverish (item_enhancement_feverish)
- No longer increases Mana Cost/Lost by 7%
- Now decreases maximum mana by 20%

# HEROES

## HERO Axe (npc_dota_hero_axe)
- Base Agility decreased from 20 to 18
### Battle Hunger (axe_battle_hunger)
  - Damage per second decreased from 12/18/24/30 to 12/16/20/24

## HERO Bane (npc_dota_hero_bane)
### Ichor of Nyctasha (bane_ichor_of_nyctasha)
  - Max Terrors per hero increased from 5 to 6
  - Status Resistance per Terror decreased from 5% to 4%
### Nightmare (bane_nightmare)
  - Duration decreased from 3.5/4.5/5.5/6.5s to 3/4/5/6s
  - Now completely disables the target's sight, instead of overriding the vision range value
### Fiend's Grip (bane_fiends_grip)
  - Aghanim's Scepter cooldown reduction decreased from 45s to 40s

## HERO Drow Ranger (npc_dota_hero_drow_ranger)
### Multishot (drow_ranger_multishot)
  - Mana Cost increased from 50/70/90/110 to 70/85/100/115
  - Arrow Range rescaled from 1.75x Drow Ranger's Attack Range to 475 + 1x Drow Ranger's Attack Range
  - Arrow Base Damage Bonus decreased from 100/120/140/160% to 80/100/120/140%

## HERO Morphling (npc_dota_hero_morphling)
### Morph (morphling_replicate)
  - Cooldown decreased from 140/100/60s to 125/90/55s
  - Aghanim's Scepter illusion no longer has illusion vision penalty

## HERO Shadow Fiend (npc_dota_hero_nevermore)
- Base Intelligence decreased from 18 to 16
### Shadowraze (nevermore_shadowraze1)
  - Stack duration decreased from 7s to 6s
### Talents
  - Level 25 Talent Shadowraze Applies Attack Damage no longer applies attack modifiers or procs

## HERO Phantom Lancer (npc_dota_hero_phantom_lancer)
### Juxtapose (phantom_lancer_juxtapose)
  - Aghanim's Shard cooldown increased from 15s to 18s

## HERO Puck (npc_dota_hero_puck)
### Illusory Orb (puck_illusory_orb)
  - Cooldown increased from 11/10/9/8s to 12/11/10/9s

## HERO Tiny (npc_dota_hero_tiny)
- Base Health Regen decreased by 1.0

## HERO Vengeful Spirit (npc_dota_hero_vengefulspirit)
### Vengeance Aura (vengefulspirit_command_aura)
  - Aghanim's Scepter illusion no longer has illusion vision penalty

## HERO Zeus (npc_dota_hero_zuus)
### Thundergod's Wrath (zuus_thundergods_wrath)
  - Damage decreased from 300/475/650 to 275/425/575
### Lightning Hands (zuus_lightning_hands)
  - Toggling on/off no longer breaks invisibility and can be done while silenced
  - Bonus Attack Speed decreased from 30 to 20

## HERO Lina (npc_dota_hero_lina)
- Base Agility decreased from 23 to 21

## HERO Witch Doctor (npc_dota_hero_witch_doctor)
### Maledict (witch_doctor_maledict)
  - Level 20 Talent Maledict bursts deal 75% damage in a 800 AoE now considers illusions as creep targets and bursts from them will not deal damage

## HERO Sniper (npc_dota_hero_sniper)
### Concussive Grenade (sniper_concussive_grenade)
  - Can now be cast while rooted, but will not knock Sniper back if he is under the effect of root

## HERO Necrophos (npc_dota_hero_necrolyte)
### Sadist (necrolyte_sadist)
  - HP/Mana Regen decreased from 3.7 + 0.3 per level to 3.8 + 0.2 per level
### Death Seeker (necrolyte_death_seeker)
  - Cast Range decreased from 750 to 600

## HERO Beastmaster (npc_dota_hero_beastmaster)
### Talents
  - Level 20 Talent Damage to Beastmaster and his summons decreased from +30 to +25
  - Level 25 Talent Primal Roar Cooldown Reduction decreased from 25s to 20s

## HERO Queen of Pain (npc_dota_hero_queenofpain)
### Shadow Strike (queenofpain_shadow_strike)
  - Mana Cost decreased from 100/110/120/130 to 100/105/110/115
### Sonic Wave (queenofpain_sonic_wave)
  - Damage from two Sonic Waves cast in quick succession now stack

## HERO Venomancer (npc_dota_hero_venomancer)
### Snakebite (venomancer_snakebite)
  - Initial Damage increased from 40/60/80/100 to 40/70/100/130

## HERO Death Prophet (npc_dota_hero_death_prophet)
- Agility gain increased from 2.0 to 2.3
  - Damage gain per level increased from 3.6 to 3.7

## HERO Phantom Assassin (npc_dota_hero_phantom_assassin)
### Blur (phantom_assassin_blur)
  - Now cannot be dispelled

## HERO Pugna (npc_dota_hero_pugna)
- Base Intelligence increased from 26 to 27
  - Damage at level 1 increased from 47-54 to 48-55

## HERO Templar Assassin (npc_dota_hero_templar_assassin)
### Psionic Projection (templar_assassin_trap_teleport)
  - Can now be now interrupted by root

## HERO Dragon Knight (npc_dota_hero_dragon_knight)
### Wyrm's Wrath (dragon_knight_wyrms_wrath)
  - AoE Bonus increased from 25/50/75/100 to 30/60/90/120

## HERO Clockwerk (npc_dota_hero_rattletrap)
### Power Cogs (rattletrap_power_cogs)
  - Mana Burn decreased from 40/80/120/160 to 40/75/110/145
  - Cogs Travel Distance decreased from 1000 to 850/900/950/1000
  - Cogs Day/Night Vision decreased from 1600/600 to 800/400
  - Cogs no longer block creep camps

## HERO Omniknight (npc_dota_hero_omniknight)
### Hammer of Purity (omniknight_hammer_of_purity)
  - Heal Amount improved from 35% over 5s to 40% over 4s

## HERO Night Stalker (npc_dota_hero_night_stalker)
### Crippling Fear (night_stalker_crippling_fear)
  - Radius decreased from 375 to 350

## HERO Weaver (npc_dota_hero_weaver)
### Threads of Fate (weaver_threads_of_fate)
  - Thread Break Distance increased from 900 to 890 + 10 per hero level

## HERO Jakiro (npc_dota_hero_jakiro)
- Intelligence gain increased from 3.0 to 3.3

## HERO Batrider (npc_dota_hero_batrider)
### Smoldering Resin (batrider_smoldering_resin)
  - No longer applies when attacking allies

## HERO Spectre (npc_dota_hero_spectre)
### Haunt (spectre_haunt)
  - Illusion Damage rescaled from 30/50/70% to 35/50/65%
### Talents
  - Level 25 Talent All Spectre Illusion Damage decreased from +15% to +12%

## HERO Ancient Apparition (npc_dota_hero_ancient_apparition)
### Ice Blast (ancient_apparition_ice_blast)
  - Cooldown decreased from 60/50/40s to 50/45/40s

## HERO Doom (npc_dota_hero_doom_bringer)
- Attack Range decreased from 200 to 175
### Infernal Blade (doom_bringer_infernal_blade)
  - Base Burn Damage increased from 15/30/45/60 to 18/34/50/66
  - Max HP As Damage rescaled from 1/2/3/4% to 0.5/1.75/3/4.25%

## HERO Gyrocopter (npc_dota_hero_gyrocopter)
### Rocket Barrage (gyrocopter_rocket_barrage)
  - Mana Cost decreased from 85 to 75
### Homing Missile (gyrocopter_homing_missile)
  - Mana Cost decreased from 120/130/140/150 to 120
  - Cooldown decreased from 30/24/18/12s to 26/21/16/11s

## HERO Invoker (npc_dota_hero_invoker)
### Ghost Walk (invoker_ghost_walk)
  - Duration decreased from 60s to 50s
  - Aghanim's Shard no longer increases radius

## HERO Outworld Destroyer (npc_dota_hero_obsidian_destroyer)
### Objurgation (obsidian_destroyer_objurgation)
  - Now has an instant cast and no longer cancels movement [Used to have 0.2s cast point]
  - Barrier increased from 120/180/240/300 to 150/200/250/300
  - Cooldown decreased from 36/34/32/30 to 36/33/30/27s

## HERO Lone Druid (npc_dota_hero_lone_druid)
### Talents
  - Level 15 Talent Savage Roar Cooldown Reduction decreased from 5s to 4s
  - Level 20 Talent Savage Roar Radius decreased from +150 to +125

## HERO Chaos Knight (npc_dota_hero_chaos_knight)
### Chaos Bolt (chaos_knight_chaos_bolt)
  - Bolt Speed increased from 700 to 900

## HERO Treant Protector (npc_dota_hero_treant)
- Base Attack Speed decreased from 100 to 90
### Leech Seed (treant_leech_seed)
  - Root duration decreased from 0.9/1.1/1.3/1.5s to 0.75/1.0/1.25/1.5s
### Living Armor (treant_living_armor)
  - Mana Cost increased from 65/70/75/80 to 80

## HERO Undying (npc_dota_hero_undying)
- Base Movement Speed decreased from 300 to 295
### Flesh Golem (undying_flesh_golem)
  - Bonus Movement Speed increased from 20 to 25

## HERO Keeper of the Light (npc_dota_hero_keeper_of_the_light)
### Chakra Magic (keeper_of_the_light_chakra_magic)
  - Cooldown increased from 19/16/13/10s to 20/17/14/11s
### Solar Bind (keeper_of_the_light_radiant_bind)
  - Cast Range decreased from 850 to 750

## HERO Visage (npc_dota_hero_visage)
### Stone Form (visage_stone_form_self_cast)
  - No longer breaks Visage's invisibility when used to order Familiars to execute

## HERO Medusa (npc_dota_hero_medusa)
### Split Shot (medusa_split_shot)
  - Toggling on/off no longer breaks invisibility and can be done while silenced

## HERO Troll Warlord (npc_dota_hero_troll_warlord)
- Base Agility increased from 23 to 24
  - Damage on level 1 increased from 50-58 to 51-59
### Battle Stance (troll_warlord_switch_stance)
  - Toggling between stances no longer breaks invisibility
### Battle Trance (troll_warlord_battle_trance)
  - Now also grants 35% Slow Resistance

## HERO Centaur Warrunner (npc_dota_hero_centaur)
### Double Edge (centaur_double_edge)
  - Aghanim's Shard Buff duration decreased from 15s to 12s
### Retaliate (centaur_return)
  - Strength Return Damage decreased from 16/24/32/40% to 14/21/28/35%

## HERO Magnus (npc_dota_hero_magnataur)
### Horn Toss (magnataur_horn_toss)
  - Damage increased from 300 to 325

## HERO Elder Titan (npc_dota_hero_elder_titan)
### Momentum (elder_titan_momentum)
  - Bonus Speed to Armor increased from 5% + 0.5% per level to 7% + 0.5% per level
### Astral Spirit (elder_titan_ancestral_spirit)
  - Return Astral Spirit and Move Astral Spirit sub-abilities no longer break Elder Titan's invisibility when used

## HERO Legion Commander (npc_dota_hero_legion_commander)
- Base Strength increased from 24 to 25
  - Damage at level 1 increased from 57-61 to 58-62
- Strength gain decreased from 3.1 to 3.0
- Base Attack Speed increased from 100 to 105
### Talents
  - Level 25 Talent Duel Refreshes Cooldown On Victory replaced with Duel Advances Cooldown by 30s On Victory

## HERO Ember Spirit (npc_dota_hero_ember_spirit)
- Base Movement Speed decreased from 300 to 295

## HERO Earth Spirit (npc_dota_hero_earth_spirit)
- Base Intelligence decreased from 18 to 17
### Talents
  - Level 20 Talent Magnetize Damage & Duration decreased from +30% to +25%

## HERO Underlord (npc_dota_hero_abyssal_underlord)
### Fiend's Gate (abyssal_underlord_dark_portal)
  - Gate channeling can now be interrupted by root

## HERO Oracle (npc_dota_hero_oracle)
### Fate's Edict (oracle_fates_edict)
  - Fate's Edict that was cast on Oracle or his ally is now dispellable by enemies
### False Promise (oracle_false_promise)
  - Cast Range increased from 700/800/900 to 800/850/900

## HERO Grimstroke (npc_dota_hero_grimstroke)
### Dark Portrait (grimstroke_dark_portrait)
  - No longer has illusion vision penalty

## HERO Hoodwink (npc_dota_hero_hoodwink)
### Mistwoods Wayfarer (hoodwink_mistwoods_wayfarer)
  - Redirect Chance decreased from 14% + 1% per level to 14.25% + 0.75% per level
### Sharpshooter (hoodwink_sharpshooter)
  - Mana Cost increased from 100/150/200 to 150/200/250
### Hunter's Boomerang (hoodwink_hunters_boomerang)
  - Cooldown increased from 18s to 20s

## HERO Snapfire (npc_dota_hero_snapfire)
### Scatterblast (snapfire_scatterblast)
  - Initial Blast Width is no longer increased by bonuses to AoE
  - Point Blank Damage Bonus decreased from 30% to 25%
### Firesnap Cookie (snapfire_firesnap_cookie)
  - Impact Damage decreased from 75/150/225/300 to 60/130/200/270
### Mortimer Kisses (snapfire_mortimer_kisses)
  - Damage per glob decreased from 180/270/360 to 170/250/330
### Talents
  - Level 10 Talent Mortimer Kisses Burn DPS decreased from +35 to +30
  - Level 15 Talent -3s Firesnap Cookie Cooldown replaced with +125 Cast Range
  - Level 25 Talent Mortimer Kisses Launched decreased from +8 to +6

## HERO Mars (npc_dota_hero_mars)
- Intelligence gain increased from 2.2 to 2.4

## HERO Ringmaster (npc_dota_hero_ringmaster)
### Impalement Arts (ringmaster_impalement)
  - Damage per Second (Creeps) rescaled from 85/90/95/100 to 60/75/90/105

## HERO Muerta (npc_dota_hero_muerta)
### Gunslinger (muerta_gunslinger)
  - Toggling on/off no longer breaks invisibility

## HERO ? (?)
- Base Armor decreased by 1
### Demolish (lone_druid_spirit_bear_demolish)
  - Bonus Building Damage decreased from 30% to 20%
# ITEMS

## Infused Raindrops (item_infused_raindrop)
- Mana Regen bonus decreased from +0.8 to +0.6

## Battle Fury (item_bfury)
- Chop Tree cooldown decreased from 4s to 3s

## Daedalus (item_greater_crit)
- Recipe cost increased from 900 to 1000. Total cost increased from 5100g to 5200g

## Dragon Lance (item_dragon_lance)
- Recipe cost increased from 450 to 550. Total cost increased from 1900g to 2000g

## Essence Distiller (item_essence_distiller)
- Mana Regen bonus decreased from +1.75 to +1.5

## Heart of Tarrasque (item_heart)
- Recipe cost increased from 700 to 800. Total cost increased from 5200g to 5300g

## Heaven's Halberd (item_heavens_halberd)
- Recipe cost decreased from 450 to 350. Total cost decreased from 3400g to 3300g

## Hurricane Pike (item_hurricane_pike)
- Total cost increased from 4450g to 4550g (due to Dragon Lance cost increase)

## Hydra's Breath (item_hydras_breath)
- Recipe cost decreased from 1100 to 1000. Total cost unchanged at 5900g (due to Dragon Lance cost increase)

## Manta Style (item_manta)
- Mirror Image ranged images damage decreased from 28% to 25%

## Mask of Madness (item_mask_of_madness)
- Lifesteal bonus decreased from +24% to +22%
  - Creep lifesteal decreased from +14.4% to +13.2%

## Mjollnir (item_mjollnir)
- Static Charge duration decreased from 15s to 12s

## Octarine Core (item_octarine_core)
- Recipe cost increased from 200 to 400. Total cost increased from 4900g to 5100g

## Satanic (item_satanic)
- Lifesteal bonus decreased from +30% to +25%
  - Creep lifesteal decreased from +18% to +15%

## Shiva's Guard (item_shivas_guard)
- Arctic Blast damage decreased from 260 to 225

## Silver Edge (item_silver_edge)
- Shadow Walk cooldown increased from 22s to 23s
- Shadow Walk bonus movement speed decreased from 22% to 20%

# NEUTRAL_ITEMS

## Enchantment Changes (Enchantment Changes)

## Greedy (item_enhancement_greedy)
- Attack Damage penalty  increased from  30/60  to  35/70

# HEROES

## HERO Anti-Mage (npc_dota_hero_antimage)
### Mana Break (antimage_mana_break)
  - Mana Burned as Damage increased from 60% to 65%

## HERO Bane (npc_dota_hero_bane)
- Base Armor decreased by 1

## HERO Mirana (npc_dota_hero_mirana)
### Celestial Quiver (mirana_celestial_quiver)
  - Base Charge Restore Time increased from 6s to 7s
### Sacred Arrow (mirana_arrow)
  - Maximum Stun decreased from 2.6/3.4/4.2/5s to 2.3/3.2/4.1/5s

## HERO Shadow Fiend (npc_dota_hero_nevermore)
### Necromastery (nevermore_necromastery)
  - Damage per soul changed from 1.35 + 0.15 damage per level to 1 + 0.8 damage per 6 levels [From 1.5-5.85 to 1-5]
### Shadowraze (nevermore_shadowraze1)
  - Bonus Damage Per Soul decreased from 3 to 2
### Talents
  - Level 15 Talent Presence Armor Reduction decreased from +2 to +1.5

## HERO Lina (npc_dota_hero_lina)
- Base Intelligence decreased from 30 to 28
  - Damage at level 1 decreased from 51-59 to 49-57
### Fiery Soul (lina_fiery_soul)
  - Attack Speed Bonus decreased from 8/16/24/32 to 7/14/21/28
  - Duration decreased from 18s to 16s

## HERO Slardar (npc_dota_hero_slardar)
- Base Health Regen decreased by 0.25
### Slithereen Crush (slardar_slithereen_crush)
  - Damage decreased from 75/150/225/300 to 60/140/220/300

## HERO Enigma (npc_dota_hero_enigma)
### Demonic Summoning (enigma_demonic_conversion)
  - Eidolon Attack Range decreased from 425/450/475/500 to 380/420/460/500
### Black Hole (enigma_black_hole)
  - Aghanim's Scepter pull speed decreased from 175 to 150
### Talents
  - Level 20 Talent Eidolon Damage decreased from +40 to +30

## HERO Necrophos (npc_dota_hero_necrolyte)
### Sadist (necrolyte_sadist)
  - Hero Kill Multiplier decreased from 6 to 4
### Ghost Shroud (necrolyte_ghost_shroud)
  - Restoration Amplification decreased from 55/65/75/85% to 45/55/65/75%

## HERO Warlock (npc_dota_hero_warlock)
- Base Attack Speed increased from 90 to 95

## HERO Clockwerk (npc_dota_hero_rattletrap)
### Power Cogs (rattletrap_power_cogs)
  - Mana Cost increased from 75 to 90
  - Knockback Duration decreased from 0.8s to 0.7s

## HERO Lifestealer (npc_dota_hero_life_stealer)
### Rage (life_stealer_rage)
  - Cooldown increased from 20/19/18/17s to 21/20/19/18s
### Infest (life_stealer_infest)
  - Aghanim's Scepter Enemy Duration decreased from 5s to 4s
### Talents
  - Level 10 Talent Movement Speed decreased from +20 to +15

## HERO Huskar (npc_dota_hero_huskar)
- Base Strength decreased from 23 to 22
  - Damage at level 1 decreased from 44-49 to 43-48
- Strength gain increased from 3.3 to 3.4

## HERO Broodmother (npc_dota_hero_broodmother)
### Insatiable Hunger (broodmother_insatiable_hunger)
  - Mana Cost decreased from 80 to 70

## HERO Bounty Hunter (npc_dota_hero_bounty_hunter)
### Track (bounty_hunter_track)
  - Self bonus gold decreased from 130/225/320 to 80/160/240
  - Allies bonus gold decreased from 50/90/130 to 40/80/120
### Talents
  - Level 10 Talent Shuriken Toss Slow decreased from +0.6s to +0.35s
  - Level 20 Talent Track Grants Shared Vision replaced with +190 Shuriken Toss Damage
  - Level 25 Talent +250 Shuriken Toss Damage replaced with Track Grants Shared Vision

## HERO Batrider (npc_dota_hero_batrider)
- Intelligence gain increased from 2.9 to 3.2
  - Damage gain per level increased from 3.5 to 3.6

## HERO Chen (npc_dota_hero_chen)
- Strength gain increased from 2.0 to 2.2
### Zealot (chen_zealot)
  - Zealot respawn time changed from 60s to 60s - 1s per hero level

## HERO Spectre (npc_dota_hero_spectre)
### Desolate (spectre_desolate)
  - Damage decreased from 23 + 2 per level to 23.5 + 1.5 per level [From 25-83 to 25-68.5]

## HERO Ursa (npc_dota_hero_ursa)
### Maul (ursa_maul)
  - Health As Damage increased from 1.25% to 1.75%

## HERO Invoker (npc_dota_hero_invoker)
### Cold Snap (invoker_cold_snap)
  - Cooldown increased from 18s to 19s
### Ghost Walk (invoker_ghost_walk)
  - Aghanim's Shard no longer applies damage to non-Hero units

## HERO Lone Druid (npc_dota_hero_lone_druid)
### Entangle (lone_druid_entangle)
  - Stack Duration decreased from 10s to 7/8/9/10s

## HERO Treant Protector (npc_dota_hero_treant)
- Base Intelligence decreased from 20 to 17
### Nature's Guise (treant_natures_guise)
  - Invisibility linger when leaving trees decreased from 2s to 1s
### Leech Seed (treant_leech_seed)
  - Now costs 35 mana
  - Damage to Healing rescaled from 20% to 10/15/20/25%
### Living Armor (treant_living_armor)
  - Minimum damage block decreased from 20 to 10
### Talents
  - Level 10 Talent +3 Living Armor Heal per Second replaced with +3s Living Armor Duration

## HERO Undying (npc_dota_hero_undying)
- Base Health Regen decreased by 0.25
### Decay (undying_decay)
  - Mana Cost increased from 100 to 110

## HERO Disruptor (npc_dota_hero_disruptor)
- Base Intelligence increased from 20 to 21
  - Damage at level 1 increased from 47-51 to 48-52

## HERO Keeper of the Light (npc_dota_hero_keeper_of_the_light)
- Base Attack Speed decreased from 100 to 90
### Chakra Magic (keeper_of_the_light_chakra_magic)
  - Cooldown Reduction decreased from 3/4/5/6s to 2.5/3.5/4.5/5.5s
### Spirit Form (keeper_of_the_light_spirit_form)
  - Illuminate Heal decreased from 70% to 60%
    - Illuminate Heal with Aghanim's Shard unchanged at 100%

## HERO Io (npc_dota_hero_wisp)
### Talents
  - Level 15 Talent Spirits Damage decreased from +50% to +40%

## HERO Centaur Warrunner (npc_dota_hero_centaur)
- Base Damage decreased by 2
  - Damage at level 1 decreased from 64-66 to 62-64
- Base Movement Speed decreased from 300 to 295
### Hitch A Ride (centaur_mount)
  - Cast Range decreased from 250 to 200

## HERO Ember Spirit (npc_dota_hero_ember_spirit)
- Base Agility decreased from 22 to 21
  - Damage at level 1 decreased from 52-56 to 51-55

## HERO Earth Spirit (npc_dota_hero_earth_spirit)
- Base Attack Speed decreased from 100 to 95
### Stone Remnant (earth_spirit_stone_caller)
  - Charges changed from (7 + 1 per 4 levels) to (7 + 1 per 5 levels)
    - Max charges decreased from 14 at level 28 to 13 at level 30
### Talents
  - Level 20 Talent +25% Magnetize Damage & Duration replaced with +35 Magnetize Damage Per Second
  - Level 20 Talent +175% Rolling Boulder Damage from Strength replaced with +200 Geomagnetic Grip Remnant Damage
  - Level 25 Talent +250 Geomagnetic Grip Remnant Damage replaced with +250% Rolling Boulder Damage from Strength

## HERO Underlord (npc_dota_hero_abyssal_underlord)
### Pit of Malice (abyssal_underlord_pit_of_malice)
  - No longer upgraded with Aghanim's Scepter
### Fiend's Gate (abyssal_underlord_dark_portal)
  - Aghanim's Scepter Cooldown decreased from 100/95/90s to 90/85/80s

## HERO Winter Wyvern (npc_dota_hero_winter_wyvern)
### Arctic Burn (winter_wyvern_arctic_burn)
  - Cooldown increased from 26/24/22/20s to 29/26/23/20s
### Cold Embrace (winter_wyvern_cold_embrace)
  - Max HP Heal per second decreased from 2.25/3/3.75/4.5% to 1.5/2.5/3.5/4.5%

## HERO Hoodwink (npc_dota_hero_hoodwink)
- Base Strength decreased from 17 to 16

## HERO Mars (npc_dota_hero_mars)
- Base Armor increased by 1

## HERO Marci (npc_dota_hero_marci)
### Rebound (marci_companion_run)
  - Ally bonus movement speed rescaled from 15/20/25/30% to 25%

## HERO Kez (npc_dota_hero_kez)
- Base Damage decreased by 1
  - Damage at level 1 decreased from 50-56 to 49-55
### Talents
  - Level 20 Talent Kazurai Katana Damage Per Second decreased from +4% to +3.5%

## HERO Largo (npc_dota_hero_largo)
### Island Elixir (largo_song_good_vibrations)
  - Heal rescaled from 34/56/78 to 30/55/80