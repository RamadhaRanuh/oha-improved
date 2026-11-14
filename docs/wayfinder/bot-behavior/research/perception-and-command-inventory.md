# Perception and command inventory

Findings for the ticket [What the bot API lets a bot perceive and command](../tickets/03-what-the-bot-api-lets-a-bot-perceive-and-command.md). Researched 2026-11-12 against the working tree (baseline `cb814c6` plus untracked files).

## Sources and how far each can be trusted

| Tag | Source | Trust |
|---|---|---|
| **[VDC]** | Valve Developer Community, "Dota Bot Scripting". Read through two local transcriptions: the `dota2-bot-dev` skill references (`architecture.md`, `bot-constants.md`) and the doc comments in `bots/API/api_global.lua`, `api_unit.lua`, `api_ability.lua`. | Primary. The live page returned HTTP 403 on 2026-11-12, so the transcriptions were not re-checked against it. |
| **[MD]** | ModDota engine dump (`docs.moddota.com/lua_bots`), mirrored in the skill references `api-globals.md`, `api-unit.md`, `api-ability.md`. Spot-checked live on 2026-11-12 for 21 functions; all matched the mirror. | Primary for "does this function exist and what is its signature". Descriptions are one-liners. |
| **[REF]** | `docs/BOT_API_REFERENCE.md` in this repo. | Secondary. Readable, but it contradicts the primary sources in several places (listed in [Disagreements](#disagreements-between-sources)). |
| **[CODE]** | This repo's Lua. Paths are relative to the repo root. | Primary for "what the project wraps or patches", and indirect evidence of how the API behaves at runtime. |

Two facts about the local sources that matter when reading the rest:

- **`bots/API/*.lua` is not loaded.** No file under `bots/` requires `api_global`, `api_unit` or `api_ability`, and the directory is untracked in git. Its executable overrides (for example the cast-range fix, the `DAMAGE_TYPE_PURE` fix, `GetActiveMode` returning `BOT_MODE_NONE` at zero desire) are **not in effect**. Its comments are still the best local copy of Valve's function descriptions.
- **`bots/FunLib/aba_global_overrides.lua` is loaded**, from `bots/FunLib/aba_item.lua:1` and `bots/hero_selection.lua:15`. Every override in it is live for any bot that loads `jmz_func` (which requires `aba_item` at `bots/FunLib/jmz_func.lua:29`).

"Needs in-game check" marks anything the sources leave open or disagree on. Those are collected again at the end.

---

## 1. Perception

### 1.1 The fog rule

- Scripts cannot query units in fog of war and cannot order units they do not control [VDC, `architecture.md` section 1].
- `unit:CanBeSeen()` is the gate: "Can we currently see this bot? Always true for bots on our team. Many functions will not return valid data without this being true" [MD]. Valve's wording: "Check if a unit can currently be seen by your team" [VDC, `bots/API/api_unit.lua:185`].
- `GetUnitList(type)` returns visible units only ("Gets a list of visible units" [MD]). `GetNearby*` return units "that we can see" [MD].
- A handle kept from an earlier frame can go stale: the unit may now be in fog. The project guards against this by patching about a dozen getters to return a harmless default when `CanBeSeen()` is false (section 4.1).
- `IsLocationVisible(vLoc)` and `IsRadiusVisible(vLoc, fRadius)` say whether the team currently sees a spot [VDC, `bots/API/api_global.lua:88-93`]. Used 33 times and once respectively, never wrapped.
- `unit:IsInvisible()` only says the unit has an invisibility effect. It does not mean the enemy cannot see it [VDC, `bots/API/api_unit.lua:524-526`]. Wrappers: `J.IsRealInvisible` (`bots/FunLib/jmz_func.lua:3073`, excludes dust, track, tower range 880 and similar) and `Utils.IsTruelyInvisible` (`bots/FunLib/utils.lua:1548`).

### 1.2 Enemy position and last-seen data

| API | Returns | Limit | Wrapper in this codebase |
|---|---|---|---|
| `unit:GetLocation()` | 2D position | Valid only while visible. | Patched to return `nil` for non-buildings in fog: `bots/FunLib/aba_global_overrides.lua:154-162`. |
| `GetHeroLastSeenInfo(playerID)` | A **list** of `{location, time_since_seen}`, one entry per hero that player controls [VDC, `bots/API/api_global.lua:329-331`] | Works for enemies in fog; this is the only sanctioned "where was he" signal. Stale by nature. | `J.GetLastSeenEnemiesNearLoc` (`bots/FunLib/jmz_func.lua:4178`, 5 s window), `Utils.GetLastSeenEnemyIdsNearLocation` (`bots/FunLib/utils.lua:630`, 3 s window, also adds incoming teleports), `Utils.CountMissingEnemyHeroes` (`bots/FunLib/utils.lua:1728`, missing = unseen for 2.5 s). All read `info[1]`. |
| `GetUnitPotentialValue(hUnit, vLoc, fRadius)` | 0-255: how likely that enemy hero is within the radius | When vision is lost a flood fill spreads at the hero's move speed with decaying intensity. Ignores teleports and movement bursts; assumes any direction equally likely [VDC, `architecture.md` section 9]. | One call site: fog chase in `bots/FunLib/override_generic/mode_attack_generic.lua:398` (threshold 180). No wrapper. |
| `unit:GetExtrapolatedLocation(fTime)` | Predicted position from recent movement | Visible units only. Linear extrapolation, so it is wrong for juking targets. | Used 161 times directly. `J.GetCorrectLoc` (`bots/FunLib/jmz_func.lua:2212`), `J.IsMoving` (`:3015`). |
| `unit:GetMovementDirectionStability()` | 1.0 = straight line for a while, 0.0 = random | Visible units only. | Used 13 times, no wrapper. |
| `unit:GetVelocity()` | Velocity over the last two seconds [MD] | Visible units only. | One use: `J.GetUltLoc` (`bots/FunLib/jmz_func.lua:6705`). |
| `unit:GetFacing()`, `unit:IsFacingLocation(vLoc, nDegrees)` | Facing 0-359; cone test | Visible units only. | `J.IsEnemyFacingUnit` (`:4010`), `J.IsChasingTarget` (`:3058`). |
| `GetIncomingTeleports()` | `{location, time_remaining, playerid}` for teleports "that are visibly happening" [VDC, `bots/API/api_global.lua:381-383`] | Only teleports the team can see. | `Utils.GetEnemyIdsInTpToLocation` (`bots/FunLib/utils.lua:654`), `Utils.GetAllyIdsInTpToLocation` (`:1964`), `bots/FunLib/aba_push.lua:387`. |
| `IsHeroAlive(id)`, `GetHeroLevel(id)`, `GetHeroKills/Deaths/Assists(id)` | Scoreboard facts by player ID | Work for enemies regardless of fog (same information a player sees on the scoreboard). | `J.GetNumOfAliveHeroes` (`:4205`), `J.GetAverageLevel` (`:4252`). |

### 1.3 Incoming projectiles and danger zones

| API | Returns | Limit | Wrapper |
|---|---|---|---|
| `unit:GetIncomingTrackingProjectiles()` | List of `{location, caster, player, ability, is_dodgeable, is_attack}` [VDC, `bots/API/api_unit.lua:770`] | Tracking projectiles only (attacks and unit-target spells). Gives current position, not time to impact; impact time must be derived from distance and the caster's `GetAttackProjectileSpeed()`. Callable on any visible unit, including creeps. `caster` can be nil. | `J.IsProjectileIncoming` (`bots/FunLib/jmz_func.lua:1919`), `J.IsUnitTargetProjectileIncoming` (`:1944`), `J.IsStunProjectileIncoming` (`:1973`), `J.IsAttackProjectileIncoming` (`:1993`), `J.IsNotAttackProjectileIncoming` (`:2011`), `J.GetCreepAttackProjectileWillRealDamage` (`:2162`), `J.GetAttackProjectileDamageByRange` (`:2194`). |
| `GetLinearProjectiles()` | List of `{location, caster, player, ability, velocity, radius, handle}` for visible skillshots [VDC, `bots/API/api_global.lua:333`] | Visible ones only. The script must do its own line-versus-point test. | No generic wrapper. Used only in five hero files (Puck, Timbersaw, Ancient Apparition, Rubick variant). **No generic skillshot dodge exists.** |
| `GetAvoidanceZones()` | List of `{location, ability, caster, radius}` for visible ground effects | Visible ones only. | Never called. Hand-written equivalents: `J.IsLocationInChrono` (`:5568`), `J.IsLocationInBlackHole` (`:5594`), `J.IsLocationInArena` (`:5643`), and a custom zone list in `Utils.addCustomAvoidanceZone` (`bots/FunLib/utils.lua:1428`). |
| `unit:IsCastingAbility()`, `IsUsingAbility()`, `IsChanneling()`, `GetCurrentActiveAbility()` | Whether a visible unit is mid-cast and which ability | Works on visible enemies; this is how the bots "see" a cast animation. | `J.DidEnemyCastAbility` (`:5430`), `J.IsCastingUltimateAbility` (`:4069`), `J.IsWillBeCastUnitTargetSpell` (`:1847`), `J.IsWillBeCastPointSpell` (`:1890`). `IsUsingAbility` is patched to return false for fogged or non-hero units (`bots/FunLib/aba_global_overrides.lua:196-204`). |
| `InstallCastCallback(playerID, fn)`, `InstallDamageCallback(playerID, fn)` | Event callbacks for a player's casts and damage taken | Exist in the engine [MD]. Callback payload fields are undocumented in the local sources. | **Never used in this codebase.** Needs in-game check before relying on them. |

### 1.4 Attack targets and animation timing

| API | Returns | Limit | Wrapper |
|---|---|---|---|
| `unit:GetAttackTarget()` | The unit being attacked | Works on any visible unit: enemy heroes, creeps, towers. This is the only "who is hitting whom" signal. | Patched to return nil in fog (`bots/FunLib/aba_global_overrides.lua:216-224`). `J.GetHeroesTargetingUnit` (`bots/FunLib/jmz_func.lua:1208`), `J.GetHeroCountAttackingTarget` (`:6307`), `J.IsEnemyTargetUnit` (`:4051`), `J.GetAttackEnemysAllyCreepCount` (`:234`). 274 direct uses. |
| `bot:GetTarget()` / `bot:SetTarget(h)` | A script-set target. "Doesn't actually execute anything, just potentially useful for communicating a target between modes/items" [VDC, `bots/API/api_unit.lua:635-640`] | Only meaningful on allied bots. Not an attack target. | Patched to return nil for non-bots (`bots/FunLib/aba_global_overrides.lua:330-338`). `J.GetProperTarget` (`:335`), `J.IsAllysTarget` (`:2936`), `J.IsOtherAllysTarget` (`:2912`). |
| `unit:GetAnimActivity()` | Current animation (`ACTIVITY_ATTACK`, `ACTIVITY_ATTACK2`, `ACTIVITY_RUN`, ...) | Visible units. | `J.IsAttacking` (`:3039`), `J.IsRunning` (`:3030`). Last-hit code compares against the raw number 1503. |
| `unit:GetAnimCycle()` | Fraction through the current animation, 0.0-1.0 | Visible units. | Compared against `GetAttackPoint()` to tell wind-up from backswing (`J.IsAttacking`, `:3039`). |
| `unit:GetAttackPoint()` | "The point in the animation where a unit will execute the attack" [VDC, `bots/API/api_unit.lua:309`] | The code treats it both as a cycle fraction (`:3052`, `:2063`) and, divided by attack speed, as seconds (`:2048`). The unit is not stated in the sources. Needs in-game check. | `J.GetAttackProDelayTime` (`:2034`). |
| `unit:GetSecondsPerAttack()` | Seconds per attack including backswing [VDC, `:306`] | | Same. |
| `unit:GetLastAttackTime()` | Time the unit last executed an attack | Compared against `GameTime()` in this codebase (`:2051`). | Same. |
| `unit:GetAttackProjectileSpeed()`, `GetAttackRange()`, `GetAttackDamage()`, `GetAttackSpeed()`, `GetAcquisitionRange()` | Attack stats | Visible units. `GetAttackRange` patched to 200 in fog (`aba_global_overrides.lua:340-348`). | Used throughout. |

The project already has a last-hit predictor built from these: `J.GetAttackProDelayTime` (`:2034`) estimates when the bot's own hit lands, and `J.GetTotalAttackWillRealDamage` (`:2187`) sums creep attacks in wind-up (`:2101`) and attack projectiles in flight (`:2162`) that will land first. Callers: `bots/mode_laning_generic.lua:144`, `bots/FunLib/override_generic/mode_laning_generic.lua:179`, `bots/mode_team_roam_generic.lua:220`, `:983`, `:1021`.

### 1.5 Creep and tower aggro

There is **no aggro API**. Nothing reports "this creep wave is about to switch to me" or "drawing aggro now". What exists:

| API | Returns | Limit | Wrapper |
|---|---|---|---|
| `creep:GetAttackTarget()` | What a visible creep is attacking now | After the fact only. | `J.GetCreepAttackActivityWillRealDamage` (`:2101`). |
| `GetTowerAttackTarget(nTeam, nTower)` | The tower's current attack target [MD] | Presumably needs vision for enemy towers; not stated. | **Never called.** The code uses `building:GetAttackTarget()` over `GetUnitList` instead: `J.IsUnitTargetedByTower` (`:6621`). |
| `bot:WasRecentlyDamagedByTower(t)`, `WasRecentlyDamagedByCreep(t)`, `WasRecentlyDamagedByAnyHero(t)`, `WasRecentlyDamagedByHero(h, t)`, `WasRecentlyDamagedByPlayer(id, t)` and the `TimeSinceDamagedBy*` twins | Damage history | `WasRecentlyDamagedByAnyHero` is patched to return nil on non-heroes (`aba_global_overrides.lua:103-111`). | `Utils.RecentlyTookDamage` (`bots/FunLib/utils.lua:1343`). |
| `bot:GetNearbyTowers(r, bEnemies)` | Towers sorted nearest first | Radius cap 1600. Patched to return nil when called on a non-hero (`aba_global_overrides.lua:113-121`). | 186 uses. |
| `GetTower(team, TOWER_*)`, `GetBarracks`, `GetAncient` | Building handles, always available | Enemy building state beyond existence follows the fog rule. | `Utils.AllTowers` and friends (`bots/FunLib/utils.lua:734-743`). |

Aggro rules (attack an enemy hero near creeps and they turn on you; tower target priority) must be modelled by the script.

### 1.6 Lane front and creep equilibrium

| API | Returns | Limit | Wrapper |
|---|---|---|---|
| `GetLaneFrontAmount(team, lane, bIgnoreTowers)` | 0.0-1.0 position of that team's creeps along the lane [VDC] | Works for both teams, so the enemy wave position appears to be known even in fog. Needs in-game check. | `J.GetClosestTeamLane` (`:1309`); laning desire reads both teams' fronts (`bots/mode_laning_generic.lua:204-205`). |
| `GetLaneFrontLocation(team, lane, fDelta)` | World position of the front, offset by `fDelta`. "Always ignores towers" [VDC] | Same. | 121 uses. `J.GetDistanceFromLaneFront` (`:2237`), `J.GetNearestLaneFrontLocation` (`:3443`). |
| `GetLocationAlongLane(lane, amount)`, `GetAmountAlongLane(lane, vLoc)` | Convert between lane fraction and world position; the second also returns distance from the lane | | Used in TP logic (`bots/ability_item_usage_generic.lua:4860`, `:5188`, `:5228`). |
| `bot:GetNearbyLaneCreeps(r, bEnemies)`, `GetNearbyCreeps`, `GetNearbyNeutralCreeps(r)` | Visible creeps sorted nearest first | Radius cap 1600. | `J.GetAroundCreepList` (`:3773`), `J.GetInLocLaneCreepCount` (`:2352`), `J.GetAllyCreepNearLoc` (`:2462`). |
| `GetNeutralSpawners()` | Camp list | The `location` field went missing in a 2025 update according to a comment at `bots/API/api_global.lua:101`; that fix lives in the unloaded file. | Consumed by `Site.RefreshCamp` (`bots/FunLib/aba_site.lua:407`). Whether farming still gets camp locations in the current client needs in-game check. |

The lane front is a single point per team per lane. It says nothing about wave size, creep health, or whether the wave is under tower. Those must be computed from `GetNearbyLaneCreeps`, which only covers 1600 units around a hero.

### 1.7 Hero power and damage estimates

| API | Returns | Limit | Wrapper |
|---|---|---|---|
| `unit:GetEstimatedDamageToTarget(bCurrentlyAvailable, hTarget, fDuration, nDamageTypes)` | Estimated damage in the window | "Takes into account item and ability usage based on current mana/cooldowns for allies, for enemies it assumes all items/abilities are available. Uses no positional/situation info" [MD]. So enemy estimates are always worst case. | `J.GetTotalEstimatedDamageToTarget` (`:6121`), `J.CanKillTarget` (`:1066`), `J.WillKillTarget` (`:1077`). 83 direct uses. |
| `unit:GetOffensivePower()` | Average damage to each enemy hero over 5 s, plus stun duration, plus half slow duration, respecting mana and cooldowns | **Teammates only** [VDC, `architecture.md` section 9]. Offence only, not durability. | `J.WeAreStronger` (`:4646`). |
| `unit:GetRawOffensivePower()` | Same, ignoring cooldown and mana | Works on visible enemies and teammates [VDC]. | Same. |
| `unit:GetStunDuration(bAvail)`, `GetSlowDuration(bAvail)`, `HasBlink`, `HasSilence`, `HasInvisibility`, `HasMinistunOnAttack` | Capability summaries | For enemies the "currently available" flag cannot be honoured (see cooldowns below). | `GetStunDuration` is never used. |
| `unit:GetActualIncomingDamage(nDmg, type)` | Damage after reductions | The unloaded `bots/API/api_unit.lua:328-334` claims `DAMAGE_TYPE_PURE` "always (?) gives 0" and remaps it to magical. That fix is not live. Needs in-game check. | `J.WillMagicKillTarget` (`:1110`), `J.WillMixedDamageKillTarget` (`:1091`). |
| `unit:GetAttackCombatProficiency(h)`, `GetDefendCombatProficiency(h)` | Damage multipliers | | Never used. |

`J.WeAreStronger` (`:4646`) is the project's team-strength test. It walks `GetUnitList(UNIT_LIST_ALL)`, combines log(power) with sqrt(attack DPS) and a health multiplier, compares our **raw** power against enemy raw power, and caches the result for 0.5 s per bot and radius. It only counts enemies that are currently visible.

### 1.8 Cooldown, mana and state: enemies versus allies

| Signal | Allies | Visible enemies | In fog |
|---|---|---|---|
| Health, mana, level, armour, magic resist, move speed | Yes | Yes | No. Patched defaults: health 666 (`aba_global_overrides.lua:408-412`), magic resist 1 (`:163-171`). |
| Ability cooldown (`GetCooldownTimeRemaining`, `IsCooldownReady`, `IsFullyCastable`) | Yes | **No.** "Only works on yourself and allies" [VDC, `bots/API/api_ability.lua:95`, `:114`]. [REF] says enemy abilities always return 0. | No |
| Ability list, level, cast range, special values | Yes | Yes for a visible enemy via `GetAbilityByName` / `GetAbilityInSlot` (used by `J.DidEnemyCastAbility`, `:5430`) | No |
| Items (`GetItemInSlot`, `FindItemSlot`) | Yes | Read on visible enemies (slots 0-8) in `J.GetInventoryNetworth` (`:5834`), which keeps the highest total ever seen per enemy. Not documented by Valve; needs in-game check that it returns real items. | Unknown |
| Modifiers (`HasModifier`, `GetModifierList`, remaining duration, stacks) | Yes | Yes | Patched to false (`aba_global_overrides.lua:140-152`) |
| Disable state (`IsStunned`, `IsRooted`, `IsHexed`, `IsSilenced`, ...) | Yes | Yes | No |
| Active mode (`GetActiveMode`, `GetActiveModeDesire`) | Yes, for bots | No meaning for enemies or humans | No |
| `IsIllusion()` | Yes | "Always returns false on enemies" [VDC, `bots/API/api_unit.lua:166-168`] | No |
| Net worth, gold | Yes | Not documented for enemies. The project estimates enemy net worth from visible items instead (`J.GetInventoryNetworth`, `:5834`). | Unknown |

Enemy illusions therefore have to be guessed. `J.IsSuspiciousIllusion` (`:771`) is the project's heuristic, and it memoises its answer on the unit handle (`is_suspicious_illusion`).

The enemy-cooldown gap is partly filled by observation: `J.DidEnemyCastAbility` (`:5430`) notices a cast in progress, and `Utils.HasCriticalSpellWithCooldown` (`bots/FunLib/utils.lua:2054`) works for allies only. Nothing in the codebase tracks "enemy used ultimate at time T, so it is down until T + cooldown". `InstallCastCallback` could feed such a tracker but is untested here.

### 1.9 Bulk queries and their cost

| API | Returns | Cost and limit | Wrapper |
|---|---|---|---|
| `bot:GetNearbyHeroes(r, bEnemies, mode)` | Heroes sorted nearest first. Mode filter is for allies; for enemies pass `BOT_MODE_NONE` | "nRadius must be less than 1600" [VDC, `bots/API/api_unit.lua:712`]. The project clamps to exactly 1600 (`aba_global_overrides.lua:226-234`), which sits on the boundary. Returns nil when called on a fogged unit (same patch). | `J.GetNearbyHeroes` (`:2516`, filters invalid heroes and Meepo clones), `J.GetAllyList` (`:3733`), `J.GetEnemyList` (`:3811`), `J.GetAlliesNearLoc` (`:474`), `J.GetEnemiesNearLoc` (`:497`). A per-bot cache inside `J.GetNearbyHeroes` is commented out (`:2540-2563`). |
| `GetUnitList(UNIT_LIST_*)` | All visible units of a type, whole map | "Reasonably fast because it will build the lists on-demand and no more than once per frame, but the lists can be long" [VDC, `bots/API/api_global.lua:52-54`]. The cost is the Lua loop over the result, not the call. | 171 call sites, 45 in `jmz_func.lua`. Only `global_cache.getGlobalUnitState` (`bots/FunLib/global_cache.lua:233`) caches it, and only `aba_push` uses that cache. |
| `bot:FindAoELocation(...)` | `{count, targetloc}` best AoE centre | Engine-side search; 368 uses, mostly per hero. | `J.GetAoeEnemyHeroLocation` (`:294`). |
| `bot:GetGroundHeight()` | Height at the unit | "This call can be very expensive! Use sparingly" [VDC, `bots/API/api_unit.lua:445`]. | Never used. `GetHeightLevel(vLoc)` (1-5) is the cheap alternative. |
| `GeneratePath(vStart, vEnd, tAvoid, fnDone)` | Asynchronous pathfind with avoidance zones; calls back with distance and waypoints | Callback based. | Only referenced in a comment (`:6461`). `Utils.findPathAvoidingZones` (`bots/FunLib/utils.lua:1478`) and `Utils.MoveBotSafely` (`:2222`) are the hand-written alternative. |

---

## 2. Commands

### 2.1 What a mode can order

Every order exists in three forms [MD, `api-unit.md` header]: `Action_*` replaces the current action and clears the queue, `ActionPush_*` puts an action on top of the current one, `ActionQueue_*` appends. `ActionImmediate_*` runs now and does not touch the queue.

| Command | Effect | Limit |
|---|---|---|
| `Action_MoveToLocation(v)` | Bot-pathfind to a point | "This is not a precision move" [VDC, `bots/API/api_unit.lua:5-9`]. |
| `Action_MoveDirectly(v)` | "Identical to a user's right-click" [VDC, `:10-14`] | Bypasses the bot pathfinder. Used twice (`bots/mode_rune_generic.lua:288`, `bots/mode_side_shop_generic.lua:345`). |
| `Action_MovePath(tWaypoints)` | Follow waypoints | |
| `Action_MoveToUnit(h)` | Move to and keep following a unit | |
| `Action_AttackUnit(h, bOnce)` | Attack a unit; `bOnce` pops the action after one attack | 63 call sites outside `BotLib`, 40 of them with `bOnce = true`. |
| `Action_AttackMove(v)` | Attack-move to a point | Target choice is the engine's. 15 uses. |
| `Action_UseAbility`, `_UseAbilityOnEntity`, `_UseAbilityOnLocation`, `_UseAbilityOnTree` | Cast | Hidden abilities are blocked by a patch (`aba_global_overrides.lua:300-318`). |
| `Action_PickUpRune`, `_PickUpItem`, `_DropItem`, `_UseShrine` | Utility orders | |
| `Action_Delay(f)` | Wait | Never used. |
| `Action_ClearActions(bStop)` | Empty the queue, optionally stop in place | The nearest thing to a stop or hold command. 61 uses. |
| `ActionImmediate_Ping(x, y, bNormal)`, `ActionImmediate_Chat(msg, bAll)` | Ping, chat | See section 3. |
| `ActionImmediate_Glyph()`, `_Buyback()`, `_Courier()`, `_SwapItems()`, `_PurchaseItem()`, `_SellItem()`, `_LevelAbility()` | Team and economy actions | `SwapItems` is rate limited by a patch: no swap with an enemy within 1000 and at most one per 11 s (`aba_global_overrides.lua:378-395`). |
| `ability:ToggleAutoCast()` | Toggle autocast | The only way to drive orb-effect abilities besides casting them on a target. |

Queue inspection: `GetCurrentActionType()`, `NumQueuedActions()`, `GetQueuedActionType(n)`. Wrappers: `J.HasQueuedAction` (`:83`, answers false for any bot other than the calling one), `J.CanNotUseAction` (`:97`), `Utils.NumActionTypeInQueue` (`bots/FunLib/utils.lua:1222`), `Utils.IsBotThinkingMeaningfulAction` (`:2256`).

Who may issue orders: only the active mode's `Think()` for movement and attack, but `AbilityUsageThink` and `ItemUsageThink` run every frame regardless of mode and also issue `Action*` calls [VDC table in `architecture.md` section 3; REF "Script Entry Points"]. The codebase issues ability casts with `ActionQueue_*` (451 uses) and makes callers check `J.CanNotUseAction` so a mode's `Action_*` does not wipe a queued cast. Any new behaviour code has to respect the same contract.

Minions: `MinionThink(hMinion)` in the hero file gets every illusion, summon and dominated unit, and the same action commands work on that handle [VDC]. Here it is routed through `bots/bot_generic.lua:14` and throttled to once per 0.3 s (`:16-18`).

### 2.2 What cannot be done directly

| Wanted | Status |
|---|---|
| Orb-walk as one command | No such command. It has to be built: `Action_AttackUnit(target, true)`, watch `GetAnimActivity()` / `GetAnimCycle()` against `GetAttackPoint()`, then `Action_MoveToLocation` once the hit is released. `J.IsAttacking` (`:3039`) already tells wind-up from backswing. **No code in this repo does this today**; the ranged branch in `bots/FunLib/override_generic/mode_attack_generic.lua:362-378` only steps away when the target cannot be attacked. Whether a move order issued on the frame after the attack point reliably cancels backswing without cancelling the hit needs an in-game check. |
| Cancel backswing | Same as above: no dedicated command, only "issue another order". |
| Explicit stop, hold position | No `Action_Stop` or `Action_Hold` in the dump [MD]. `Action_ClearActions(true)` is the substitute. |
| Attack-ground, patrol, directional move | Not in the API. |
| Choose the target of an attack-move | Not possible; use `Action_AttackUnit`. |
| Shift-queue across modes | The queue belongs to the bot, not the mode. A mode switch plus one `Action_*` call discards it. |
| Sub-frame timing | Decisions happen at `Think()` granularity. On top of that the engine adds difficulty delays to ability and item use: Easy 0.5-1.0 s, Medium 0.3-0.6 s, Hard 0.1-0.2 s, Unfair 0.075-0.15 s, and Easy/Medium/Passive also randomise last-hit timing [VDC, `architecture.md` section 7]. These apply even to fully taken-over bots. |
| Order another bot's hero | Not allowed; scripts command only their own unit and its minions [VDC]. Coordination has to go through shared state (section 3). |
| Camera, selection, quick-cast, alt-ping of cooldowns | Not in the API. |
| Read or set another mode's desire | A mode's `GetDesire()` returns its own number only. `GetActiveMode()` and `GetActiveModeDesire()` reveal the winner, not the losers. |

---

## 3. Team channels

### 3.1 Is each bot in its own Lua environment?

The local Valve transcriptions do not say. The code gives consistent indirect evidence for this model, which should be treated as **likely but unconfirmed**:

- **Engine entry files are per bot.** Mode files and `ability_item_usage_generic.lua` hold a file-level `bot` and per-bot locals (for example `bots/ability_item_usage_generic.lua:5`), and each mode file's `GetDesire`/`Think` are called for one bot.
- **`require`d modules are shared by all bots on a team.** The code depends on it:
  - `Utils.GameStates.defendPings` is written in `bots/FunLib/aba_defend.lua:857` and read in `bots/FunLib/aba_push.lua:193` to stop several bots pinging at once.
  - `Utils.SetCachedVars` / `GetCachedVars` (`bots/FunLib/utils.lua:1058-1073`) is one table; callers add the player ID to the key when the value is per bot (`J.WeAreStronger`, `bots/FunLib/jmz_func.lua:4647`), which would be pointless if each bot had its own copy.
  - `botIdleStateTracker` in `J.CheckBotIdleState` (`:6510`) is keyed by player ID.
  - `aba_global_overrides` patches the `CDOTA_Bot_Script` class once and every bot sees it.
- **The two teams do not share modules.** `jmz_func.lua:4` stores `GetTeamPlayers(GetTeam())` in a module-level local at load time, which would be wrong for one team if both shared the module.
- **Unit handles are shared tables within a team.** Bots read fields that other bots wrote on a handle: `member.tormentor_state`, `member.tormentor_kill_time` (`bots/mode_side_shop_generic.lua:114-155`), `ally.to_farm_lane` (`bots/FunLib/MinionLib/illusions.lua:233`).

Needs in-game check: a counter in a required module, incremented and printed by two bots on each team, settles all three points in one lobby.

### 3.2 Channels

| Channel | What it carries | Limit | Used here |
|---|---|---|---|
| Shared module state (tables in `require`d modules) | Anything | Same team only (see above). No ordering guarantee between bots within a frame. | `Utils.GameStates` (`bots/FunLib/utils.lua:871`), `Utils.SetCachedVars`, `global_cache` (`bots/FunLib/global_cache.lua`, TTL 0.5 s, only `aba_push` uses it). |
| Fields on unit handles | Per-bot facts readable by teammates through `GetTeamMember(i)` | Same team only. Also works for facts about enemies (`is_suspicious_illusion`). | Many, ad hoc; no registry of field names. |
| `bot:SetTarget(h)` / `ally:GetTarget()` | One unit handle per bot | Engine-supported; meant for exactly this. | `J.IsAllysTarget` (`:2936`), `J.GetHeroCountAttackingTarget` (`:6307`), attack override sets it at `bots/FunLib/override_generic/mode_attack_generic.lua:347`. |
| `ally:GetActiveMode()`, `GetNearbyHeroes(r, false, BOT_MODE_X)` | What each allied bot is doing | Bots only; a human teammate has no mode. | `J.IsInTeamFight` (`:1452`: two or more allies within range in attack mode), `J.GetSpecialModeAllies` (`:3189`), `J.IsGoingOnSomeone` (`:1539`), `J.GetTeamFightLocation` (`:3220`). |
| `team_desires.lua`: `TeamThink()`, `UpdatePushLaneDesires()`, `UpdateDefendLaneDesires()`, `UpdateFarmLaneDesires()`, `UpdateRoamDesire()` (returns desire and a target unit), `UpdateRoshanDesire()` | Team-wide desires that each bot reads with `GetPushLaneDesire(lane)`, `GetDefendLaneDesire`, `GetFarmLaneDesire`, `GetRoamDesire`, `GetRoamTarget`, `GetRoshanDesire` | "Desires only; they never command a bot directly" [VDC]. Fixed vocabulary: three lanes, one roam target, Roshan. [REF] says `TeamThink` runs once per frame before the bots. | **The file does not exist in this repo**, so the getters return Valve's defaults. `J.GetMostPushLaneDesire` (`:3405`), `J.GetMostDefendLaneDesire` (`:3320`), `J.GetMostFarmLaneDesire` (`:3295`) read them. `GetRoamTarget` is never called. |
| Pings: `ActionImmediate_Ping(x, y, bNormal)` out, `unit:GetMostRecentPing()` in | A location, a time and normal-versus-danger | Only the most recent ping per player. Visible to human teammates, so it doubles as bot-to-human signalling. The time field is compared with `GameTime()` here (`bots/FunLib/utils.lua:1033`). | `J.SetBotPing` (`:2636`), `J.GetHumanPing` (`:5896`), `Utils.IsPingedByAnyPlayer` (`bots/FunLib/utils.lua:1017`), `J.IsPingCloseToValidTower` (`:3363`). |
| Chat: `ActionImmediate_Chat(msg, bAllChat)` out, `InstallChatCallback(fn)` in | Text | The callback table uses `string`, `player_id`, `team_only` in working code (`bots/hero_selection.lua:1044`, `bots/ability_item_usage_generic.lua:509-510`). Install once; callbacks persist. | `J.Chat` (`bots/FunLib/aba_chat.lua`), human commands in `ability_item_usage_generic.lua:404-408`. |
| HTTP: `CreateHTTPRequest` (localhost), `CreateRemoteHTTPRequest` | External process | Exists in the dump [MD]. Outside the map's fair-play intent for behaviour logic. | Not assessed. |

There is no engine channel between the two teams other than all-chat.

---

## 4. What this codebase already wraps or patches

### 4.1 Live global patches (`bots/FunLib/aba_global_overrides.lua`)

| Patched call | Line | What the patch does | What it implies about the raw API |
|---|---|---|---|
| `GetTeamPlayers` | 15-70 | Reorders Dire IDs when humans are on Dire; cached forever after first call. Pass `bypass = true` for the raw list. | Raw ID order is unreliable since 7.38 (comment in `bots/API/api_global.lua:13-14`). |
| `print` | 73-84 | Silent unless `Utils.DebugMode`. | |
| `GetUnitToUnitDistance` | 86-101 | Returns 1000 and logs a stack trace when either unit is nil or has no location. | Raw call errors on fogged or nil units. |
| `WasRecentlyDamagedByAnyHero` | 103-111 | nil on non-heroes. | |
| `GetNearbyTowers`, `GetNearbyHeroes`, `GetNearbyNeutralCreeps`, `GetNearbyLaneCreeps`, `GetNearbyCreeps` | 113-121, 226-234, 271-289 | Radius clamped with `math.min(r, 1600)`. `GetNearbyTowers` returns nil on non-heroes; `GetNearbyHeroes` returns nil on fogged units. | Radius above the cap misbehaves. **Callers must handle a nil return**, not just an empty table. |
| `IsIllusion` | 123-138 | nil on non-heroes or fogged units. | |
| `HasModifier` | 140-152 | false in fog. | |
| `GetLocation` | 154-162 | nil for fogged non-buildings. | Raw call returns stale or invalid data in fog. |
| `GetMagicResist`, `IsInvulnerable`, `IsAttackImmune`, `IsUsingAbility`, `IsChanneling`, `GetAttackTarget`, `GetAttackRange` | 163-224, 340-348 | Defaults in fog (1, false, false, false, false, nil, 200). `IsInvulnerable` also ignores Dazzle's projection debuff. | |
| `IsMagicImmune` | 236-263 | false in fog; true for a hand-kept list of modifiers. | Raw call misses several immunity sources. |
| `RandomFloat` | 265-269 | Reimplemented on `math.random`. | |
| `GetUnitName` | 291-298 | Normalises Lone Druid's bear. | |
| `Action_UseAbility`, `ActionPush_UseAbility` | 300-318 | Refuses nil or hidden abilities. | |
| `GetTarget` | 330-338 | nil for non-bots. | |
| `ActionImmediate_SwapItems` | 378-395 | Rate limit (11 s, no enemy within 1000). | |
| `GetUnitToLocationDistance` (as a method) | 397-406 | Returns 200 on nil location. | |
| `GetHealth`, `GetMaxHealth` | 408-449 | 666 in fog; Medusa gets mana folded in. Raw values via `OriginalGetHealth()`, `OriginalGetMaxHealth()`. | **`GetHealth()` is not raw health.** A fogged unit looks like it has 666 HP. |
| `GetMana`, `GetMaxMana` | 451-466 | 0 for Huskar. | |

Commented-out patches for `Action_AttackUnit` (320-328) and `Action_AttackMove` (350-365) show where earlier attempts to fix the "buggy heroes" were made at the action level.

### 4.2 Not live: `bots/API/*.lua`

Untracked and not required by anything. If it were loaded it would also change `GetCastRange` (adds cast-range bonuses, `bots/API/api_ability.lua:8`), `GetActiveMode` (returns `BOT_MODE_NONE` at zero desire, `bots/API/api_unit.lua:192`), `GetActualIncomingDamage` and `GetEstimatedDamageToTarget` (remap pure to magical, `:328`, `:679`), `GetAssignedLane`, `GetAbilityPoints`, `ActionImmediate_SellItem`, `GetNeutralSpawners`, and define `BOT_MODE_WATCHER/WISDOM_SHRINE/LOTUS_POOL`. A comment at `bots/API/api_global.lua:389-399` says attack-mode desire was capped at 0.65 in 7.41 and later fixed by Valve. None of this is confirmed for the baseline. Whether this directory is meant to become part of the project is a question for the human.

### 4.3 Wrappers by purpose

All in `bots/FunLib/jmz_func.lua` (hand-written Lua, 345 `J.*` functions) unless marked `Utils` (`bots/FunLib/utils.lua`, generated from `typescript/bots/FunLib/utils.ts`) or `global_cache` (`bots/FunLib/global_cache.lua`, generated from `typescript/bots/FunLib/global_cache.ts`).

| Purpose | Functions |
|---|---|
| Validity guards | `J.IsValid` (`:2983`), `J.IsValidHero` (`:2996`), `J.IsValidBuilding` (`:3000`), `J.IsValidTarget` (`:2991`), `J.CanBeAttacked` (`:3670`); `Utils.IsValidUnit` (`:537`), `Utils.IsValidHero` (`:547`) |
| Unit lists | `J.GetNearbyHeroes` (`:2516`), `J.GetAllyList` (`:3733`), `J.GetEnemyList` (`:3811`), `J.GetAlliesNearLoc` (`:474`), `J.GetEnemiesNearLoc` (`:497`), `J.GetAroundCreepList` (`:3773`), `J.GetEnemiesAroundLoc` (`:5765`); `global_cache.getCachedAlliesNearLoc` (`:315`), `getCachedEnemiesNearLoc` (`:327`) |
| Fog and last-seen | `J.GetLastSeenEnemiesNearLoc` (`:4178`); `Utils.GetLastSeenEnemyIdsNearLocation` (`:630`), `Utils.CountMissingEnemyHeroes` (`:1728`), `Utils.GetEnemyIdsInTpToLocation` (`:654`) |
| Projectiles | `J.IsProjectileIncoming` family (`:1919-2011`) |
| Attack timing and last hits | `J.GetAttackProDelayTime` (`:2034`), `J.GetCreepAttackActivityWillRealDamage` (`:2101`), `J.GetCreepAttackProjectileWillRealDamage` (`:2162`), `J.GetTotalAttackWillRealDamage` (`:2187`), `J.IsAttacking` (`:3039`), `J.IsRunning` (`:3030`), `J.IsMoving` (`:3015`), `J.IsChasingTarget` (`:3058`) |
| Who targets whom | `J.GetHeroesTargetingUnit` (`:1208`), `J.GetHeroCountAttackingTarget` (`:6307`), `J.IsUnitTargetedByTower` (`:6621`), `J.IsEnemyTargetUnit` (`:4051`) |
| Target choice | `J.GetProperTarget` (`:335`), `J.ScoreEnemyTarget` (`:3547`), `J.GetBestTeamTarget` (`:3632`), `J.GetAttackableWeakestUnit` (`:3470`), `J.GetVulnerableWeakestUnit` (`:253`) |
| Kill math | `J.CanKillTarget` (`:1066`), `J.WillKillTarget` (`:1077`), `J.WillMagicKillTarget` (`:1110`), `J.GetTotalEstimatedDamageToTarget` (`:6121`), `J.GetEffectiveHP` (`:3703`) |
| Team strength and fights | `J.WeAreStronger` (`:4646`, cached 0.5 s), `J.IsInTeamFight` (`:1452`), `J.GetTeamFightLocation` (`:3220`), `J.GetTeamFightAlliesCount` (`:3249`) |
| Mode readers | `J.IsRetreating` (`:1493`), `J.IsGoingOnSomeone` (`:1539`), `J.IsDefending` (`:1603`), `J.IsPushing` (`:1631`), `J.IsLaning` (`:1656`), `J.IsFarming` (`:1672`) |
| Lane | `J.GetDistanceFromLaneFront` (`:2237`), `J.GetNearestLaneFrontLocation` (`:3443`), `J.GetClosestTeamLane` (`:1309`), `J.GetEnemyCountInLane` (`:6163`), `J.GetAllyCountInLane` (`:6189`), `J.IsInLaningPhase` (`:5541`) |
| Illusions and invisibility | `J.IsSuspiciousIllusion` (`:771`), `J.IsRealInvisible` (`:3073`); `Utils.IsTruelyInvisible` (`:1548`) |
| Action state | `J.CanNotUseAction` (`:97`), `J.CanNotUseAbility` (`:113`), `J.HasQueuedAction` (`:83`), `J.IsStuck` (`:2280`), `J.CheckBotIdleState` (`:6510`) |
| Pings and chat | `J.SetBotPing` (`:2636`), `J.GetHumanPing` (`:5896`); `Utils.IsPingedByAnyPlayer` (`:1017`) |
| Safe movement | `Utils.MoveBotSafely` (`:2222`), `Utils.GetSafeDestination` (`:2183`), `Utils.IsLocationInDangerZone` (`:2148`), `Utils.SmartSpreadOut` (`:1867`) |
| Caching | `Utils.SetCachedVars` / `GetCachedVars` (`:1058`, `:1065`; `CleanupCachedVars` at `:1074` is a no-op, so the table only grows), `global_cache.getGlobalGameState` (`:198`), `getGlobalUnitState` (`:233`), `getCachedData` (`:279`) |

### 4.4 Broken, costly or misleading calls

- **`GetNearby*` above 1600**: must be avoided; the patch clamps. Larger searches need `GetUnitList` plus a distance filter.
- **Nil returns from patched getters**: `GetNearbyHeroes`, `GetNearbyTowers`, `GetLocation`, `IsIllusion`, `WasRecentlyDamagedByAnyHero` can return nil. `#nil` and `nil.x` are runtime errors that silently kill a `Think()` for that frame.
- **`GetHealth()` returns 666 for fogged units** and inflated values for Medusa.
- **`IsIllusion()` on enemies** is always false.
- **`GetCooldownTimeRemaining` / `IsCooldownReady` on enemies** do not work.
- **`GetOffensivePower()` on enemies** is not supported; use `GetRawOffensivePower()`.
- **`GetEstimatedDamageToTarget` for an enemy attacker** assumes everything is off cooldown.
- **`GetUnitList` loops**: 171 call sites and almost no caching. `J.WeAreStronger` alone iterates `UNIT_LIST_ALL` (cached 0.5 s per bot per radius). Any new per-frame logic that adds list walks multiplies by five bots.
- **`GetGroundHeight()`**: expensive by Valve's own note.
- **`GetTeamPlayers` order**: unreliable for Dire with humans; patched.
- **Throttling already in place**: item and ability think run at most every `bot.frameProcessTime` (0.1 s default, `bots/ability_item_usage_generic.lua:5`, `:8379-8390`), minions every 0.3 s. Mode `Think()` and `GetDesire()` have no shared throttle.
- **Nine heroes** in `Utils.BuggyHeroesDueToValveTooLazy` (`bots/FunLib/utils.lua:723`) do not act correctly under Valve's default attack and laning `Think()`, which is why the override modes exist.

---

## Disagreements between sources

| Topic | Source A | Source B | Which to believe |
|---|---|---|---|
| `GetHeroLastSeenInfo` shape | [REF]: one table with `location`, `time_since_seen` | [VDC] and [CODE]: a list of such tables; code reads `info[1]` | [VDC]/[CODE]. [MD] calls the second field `time`; working code uses `time_since_seen`. |
| `CanBeSeen()` meaning | [REF]: "Is this unit visible to the enemy team?" | [VDC], [MD]: can **our** team see it | [VDC]/[MD]. [REF] is wrong. |
| `GetNearby*` radius | [REF]: values above 1600 are "silently clamped" | [VDC]: "must be less than 1600"; the project clamps to exactly 1600 itself | Treat 1600 as the ceiling. Whether exactly 1600 is legal needs in-game check. |
| How often `GetDesire()` runs | [REF]: every frame for all modes | [VDC]: about every 300 ms | [VDC]. Matters for hysteresis design. Needs in-game check. |
| `GetUnitList` cost | [REF]: "expensive ... scans all units" | [VDC]: built on demand, once per frame, "reasonably fast"; the Lua loop is the cost | [VDC]. |
| `GetLaneFrontAmount` zero point | [REF]: 0.0 = own ancient, 1.0 = enemy ancient | [REF] on `GetLocationAlongLane`: 0.0 = Radiant ancient. `J.GetClosestTeamLane` (`:1310`) feeds one into the other, so both must share a scale | Unresolved. Needs in-game check (print both for a Dire bot). |
| `GetMostRecentPing` fields | [REF]: `time`, `location`, `normal_ping`, `player_id` | [VDC]: `time`, `location`, `normal_ping` | Only the three [VDC] fields are safe. |
| Chat callback fields | [REF]: `playerid`, `teamonly` | [CODE]: `player_id`, `team_only` | [CODE]. |
| Projectile table field | [REF]: `playerid` | [VDC]: `player` | Unverified; code only uses `caster`, `ability`, `location`, `is_attack`, `is_dodgeable`. |
| `GetQueuedActionType(n)` index base | [REF]: 0-indexed | [CODE] loops 1..N (`bots/FunLib/utils.lua:1225`, `bots/FunLib/jmz_func.lua:6537`) | Unresolved. Needs in-game check. |
| `GetModifierSourceAbility` | Listed in [REF] | Absent from [MD] dump | Assume it does not exist. |
| `GetOffensivePower` scope | [REF]: no restriction mentioned | [VDC]: teammates only | [VDC]. |
| `InstallDamageCallback` signature | [REF]: `fn(victim, attacker, damage)` | Not documented in local [VDC]/[MD]; unused in code | Needs in-game check. |

## Needs in-game check (for a human-run lobby)

1. Lua environment sharing: module state shared within a team, separate between teams, entry files per bot (section 3.1).
2. `GetDesire()` call frequency, and whether `TeamThink()` in a new `team_desires.lua` is called at all in the current client.
3. `GetLaneFrontAmount` scale for a Dire bot, and whether the enemy front is reported while the enemy wave is in fog.
4. `GetAttackPoint()` unit (animation fraction or seconds), and whether a move order after the attack point cancels backswing without losing the hit.
5. `GetNearbyHeroes(1600, ...)` exactly at the cap.
6. `GetQueuedActionType` index base.
7. Payload of `InstallCastCallback` and `InstallDamageCallback`, and whether they fire for enemy casts in fog.
8. `GetItemInSlot` on enemies, visible and fogged, and whether `GetNeutralSpawners()` still returns a `location`.
9. `GetActualIncomingDamage(x, DAMAGE_TYPE_PURE)` returning 0.
10. `GetTowerAttackTarget` for an enemy tower in and out of vision.
11. The claimed 0.65 attack-desire cap (section 4.2) in the current client.

## Hard limits that shape behaviour design

1. **Fog is absolute for unit state.** Outside vision a bot has only last-seen position and time, the potential-value grid, scoreboard facts, visible teleports and the lane-front point. Any "is it safe" logic must be written against missing enemies, and the baseline treats an enemy as missing after 2.5 to 5 s.
2. **Perception radius is 1600 per query.** Anything wider is a `GetUnitList` walk, whose cost is the Lua loop, times five bots, every frame unless cached.
3. **Enemy cooldowns and enemy illusions are invisible.** Both must be inferred from observed casts and behaviour. The engine's own enemy damage estimate assumes everything is ready, so it overstates threat.
4. **There is no aggro signal and the lane front is one point.** Creep equilibrium, wave size, tower aggro and creep-aggro pulls all have to be modelled from `GetAttackTarget()`, nearby creep lists and damage history.
5. **Orders are coarse.** Move, attack unit, attack-move, cast, clear. No stop, hold, orb-walk or backswing cancel. Fine control means issuing a new order on the right frame using animation getters, at `Think()` granularity, and it is unproven in this codebase.
6. **One writer at a time.** Only the active mode's `Think()` moves the hero, while ability and item think also push actions every frame. `Action_*` wipes the queue, so new mode logic must keep the `J.CanNotUseAction` contract or it will cancel casts.
7. **Difficulty adds reaction delay and last-hit jitter below Hard**, on top of anything the script does. Human-feel tuning and bot-versus-bot measurement should fix the difficulty level first.
8. **Team coordination has no command channel.** The engine offers team desires (three lanes, one roam target, Roshan), `SetTarget`, pings and chat. Everything richer rides on shared module tables and handle fields, which the code already relies on but which rests on an unconfirmed assumption about shared Lua state.
9. **Patched getters lie politely.** `GetHealth()` can be 666, `GetLocation()` can be nil, `GetNearbyHeroes()` can be nil. New code must go through the `J.IsValid*` guards or check `CanBeSeen()` first.
10. **Valve's default `Think()` is a black box for most heroes.** Outside the nine override heroes, attack and laning movement are not script-controlled today, so none of the timing primitives above are in use for them until a mode's `Think()` is taken over.
