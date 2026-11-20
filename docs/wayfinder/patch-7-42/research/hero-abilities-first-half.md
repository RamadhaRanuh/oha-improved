# 7.42 hero ability breakage: first half (Anti-Mage to Batrider)

Ticket: [01](../tickets/01-which-hero-ability-code-breaks-first-half.md). Scope: the 63 heroes in
`research/data/patchnotes-7.42.md` lines 925-1712 (Anti-Mage at 927 through Batrider at 1693; Chen at
1713 belongs to ticket 02). Structural changes only.

## Sources

- **N**: `research/data/patchnotes-7.42.md` (Valve notes, flattened). Cited as `N:<line>`.
- **S**: slot diff `heroes-pre-7.42.md` vs `heroes-7.42.md`. Only 4 heroes in range changed slots
  1-6, and none changed `extra` (script compared all three columns for all 63 heroes).
- **KV**: dotabuff/d2vpkr `dota/scripts/npc/heroes/npc_dota_hero_<h>.txt` and `npc/npc_units.txt`.
  Post = master @ commit 5efc826 "Client 6978" (2026-11-18). Pre = commit 969480b "Client 6933"
  (2026-09-15), the last change to these files before 7.42. Used for ability behavior flags, which
  the notes don't spell out.
- **Code**: `bots/BotLib/hero_<h>.lua`, `bots/FunLib/aba_skill.lua` (GetAbilityList :82-129,
  GetTalentBuild :135-150), `FunLib/spell_list.lua`, `FunLib/spell_prob_list.lua`,
  `FunLib/rubick_hero/`, `FunLib/MinionLib/minion_with_skill.lua`. None of the affected hero files
  is TS-generated (`typescript/bots/BotLib/` only has `hero_wisp.ts`).

## Summary

No hero in this half fails to load or stalls its skill build. Every `tAllAbilityBuildList` that
indexes a shifted slot gets the same kind of entry at that index as before.

| hero | problem | severity | fix | files:lines |
|---|---|---|---|---|
| Weaver | Scepter ally Time Lapse moved to the new `weaver_time_lapse_ally` (unit target, friendly hero, range 500). `weaver_time_lapse` is now NO_TARGET with no cast range, so the code's ally branch never finds an ally. If it did, it would order a unit-target cast of a no-target ability. | misfire (dead in practice) | Fetch `weaver_time_lapse_ally`. In the `bot:HasScepter()` branch use its `GetCastRange()` and cast it with `Action_UseAbilityOnEntity`. Keep the self-cast on `weaver_time_lapse` (`Action_UseAbility`). | hero_weaver.lua:86, 104-117, 499-530 |
| Juggernaut | `juggernaut_swift_slash` removed. Slot 3 is now `generic_hidden`, so `abilityD = sAbilityList[4]` names `generic_hidden`. `ConsiderD` runs only with Scepter, then calls `abilityD:IsFullyCastable()`. The Scepter now upgrades Blade Fury (attack while spinning), and nothing uses that. | missing (plus dead code; latent error if the handle is nil) | Delete abilityD, ConsiderD and the D cast. Optionally, while Blade Fury is active with Scepter, keep issuing attack-target orders. Drop the `juggernaut_swift_slash` row from spell_list. | hero_juggernaut.lua:133, 166-175, 510-516; spell_list.lua:341 |
| Beastmaster | `beastmaster_drums_of_slom` (passive, Scepter) replaced in slot 4 by `beastmaster_summon_thunderhide` (NO_TARGET, Scepter, cd 60, mana 100). The bot buys Scepter (`item_ultimate_scepter` :35) and never casts it. | missing | Add ConsiderSummonThunderhide: `Action_UseAbility`, when fighting or pushing with no Thunderhide alive. | hero_beastmaster.lua:157-167, 196-203 (add a handle and a cast in SkillsComplement) |
| Dazzle | New Shard sub-ability `dazzle_through_the_realm` (NO_TARGET, IMMEDIATE, no cost or cooldown; pulls the body to the spirit and ends Nothl Projection). Never fetched. The bot buys Shard (4 build refs). | missing | Fetch it by name. Cast `Action_UseAbility` while the soul is out, when the body is threatened or the spirit is near a kill or safety. Can't be used if the body is rooted or leashed (N:1524). | hero_dazzle.lua:176-177, 207-208, 243-247 (next to NothlProjectionEnd) |
| Leshrac | Nihilism (`leshrac_greater_lightning_storm`) reworked: still NO_TARGET Scepter, but now disarms enemies in 550 and basic-dispels them and Leshrac every tick. No more self-Ethereal, mana 125. The code only casts it on retreat or vs lethal attack projectiles. | misfire (soft: still useful, not broken) | Optional retune: also cast in fights when ≥1 right-click enemy is within `radius` (key still `radius`), or to dispel a debuff on self. | hero_leshrac.lua:124, 174-177, 943-970 |
| Nature's Prophet | `furion_curse_of_the_forest` went active NO_TARGET → PASSIVE (KV). `J.CanCastAbility` returns false for passives (jmz_func.lua:864), so the cast is dead code. | none (cleanup) | Delete ConsiderCurseOfTheOldGrowth and its cast. Optionally drop the spell_list row. | hero_furion.lua:196, 255-259, 594-607; spell_list.lua:276 |
| Pugna | Life Drain: KV drops `AbilityChannelTime 10` for `AbilityDuration 10` but still has the CHANNELLED flag. Notes say several drains can be active at once (N:1462). Whether it still channels is **ambiguous**. Special key `health_drain` renamed `life_drain`, `ally_healing` removed (code reads neither). | verify in-game | No code change needed. In-game, check whether Pugna still stands channelling. If not, the ultimate can be recast on a second target. | hero_pugna.lua:218, 286-293, 710+; override_generic/mode_attack_generic.lua:236 (`modifier_pugna_life_drain` name unverified) |

Checked with no code impact (cast type unchanged, or the engine handles it): Death Prophet (Crypt
Swarm Shard charges, Spirit Siphon now upgraded by Scepter, Exorcism lost its Scepter upgrade; no
HasScepter/Shard gating in the file), Pugna Oblivion Savant (Scepter charges on a passive innate),
Sand King (Burrowstrike Scepter range via `GetCastRange`; Epicenter lost its Scepter upgrade and the
code has no HasScepter), Morphling (Morph Scepter rework is passive), Lich (Sacrifice 2→3 charges),
Wraith King (Bone Guard charges rescaled), Tinker (Warp Flare root→100% slow; no root-modifier
checks anywhere), Clockwerk (Overclocking mana 0), Lifestealer (Scepter Infest vs debuff-immune;
already guarded by `CanCastOnNonMagicImmune`, hero_life_stealer.lua:449), Pudge (Shard ally-refund
removed; the ally-save hook doesn't depend on it), Teleportation barrier removed (no code reads it).

`spell_list.lua` / `spell_prob_list.lua` (TS: `typescript/bots/FunLib/spell_prob_list.ts`) are
weight lookups by name with default 1 (spell_list.lua:1023-1044, spell_prob_list.lua:95). Stale
or missing rows can't error. Optional rows: `beastmaster_summon_thunderhide`,
`dazzle_through_the_realm`, `weaver_time_lapse_ally`. `rubick_hero/` (21 files; in this half:
antimage, axe, bane, batrider, beastmaster, bloodseeker, bounty_hunter, broodmother, clinkz,
crystal_maiden, rattletrap) has no 7.42 break.

## Per-hero notes

### Weaver
- N:1680-1681: "Aghanim's Scepter upgrade moved into a separate ability with shared cooldown".
- S: slot 3 `generic_hidden` → `weaver_time_lapse_ally`.
- KV post, `weaver_time_lapse_ally`: `UNIT_TARGET | DONT_RESUME_MOVEMENT | DONT_RESUME_ATTACK |
  IGNORE_BACKSWING`, `TEAM_FRIENDLY`, `TARGET_HERO`, `AbilityCastRange 500`, `MaxLevel 3`,
  `IsGrantedByScepter 1`, `AbilitySharedCooldown weaver_time_lapse`.
- KV, `weaver_time_lapse`: still NO_TARGET, but `AbilityCastRange 500` was removed (pre had it).
- Code: hero_weaver.lua:501 `nCastRange = TimeLapse:GetCastRange()`, now 0, so no ally is in
  range. :112-115 `Action_UseAbilityOnEntity(TimeLapse, Target)` is the wrong cast type for the
  no-target ult.
- **Needed cast**: `bot:Action_UseAbilityOnEntity(bot:GetAbilityByName('weaver_time_lapse_ally'), ally)`.
  Gate it with `J.CanCastAbility(TimeLapseAlly)`, which also covers the hidden state without Scepter.
- Index: GetAbilityList now puts `weaver_time_lapse_ally` at [4] (it isn't NOT_LEARNABLE).
  Before 7.42, [4] was `generic_hidden`. The build `{2,3,1,2,2,6,...}` (:19) never uses 4: no stall.

### Juggernaut
- N:998 "Removed Swiftslash ability". N:1002-1005: Blade Fury is now upgraded by Scepter (attacks
  at 75% damage while moving, keeps attacking even when stunned or on stop/hold, auto-targets the
  closest enemy if no attack order). N:1000: fully disarmed during Blade Fury without Scepter.
- S: slot 3 `juggernaut_swift_slash` → `generic_hidden`. KV pre: swift_slash was
  `UNIT_TARGET`, `IsGrantedByScepter`.
- Code: :133 `abilityD = bot:GetAbilityByName(sAbilityList[4])` now resolves `'generic_hidden'`.
  :510-516 `ConsiderD` checks `not bot:HasScepter()` first, so it only touches abilityD after
  `item_ultimate_scepter_2` (:56, last item). A `generic_hidden` handle is level 0, so
  `IsFullyCastable()` is false and nothing happens. If the API returned nil instead, it would raise
  a Lua error every tick before R/Q are considered (:166 runs first). Not verified in-game.
- Build `{1,2,1,3,1,6,...}` (:27) has no index 4: no stall.
- **Fix**: remove the D path. Scepter value: during `modifier_juggernaut_blade_fury` with Scepter,
  `Action_AttackUnit(target)` (attacks now land while spinning).

### Beastmaster
- N:1302 Drums of Slom removed. N:1309-1326: Summon Ancient Thunderhide, a new Scepter ability,
  "Active. No target", mana 100, cd 60s, cast point 0.3. The unit has Slam (active, no target) and a
  passive Drum aura.
- S: slot 4 `beastmaster_drums_of_slom` → `beastmaster_summon_thunderhide`. KV pre drums:
  `PASSIVE, IsGrantedByScepter, MaxLevel 1`. KV post thunderhide: `NO_TARGET, IsGrantedByScepter,
  MaxLevel 1`. Both have the same flags for GetAbilityList, so sAbilityList indices don't move.
  The builds at :18-19 use index 4 (whatever [4] was before, `inner_beast` or drums), and that is
  unchanged.
- Code: drums was already commented out (:166). Nothing handles thunderhide.
- **Needed cast**: `bot:Action_UseAbility(Thunderhide)`, gated by `J.CanCastAbility`. Don't recast
  while one is alive and took damage in the last 3s (the engine blocks it; N:1313).
- Minion: npc_units `npc_dota_beastmaster_thunderhide` has `Ability1 big_thunder_lizard_slam`,
  which `MinionLib/minion_with_skill.lua:1206` already handles, provided the unit reaches
  MinionWithSkill (aba_minion.lua MinionThink fallthrough). Not verified in-game.
  Note: `FunLib/MinionLib/` is untracked in git.

### Dazzle
- N:1517-1525: Nothl Projection Shard upgrade (+250 cast range, +500 leash) and the new
  sub-ability Through the Realm: "Active. No target. No Mana Cost. No Cooldown. No Cast Point,
  instant". Body travels at 500 speed. Can't be cast while the body is rooted or leashed. If the
  body is stunned it can be cast, but Dazzle stays stunned.
- S: slot 3 `dazzle_innate_weave` → `dazzle_through_the_realm`. Slot 4 `generic_hidden` →
  `dazzle_innate_weave`.
- KV post: through_the_realm `NO_TARGET | IMMEDIATE | NOT_LEARNABLE`, `IsGrantedByShard`.
  innate_weave `PASSIVE | NOT_LEARNABLE | HIDDEN` (skipped by GetAbilityList).
- Index: before 7.42, [4] = `generic_hidden`. Now [4] = through_the_realm if it isn't hidden at
  load, else the next appended entry. `abilityF = sAbilityList[5]` (:174, :205) is assigned but
  never used. Build `{1,3,1,2,1,6,...}` (:30) uses only 1/2/3/6: no stall.
- **Needed cast**: `bot:Action_UseAbility(bot:GetAbilityByName('dazzle_through_the_realm'))`.
  Gate it with `J.CanCastAbility` (passive and hidden checks cover "no Shard"). Natural uses: the
  body is retreating or low and the soul is at a safe spot, the same trigger as
  `ConsiderNothlProjectionEnd` (:343-359). Prefer Through the Realm over End when the soul is
  further from enemies than the body.

### Leshrac
- N:1554-1561 rework. KV pre: values `duration 4, magic_amp 30, slow 40, radius 500`, mana 75.
  KV post: `duration 4.0, radius 550`, mana 125, `SPELL_DISPELLABLE_NO`, still
  `NO_TARGET | IMMEDIATE | HIDDEN`, `IsGrantedByScepter`.
- Cast type unchanged, and `GetSpecialValueInt('radius')` (:950) still resolves. The old use was
  self-Ethereal to dodge physical damage. The new effect (disarm enemies in 550) still answers
  physical damage on retreat, so the logic still makes sense. It no longer protects against
  ranged attackers beyond 550 or towers, and it now also helps offensively (dispels enemy
  buffs).

### Nature's Prophet
- N:1580-1584: Curse of the Oldgrowth is now "Passive. Breakable". KV pre `NO_TARGET`, post
  `PASSIVE` (still `IsGrantedByShard`). No slot change.
- Code at :255-259 queues `ActionQueue_UseAbility`, but ConsiderCurse returns NONE through
  `J.CanCastAbility` (jmz_func.lua:861-874 rejects `IsPassive()`). Harmless.
- N:1574: Teleportation no longer gives a barrier. `grep barrier` in the hero file finds nothing.

### Pugna
- N:1460-1469. KV `pugna_life_drain`: `AbilityChannelTime 10.0` removed, `AbilityDuration 10.0`
  added, `CHANNELLED` still in AbilityBehavior. `HasScepterUpgrade` removed. Special keys:
  `health_drain` → `life_drain`, `ally_healing` gone. The code reads `GetAbilityDamage()` and
  cast range only (:710-716).
- Ambiguous: the notes ("multiple Life Drains can be active at the same time") plus a duration in
  place of a channel time suggest it no longer channels. The behavior flag says it does. Check
  in-game whether `bot:IsChanneling()` is true after casting.
- Oblivion Savant (slot 3) pre `PASSIVE, Innate`, post `PASSIVE | ... | HIDDEN, Innate,
  AbilityCharges` (Scepter). Neither version has NOT_LEARNABLE, so its index is unchanged.
  Build `{1,3,1,2,1,6,...}` (:27) never uses 4.

## Talent picks that now name a different talent

`J.Skill.GetTalentBuild` (aba_skill.lua:135-145) picks the first option of a level when
`tTalentTreeList[tN][1] == 0`, else the second. I compared the talent at the picked position,
before and after, per tree. Same-name number changes are excluded (Kunkka spell_aoe_100→75,
Witch Doctor hp_200→175, QoP attack_damage_30→35, DK attack_damage_15→12, Necrophos
spell_aoe_75→50, WK attack_speed_50→40). No fix needed; listed for review.

| hero (tree) | level: was → now |
|---|---|
| Anti-Mage | L10: +3 HP regen → +25% Counterspell reflect duration. L15: +0.2 Mana Void multiplier (`_6`) → +10% Counterspell magic resist (`_4`) |
| Shadow Fiend pos1 | L10: +30 Feast attack speed (`_4`) → +2 Feast souls |
| Shadow Fiend pos2 | L15: +2 Feast souls → Feast heals 25 HP per soul |
| Shadow Fiend (both) | L20 `_6`, same name: +0.2s Requiem fear per line → +0.5s Requiem fear/slow (KV) |
| Phantom Lancer | L15: +125 Doppelganger range → +4% Juxtapose proc chance |
| Storm Spirit | L15: +250 HP → +60/25% Overload slow |
| Lina pos1 | L10: +25 damage → +100 LSA cast range (`lina_4`). L15: +5% Fiery Soul MR (`lina_4`) → +30 damage |
| Lion | L15 `lion_11`, same name: +15/15% To Hell and Back → +45 Mana Drain per second (KV) |
| Slardar | L15: +250 HP → -1.5s Crush CD (`_4`). L25: -3s Crush CD (`_4`) → +200 Bash damage (`_2`) |
| Warlock | L10: +50 Upheaval radius → Shadow Word ±8% move speed (`_7`) |
| Venomancer | L20: +100 Snakebite initial damage (`_4`) → Snakebite undispellable (`_5`). L25: undispellable → +2% Noxious Plague max HP damage |
| Death Prophet (both) | L15: +50 attack speed → +125 Silence AoE. L20: +30 Siphon damage/heal (`_3`) → +110 Crypt Swarm damage. L25: Exorcism +8s on deaths → `_2` (by note order, +1 Witchcraft spirit; unverified) |
| Pugna | L10: +2 Nether Ward attacks (`_6`) → +200 HP. L15: +250 HP → -3s Life Drain CD (`_6`, KV-confirmed) |
| Dazzle pos1/2 (tree 1) | L10: +200 Poison Touch range → `dazzle_1` (+15% Poison Touch slow per note order). L15: +5s Nothl duration → `dazzle_2`. L20: `dazzle_3` → -15s Nothl CD. L25: `dazzle_1` → Poison Touch undispellable |
| Dazzle other roles (tree 2) | L10: same as above. L15: `dazzle_2` → `dazzle_3`. L25: +1 Weave (`dazzle_4`) → +1s Shallow Grave duration |
| Clockwerk pos5 | L10: +1.5 mana regen → +2.5s Battery Assault duration |
| Leshrac pos3 | L20: Edict hits an extra target (`_7`) → +10 Edict explosions (`_1`) |
| Nature's Prophet pos1/2/3 | L20: +240 Sprout damage (`_4`) → +2 Nature's Call treants |
| Nature's Prophet pos4/5 | L15: +100 Teleport barrier → +300 HP |
| Clinkz (both) | L20: +400 Death Pact HP (`_8`) → +2 Skeleton Walk skeletons |
| Broodmother (both) | L20: Bite slow/miss (`_4`) → +350 Spiderling HP (`_7`) |
| Weaver | L10: +7 strength → +5% Threads of Fate damage per thread |

Not affected even though a talent at that level was replaced: Juggernaut L20 (bot picks `_4`),
Dark Seer L10/15, Luna L25 (bot picks #7; the Lucent talent is `luna_5`, #8), Kunkka, Storm L10,
PL L10/L20.

Talent handles read by index in damage maths now read a different talent. This is a small
estimate misfire, not an error:
- hero_nevermore.lua:391 adds `talent4` "value" to raze damage. pos2 #4 is now heal-per-soul (25).
- hero_dazzle.lua:389 adds `talent6` to Poison Touch damage. Tree 1 #6 is now the Nothl CD talent.
- hero_phantom_lancer.lua:171 adds `talent5` to rush range. #5 is now illusion Spirit Lance.
  The PL and SF reads were already stale before 7.42.

## Pre-existing, not 7.42 (FYI)

These names in `GetAbilityByName` aren't in the 7.42 or pre-7.42 slot lists. They are facet or
sub-abilities, or legacy fallbacks, and none changed in 7.42: antimage_counterspell_ally,
antimage_mana_overload, bloodseeker_blood_mist, morphling_adaptive_strike_str,
tinker_defense_matrix, faceless_void_time_zone, skeleton_king_spectral_blade,
templar_assassin_self_trap, life_stealer_control, clinkz_tar_bomb, jakiro_liquid_frost, and
beastmaster `call_of_the_wild_*`/`summon_raptors` (fallbacks at hero_beastmaster.lua:159-164).
`spell_list.lua:65-70` and `rubick_hero/beastmaster.lua:56,67` still use the pre-7.41
`beastmaster_call_of_the_wild_*` names.
