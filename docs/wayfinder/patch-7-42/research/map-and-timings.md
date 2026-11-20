# Which hardcoded map positions and timings 7.42 moves

Ticket: [05](../tickets/05-which-map-positions-and-timings-742-moves.md). Date 2026-11-20.

**Sources.** The 7.42 patch notes ([data/patchnotes-7.42.md](data/patchnotes-7.42.md) lines 1-118). The tracked
source files under `bots/` and `typescript/bots/`, found with `git ls-files` and grep. Untracked files are left out
(`aba_spell_list.lua`, `Buff/script/`, `bots/API/` and others). Bot API signatures come from the dota2-bot-dev skill
references (`api-globals.md`, `api-unit.md`, `bot-constants.md`). Liquipedia and the fandom wiki refused the fetch
(403 and 402), so the Roshan respawn formula is confirmed by the patch-note line alone (line 89).

**TS rule** ([ARCHITECTURE.md](../../../ARCHITECTURE.md) §13). `utils.lua`, `aba_site.lua`, `aba_push.lua`,
`aba_defend.lua` and `behavior/*.lua` are generated from TypeScript, so a fix goes in the `.ts` file and is then
rebuilt. `jmz_func.lua`, `ability_item_usage_generic.lua`, `mode_*.lua`, `Buff/*` and `BotLib/*` are plain Lua.

## Summary

| # | 7.42 change | Live hardcoded hit? | Needs a code change? | Needs a probe? |
|---|---|---|---|---|
| 1 | Dire fountain ~300u toward the Ancient | **yes, 5 places** | yes (or read it at runtime) | **yes, new coords** |
| 2 | Mid T1/T2 towers moved | no live hit (towers read with `GetTower`) | no; the ward and mine spots near mid need a check | **yes, ward spot passability** |
| 3 | Twin Gates moved to the map rims | only a commented-out line | no | optional |
| 4 | Small flooded / stream-end camps moved, T1 spawn boxes smaller | no (`GetNeutralSpawners()` at runtime) | no | no |
| 5 | Tormentor first spawn 20:00 to 15:00, new drops | **yes** | yes | turbo value only |
| 6 | Roshan respawn -1 min per kill, minimum 5 min | **yes** | yes | yes, exact formula |
| 7 | Glyph 2 charges, 6 min replenish, 7s between uses | gate on `GetGlyphCooldown()` | maybe | **yes, what the API returns** |
| 8 | Siege creep cadence after 30:00 | none | no | no |
| 9 | Wisdom Shrine XP 200+300 to 200+200 | position and cadence only | no | no |
| 10 | Invis rune disguise, pulled-creep slow, passive XP | none, except the Buff XP table | Buff XP table optional | no |

## 1. Dire fountain (moved ~300 units toward the Dire Ancient, notes line 76)

Old Dire coords are about (6928, 6372). The Ancient is at `aba_site` (5517, 4981). Moving 300u along that line
gives an **estimate of about (6714, 6161, ~392)**. This is not measured yet; a probe must confirm it.
Radiant is unchanged.

| File:line | Current value | Used by | Matters? |
|---|---|---|---|
| `bots/FunLib/jmz_func.lua:9` | `DireFountain = Vector(6928, 6372, 392)` | `J.GetTeamFountain` / `J.GetEnemyFountain` (:1695-1718, about 142 call sites), `J.GetEscapeLoc` (:2252), `J.GetDistanceFromEnemyFountain` (:2408) | **Yes.** It sets where Dire bots retreat to and how far Radiant bots think they are from the Dire fountain when deciding how deep to dive. The old point is still inside the fountain aura, so Dire retreat still heals. Radiant bots, though, under-read their distance to the Dire fountain by about 300u. |
| `bots/ability_item_usage_generic.lua:31` | local copy, same value | dust placement direction (:7041-7044) | Low: it only sets a direction. |
| `bots/FunLib/utils.lua:708` / **`typescript/bots/FunLib/utils.ts:26`** | `DireFountainTpPoint = Vector(6982, 6422, 392)` | `GetTeam/EnemyFountainTpPoint` (utils.ts:341-352): retreat moves (utils.lua:1886/1904, ts:1507/1533), `aba_push.lua:41/188` (the enemy-fountain "do not push past" check), `aba_defend.lua:261/1036`, `hero_wisp.lua:183/188`, `hero_invoker.lua:1520` | **Yes**, for the push stop-distance near the Dire base and the Dire retreat path. Edit the TS file. |
| `bots/mode_farm_generic.lua:22` | `DB = Vector(7023, 6450, 0)` | run-home moves (:551, :557-561), map midpoint (:757) | Low to medium. It is a move target only. |
| `bots/FunLib/aba_site.lua:228` / `aba_site.ts:142` | `dire_base = Vector(7137, 6548, 0)` | **nothing**: grep finds no caller | No. These are dead exports. |

**Can the position be read at runtime?** Partly.
- `bot:DistanceFromFountain()` exists, but it returns only the distance to the bot's own fountain, not a position.
- `GetShopLocation(team, SHOP_HOME)` exists (`SHOP_HOME` is in `bot-constants.md`). It returns the home *shop*,
  which is near the fountain but not at its centre.
- The fountain may be in `GetUnitList(UNIT_LIST_ALLIED_BUILDINGS)` and `UNIT_LIST_ENEMY_BUILDINGS`
  (expected unit name `dota_fountain`), but that is **unverified**.

**Probe P1:** at 0:00, print the name and `GetLocation()` of every unit in both building lists. Also print
`GetShopLocation(t, SHOP_HOME)` for both teams. If the fountain unit shows up, compute both fountains once from it
and drop the literals. Otherwise update the literals to the measured values. Also check
`IsLocationPassable(old DireFountain)` to see whether bots still path to the old point.

## 2. Mid T1/T2 towers (T2 ~260u and T1 ~350u away from the Radiant base, both sides; notes lines 102-107)

- **No live code hardcodes a tower position.** Push, defend, group and siege all call
  `GetTower(team, TOWER_*)` and then `:GetLocation()`, so the new positions arrive on their own.
  The glyph logic and ward logic also choose towers through `GetTower`.
- The `aba_site.lua:114-137` / `aba_site.ts:14-36` `*_T1MIDFALL` / `*_T2MIDFALL` / `MANDATE` / `AGGRESSIVE` vectors
  only feed `GetWardSpotWhenTowerFall`, `GetAggressiveSpot` and `GetMandatorySpot`. Grep finds **no caller outside
  aba_site** for any of the three, so this is dead code.
- **Live but affected: `bots/FunLib/aba_ward_utility.lua`** (192 vectors, used by `mode_ward_generic.lua:9`).
  - It holds fixed ward spots keyed by tower, for example `[TOWER_MID_1]` at :58-63 and :134-144,
    `[TOWER_MID_2]` at :82-90 and :165-170, and the game-start mid spots at :9-11 and :24-26 (such as
    (-249, -1046) and (1141, -458)).
  - 7.42 "reworked the geometry of the river where mid lanes meet" and added trees on the mid flanks
    (notes lines 105-110), so some of these spots may now land on trees or cliffs. A ward cast there fails
    without any error.
  - `bots/FunLib/techies_utility.lua` (117 vectors, the Techies mine spots keyed the same way) has the same
    problem, but it only affects Techies.
- `bots/mode_rune_generic.lua:666-677` `GetGoOutLocation()` has river points near mid, for example
  (-1945, 60, 128) and (1142, -337, 128). They are game-start move targets only.

**Probe P2:** run `IsLocationPassable` over every ward and go-out vector in `aba_ward_utility.lua` and
`mode_rune_generic.lua:666-677`, and print the ones that fail. Also print `GetTower(t, TOWER_MID_1/2):GetLocation()`
for the record. Nothing needs those numbers yet.

## 3. Twin Gates (moved to the top and bottom rims; notes lines 95-97)

- The only hit is `bots/mode_roshan_generic.lua:21-24`: `rTwinGateLoc` (5888, -7168) and `dTwinGateLoc`
  (6144, 7552). **Both are commented out.** Bots do not use the gates.
- **Possible conflict:** the new gates sit at the rim, where the small flooded camps used to be. The Tormentor
  waiting spots are hardcoded at `jmz_func.lua:6016/6018` (6792, -6815) and (-7041, 6796). Whether a gate now
  stands close to them is unknown.

**Probe P3 (optional):** find the twin gate units with `GetUnitList(UNIT_LIST_ALL)`, matching on "twin_gate", and
print their locations and their distance to the two waiting spots.

## 4. Neutral camps (flooded and stream-end camps moved, T1 spawn boxes smaller; notes lines 96-97, 112)

- The farm code (`aba_site.lua:407` `RefreshCamp`, `mode_farm_generic.lua` through `GetClosestNeutralSpwan`)
  and `hero_rattletrap.lua:597` / `hero_templar_assassin.lua:613` all read **`GetNeutralSpawners()` at runtime**.
  No change is needed.
- `aba_site.lua:168` `CStackLoc` (4136, -1753) is only read by `GetCampMoveToStack`, which has no caller.
- No pull or stack logic exists anywhere (grep for "pull" finds only Enigma and Brewmaster modifiers). So the new
  pulled-creep slow (notes line 72) does not affect bots either.

## 5. Tormentor (first spawn 20:00 to 15:00; drops a Greater Horn of Battle, and an Aghanim's Shard from the 2nd death on; notes lines 79-85)

- **`bots/mode_side_shop_generic.lua:65`** `nTormentorSpawnTime = J.IsModeTurbo() and 10 or 20`, in minutes, gated
  at :200.
  - **Change 20 to 15.** For turbo, the old values halve (20 to 10), so the guess is 7.5. Check the turbo value
    with a turbo probe or keep 7.5.
  - **Matters: yes.** Bots will not send anyone to check the Tormentor until 20:00, so they give up 5 minutes and
    the new Horn drop.
- Nothing reads this at runtime: there is no Tormentor spawn API. `IsTormentorAlive` (:366) only sees the
  `miniboss` creep when a hero is standing next to it.
- `:64` respawn interval of 10 min (turbo 5): 7.42 says nothing about it, so it stays.
- `:41` "cores avg networth >= 23000, skip" and `:169` "skip after 40:00 (turbo 25:00)": 7.42 does not change these
  values. The Shard from the 2nd death on makes late Tormentors worth more, though. That is a tuning call, not a
  patch fix.
- The drops are picked up by the generic `GetDroppedItemList` / `Action_PickUpItem` code
  (`item_purchase_generic.lua:659-714`, `mode_team_roam_generic.lua:1506-1580`). Using the Horn is a question for
  the item ticket (03).
- The positions (`jmz_func.lua:10-11`, `:6002-6019`) are not changed by 7.42.

## 6. Roshan respawn (base timer -1 min per kill, minimum 5 min; notes line 89)

- **`bots/FunLib/jmz_func.lua:4985`** `J.IsRoshanAlive()` assumes Roshan is back when
  `DotaTime() - killTime > (turbo 6*60 or 11*60)`, which is the old maximum of 8 + 3 min.
  - It is the only respawn model. Its callers are `mode_roshan_generic.lua:159`,
    `ability_item_usage_generic.lua:7883`, `mode_farm_generic.lua:172`, `mode_retreat_generic.lua:314`,
    `behavior/roshsafe.ts:94` and `behavior/siege.ts:99`.
  - **Matters: yes.** From the 2nd kill on, bots consider Roshan alive 1 to 3+ minutes after he is really back.
    `mode_roshan_generic.lua:221` also ramps its desire from that late moment.
- Runtime: `GetRoshanKillTime()` gives only the *last* kill time. Counting kills is still possible: the
  `killTime` local in `IsRoshanAlive` already notices every change. There is no respawn-timer API.
- Fix shape: keep a kill counter in `IsRoshanAlive` and use a max respawn of
  `max(5, 8 - (kills-1))*60 + 180`, plus a turbo variant. **The exact formula is unverified:** does the random
  0-3 min stay? Is the 1st respawn already 7 min?

**Probe P4:** in a cheats lobby, kill Roshan 4 times (`dota_kill_roshan` or by force) and log `GetRoshanKillTime()`
along with the time the `npc_dota_roshan` unit reappears in a hero's nearby-units list.
- `jmz_func.lua:3401` `IsRoshanCloseToChangingSides` (`% 300`) is the day/night pit swap. 7.42 does not touch it.

## 7. Glyph (2 charges, 6 min replenish, 7s between uses, no reset when buildings die; notes lines 64-66)

- **`bots/ability_item_usage_generic.lua:8322-8388`** `UseGlyph()` returns early when `GetGlyphCooldown() > 0`, then
  glyphs for a tower under 36% HP, a melee rax under 50% or the Ancient under 50%. There is no other glyph code.
- Nothing else in the bot code reads glyph charges.

**Probe P5:** with one charge left after a use, does `GetGlyphCooldown()` return the 7s gap, the 6-min replenish, or
something else?
- If it returns the replenish timer, bots keep using one charge at a time. That is safe but leaves the second charge
  unused.
- If it returns 7s, bots may fire both charges on the same dive about 7s apart.

That second case is probably fine, because each call needs the threshold to still be true. The thresholds may want
revisiting once two charges exist. **Behaviour impact: low to medium.**

## 8. Siege creeps (every 2.5 min after 30:00; notes lines 55-62)

- **No hardcoded siege-wave timing exists.** The siege hits are all unit-name checks (`aba_defend.lua:382/774`,
  `jmz_func.lua:2142/5808`, `aba_special_units.lua:138`). Push timing reads the creeps themselves.
- `behavior/siege.ts` is the team-siege behaviour, not siege creeps.
- No change is needed. Flagbearer and the 35:00 ranged creep are likewise not hardcoded.

## 9. Wisdom Shrine (XP now 200 + 200 per use; notes line 93)

- `bots/mode_rune_generic.lua:52-53` has the shrine spots (-7948, 768) and (8029, -1125). The 7-min cadence is at
  `:269` (`DotaTime() >= 7*60`) and `:732` (`% 7`).
- 7.42 changes only the XP value, and no code reads it, so **no change is needed**.
- Unrelated but noticed: `utils.ts:30-33` `WisdomRunes` (-8126, -320) / (8319, 266) is never read and does not match
  the coords in `mode_rune_generic`. It was already like this before 7.42.

## 10. Other items from lines 1-118

- **Invisibility Rune disguise** (line 94): no rune-type branching hit (`RUNE_INVISIBILITY` and "disguise" are not
  found). Runes are read with `GetRuneSpawnLocation` at runtime (`mode_rune_generic.lua:344-355`). The
  `aba_site.lua:222-223` power rune vectors have no caller.
- **Passive XP of 50/min and the new XP curve** (lines 27-28): `bots/Buff/Experience.lua:8-39` `XPNeeded` scales the
  Buff-mode bonus XP.
  - The table is already off for 7.41 (for example [29]=7500 where the notes give 7000).
  - The new values from the notes are 250, 400, 550, 800, 850, 925, 1050, 1150, 1225, 1300, 1375, 1450, 1525, 1600,
    1675, 1750, 1825, 1900, 2000, 2200, 2400, 2600, 2800, 3000, 4000, 5000, 6000, 7000, 8000.
  - Updating it is optional and changes numbers only.
- Gold, bounty and pip changes are not map or timing values and were not searched for here.

## Probes for the headless game (ticket 14 / 06)

| Id | What to measure | Needed for |
|---|---|---|
| P1 | Dire and Radiant fountain coords (building unit list, `GetShopLocation(t, SHOP_HOME)`), plus `IsLocationPassable` of the old Dire point | §1, **required** |
| P2 | `IsLocationPassable` of every ward spot and go-out vector near mid, plus mid T1/T2 locations | §2, recommended |
| P3 | Twin gate unit locations vs the Tormentor waiting spots | §3, optional |
| P4 | Roshan respawn time after kills 1-4 | §6, required for an exact formula (a conservative bound works without it) |
| P5 | `GetGlyphCooldown()` with 1 of 2 charges left | §7, recommended |
