--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
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
-- End of Lua Library inline imports
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local ____desire_tiers = require(GetScriptDirectory().."/FunLib/behavior/desire_tiers")
local DesireTier = ____desire_tiers.DesireTier
local STACK_START = 2 * 60 + 30
local STACK_GAP = 60
local STACK_GAP_LANING = 120
local PLAN_FROM = 30
local HIT_SEC = {ancient = 52.5, large = 53, medium = 53.5, small = 54}
local STAND_DIST = 350
local PULL_DIST = 1100
local MAX_TRAVEL = 2600
local ENEMY_RADIUS = 1500
local AT_CAMP = 900
local PATH_FACTOR = 1.4
local SEE_RADIUS = 1000
local FARMER_RADIUS = 1000
local MIN_HP = 0.5
local LANING_MAX_TRAVEL = 1600
local LANING_PARTNER_RADIUS = 1600
local LANING_PARTNER_ENEMY = 1400
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local camps = nil
--- All camps with the spawn-box centre (min/max when the game gives them, else location).
function ____exports.Camps()
    if camps ~= nil then
        return camps
    end
    local out = {}
    local box = false
    local fields = ""
    for ____, raw in ipairs(GetNeutralSpawners()) do
        do
            local __continue5
            repeat
                if raw == nil or raw == nil then
                    __continue5 = true
                    break
                end
                if fields == "" then
                    local keys = {}
                    for k in pairs(raw) do
                        keys[#keys + 1] = k
                    end
                    __TS__ArraySort(keys)
                    fields = table.concat(keys, ",")
                end
                local centre = nil
                if raw.min ~= nil and raw.min ~= nil and raw.max ~= nil and raw.max ~= nil then
                    centre = Vector((raw.min.x + raw.max.x) / 2, (raw.min.y + raw.max.y) / 2, raw.min.z)
                    box = true
                elseif raw.location ~= nil and raw.location ~= nil then
                    centre = raw.location
                end
                if centre == nil then
                    __continue5 = true
                    break
                end
                out[#out + 1] = {
                    centre = centre,
                    type = tostring(raw.type),
                    team = raw.team,
                    raw = raw
                }
                __continue5 = true
            until true
            if not __continue5 then
                break
            end
        end
    end
    if Utils.DebugMode then
        print((((((("CAMPS team=" .. tostring(GetTeam())) .. " n=") .. tostring(#out)) .. " box=") .. tostring(box)) .. " fields=") .. fields)
    end
    camps = out
    return out
end
local states = {}
local claimed = {}
local function StateOf(bot)
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local s = states[key]
    if s == nil then
        s = {
            camp = nil,
            phase = "none",
            minute = -1,
            hitAt = 0,
            stand = Vector(0, 0, 0),
            away = Vector(0, 0, 0),
            lastStack = -999,
            neutrals = 0,
            lastMove = -999,
            hitGame = -999
        }
        states[key] = s
    end
    return s
end
local function EnemyNear(loc, radius)
    return #jmz.GetEnemiesNearLoc(loc, radius) > 0
end
local function Busy(bot)
    local mode = bot:GetActiveMode()
    return mode == BotMode.Retreat or mode == BotMode.Attack or mode == BotMode.DefendAlly or mode == BotMode.EvasiveManeuvers or bot:WasRecentlyDamagedByAnyHero(3) or jmz.CanNotUseAction(bot) or bot:IsChanneling()
end
local function Toward(from, to, distance)
    local d = math.max(
        Dist(from, to),
        1
    )
    return Vector(from.x + (to.x - from.x) / d * distance, from.y + (to.y - from.y) / d * distance, from.z)
end
local function End(bot, s, result)
    if s.camp ~= nil and Utils.DebugMode then
        print((((((((((((("STACK team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(DotaTime()))) .. " camp=") .. s.camp.type) .. " result=") .. result) .. " hitAt=") .. tostring(s.hitAt)) .. " neutrals=") .. tostring(s.neutrals))
    end
    if result ~= "pulled" and result ~= "hit" then
        s.lastStack = DotaTime() - STACK_GAP / 2
    end
    s.camp = nil
    s.phase = "none"
end
local function NeutralsAt(bot, centre)
    return __TS__ArrayFilter(
        bot:GetNearbyNeutralCreeps(1600, true),
        function(____, n) return jmz.IsValid(n) and Dist(
            n:GetLocation(),
            centre
        ) < 700 end
    )
end
--- Skip: an ally hero is at the camp (farming it), or an allied unit sees it and it has no neutrals.
local function KnownEmptyOrTaken(bot, centre)
    local seen = false
    for ____, ally in ipairs(GetUnitList(UnitType.AlliedHeroes)) do
        do
            local __continue26
            repeat
                if ally == nil or ally:IsNull() or not ally:IsAlive() then
                    __continue26 = true
                    break
                end
                local d = Dist(
                    ally:GetLocation(),
                    centre
                )
                if ally ~= bot and d < FARMER_RADIUS then
                    return true
                end
                if d < SEE_RADIUS then
                    seen = true
                end
                __continue26 = true
            until true
            if not __continue26 then
                break
            end
        end
    end
    if not seen then
        return false
    end
    for ____, n in ipairs(GetUnitList(UnitType.NeutralCreeps)) do
        if n ~= nil and not n:IsNull() and n:IsAlive() and Dist(
            n:GetLocation(),
            centre
        ) < 700 then
            return false
        end
    end
    return true
end
--- A lane ally near this bot is facing an enemy hero (laning: do not leave it alone).
local function PartnerPressed(bot)
    for ____, ally in ipairs(jmz.GetAlliesNearLoc(
        bot:GetLocation(),
        LANING_PARTNER_RADIUS
    )) do
        do
            local __continue36
            repeat
                if ally == bot then
                    __continue36 = true
                    break
                end
                if EnemyNear(
                    ally:GetLocation(),
                    LANING_PARTNER_ENEMY
                ) then
                    return true
                end
                __continue36 = true
            until true
            if not __continue36 then
                break
            end
        end
    end
    return false
end
--- Pick a camp this minute, if this bot should stack.
local function Plan(bot, s, now, sec, minute)
    local pos = jmz.GetPosition(bot)
    if pos ~= 4 and pos ~= 5 then
        return false
    end
    if now < STACK_START or sec < PLAN_FROM or sec > 50 then
        return false
    end
    local gap = jmz.IsInLaningPhase() and STACK_GAP_LANING or STACK_GAP
    if now - s.lastStack < gap then
        return false
    end
    if not bot:IsAlive() or Busy(bot) or jmz.GetHP(bot) < MIN_HP then
        return false
    end
    local speed = math.max(
        bot:GetCurrentMovementSpeed(),
        250
    )
    local laning = jmz.IsInLaningPhase()
    if laning and PartnerPressed(bot) then
        return false
    end
    local list = ____exports.Camps()
    local best = -1
    local bestDist = laning and LANING_MAX_TRAVEL or MAX_TRAVEL
    do
        local i = 0
        while i < #list do
            do
                local __continue46
                repeat
                    local c = list[i + 1]
                    if c.team ~= GetTeam() or HIT_SEC[c.type] == nil then
                        __continue46 = true
                        break
                    end
                    if c.type == "ancient" and bot:GetLevel() < 6 then
                        __continue46 = true
                        break
                    end
                    if claimed[i] == minute then
                        __continue46 = true
                        break
                    end
                    local d = Dist(
                        bot:GetLocation(),
                        c.centre
                    )
                    if d >= bestDist then
                        __continue46 = true
                        break
                    end
                    if d * PATH_FACTOR / speed > HIT_SEC[c.type] - 2 - sec then
                        __continue46 = true
                        break
                    end
                    if EnemyNear(c.centre, ENEMY_RADIUS) then
                        __continue46 = true
                        break
                    end
                    if KnownEmptyOrTaken(bot, c.centre) then
                        __continue46 = true
                        break
                    end
                    best = i
                    bestDist = d
                    __continue46 = true
                until true
                if not __continue46 then
                    break
                end
            end
            i = i + 1
        end
    end
    if best < 0 then
        return false
    end
    local c = list[best + 1]
    claimed[best] = minute
    s.camp = c
    s.phase = "go"
    s.minute = minute
    s.hitAt = HIT_SEC[c.type]
    s.stand = Toward(
        c.centre,
        bot:GetLocation(),
        STAND_DIST
    )
    s.away = Toward(
        c.centre,
        bot:GetLocation(),
        PULL_DIST
    )
    s.lastStack = now
    s.neutrals = 0
    return true
end
--- HIGH while this bot is stacking a camp (team roam), else 0.
function ____exports.StackDesire(bot)
    local s = StateOf(bot)
    local now = DotaTime()
    local sec = now % 60
    local minute = math.floor(now / 60)
    if s.phase == "none" then
        if not Plan(
            bot,
            s,
            now,
            sec,
            minute
        ) then
            return 0
        end
        return DesireTier.HIGH
    end
    local camp = s.camp
    if not bot:IsAlive() or jmz.GetHP(bot) < MIN_HP - 0.1 or bot:WasRecentlyDamagedByAnyHero(2) then
        End(bot, s, "danger")
        return 0
    end
    local atCamp = Dist(
        bot:GetLocation(),
        camp.centre
    ) < AT_CAMP
    if EnemyNear(camp.centre, 1200) or atCamp and EnemyNear(
        bot:GetLocation(),
        1200
    ) then
        End(bot, s, "enemy_near")
        return 0
    end
    if minute ~= s.minute then
        End(bot, s, s.phase == "pull" and "pulled" or "late")
        return 0
    end
    return DesireTier.HIGH
end
function ____exports.StackActive(bot)
    return StateOf(bot).phase ~= "none"
end
function ____exports.StackThink(bot)
    local s = StateOf(bot)
    if s.phase == "none" or s.camp == nil or jmz.CanNotUseAction(bot) then
        return
    end
    local now = DotaTime()
    local sec = now % 60
    local camp = s.camp
    bot.laningHoldUntil = now + 1
    if s.phase == "go" then
        if sec >= s.hitAt then
            local neutrals = NeutralsAt(bot, camp.centre)
            if #neutrals == 0 then
                End(
                    bot,
                    s,
                    Dist(
                        bot:GetLocation(),
                        camp.centre
                    ) < 900 and "empty" or "late"
                )
                return
            end
            s.neutrals = #neutrals
            bot:Action_AttackUnit(neutrals[1], true)
            s.hitGame = GameTime()
            s.phase = "hit"
            return
        end
        if Dist(
            bot:GetLocation(),
            s.stand
        ) > 120 and now - s.lastMove > 0.3 then
            bot:Action_MoveToLocation(s.stand)
            s.lastMove = now
        end
        return
    end
    if s.phase == "hit" then
        if bot:GetLastAttackTime() >= s.hitGame or GameTime() - s.hitGame > 1.5 then
            s.phase = "pull"
        else
            return
        end
    end
    if s.phase == "pull" and now - s.lastMove > 0.3 then
        bot:Action_MoveToLocation(s.away)
        s.lastMove = now
    end
end
return ____exports
