--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local function __TS__StringIncludes(self, searchString, position)
    if not position then
        position = 1
    else
        position = position + 1
    end
    local index = string.find(self, searchString, position, true)
    return index ~= nil
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
-- End of Lua Library inline imports
local ____exports = {}
local StateOf, Dist, Toward, OutermostOwnTower, LaneGeometryOf, IsRangedHero, RoleOffset, HoldBack, AttackDamage, OthersDamage, WillKill, DueWithin, IsRangedCreep, LastHitCandidates, SupportShouldYield, BestLastHit, BestDeny, ConsiderTango, IncomingDamage, TowerTargetingBot, AggroDropCreep, CorePartnerBusy, TradeTarget, MoveTo, Stop, Attack, CountStep, Tier, Step, DANGER_WINDOW, DANGER_FRACTION, DANGER_RADIUS, DANGER_REACH, DUE_MOVE, DENY_BLOCK, TRADE_EXTRA_RANGE, TRADE_CREEPS_RANGED, TRADE_CREEPS_MELEE, TRADE_SWING_MARGIN, TRADE_MIN_HP, CREEP_AGGRO_RADIUS, TRADE_HP_MARGIN, STEP_BACK, STEP_BACK_TIME, SUPPORT_YIELD_RADIUS, ROLE_OFFSET_MELEE_CORE, ROLE_OFFSET_RANGED_CORE, ROLE_OFFSET_SUPPORT, PARTNER_CLOSE, PARTNER_SIDESTEP, SAFE_BACK, TOWER_RANGE, MOVE_REISSUE_DIST, MOVE_REISSUE_TIME, TANGO_MISSING_HP, TANGO_TREE_RANGE, RANGED_HERO, HOLD_MELEE_BACK, HOLD_RANGED_INSIDE, HARASSED_RECENT, HARASS_MARGIN, HARASS_MAX_EXTRA, LAST_HIT_SEARCH_MIN, OTHERS_DPS_SHARE, COMMIT_EXTRA, IDLE_EXEMPT, states, OUTER_TOWERS
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
function StateOf(bot)
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local state = states[key]
    if state == nil then
        state = {
            lastMoveLoc = nil,
            lastMoveTime = -999,
            tradeLandsAt = -999,
            stepBackUntil = -999,
            lastAggroDrop = -999,
            commitCreep = nil,
            commitUntil = -999,
            highUntil = -999,
            steps = {},
            statsSince = -999
        }
        states[key] = state
    end
    return state
end
function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
function Toward(from, to, distance)
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
function OutermostOwnTower(lane)
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
function LaneGeometryOf(lane)
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
function IsRangedHero(unit)
    return unit:GetAttackRange() > RANGED_HERO
end
function RoleOffset(bot)
    if not jmz.IsCore(bot) then
        return ROLE_OFFSET_SUPPORT
    end
    return IsRangedHero(bot) and ROLE_OFFSET_RANGED_CORE or ROLE_OFFSET_MELEE_CORE
end
function HoldBack(bot)
    local range = bot:GetAttackRange()
    local base = IsRangedHero(bot) and math.max(range - HOLD_RANGED_INSIDE, HOLD_MELEE_BACK) or HOLD_MELEE_BACK
    return base + RoleOffset(bot)
end
--- Where to stand: the front moved back by `HoldBack`.
function ____exports.HoldPoint(bot)
    local lane = ____exports.LaneOf(bot)
    local geo = LaneGeometryOf(lane)
    local back = HoldBack(bot)
    local point = Vector(geo.front.x + geo.back.x * back, geo.front.y + geo.back.y * back, geo.front.z)
    local botRange = bot:GetAttackRange()
    for ____, enemy in ipairs(bot:GetNearbyHeroes(1200, true, BotMode.None)) do
        do
            local __continue22
            repeat
                if not jmz.IsValidHero(enemy) or jmz.IsSuspiciousIllusion(enemy) then
                    __continue22 = true
                    break
                end
                local enemyRange = enemy:GetAttackRange()
                if enemyRange <= botRange or not bot:WasRecentlyDamagedByHero(enemy, HARASSED_RECENT) then
                    __continue22 = true
                    break
                end
                local need = enemyRange + HARASS_MARGIN
                local enemyLoc = enemy:GetLocation()
                do
                    local extra = 0
                    while extra < HARASS_MAX_EXTRA and Dist(point, enemyLoc) < need do
                        point = Vector(point.x + geo.back.x * 50, point.y + geo.back.y * 50, point.z)
                        extra = extra + 50
                    end
                end
                __continue22 = true
            until true
            if not __continue22 then
                break
            end
        end
    end
    for ____, ally in ipairs(bot:GetNearbyHeroes(PARTNER_CLOSE, false, BotMode.None)) do
        if ally ~= bot and jmz.IsValidHero(ally) and ally:GetPlayerID() ~= bot:GetPlayerID() then
            local side = bot:GetPlayerID() > ally:GetPlayerID() and 1 or -1
            point = Vector(point.x - geo.back.y * PARTNER_SIDESTEP * side, point.y + geo.back.x * PARTNER_SIDESTEP * side, point.z)
            break
        end
    end
    return point
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
function AttackDamage(bot)
    local damage = bot:GetAttackDamage()
    if jmz.FindItemSlotNotInNonbackpack(bot, "item_quelling_blade") >= 0 then
        damage = damage + ((bot:GetAttackRange() > 310 or bot:GetUnitName() == "npc_dota_hero_templar_assassin") and 4 or 8)
    end
    return damage
end
function OthersDamage(bot, creep, seconds)
    local counted = jmz.GetTotalAttackWillRealDamage(creep, seconds)
    local dps = 0
    local groups = {
        bot:GetNearbyLaneCreeps(1200, true),
        bot:GetNearbyLaneCreeps(1200, false),
        bot:GetNearbyHeroes(1200, true, BotMode.None),
        bot:GetNearbyHeroes(1200, false, BotMode.None),
        bot:GetNearbyTowers(1200, true),
        bot:GetNearbyTowers(1200, false)
    }
    for ____, group in ipairs(groups) do
        for ____, unit in ipairs(group) do
            do
                local __continue37
                repeat
                    if unit == bot or not jmz.IsValid(unit) or unit:GetAttackTarget() ~= creep then
                        __continue37 = true
                        break
                    end
                    dps = dps + creep:GetActualIncomingDamage(
                        unit:GetAttackDamage(),
                        DamageType.Physical
                    ) / math.max(
                        unit:GetSecondsPerAttack(),
                        0.1
                    )
                    __continue37 = true
                until true
                if not __continue37 then
                    break
                end
            end
        end
    end
    return math.max(counted, dps * seconds * OTHERS_DPS_SHARE)
end
function WillKill(bot, creep, damage, seconds)
    local health = creep:GetHealth() + creep:GetHealthRegen() * seconds + 0.8
    local others = OthersDamage(bot, creep, seconds)
    return others < health - 1 and others + creep:GetActualIncomingDamage(damage, DamageType.Physical) > health
end
function DueWithin(bot, creep, damage, extra)
    return WillKill(
        bot,
        creep,
        damage,
        jmz.GetAttackProDelayTime(bot, creep) + extra
    )
end
function IsRangedCreep(creep)
    return __TS__StringIncludes(
        creep:GetUnitName(),
        "ranged"
    )
end
function LastHitCandidates(bot)
    local radius = math.min(
        math.max(
            bot:GetAttackRange() + 300,
            LAST_HIT_SEARCH_MIN
        ),
        1599
    )
    return __TS__ArrayFilter(
        bot:GetNearbyLaneCreeps(radius, true),
        function(____, c) return jmz.IsValid(c) and jmz.CanBeAttacked(c) end
    )
end
function SupportShouldYield(bot, creep, delay)
    if jmz.GetPosition(bot) < 4 then
        return false
    end
    local creepLoc = creep:GetLocation()
    for ____, ally in ipairs(bot:GetNearbyHeroes(1200, false, BotMode.None)) do
        do
            local __continue48
            repeat
                if ally == bot or not jmz.IsValidHero(ally) or not jmz.IsCore(ally) then
                    __continue48 = true
                    break
                end
                local dist = Dist(
                    ally:GetLocation(),
                    creepLoc
                )
                if dist > SUPPORT_YIELD_RADIUS then
                    __continue48 = true
                    break
                end
                local walk = math.max(
                    0,
                    dist - ally:GetAttackRange()
                ) / math.max(
                    ally:GetCurrentMovementSpeed(),
                    1
                )
                if walk <= delay + 0.3 then
                    return true
                end
                __continue48 = true
            until true
            if not __continue48 then
                break
            end
        end
    end
    return false
end
function BestLastHit(bot, damage, soon)
    local best = nil
    local bestRanged = false
    local dueSoon = nil
    local dueSoonDist = 99999
    local botLoc = bot:GetLocation()
    for ____, creep in ipairs(LastHitCandidates(bot)) do
        do
            local __continue54
            repeat
                local delay = jmz.GetAttackProDelayTime(bot, creep)
                if SupportShouldYield(bot, creep, delay) then
                    __continue54 = true
                    break
                end
                if WillKill(bot, creep, damage, delay) then
                    local ranged = IsRangedCreep(creep)
                    if best == nil or ranged and not bestRanged then
                        best = creep
                        bestRanged = ranged
                    end
                elseif soon > 0 and WillKill(bot, creep, damage, delay + soon) then
                    local d = Dist(
                        botLoc,
                        creep:GetLocation()
                    )
                    if d < dueSoonDist then
                        dueSoon = creep
                        dueSoonDist = d
                    end
                end
                __continue54 = true
            until true
            if not __continue54 then
                break
            end
        end
    end
    if best ~= nil then
        return {creep = best, now = true}
    end
    if dueSoon ~= nil then
        return {creep = dueSoon, now = false}
    end
    return nil
end
function BestDeny(bot, damage)
    for ____, creep in ipairs(bot:GetNearbyLaneCreeps(
        math.min(
            bot:GetAttackRange() + 200,
            1599
        ),
        false
    )) do
        do
            local __continue64
            repeat
                if not jmz.IsValid(creep) or not jmz.CanBeAttacked(creep) or jmz.GetHP(creep) >= 0.5 then
                    __continue64 = true
                    break
                end
                if DueWithin(bot, creep, damage, 0) then
                    return creep
                end
                __continue64 = true
            until true
            if not __continue64 then
                break
            end
        end
    end
    return nil
end
function ConsiderTango(bot)
    if bot:HasModifier("modifier_tango_heal") then
        return nil
    end
    local slot = jmz.FindItemSlotNotInNonbackpack(bot, "item_tango")
    if slot < 0 then
        slot = jmz.FindItemSlotNotInNonbackpack(bot, "item_tango_single")
    end
    if slot < 0 then
        return nil
    end
    if bot:OriginalGetMaxHealth() - bot:OriginalGetHealth() < TANGO_MISSING_HP then
        return nil
    end
    if bot:WasRecentlyDamagedByAnyHero(2) then
        return nil
    end
    local trees = bot:GetNearbyTrees(TANGO_TREE_RANGE)
    if #trees == 0 then
        return nil
    end
    local tree = trees[1]
    local treeLoc = GetTreeLocation(tree)
    if not IsLocationVisible(treeLoc) or not IsLocationPassable(treeLoc) then
        return nil
    end
    local treeDist = Dist(
        bot:GetLocation(),
        treeLoc
    )
    for ____, enemy in ipairs(bot:GetNearbyHeroes(1000, true, BotMode.None)) do
        if jmz.IsValidHero(enemy) and Dist(
            enemy:GetLocation(),
            bot:GetLocation()
        ) < treeDist * 1.6 then
            return nil
        end
    end
    for ____, tower in ipairs(bot:GetNearbyTowers(1400, true)) do
        if jmz.IsValidBuilding(tower) and Dist(
            tower:GetLocation(),
            treeLoc
        ) <= 920 then
            return nil
        end
    end
    return {slot = slot, tree = tree}
end
function IncomingDamage(bot)
    local botLoc = bot:GetLocation()
    local damage = 0
    for ____, enemy in ipairs(bot:GetNearbyHeroes(DANGER_RADIUS, true, BotMode.None)) do
        do
            local __continue83
            repeat
                if not jmz.IsValidHero(enemy) or jmz.IsSuspiciousIllusion(enemy) then
                    __continue83 = true
                    break
                end
                local threatening = enemy:GetAttackTarget() == bot or bot:WasRecentlyDamagedByHero(enemy, 1) or enemy:IsFacingLocation(botLoc, 30) and Dist(
                    enemy:GetLocation(),
                    botLoc
                ) <= enemy:GetAttackRange() + DANGER_REACH
                if threatening then
                    damage = damage + enemy:GetEstimatedDamageToTarget(true, bot, DANGER_WINDOW, DamageType.All)
                end
                __continue83 = true
            until true
            if not __continue83 then
                break
            end
        end
    end
    for ____, tower in ipairs(bot:GetNearbyTowers(DANGER_RADIUS, true)) do
        if jmz.IsValidBuilding(tower) and tower:GetAttackTarget() == bot then
            damage = damage + tower:GetEstimatedDamageToTarget(true, bot, DANGER_WINDOW, DamageType.All)
        end
    end
    return damage
end
function TowerTargetingBot(bot)
    for ____, tower in ipairs(bot:GetNearbyTowers(DANGER_RADIUS, true)) do
        if jmz.IsValidBuilding(tower) and tower:GetAttackTarget() == bot then
            return tower
        end
    end
    return nil
end
function AggroDropCreep(bot, tower)
    local towerLoc = tower:GetLocation()
    for ____, creep in ipairs(bot:GetNearbyLaneCreeps(
        math.min(
            bot:GetAttackRange() + 50,
            1599
        ),
        false
    )) do
        if jmz.IsValid(creep) and jmz.CanBeAttacked(creep) and jmz.GetHP(creep) < 0.5 and Dist(
            creep:GetLocation(),
            towerLoc
        ) < TOWER_RANGE then
            return creep
        end
    end
    return nil
end
function CorePartnerBusy(bot)
    for ____, ally in ipairs(bot:GetNearbyHeroes(SUPPORT_YIELD_RADIUS, false, BotMode.None)) do
        do
            local __continue99
            repeat
                if ally == bot or not jmz.IsValidHero(ally) or not jmz.IsCore(ally) then
                    __continue99 = true
                    break
                end
                local target = ally:GetAttackTarget()
                if target ~= nil and target ~= nil and target:IsCreep() then
                    return true
                end
                __continue99 = true
            until true
            if not __continue99 then
                break
            end
        end
    end
    return false
end
function TradeTarget(bot, damage)
    local range = bot:GetAttackRange()
    local ranged = IsRangedHero(bot)
    local enemyCreepsNear = #__TS__ArrayFilter(
        bot:GetNearbyLaneCreeps(CREEP_AGGRO_RADIUS, true),
        function(____, c) return jmz.IsValid(c) end
    )
    if enemyCreepsNear > (ranged and TRADE_CREEPS_RANGED or TRADE_CREEPS_MELEE) then
        return nil
    end
    local swing = bot:GetAttackPoint() / math.max(
        bot:GetAttackSpeed(),
        0.01
    ) + TRADE_SWING_MARGIN
    if BestLastHit(bot, damage, swing) ~= nil then
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
    local botLoc = bot:GetLocation()
    local towers = __TS__ArrayFilter(
        bot:GetNearbyTowers(1599, true),
        function(____, t) return jmz.IsValidBuilding(t) end
    )
    for ____, enemy in ipairs(bot:GetNearbyHeroes(
        math.min(range + TRADE_EXTRA_RANGE, 1599),
        true,
        BotMode.None
    )) do
        do
            local __continue110
            repeat
                if not jmz.IsValidHero(enemy) or jmz.IsSuspiciousIllusion(enemy) or not jmz.CanBeAttacked(enemy) then
                    __continue110 = true
                    break
                end
                if botHp < jmz.GetHP(enemy) - TRADE_HP_MARGIN then
                    __continue110 = true
                    break
                end
                if isCore and not ranged and Dist(
                    botLoc,
                    enemy:GetLocation()
                ) > range then
                    __continue110 = true
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
                    __continue110 = true
                    break
                end
                return enemy
            until true
            if not __continue110 then
                break
            end
        end
    end
    return nil
end
function MoveTo(bot, state, loc)
    local now = DotaTime()
    if state.lastMoveLoc ~= nil and Dist(state.lastMoveLoc, loc) <= MOVE_REISSUE_DIST and now - state.lastMoveTime < MOVE_REISSUE_TIME then
        return
    end
    bot:Action_MoveToLocation(loc)
    state.lastMoveLoc = loc
    state.lastMoveTime = now
end
function Stop(bot, state)
    local loc = bot:GetLocation()
    if state.lastMoveLoc ~= nil and Dist(state.lastMoveLoc, loc) < 30 then
        return
    end
    bot:Action_MoveToLocation(loc)
    state.lastMoveLoc = loc
    state.lastMoveTime = DotaTime()
end
function Attack(bot, state, target)
    if not target:IsHero() then
        bot:SetTarget(target)
    end
    bot:Action_AttackUnit(target, true)
    state.lastMoveLoc = nil
end
function CountStep(bot, state, step)
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
    if Utils.DebugMode then
        CountStep(
            bot,
            StateOf(bot),
            "desire." .. tier
        )
    end
    return desire
end
function Step(bot, state)
    if not bot:IsAlive() or jmz.CanNotUseAction(bot) or bot:IsUsingAbility() or bot:IsChanneling() then
        return "busy"
    end
    local now = DotaTime()
    local canAttack = not bot:IsDisarmed()
    bot.laningHoldUntil = now + IDLE_EXEMPT
    local tango = ConsiderTango(bot)
    if tango ~= nil then
        local item = bot:GetItemInSlot(tango.slot)
        if item ~= nil and item ~= nil then
            bot:Action_UseAbilityOnTree(item, tango.tree)
            return "tango"
        end
    end
    if now >= state.tradeLandsAt and now < state.stepBackUntil then
        MoveTo(
            bot,
            state,
            Toward(
                bot:GetLocation(),
                ____exports.SafePoint(bot),
                STEP_BACK
            )
        )
        return "stepback"
    end
    if IncomingDamage(bot) > bot:GetHealth() * DANGER_FRACTION then
        MoveTo(
            bot,
            state,
            ____exports.SafePoint(bot)
        )
        return "danger"
    end
    local tower = TowerTargetingBot(bot)
    if tower ~= nil then
        local ____temp_0
        if canAttack and now - state.lastAggroDrop > 1 then
            ____temp_0 = AggroDropCreep(bot, tower)
        else
            ____temp_0 = nil
        end
        local creep = ____temp_0
        if creep ~= nil then
            state.lastAggroDrop = now
            Attack(bot, state, creep)
        else
            MoveTo(
                bot,
                state,
                ____exports.SafePoint(bot)
            )
        end
        return "aggro"
    end
    local damage = AttackDamage(bot)
    if canAttack then
        local committed = state.commitCreep
        if committed ~= nil and now < state.commitUntil and jmz.IsValid(committed) and committed:IsAlive() then
            Attack(bot, state, committed)
            return "commit"
        end
        state.commitCreep = nil
        local hit = BestLastHit(bot, damage, DUE_MOVE)
        if hit ~= nil then
            local inRange = Dist(
                bot:GetLocation(),
                hit.creep:GetLocation()
            ) <= bot:GetAttackRange()
            if hit.now then
                Attack(bot, state, hit.creep)
                state.commitCreep = hit.creep
                state.commitUntil = now + jmz.GetAttackProDelayTime(bot, hit.creep) + COMMIT_EXTRA
                return "lasthit"
            end
            if not inRange then
                MoveTo(
                    bot,
                    state,
                    Toward(
                        hit.creep:GetLocation(),
                        bot:GetLocation(),
                        bot:GetAttackRange() * 0.9
                    )
                )
                return "approach"
            end
            Stop(bot, state)
            return "wait"
        end
        if BestLastHit(bot, damage, DENY_BLOCK) == nil then
            local deny = BestDeny(bot, damage)
            if deny ~= nil then
                Attack(bot, state, deny)
                return "deny"
            end
        end
        local target = TradeTarget(bot, damage)
        if target ~= nil then
            Attack(bot, state, target)
            local attackPoint = bot:GetAttackPoint() / math.max(
                bot:GetAttackSpeed(),
                0.01
            )
            local travel = IsRangedHero(bot) and Dist(
                bot:GetLocation(),
                target:GetLocation()
            ) / 900 or 0
            state.tradeLandsAt = now + attackPoint + travel + 0.1
            state.stepBackUntil = state.tradeLandsAt + STEP_BACK_TIME
            return "trade"
        end
    end
    MoveTo(
        bot,
        state,
        ____exports.HoldPoint(bot)
    )
    return "hold"
end
DANGER_WINDOW = 2
DANGER_FRACTION = 0.35
DANGER_RADIUS = 1000
DANGER_REACH = 200
DUE_MOVE = 0.6
DENY_BLOCK = 1.2
TRADE_EXTRA_RANGE = 100
TRADE_CREEPS_RANGED = 3
TRADE_CREEPS_MELEE = 1
TRADE_SWING_MARGIN = 0.3
TRADE_MIN_HP = 0.45
CREEP_AGGRO_RADIUS = 500
TRADE_HP_MARGIN = 0.1
STEP_BACK = 300
STEP_BACK_TIME = 0.5
SUPPORT_YIELD_RADIUS = 800
ROLE_OFFSET_MELEE_CORE = 0
ROLE_OFFSET_RANGED_CORE = 100
ROLE_OFFSET_SUPPORT = 150
PARTNER_CLOSE = 300
PARTNER_SIDESTEP = 320
SAFE_BACK = 1200
TOWER_RANGE = 750
MOVE_REISSUE_DIST = 150
MOVE_REISSUE_TIME = 0.4
TANGO_MISSING_HP = 115
TANGO_TREE_RANGE = 400
RANGED_HERO = 320
HOLD_MELEE_BACK = 200
HOLD_RANGED_INSIDE = 100
HARASSED_RECENT = 3
HARASS_MARGIN = 120
HARASS_MAX_EXTRA = 800
LAST_HIT_SEARCH_MIN = 600
OTHERS_DPS_SHARE = 0.8
COMMIT_EXTRA = 0.3
local HIGH_HOLD = 1.5
IDLE_EXEMPT = 0.5
states = {}
OUTER_TOWERS = {[Lane.Top] = {Tower.Top1, Tower.Top2, Tower.Top3}, [Lane.Mid] = {Tower.Mid1, Tower.Mid2, Tower.Mid3}, [Lane.Bot] = {Tower.Bot1, Tower.Bot2, Tower.Bot3}}
--- Desire with the flag on, called after the shim's off-conditions. During the laning phase:
-- SURVIVE when a Tango is due, HIGH when a last hit is due within 0.6 s, else MODERATE.
-- After it: the shim's ladder tail, without its 0.9 last-hit return.
function ____exports.GetDesire(bot)
    local mode = GetGameMode()
    if mode == 11 or mode == 21 then
        return 1
    end
    if jmz.IsInLaningPhase() then
        if ConsiderTango(bot) ~= nil then
            return Tier(bot, "survive", DesireTier.SURVIVE)
        end
        local state = StateOf(bot)
        local now = DotaTime()
        if BestLastHit(
            bot,
            AttackDamage(bot),
            DUE_MOVE
        ) ~= nil then
            state.highUntil = now + HIGH_HOLD
        end
        if now < state.highUntil then
            return Tier(bot, "high", DesireTier.HIGH)
        end
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
function ____exports.Think(bot)
    local state = StateOf(bot)
    local step = Step(bot, state)
    if Utils.DebugMode then
        CountStep(bot, state, step)
    end
end
return ____exports
