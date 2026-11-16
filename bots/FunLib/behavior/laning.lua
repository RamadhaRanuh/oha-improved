--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local function __TS__NumberToFixed(self, fractionDigits)
    if math.abs(self) >= 1e+21 or self ~= self then
        return tostring(self)
    end
    local f = math.floor(fractionDigits or 0)
    if f < 0 or f > 99 then
        error("toFixed() digits argument must be between 0 and 99", 0)
    end
    return string.format(
        ("%." .. tostring(f)) .. "f",
        self
    )
end

local function __TS__ArrayFilter(self, callbackfn, thisArg)
    local result = {}
    local len = 0
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            len = len + 1
            result[len] = self[i]
        end
    end
    return result
end

local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
end

local function __TS__ArraySort(self, compareFn)
    if compareFn ~= nil then
        table.sort(
            self,
            function(a, b) return compareFn(nil, a, b) < 0 end
        )
    else
        table.sort(self)
    end
    return self
end

local function __TS__StringStartsWith(self, searchString, position)
    if position == nil or position < 0 then
        position = 0
    end
    return string.sub(self, position + 1, #searchString + position) == searchString
end
-- End of Lua Library inline imports
local ____exports = {}
local StateOf, CountStep, Tier, states
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local DamageType = ____dota.DamageType
local Lane = ____dota.Lane
local Team = ____dota.Team
local Tower = ____dota.Tower
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local ____desire_tiers = require(GetScriptDirectory().."/FunLib/behavior/desire_tiers")
local DesireTier = ____desire_tiers.DesireTier
local Pull = require(GetScriptDirectory().."/FunLib/behavior/pull")
function StateOf(bot)
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local state = states[key]
    if state == nil then
        state = {
            lastMoveLoc = nil,
            lastMoveTime = -999,
            burst = "none",
            burstTarget = nil,
            burstLoc = nil,
            burstUntil = -999,
            tradeLandsAt = -999,
            nextTradeAt = -999,
            burstDesire = 0,
            lastFightLog = -999,
            steps = {},
            statsSince = -999
        }
        states[key] = state
    end
    return state
end
function CountStep(bot, state, step)
    if not Utils.DebugMode then
        return
    end
    local now = DotaTime()
    if state.statsSince < 0 then
        state.statsSince = now
    end
    state.steps[step] = (state.steps[step] or 0) + 1
    if now - state.statsSince < 60 then
        return
    end
    local parts = {}
    for key in pairs(state.steps) do
        parts[#parts + 1] = (key .. "=") .. tostring(state.steps[key])
    end
    __TS__ArraySort(parts)
    print((((((((((("LANE team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " seconds=") .. tostring(math.floor(now - state.statsSince))) .. " lh=") .. tostring(bot:GetLastHits())) .. " dn=") .. tostring(bot:GetDenies())) .. " ") .. table.concat(parts, " "))
    state.steps = {}
    state.statsSince = now
end
function Tier(bot, tier, desire)
    CountStep(
        bot,
        StateOf(bot),
        __TS__StringStartsWith(tier, "burst.") and tier or "desire." .. tier
    )
    return desire
end
local TRADE_EXTRA_RANGE = 100
local TRADE_CREEPS_RANGED = 3
local TRADE_CREEPS_MELEE = 1
local TRADE_SWING_MARGIN = 0.3
local TRADE_MIN_HP = 0.5
local CREEP_AGGRO_RADIUS = 500
local TRADE_HP_MARGIN = 0.1
local TRADE_MAX_LEAD = 1.2
local TRADE_COOLDOWN = 2.5
local STEP_BACK = 300
local STEP_BACK_TIME = 0.5
local SUPPORT_YIELD_RADIUS = 800
local YIELD_CORE_REACH = 400
local YIELD_TIME = 0.6
local DISENGAGE_TIME = 1.5
local DISENGAGE_MARGIN = 0.05
local LIKELY_KILL_HP = 0.35
local LANEFIGHT_LOG_GAP = 3
local SAFE_BACK = 1200
local TOWER_RANGE = 750
local MOVE_REISSUE_DIST = 150
local MOVE_REISSUE_TIME = 0.4
local RANGED_HERO = 320
local STEPOUT_RECENT = 1.5
local STEPOUT_MARGIN = 120
local STEPOUT_MAX = 800
local STEPOUT_TIME = 1.2
local STEPOUT_RANGE_GAP = 50
local STEPOUT_MAX_HP = 0.8
local BURST_MIN_HP = 0.55
local LAST_HIT_SEARCH_MIN = 600
local OTHERS_DPS_SHARE = 0.8
states = {}
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
--- `from` moved `distance` toward `to` (2D).
local function Toward(from, to, distance)
    local d = Dist(from, to)
    if d < 1 then
        return from
    end
    return Vector(from.x + (to.x - from.x) / d * distance, from.y + (to.y - from.y) / d * distance, from.z)
end
--- Lane from position, as the override does (override_generic/mode_laning_generic.lua 40-55).
function ____exports.LaneOf(bot)
    local pos = jmz.GetPosition(bot)
    if pos == 2 then
        return Lane.Mid
    end
    local safe = pos == 1 or pos == 5
    if GetTeam() == Team.Radiant then
        return safe and Lane.Bot or Lane.Top
    end
    return safe and Lane.Top or Lane.Bot
end
local OUTER_TOWERS = {[Lane.Top] = {Tower.Top1, Tower.Top2, Tower.Top3}, [Lane.Mid] = {Tower.Mid1, Tower.Mid2, Tower.Mid3}, [Lane.Bot] = {Tower.Bot1, Tower.Bot2, Tower.Bot3}}
local function OutermostOwnTower(lane)
    for ____, id in ipairs(OUTER_TOWERS[lane] or ({})) do
        local tower = GetTower(
            GetTeam(),
            id
        )
        if tower ~= nil and tower ~= nil and jmz.IsValidBuilding(tower) then
            return tower
        end
    end
    return nil
end
local function LaneGeometryOf(lane)
    local team = GetTeam()
    local ownFront = GetLaneFrontLocation(team, lane, 0)
    local front = ownFront
    if GetLaneFrontAmount(
        GetOpposingTeam(),
        lane,
        false
    ) < GetLaneFrontAmount(team, lane, false) then
        front = GetLaneFrontLocation(
            GetOpposingTeam(),
            lane,
            0
        )
    end
    local behind = GetLaneFrontLocation(team, lane, -500)
    local d = Dist(ownFront, behind)
    local back = d >= 1 and Vector((behind.x - ownFront.x) / d, (behind.y - ownFront.y) / d, 0) or Vector(0, 0, 0)
    if d < 1 then
        local fountain = jmz.GetTeamFountain()
        d = Dist(front, fountain)
        back = d >= 1 and Vector((fountain.x - front.x) / d, (fountain.y - front.y) / d, 0) or back
    end
    return {front = front, back = back}
end
--- Where to retreat to: 1200 behind the front, never in front of our outermost tower in the lane.
function ____exports.SafePoint(bot)
    local lane = ____exports.LaneOf(bot)
    local geo = LaneGeometryOf(lane)
    local point = Vector(geo.front.x + geo.back.x * SAFE_BACK, geo.front.y + geo.back.y * SAFE_BACK, geo.front.z)
    local tower = OutermostOwnTower(lane)
    if tower ~= nil then
        local fountain = jmz.GetTeamFountain()
        local towerLoc = tower:GetLocation()
        if Dist(point, fountain) > Dist(towerLoc, fountain) then
            return towerLoc
        end
    end
    return point
end
--- Where to step out to: from where the bot stands, back along the lane until outside the
-- harasser's attack range plus a margin (at most STEPOUT_MAX). Playtest 3: a melee Brood took
-- Viper's harass for a minute without moving.
function ____exports.StepOutPoint(bot, enemy)
    local geo = LaneGeometryOf(____exports.LaneOf(bot))
    local need = enemy:GetAttackRange() + STEPOUT_MARGIN
    local enemyLoc = enemy:GetLocation()
    local point = bot:GetLocation()
    do
        local extra = 0
        while extra < STEPOUT_MAX and Dist(point, enemyLoc) < need do
            point = Vector(point.x + geo.back.x * 50, point.y + geo.back.y * 50, point.z)
            extra = extra + 50
        end
    end
    return point
end
local function IsRangedHero(unit)
    return unit:GetAttackRange() > RANGED_HERO
end
local function AttackDamage(bot)
    local damage = bot:GetAttackDamage()
    if jmz.FindItemSlotNotInNonbackpack(bot, "item_quelling_blade") >= 0 then
        damage = damage + ((bot:GetAttackRange() > 310 or bot:GetUnitName() == "npc_dota_hero_templar_assassin") and 4 or 8)
    end
    return damage
end
--- Units near the bot that could be hitting a creep it wants to last hit. Built once per LastHitDue call.
local function NearbyAttackers(bot)
    return {
        bot:GetNearbyLaneCreeps(1200, true),
        bot:GetNearbyLaneCreeps(1200, false),
        bot:GetNearbyHeroes(1200, true, BotMode.None),
        bot:GetNearbyHeroes(1200, false, BotMode.None),
        bot:GetNearbyTowers(1200, true),
        bot:GetNearbyTowers(1200, false)
    }
end
local function OthersDamage(bot, creep, seconds, groups)
    local counted = jmz.GetTotalAttackWillRealDamage(creep, seconds)
    local dps = 0
    for ____, group in ipairs(groups) do
        for ____, unit in ipairs(group) do
            do
                local __continue28
                repeat
                    if unit == bot or not jmz.IsValid(unit) or unit:GetAttackTarget() ~= creep then
                        __continue28 = true
                        break
                    end
                    dps = dps + creep:GetActualIncomingDamage(
                        unit:GetAttackDamage(),
                        DamageType.Physical
                    ) / math.max(
                        unit:GetSecondsPerAttack(),
                        0.1
                    )
                    __continue28 = true
                until true
                if not __continue28 then
                    break
                end
            end
        end
    end
    return math.max(counted, dps * seconds * OTHERS_DPS_SHARE)
end
--- Whether one attack from the bot, landing in `seconds`, gets the kill: the others leave it alive, and our hit finishes it.
local function WillKill(bot, creep, damage, seconds, groups)
    local health = creep:GetHealth() + creep:GetHealthRegen() * seconds + 0.8
    local others = OthersDamage(bot, creep, seconds, groups)
    return others < health - 1 and others + creep:GetActualIncomingDamage(damage, DamageType.Physical) > health
end
--- Whether some enemy lane creep near the bot can be last hit by an attack landing within its delay + `extra`.
local function LastHitDue(bot, damage, extra)
    local radius = math.min(
        math.max(
            bot:GetAttackRange() + 300,
            LAST_HIT_SEARCH_MIN
        ),
        1599
    )
    local groups = nil
    for ____, creep in ipairs(bot:GetNearbyLaneCreeps(radius, true)) do
        do
            local __continue34
            repeat
                if not jmz.IsValid(creep) or not jmz.CanBeAttacked(creep) then
                    __continue34 = true
                    break
                end
                if groups == nil then
                    groups = NearbyAttackers(bot)
                end
                if WillKill(
                    bot,
                    creep,
                    damage,
                    jmz.GetAttackProDelayTime(bot, creep) + extra,
                    groups
                ) then
                    return true
                end
                __continue34 = true
            until true
            if not __continue34 then
                break
            end
        end
    end
    return false
end
local function CorePartnerBusy(bot)
    for ____, ally in ipairs(bot:GetNearbyHeroes(SUPPORT_YIELD_RADIUS, false, BotMode.None)) do
        do
            local __continue40
            repeat
                if ally == bot or not jmz.IsValidHero(ally) or not jmz.IsCore(ally) then
                    __continue40 = true
                    break
                end
                local target = ally:GetAttackTarget()
                if target ~= nil and target ~= nil and target:IsCreep() then
                    return true
                end
                __continue40 = true
            until true
            if not __continue40 then
                break
            end
        end
    end
    return false
end
--- The core a support should leave its current target to: the support is attacking an enemy lane
-- creep, and an allied core is close enough to that creep to last hit it. Valve's laning Think
-- last hits for every role; quick test 9089523363 had CM at 19 last hits against Juggernaut's 37
-- at 8:00, and ES at 19 against Axe's 35.
local function YieldTo(bot)
    local target = bot:GetAttackTarget()
    if target == nil or target == nil or not jmz.IsValid(target) or not target:IsCreep() then
        return nil
    end
    if target:GetTeam() ~= GetOpposingTeam() then
        return nil
    end
    local targetLoc = target:GetLocation()
    for ____, ally in ipairs(bot:GetNearbyHeroes(SUPPORT_YIELD_RADIUS + YIELD_CORE_REACH, false, BotMode.None)) do
        do
            local __continue47
            repeat
                if ally == bot or not jmz.IsValidHero(ally) or jmz.IsSuspiciousIllusion(ally) or not jmz.IsCore(ally) then
                    __continue47 = true
                    break
                end
                if Dist(
                    ally:GetLocation(),
                    targetLoc
                ) <= ally:GetAttackRange() + YIELD_CORE_REACH then
                    return ally
                end
                __continue47 = true
            until true
            if not __continue47 then
                break
            end
        end
    end
    return nil
end
--- The enemy hero a bot in attack mode is fighting, if any.
local function FightTarget(bot)
    local attacking = bot:GetAttackTarget()
    if attacking ~= nil and attacking ~= nil and jmz.IsValidHero(attacking) then
        return attacking
    end
    local target = bot:GetTarget()
    if target ~= nil and target ~= nil and jmz.IsValidHero(target) then
        return target
    end
    return nil
end
--- Why a lane fight is worth it, or null if it is not: the enemy is low, or an allied hero is on it
-- with us, we are not outnumbered nearby and our health is at least theirs.
local function LikelyKill(bot, target)
    local targetHp = jmz.GetHP(target)
    if targetHp < LIKELY_KILL_HP then
        return "low"
    end
    local allies = 1
    local helper = false
    local targetLoc = target:GetLocation()
    for ____, ally in ipairs(bot:GetNearbyHeroes(1200, false, BotMode.None)) do
        do
            local __continue56
            repeat
                if ally == bot or not jmz.IsValidHero(ally) or jmz.IsSuspiciousIllusion(ally) then
                    __continue56 = true
                    break
                end
                allies = allies + 1
                if Dist(
                    ally:GetLocation(),
                    targetLoc
                ) < 900 then
                    helper = true
                end
                __continue56 = true
            until true
            if not __continue56 then
                break
            end
        end
    end
    local enemies = 0
    for ____, enemy in ipairs(bot:GetNearbyHeroes(1200, true, BotMode.None)) do
        if jmz.IsValidHero(enemy) and not jmz.IsSuspiciousIllusion(enemy) then
            enemies = enemies + 1
        end
    end
    if helper and enemies <= allies and jmz.GetHP(bot) >= targetHp then
        return "with_ally"
    end
    return nil
end
--- Debug (Utils.DebugMode), at most every LANEFIGHT_LOG_GAP s per bot, while a core is in Valve's attack
-- mode in the laning phase:
--   LANEFIGHT team=2 hero=npc_dota_hero_juggernaut t=152 desire=0.93 hp=0.71 target=npc_dota_hero_centaur thp=0.88 e=2 a=2 verdict=disengage
local function LogLaneFight(bot, state, desire, target, verdict)
    if not Utils.DebugMode then
        return
    end
    local now = DotaTime()
    if now - state.lastFightLog < LANEFIGHT_LOG_GAP then
        return
    end
    state.lastFightLog = now
    local e = #bot:GetNearbyHeroes(1200, true, BotMode.None)
    local a = #bot:GetNearbyHeroes(1200, false, BotMode.None)
    local name = target ~= nil and target:GetUnitName() or "none"
    local thp = target ~= nil and __TS__NumberToFixed(
        jmz.GetHP(target),
        2
    ) or "-"
    print((((((((((((((((((("LANEFIGHT team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(now))) .. " desire=") .. __TS__NumberToFixed(desire, 2)) .. " hp=") .. __TS__NumberToFixed(
        jmz.GetHP(bot),
        2
    )) .. " target=") .. name) .. " thp=") .. thp) .. " e=") .. tostring(e)) .. " a=") .. tostring(a)) .. " verdict=") .. verdict)
end
--- Back to our creeps: a little behind our lane front.
local function BackToCreeps(bot)
    return GetLaneFrontLocation(
        GetTeam(),
        ____exports.LaneOf(bot),
        -200
    )
end
--- Who to harass, if anyone (rules from S1 playtest 2):
-- - creep aggro: a ranged hero accepts up to 3 enemy creeps near it (it steps back after the hit);
--   a melee hero at most 1;
-- - a last hit due before the trade swing would finish blocks the trade;
-- - a ranged hero may step up to 100 into range; a melee core trades only from where it stands;
-- - a support does not trade while an allied core near it is hitting creeps;
-- - never below 45% health or 10% below the enemy, and never at a target under its own tower.
local function TradeTarget(bot)
    local range = bot:GetAttackRange()
    local ranged = IsRangedHero(bot)
    local enemyCreepsNear = #__TS__ArrayFilter(
        bot:GetNearbyLaneCreeps(CREEP_AGGRO_RADIUS, true),
        function(____, c) return jmz.IsValid(c) end
    )
    if enemyCreepsNear > (ranged and TRADE_CREEPS_RANGED or TRADE_CREEPS_MELEE) then
        return nil
    end
    local botHp = jmz.GetHP(bot)
    if botHp < TRADE_MIN_HP then
        return nil
    end
    local isCore = jmz.IsCore(bot)
    if not isCore and CorePartnerBusy(bot) then
        return nil
    end
    local swing = bot:GetAttackPoint() / math.max(
        bot:GetAttackSpeed(),
        0.01
    ) + TRADE_SWING_MARGIN
    if LastHitDue(
        bot,
        AttackDamage(bot),
        swing
    ) then
        return nil
    end
    local botLoc = bot:GetLocation()
    local towers = __TS__ArrayFilter(
        bot:GetNearbyTowers(1599, true),
        function(____, t) return not t:IsNull() and t:IsAlive() end
    )
    for ____, enemy in ipairs(bot:GetNearbyHeroes(
        math.min(range + TRADE_EXTRA_RANGE, 1599),
        true,
        BotMode.None
    )) do
        do
            local __continue75
            repeat
                if not jmz.IsValidHero(enemy) or jmz.IsSuspiciousIllusion(enemy) or not jmz.CanBeAttacked(enemy) then
                    __continue75 = true
                    break
                end
                if botHp < jmz.GetHP(enemy) - TRADE_HP_MARGIN then
                    __continue75 = true
                    break
                end
                if isCore and not ranged and Dist(
                    botLoc,
                    enemy:GetLocation()
                ) > range then
                    __continue75 = true
                    break
                end
                local enemyLoc = enemy:GetLocation()
                if __TS__ArraySome(
                    towers,
                    function(____, t) return Dist(
                        t:GetLocation(),
                        enemyLoc
                    ) < TOWER_RANGE end
                ) then
                    __continue75 = true
                    break
                end
                return enemy
            until true
            if not __continue75 then
                break
            end
        end
    end
    return nil
end
--- An enemy hero that outranges us, hit us in the last STEPOUT_RECENT s and still has us in range.
local function Harasser(bot)
    local botRange = bot:GetAttackRange()
    local botLoc = bot:GetLocation()
    for ____, enemy in ipairs(bot:GetNearbyHeroes(1200, true, BotMode.None)) do
        do
            local __continue83
            repeat
                if not jmz.IsValidHero(enemy) or jmz.IsSuspiciousIllusion(enemy) then
                    __continue83 = true
                    break
                end
                local enemyRange = enemy:GetAttackRange()
                if enemyRange <= botRange + STEPOUT_RANGE_GAP then
                    __continue83 = true
                    break
                end
                if not bot:WasRecentlyDamagedByHero(enemy, STEPOUT_RECENT) then
                    __continue83 = true
                    break
                end
                if Dist(
                    botLoc,
                    enemy:GetLocation()
                ) >= enemyRange + STEPOUT_MARGIN then
                    __continue83 = true
                    break
                end
                return enemy
            until true
            if not __continue83 then
                break
            end
        end
    end
    return nil
end
--- Move order with the throttle from section 11.1.
local function MoveTo(bot, state, loc)
    local now = DotaTime()
    if state.lastMoveLoc ~= nil and Dist(state.lastMoveLoc, loc) <= MOVE_REISSUE_DIST and now - state.lastMoveTime < MOVE_REISSUE_TIME then
        return
    end
    bot:Action_MoveToLocation(loc)
    state.lastMoveLoc = loc
    state.lastMoveTime = now
end
--- Desire with the flag on, called after the shim's off-conditions. During the laning phase a flat
-- MODERATE: Valve's laning Think chooses its own last hits, so there is no last-hit spike to flicker.
-- After it: the shim's ladder tail, without its 0.9 last-hit return.
function ____exports.GetDesire(bot)
    local mode = GetGameMode()
    if mode == 11 or mode == 21 then
        return 1
    end
    if jmz.IsInLaningPhase() then
        return Tier(bot, "moderate", DesireTier.MODERATE)
    end
    local time = DotaTime()
    if mode == 23 then
        time = time * 1.65
    end
    local level = bot:GetLevel()
    if time <= 10 then
        return 0.268
    end
    if time <= 9 * 60 and level <= 7 then
        return 0.446
    end
    if time <= 12 * 60 and level <= 11 then
        return 0.369
    end
    if level <= 14 and jmz.GetCoresAverageNetworth() < 7000 then
        return 0.2
    end
    Utils.GameStates.passiveLaningTime = true
    return 0.01
end
local function EndBurst(bot, state)
    state.burst = "none"
    state.burstTarget = nil
    state.burstLoc = nil
    bot.laningHoldUntil = nil
end
local function StartBurst(bot, state, burst, ____until, target, loc)
    state.burst = burst
    state.burstUntil = ____until
    state.burstTarget = target
    state.burstLoc = loc
    state.lastMoveLoc = nil
    bot.laningHoldUntil = ____until
end
--- Team roam's desire for a lane burst: HIGH while one runs or one should start, else 0.
-- A burst starts only from laning mode, in the laning phase.
function ____exports.BurstDesire(bot)
    local state = StateOf(bot)
    local now = DotaTime()
    if not jmz.IsInLaningPhase() or not bot:IsAlive() then
        if state.burst ~= "none" then
            EndBurst(bot, state)
        end
        Pull.Desire(bot)
        return 0
    end
    local pull = Pull.Desire(bot)
    if pull > 0 then
        if state.burst ~= "none" then
            EndBurst(bot, state)
        end
        bot.laningHoldUntil = now + 0.5
        return Tier(bot, "burst.pull", pull)
    end
    local active = bot:GetActiveMode()
    if jmz.GetHP(bot) < BURST_MIN_HP or active == BotMode.Retreat or active == BotMode.EvasiveManeuvers then
        if state.burst ~= "none" then
            EndBurst(bot, state)
        end
        return 0
    end
    if state.burst ~= "none" and now >= state.burstUntil then
        EndBurst(bot, state)
    end
    if state.burst ~= "none" then
        if state.burst == "trade" then
            local target = state.burstTarget
            local lost = target == nil or not jmz.IsValidHero(target) or not jmz.CanBeAttacked(target) or Dist(
                bot:GetLocation(),
                target:GetLocation()
            ) > bot:GetAttackRange() + 300
            if lost or now >= state.tradeLandsAt then
                StartBurst(
                    bot,
                    state,
                    "stepback",
                    now + STEP_BACK_TIME,
                    nil,
                    Toward(
                        bot:GetLocation(),
                        ____exports.SafePoint(bot),
                        STEP_BACK
                    )
                )
                state.nextTradeAt = state.burstUntil + TRADE_COOLDOWN
            end
        end
        return Tier(bot, "burst." .. state.burst, state.burst == "disengage" and state.burstDesire or DesireTier.HIGH)
    end
    if bot:GetActiveMode() == BotMode.Attack and jmz.IsCore(bot) then
        local attackDesire = bot:GetActiveModeDesire()
        local fightTarget = FightTarget(bot)
        local ____temp_0
        if fightTarget ~= nil then
            ____temp_0 = LikelyKill(bot, fightTarget)
        else
            ____temp_0 = "no_target"
        end
        local why = ____temp_0
        if fightTarget ~= nil and why == nil then
            LogLaneFight(
                bot,
                state,
                attackDesire,
                fightTarget,
                "disengage"
            )
            StartBurst(
                bot,
                state,
                "disengage",
                now + DISENGAGE_TIME,
                nil,
                BackToCreeps(bot)
            )
            state.burstDesire = math.min(attackDesire + DISENGAGE_MARGIN, 1)
            return Tier(bot, "burst.disengage", state.burstDesire)
        end
        LogLaneFight(
            bot,
            state,
            attackDesire,
            fightTarget,
            "fight:" .. tostring(why)
        )
        return 0
    end
    if bot:GetActiveMode() ~= BotMode.Laning then
        return 0
    end
    if jmz.CanNotUseAction(bot) or bot:IsUsingAbility() or bot:IsChanneling() then
        return 0
    end
    local ____temp_1
    if jmz.GetHP(bot) < STEPOUT_MAX_HP then
        ____temp_1 = Harasser(bot)
    else
        ____temp_1 = nil
    end
    local harasser = ____temp_1
    local ____temp_2
    if harasser ~= nil then
        ____temp_2 = TradeTarget(bot)
    else
        ____temp_2 = nil
    end
    local harasserTrade = ____temp_2
    if harasser ~= nil and harasserTrade == nil then
        StartBurst(
            bot,
            state,
            "stepout",
            now + STEPOUT_TIME,
            harasser,
            ____exports.StepOutPoint(bot, harasser)
        )
        return Tier(bot, "burst.stepout", DesireTier.HIGH)
    end
    if not jmz.IsCore(bot) and YieldTo(bot) ~= nil then
        StartBurst(
            bot,
            state,
            "yield",
            now + YIELD_TIME,
            nil,
            Toward(
                bot:GetLocation(),
                ____exports.SafePoint(bot),
                50
            )
        )
        return Tier(bot, "burst.yield", DesireTier.HIGH)
    end
    if now < state.nextTradeAt or bot:IsDisarmed() then
        return 0
    end
    local ____temp_3
    if harasser ~= nil then
        ____temp_3 = harasserTrade
    else
        ____temp_3 = TradeTarget(bot)
    end
    local target = ____temp_3
    if target == nil then
        return 0
    end
    local dist = Dist(
        bot:GetLocation(),
        target:GetLocation()
    )
    local walk = math.max(
        0,
        dist - bot:GetAttackRange()
    ) / math.max(
        bot:GetCurrentMovementSpeed(),
        1
    )
    local attackPoint = bot:GetAttackPoint() / math.max(
        bot:GetAttackSpeed(),
        0.01
    )
    local travel = IsRangedHero(bot) and dist / 900 or 0
    local lead = walk + attackPoint + travel + 0.1
    if lead > TRADE_MAX_LEAD then
        return 0
    end
    StartBurst(
        bot,
        state,
        "trade",
        now + lead + STEP_BACK_TIME,
        target,
        nil
    )
    state.tradeLandsAt = now + lead
    return Tier(bot, "burst.trade", DesireTier.HIGH)
end
--- Team roam's Think while a lane burst runs.
function ____exports.BurstThink(bot)
    local state = StateOf(bot)
    if jmz.CanNotUseAction(bot) then
        return
    end
    if Pull.Active(bot) then
        Pull.Think(bot)
        CountStep(bot, state, "pull")
        return
    end
    if state.burst == "trade" and state.burstTarget ~= nil then
        if bot:GetAttackTarget() ~= state.burstTarget then
            bot:Action_AttackUnit(state.burstTarget, true)
        end
        state.lastMoveLoc = nil
        CountStep(bot, state, "trade")
        return
    end
    if state.burstLoc ~= nil then
        MoveTo(bot, state, state.burstLoc)
        CountStep(bot, state, state.burst)
    end
end
--- Whether a camp pull is running: team roam lets it finish before a lotus trip.
function ____exports.PullActive(bot)
    return Pull.Active(bot)
end
--- Whether a lane burst is running (team roam uses it to run BurstThink).
function ____exports.InBurst(bot)
    local state = StateOf(bot)
    return state.burst ~= "none" and DotaTime() < state.burstUntil
end
return ____exports
