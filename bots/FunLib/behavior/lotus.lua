--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local ____desire_tiers = require(GetScriptDirectory().."/FunLib/behavior/desire_tiers")
local DesireTier = ____desire_tiers.DesireTier
local POOLS = {
    Vector(7515, -4423, 128),
    Vector(-7562, 4219, 128)
}
local POOL_NAME = "npc_dota_lotus_pool"
--- Ways to pick, tried in turn: cast the hero ability on the pool, attack it, or walk onto it (right-click).
local METHODS = {"stand", "ability_capture", "attack"}
local METHOD_RETRY = 25
local FIRST_LOTUS = 180
local REGROW = 180
local EMPTY_RETRY = 90
local ENEMY_RETRY = 60
local SUPPORT_RADIUS = 3000
local ANY_RADIUS = 1200
local ENEMY_RADIUS = 1500
local ABORT_RADIUS = 900
local MIN_HP = 0.5
local WALK_TIMEOUT = 25
local PICK_TIMEOUT = 6
local PICK_RANGE = 250
local STAND_RADIUS = 200
local STUCK_RADIUS = 400
local STUCK_TIME = 1
local states = {}
--- Per pool: when it is next worth a visit, and who is on the way. Shared by the team (one VM per team).
local readyAt = {FIRST_LOTUS, FIRST_LOTUS}
local claimedBy = {nil, nil}
local claimedAt = {-999, -999}
--- Team-wide: the method to try next, and the one that worked (then always used).
local nextMethod = 0
local workingMethod = nil
--- A claim older than this is dropped: a claimant that died stops running Desire (team roam returns early), so it never ends its own claim.
local CLAIM_STALE = WALK_TIMEOUT + PICK_TIMEOUT + 5
local function StateOf(bot)
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local s = states[key]
    if s == nil then
        s = {
            pool = -1,
            startAt = -999,
            castAt = -1,
            lotusesBefore = 0,
            lastMoveTime = -999,
            closest = 99999,
            closestAt = -999,
            method = -1
        }
        states[key] = s
    end
    return s
end
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function PoolUnit(index)
    for ____, unit in ipairs(GetUnitList(UnitType.All)) do
        do
            local __continue6
            repeat
                if unit == nil or unit == nil or unit:IsNull() then
                    __continue6 = true
                    break
                end
                if unit:GetUnitName() == POOL_NAME and Dist(
                    unit:GetLocation(),
                    POOLS[index + 1]
                ) < 700 then
                    return unit
                end
                __continue6 = true
            until true
            if not __continue6 then
                break
            end
        end
    end
    return nil
end
local function CountLotuses(bot)
    local n = 0
    do
        local slot = 0
        while slot <= 8 do
            local item = bot:GetItemInSlot(slot)
            if item ~= nil and item ~= nil and (string.find(
                item:GetName(),
                "famango",
                nil,
                true
            ) or 0) - 1 >= 0 then
                n = n + math.max(
                    item:GetCurrentCharges(),
                    1
                )
            end
            slot = slot + 1
        end
    end
    return n
end
local function EnemyNear(loc, radius)
    for ____, enemy in ipairs(GetUnitList(UnitType.EnemyHeroes)) do
        if jmz.IsValidHero(enemy) and not jmz.IsSuspiciousIllusion(enemy) and Dist(
            enemy:GetLocation(),
            loc
        ) < radius then
            return true
        end
    end
    return false
end
local function Describe(bot, pool)
    local text = ""
    do
        local hints = {}
        do
            local i = 0
            while i < 32 do
                do
                    local __continue19
                    repeat
                        local a = bot:GetAbilityInSlot(i)
                        if a == nil or a == nil then
                            __continue19 = true
                            break
                        end
                        local name = a:GetName()
                        if (string.find(name, "ability_", nil, true) or 0) - 1 == 0 or (string.find(name, "famango", nil, true) or 0) - 1 >= 0 or (string.find(name, "pluck", nil, true) or 0) - 1 >= 0 then
                            hints[#hints + 1] = name
                        end
                        __continue19 = true
                    until true
                    if not __continue19 then
                        break
                    end
                end
                i = i + 1
            end
        end
        text = text .. " heroAbilities=" .. table.concat(hints, ",")
    end
    if pool ~= nil then
        local mods = {}
        do
            local i = 0
            while i < pool:NumModifiers() do
                mods[#mods + 1] = (pool:GetModifierName(i) .. "x") .. tostring(pool:GetModifierStackCount(i))
                i = i + 1
            end
        end
        local abilities = {}
        do
            local i = 0
            while i < 6 do
                local a = pool:GetAbilityInSlot(i)
                if a ~= nil and a ~= nil then
                    abilities[#abilities + 1] = a:GetName()
                end
                i = i + 1
            end
        end
        text = text .. ((((" poolhp=" .. tostring(pool:GetHealth())) .. " poolmods=") .. table.concat(mods, ",")) .. " poolabilities=") .. table.concat(abilities, ",")
    else
        text = text .. " pool=unseen"
    end
    return text
end
local function End(bot, s, result, retryIn)
    local index = s.pool
    if index < 0 then
        return
    end
    if Utils.DebugMode then
        print((((((((((((((((("LOTUSPICK team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(DotaTime()))) .. " pool=") .. tostring(index)) .. " method=") .. (s.method >= 0 and METHODS[s.method + 1] or "none")) .. " result=") .. result) .. " lotuses=") .. tostring(s.lotusesBefore)) .. ">") .. tostring(CountLotuses(bot))) .. " ") .. Describe(
            bot,
            PoolUnit(index)
        ))
    end
    if s.method >= 0 then
        if result == "picked" then
            workingMethod = s.method
        elseif (result == "nothing" or result == "no_ability") and workingMethod == nil and s.method == nextMethod then
            nextMethod = (nextMethod + 1) % #METHODS
            retryIn = METHOD_RETRY
        end
    end
    if claimedBy[index + 1] == bot:GetPlayerID() then
        readyAt[index + 1] = DotaTime() + retryIn
        claimedBy[index + 1] = nil
    end
    s.pool = -1
    s.castAt = -1
    s.method = -1
end
local function Busy(bot)
    local mode = bot:GetActiveMode()
    return mode == BotMode.Retreat or mode == BotMode.Attack or mode == BotMode.EvasiveManeuvers or mode == BotMode.DefendAlly or bot:WasRecentlyDamagedByAnyHero(3) or jmz.CanNotUseAction(bot) or bot:IsChanneling()
end
--- HIGH while a pickup runs or should start, else 0.
function ____exports.Desire(bot)
    local s = StateOf(bot)
    local now = DotaTime()
    if s.pool >= 0 then
        local poolLoc = POOLS[s.pool + 1]
        if not bot:IsAlive() or jmz.GetHP(bot) < MIN_HP - 0.1 then
            End(bot, s, "low_hp", 20)
            return 0
        end
        if EnemyNear(
            bot:GetLocation(),
            ABORT_RADIUS
        ) or EnemyNear(poolLoc, ABORT_RADIUS) then
            End(bot, s, "enemy_near", ENEMY_RETRY)
            return 0
        end
        if CountLotuses(bot) > s.lotusesBefore then
            End(bot, s, "picked", REGROW)
            return 0
        end
        if s.castAt < 0 and now - s.startAt > WALK_TIMEOUT then
            End(bot, s, "walk_timeout", EMPTY_RETRY)
            return 0
        end
        if s.castAt >= 0 then
            if now - s.castAt > PICK_TIMEOUT then
                End(bot, s, "nothing", EMPTY_RETRY)
                return 0
            end
        end
        return DesireTier.HIGH
    end
    if now < FIRST_LOTUS or not bot:IsAlive() or bot:IsIllusion() or Busy(bot) or jmz.GetHP(bot) < MIN_HP then
        return 0
    end
    local support = not jmz.IsCore(bot)
    local botLoc = bot:GetLocation()
    do
        local i = 0
        while i < #POOLS do
            do
                local __continue44
                repeat
                    if now < readyAt[i + 1] or claimedBy[i + 1] ~= nil and now - claimedAt[i + 1] < CLAIM_STALE then
                        __continue44 = true
                        break
                    end
                    local d = Dist(botLoc, POOLS[i + 1])
                    if d > (support and SUPPORT_RADIUS or ANY_RADIUS) then
                        __continue44 = true
                        break
                    end
                    if EnemyNear(POOLS[i + 1], ENEMY_RADIUS) then
                        __continue44 = true
                        break
                    end
                    s.pool = i
                    s.startAt = now
                    s.castAt = -1
                    s.closest = 99999
                    s.closestAt = now
                    s.lotusesBefore = CountLotuses(bot)
                    claimedBy[i + 1] = bot:GetPlayerID()
                    claimedAt[i + 1] = now
                    return DesireTier.HIGH
                until true
                if not __continue44 then
                    break
                end
            end
            i = i + 1
        end
    end
    return 0
end
function ____exports.Active(bot)
    return StateOf(bot).pool >= 0
end
function ____exports.Think(bot)
    local s = StateOf(bot)
    if s.pool < 0 or jmz.CanNotUseAction(bot) then
        return
    end
    local now = DotaTime()
    if s.castAt >= 0 then
        return
    end
    local pool = PoolUnit(s.pool)
    if pool == nil then
        End(bot, s, "no_pool", 600)
        return
    end
    local centre = pool:GetLocation()
    local d = Dist(
        bot:GetLocation(),
        centre
    )
    if d < s.closest - 25 then
        s.closest = d
        s.closestAt = now
    end
    local stuck = d <= STUCK_RADIUS and now - s.closestAt > STUCK_TIME
    local method = workingMethod ~= nil and workingMethod or nextMethod
    local name = METHODS[method + 1]
    local arriveAt = name == "stand" and STAND_RADIUS or PICK_RANGE
    if d > arriveAt and not stuck then
        if now - s.lastMoveTime > 0.4 then
            bot:Action_MoveToLocation(centre)
            s.lastMoveTime = now
        end
        return
    end
    s.method = method
    if name == "attack" then
        bot:Action_AttackUnit(pool, true)
    elseif name ~= "stand" then
        local ability = bot:GetAbilityByName(name)
        if ability == nil or ability == nil then
            End(bot, s, "no_ability", METHOD_RETRY)
            return
        end
        bot:Action_UseAbilityOnEntity(ability, pool)
    end
    s.castAt = now
end
return ____exports
