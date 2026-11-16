--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local __TS__StringReplace
do
    local sub = string.sub
    function __TS__StringReplace(source, searchValue, replaceValue)
        local startPos, endPos = string.find(source, searchValue, nil, true)
        if not startPos then
            return source
        end
        local before = sub(source, 1, startPos - 1)
        local replacement = type(replaceValue) == "string" and replaceValue or replaceValue(nil, searchValue, startPos - 1, source)
        local after = sub(source, endPos + 1)
        return (before .. replacement) .. after
    end
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

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
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

local function __TS__StringIncludes(self, searchString, position)
    if not position then
        position = 1
    else
        position = position + 1
    end
    local index = string.find(self, searchString, position, true)
    return index ~= nil
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end

local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ClassExtends(target, base)
    target.____super = base
    local staticMetatable = setmetatable({__index = base}, base)
    setmetatable(target, staticMetatable)
    local baseMetatable = getmetatable(base)
    if baseMetatable then
        if type(baseMetatable.__index) == "function" then
            staticMetatable.__index = baseMetatable.__index
        end
        if type(baseMetatable.__newindex) == "function" then
            staticMetatable.__newindex = baseMetatable.__newindex
        end
    end
    setmetatable(target.prototype, base.prototype)
    if type(base.prototype.__index) == "function" then
        target.prototype.__index = base.prototype.__index
    end
    if type(base.prototype.__newindex) == "function" then
        target.prototype.__newindex = base.prototype.__newindex
    end
    if type(base.prototype.__tostring) == "function" then
        target.prototype.__tostring = base.prototype.__tostring
    end
end

local Error, RangeError, ReferenceError, SyntaxError, TypeError, URIError
do
    local function getErrorStack(self, constructor)
        if debug == nil then
            return nil
        end
        local level = 1
        while true do
            local info = debug.getinfo(level, "f")
            level = level + 1
            if not info then
                level = 1
                break
            elseif info.func == constructor then
                break
            end
        end
        if __TS__StringIncludes(_VERSION, "Lua 5.0") then
            return debug.traceback(("[Level " .. tostring(level)) .. "]")
        else
            return debug.traceback(nil, level)
        end
    end
    local function wrapErrorToString(self, getDescription)
        return function(self)
            local description = getDescription(self)
            local caller = debug.getinfo(3, "f")
            local isClassicLua = __TS__StringIncludes(_VERSION, "Lua 5.0") or _VERSION == "Lua 5.1"
            if isClassicLua or caller and caller.func ~= error then
                return description
            else
                return (description .. "\n") .. tostring(self.stack)
            end
        end
    end
    local function initErrorClass(self, Type, name)
        Type.name = name
        return setmetatable(
            Type,
            {__call = function(____, _self, message) return __TS__New(Type, message) end}
        )
    end
    local ____initErrorClass_1 = initErrorClass
    local ____class_0 = __TS__Class()
    ____class_0.name = ""
    function ____class_0.prototype.____constructor(self, message)
        if message == nil then
            message = ""
        end
        self.message = message
        self.name = "Error"
        self.stack = getErrorStack(nil, self.constructor.new)
        local metatable = getmetatable(self)
        if metatable and not metatable.__errorToStringPatched then
            metatable.__errorToStringPatched = true
            metatable.__tostring = wrapErrorToString(nil, metatable.__tostring)
        end
    end
    function ____class_0.prototype.__tostring(self)
        return self.message ~= "" and (self.name .. ": ") .. self.message or self.name
    end
    Error = ____initErrorClass_1(nil, ____class_0, "Error")
    local function createErrorClass(self, name)
        local ____initErrorClass_3 = initErrorClass
        local ____class_2 = __TS__Class()
        ____class_2.name = ____class_2.name
        __TS__ClassExtends(____class_2, Error)
        function ____class_2.prototype.____constructor(self, ...)
            ____class_2.____super.prototype.____constructor(self, ...)
            self.name = name
        end
        return ____initErrorClass_3(nil, ____class_2, name)
    end
    RangeError = createErrorClass(nil, "RangeError")
    ReferenceError = createErrorClass(nil, "ReferenceError")
    SyntaxError = createErrorClass(nil, "SyntaxError")
    TypeError = createErrorClass(nil, "TypeError")
    URIError = createErrorClass(nil, "URIError")
end

local function __TS__ObjectGetOwnPropertyDescriptors(object)
    local metatable = getmetatable(object)
    if not metatable then
        return {}
    end
    return rawget(metatable, "_descriptors") or ({})
end

local function __TS__Delete(target, key)
    local descriptors = __TS__ObjectGetOwnPropertyDescriptors(target)
    local descriptor = descriptors[key]
    if descriptor then
        if not descriptor.configurable then
            error(
                __TS__New(
                    TypeError,
                    ((("Cannot delete property " .. tostring(key)) .. " of ") .. tostring(target)) .. "."
                ),
                0
            )
        end
        descriptors[key] = nil
        return true
    end
    target[key] = nil
    return true
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

local function __TS__ArrayIncludes(self, searchElement, fromIndex)
    if fromIndex == nil then
        fromIndex = 0
    end
    local len = #self
    local k = fromIndex
    if fromIndex < 0 then
        k = len + fromIndex
    end
    if k < 0 then
        k = 0
    end
    for i = k + 1, len do
        if self[i] == searchElement then
            return true
        end
    end
    return false
end

local function __TS__ArraySlice(self, first, last)
    local len = #self
    first = first or 0
    if first < 0 then
        first = len + first
        if first < 0 then
            first = 0
        end
    else
        if first > len then
            first = len
        end
    end
    last = last or len
    if last < 0 then
        last = len + last
        if last < 0 then
            last = 0
        end
    else
        if last > len then
            last = len
        end
    end
    local out = {}
    first = first + 1
    last = last + 1
    local n = 1
    while first < last do
        out[n] = self[first]
        first = first + 1
        n = n + 1
    end
    return out
end
-- End of Lua Library inline imports
local ____exports = {}
local PushGather, DefenceOf, PUSH_GATHER_BACK, LANES, defences
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local Lane = ____dota.Lane
local Tower = ____dota.Tower
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local Brain = require(GetScriptDirectory().."/FunLib/behavior/team_brain")
local Siege = require(GetScriptDirectory().."/FunLib/behavior/siege")
local ____desire_tiers = require(GetScriptDirectory().."/FunLib/behavior/desire_tiers")
local DesireTier = ____desire_tiers.DesireTier
local ____flags = require(GetScriptDirectory().."/FunLib/behavior/flags")
local IsOn = ____flags.IsOn
function PushGather(lane)
    return GetLaneFrontLocation(
        GetTeam(),
        lane,
        PUSH_GATHER_BACK
    )
end
function DefenceOf(id)
    for ____, lane in ipairs(LANES) do
        local d = defences[lane]
        if d ~= nil and __TS__ArrayIncludes(d.ids, id) then
            return d
        end
    end
    return nil
end
function ____exports.Bails(bot)
    return IsOn("bail") and jmz.GetHP(bot) < ____exports.BAIL_HP
end
local UPDATE = 1
local THREAT_RADIUS = 1600
local SEEN = 3
local DEFEND_HOLD = 8
local DEFEND_MIN_HP = 0.4
local GATHER_BACK = 1200
local GATHER_RADIUS = 900
local GATHER_WAIT = 6
local TP_TIME = 4
local TP_MIN_DIST = 4000
local PUSH_LEAD = 2
local WON_KILLS = 2
local WON_WINDOW = 20
local LATE_TIME = 30 * 60
local LATE_ENEMIES = 3
local PUSH_MIN_HP = 0.5
PUSH_GATHER_BACK = -1200
local PUSH_GATHER_RADIUS = 1600
local PUSH_GATHER_COUNT = 3
local PUSH_GATHER_TIMEOUT = 20
local PUSH_MAX = 120
local PUSH_COOLDOWN = 20
local STOP_UNSEEN = 3
local STOP_UNSEEN_TIME = 5
local STOP_DEATHS = 2
local STOP_DEATH_WINDOW = 10
____exports.PUSH_DESIRE = DesireTier.HIGH
local ENEMY_GROUP = 3
local ENEMY_GROUP_LINK = 1500
local GROUP_MEMORY = 20
local REGROUP_RADIUS = 2500
local REGROUP_ARRIVE = 1200
local REGROUP_MIN_HP = 0.4
local LOW = DesireTier.LOW
local CAP_KEEP = 0.9
local CAPPED = {
    [BotMode.Farm] = true,
    [BotMode.Rune] = true,
    [BotMode.Ward] = true,
    [BotMode.SecretShop] = true,
    [BotMode.SideShop] = true,
    [BotMode.Roam] = true
}
LANES = {Lane.Top, Lane.Mid, Lane.Bot}
local LANE_NAMES = {[Lane.Top] = "top", [Lane.Mid] = "mid", [Lane.Bot] = "bot"}
local LANE_TOWERS = {[Lane.Top] = {Tower.Top1, Tower.Top2, Tower.Top3}, [Lane.Mid] = {Tower.Mid1, Tower.Mid2, Tower.Mid3}, [Lane.Bot] = {Tower.Bot1, Tower.Bot2, Tower.Bot3}}
local updatedAt = -999
local laning = true
defences = {}
local push = nil
local pushEndedAt = -999
local groupSeenAt = -999
local regrouping = false
local rally = nil
local anchorId = -1
local enemyDeaths = {}
local allyDeaths = {}
local enemyAlive = {}
local allyAlive = {}
local moving = {}
local target = {}
local lastMove = {}
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function Toward(from, to, distance)
    local d = Dist(from, to)
    if d < 1 then
        return from
    end
    return Vector(from.x + (to.x - from.x) / d * distance, from.y + (to.y - from.y) / d * distance, from.z)
end
local function Short(u)
    return __TS__StringReplace(
        u:GetUnitName(),
        "npc_dota_hero_",
        ""
    )
end
local function Log(text)
    if Utils.DebugMode then
        print((((("GROUP team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(DotaTime()))) .. " ") .. text)
    end
end
--- Living allied heroes, people included (they count as present but are never assigned).
local function Allies()
    return __TS__ArrayFilter(
        GetUnitList(UnitType.AlliedHeroes),
        function(____, h) return h ~= nil and not h:IsNull() and h:IsAlive() and not h:IsIllusion() and not jmz.IsMeepoClone(h) end
    )
end
local function Bots()
    return __TS__ArrayFilter(
        Allies(),
        function(____, h) return h:IsBot() end
    )
end
local function ById(id)
    for ____, a in ipairs(Allies()) do
        if a:GetPlayerID() == id then
            return a
        end
    end
    return nil
end
local function Names(ids)
    return table.concat(
        __TS__ArrayMap(
            ids,
            function(____, id)
                local u = ById(id)
                return u ~= nil and Short(u) or "#" .. tostring(id)
            end
        ),
        ","
    )
end
local function Centroid(units)
    if #units == 0 then
        return nil
    end
    local x = 0
    local y = 0
    for ____, u in ipairs(units) do
        x = x + u:GetLocation().x
        y = y + u:GetLocation().y
    end
    return Vector(x / #units, y / #units, 0)
end
local function TpReady(bot)
    local tp = bot:GetItemInSlot(15)
    return tp ~= nil and tp ~= nil and tp:GetName() == "item_tpscroll" and jmz.CanCastAbility(tp)
end
local function TravelTime(bot, loc)
    local d = Dist(
        bot:GetLocation(),
        loc
    )
    local walk = d / math.max(
        bot:GetCurrentMovementSpeed(),
        200
    )
    if d > TP_MIN_DIST and TpReady(bot) then
        return math.min(walk, TP_TIME)
    end
    return walk
end
--- Our lowest standing tower in a lane and its tier (1-3), or null.
local function LowestTower(team, lane)
    local list = LANE_TOWERS[lane]
    do
        local i = 0
        while i < #list do
            local t = GetTower(team, list[i + 1])
            if t ~= nil and t ~= nil and not t:IsNull() and t:IsAlive() then
                return {t, i + 1}
            end
            i = i + 1
        end
    end
    return nil
end
local function TrackDeaths(now)
    for ____, id in ipairs(GetTeamPlayers(GetOpposingTeam())) do
        local alive = IsHeroAlive(id)
        if enemyAlive[id] == true and not alive then
            enemyDeaths[#enemyDeaths + 1] = now
        end
        enemyAlive[id] = alive
    end
    for ____, id in ipairs(GetTeamPlayers(GetTeam())) do
        local alive = IsHeroAlive(id)
        if allyAlive[id] == true and not alive then
            allyDeaths[#allyDeaths + 1] = now
        end
        allyAlive[id] = alive
    end
    while #enemyDeaths > 0 and now - enemyDeaths[1] > 60 do
        table.remove(enemyDeaths, 1)
    end
    while #allyDeaths > 0 and now - allyDeaths[1] > 60 do
        table.remove(allyDeaths, 1)
    end
end
local function CountSince(list, now, window)
    return #__TS__ArrayFilter(
        list,
        function(____, t) return now - t <= window end
    )
end
--- Size of the largest group of enemies seen together in the last SEEN s.
local function EnemyGroupSize()
    local pts = {}
    for ____, e in ipairs(Brain.Get().enemies) do
        if e.alive and e.lastSeenLoc ~= nil and e.lastSeenAge <= SEEN then
            pts[#pts + 1] = e.lastSeenLoc
        end
    end
    local best = 0
    local used = __TS__ArrayMap(
        pts,
        function() return false end
    )
    do
        local i = 0
        while i < #pts do
            do
                local __continue44
                repeat
                    if used[i + 1] then
                        __continue44 = true
                        break
                    end
                    used[i + 1] = true
                    local group = {pts[i + 1]}
                    do
                        local k = 0
                        while k < #group do
                            do
                                local j = 0
                                while j < #pts do
                                    if not used[j + 1] and Dist(group[k + 1], pts[j + 1]) <= ENEMY_GROUP_LINK then
                                        used[j + 1] = true
                                        group[#group + 1] = pts[j + 1]
                                    end
                                    j = j + 1
                                end
                            end
                            k = k + 1
                        end
                    end
                    best = math.max(best, #group)
                    __continue44 = true
                until true
                if not __continue44 then
                    break
                end
            end
            i = i + 1
        end
    end
    return best
end
--- Laning phase for the whole team. jmz.IsInLaningPhase() reads GetBot()'s net worth between 10:00 and
-- 14:00, so it flipped with whichever bot ran Update() (regroup started and ended every second).
-- This uses the bots' average net worth instead.
local function TeamLaning()
    local now = DotaTime()
    local turbo = jmz.IsModeTurbo()
    if now < (turbo and 480 or 600) then
        return true
    end
    if now >= (turbo and 600 or 840) then
        return false
    end
    local bots = Bots()
    if #bots == 0 then
        return false
    end
    local nw = 0
    for ____, b in ipairs(bots) do
        nw = nw + b:GetNetWorth()
    end
    return nw / #bots < 8000
end
--- Our tower is under real pressure: hit by a hero or by creeps in the last 2 s.
local function TowerHit(tower)
    return tower:WasRecentlyDamagedByAnyHero(2) or tower:WasRecentlyDamagedByCreep(2)
end
local function UpdateDefences(now)
    if laning then
        for ____, lane in ipairs(LANES) do
            local d = defences[lane]
            if d ~= nil then
                Log((("defend lane=" .. LANE_NAMES[lane]) .. " end why=laning dur=") .. tostring(math.floor(now - d.since)))
            end
        end
        defences = {}
        return
    end
    local team = GetTeam()
    local fountain = jmz.GetTeamFountain()
    local threats = {}
    for ____, lane in ipairs(LANES) do
        do
            local __continue61
            repeat
                local low = LowestTower(team, lane)
                if low == nil then
                    __continue61 = true
                    break
                end
                local n = 0
                for ____, e in ipairs(Brain.Get().enemies) do
                    if e.alive and e.lastSeenLoc ~= nil and e.lastSeenAge <= SEEN and Dist(
                        e.lastSeenLoc,
                        low[1]:GetLocation()
                    ) <= THREAT_RADIUS then
                        n = n + 1
                    end
                end
                local running = defences[lane] ~= nil
                if n > 0 and (running or n >= 2 or TowerHit(low[1])) then
                    threats[#threats + 1] = {lane, n, low[1], low[2]}
                end
                __continue61 = true
            until true
            if not __continue61 then
                break
            end
        end
    end
    for ____, lane in ipairs(LANES) do
        do
            local __continue68
            repeat
                local d = defences[lane]
                if d == nil then
                    __continue68 = true
                    break
                end
                local live = __TS__ArraySome(
                    threats,
                    function(____, t) return t[1] == lane end
                )
                if live then
                    d.lastThreat = now
                end
                if not live and now - d.lastThreat > DEFEND_HOLD then
                    Log((((("defend lane=" .. LANE_NAMES[lane]) .. " end dur=") .. tostring(math.floor(now - d.since))) .. " gathered=") .. tostring(d.gathered))
                    __TS__Delete(defences, lane)
                end
                __continue68 = true
            until true
            if not __continue68 then
                break
            end
        end
    end
    __TS__ArraySort(
        threats,
        function(____, a, b) return b[2] - a[2] end
    )
    local bots = __TS__ArrayFilter(
        Bots(),
        function(____, b) return jmz.GetHP(b) >= DEFEND_MIN_HP end
    )
    local taken = {}
    for ____, t in ipairs(threats) do
        do
            local __continue76
            repeat
                local lane, enemies, tower, tier = unpack(t)
                local needed = (tier >= 3 or enemies >= 4) and #bots or (enemies == 1 and 2 or 3)
                local old = defences[lane]
                local loc = tower:GetLocation()
                local keep = old ~= nil and __TS__ArrayFilter(
                    old.ids,
                    function(____, id) return not taken[id] and __TS__ArraySome(
                        bots,
                        function(____, b) return b:GetPlayerID() == id end
                    ) end
                ) or ({})
                local rest = __TS__ArrayFilter(
                    bots,
                    function(____, b) return not taken[b:GetPlayerID()] and not __TS__ArrayIncludes(
                        keep,
                        b:GetPlayerID()
                    ) end
                )
                __TS__ArraySort(
                    rest,
                    function(____, a, b) return TravelTime(a, loc) - TravelTime(b, loc) end
                )
                local ids = __TS__ArraySlice(keep, 0, needed)
                for ____, b in ipairs(rest) do
                    if #ids >= needed then
                        break
                    end
                    ids[#ids + 1] = b:GetPlayerID()
                end
                for ____, id in ipairs(ids) do
                    taken[id] = true
                end
                if #ids == 0 then
                    if old ~= nil then
                        Log((("defend lane=" .. LANE_NAMES[lane]) .. " end why=nobody dur=") .. tostring(math.floor(now - old.since)))
                        __TS__Delete(defences, lane)
                    end
                    __continue76 = true
                    break
                end
                if old == nil then
                    local d = {
                        lane = lane,
                        tier = tier,
                        loc = loc,
                        gather = Toward(loc, fountain, GATHER_BACK),
                        needed = needed,
                        ids = ids,
                        since = now,
                        gathered = false,
                        lastThreat = now,
                        enemies = enemies
                    }
                    defences[lane] = d
                    Log((((((((("defend lane=" .. LANE_NAMES[lane]) .. " start tier=") .. tostring(tier)) .. " enemies=") .. tostring(enemies)) .. " needed=") .. tostring(needed)) .. " ids=") .. Names(ids))
                else
                    if old.needed ~= needed or table.concat(old.ids, ",") ~= table.concat(ids, ",") then
                        Log((((((("defend lane=" .. LANE_NAMES[lane]) .. " update enemies=") .. tostring(enemies)) .. " needed=") .. tostring(needed)) .. " ids=") .. Names(ids))
                    end
                    old.needed = needed
                    old.ids = ids
                    old.enemies = enemies
                    old.tier = tier
                end
                __continue76 = true
            until true
            if not __continue76 then
                break
            end
        end
    end
    for ____, lane in ipairs(LANES) do
        do
            local __continue92
            repeat
                local d = defences[lane]
                if d == nil or d.gathered then
                    __continue92 = true
                    break
                end
                local here = 0
                for ____, id in ipairs(d.ids) do
                    local u = ById(id)
                    if u ~= nil and (Dist(
                        u:GetLocation(),
                        d.gather
                    ) <= GATHER_RADIUS or Dist(
                        u:GetLocation(),
                        d.loc
                    ) <= GATHER_RADIUS) then
                        here = here + 1
                    end
                end
                if here >= math.max(1, #d.ids - 1) or now - d.since >= GATHER_WAIT then
                    d.gathered = true
                    Log((((("defend lane=" .. LANE_NAMES[lane]) .. " gathered here=") .. tostring(here)) .. "/") .. tostring(#d.ids))
                end
                __continue92 = true
            until true
            if not __continue92 then
                break
            end
        end
    end
end
local function PickPushLane()
    local centre = Centroid(Bots())
    if centre == nil then
        return nil
    end
    local enemy = GetOpposingTeam()
    local best = nil
    local bestScore = 1000000000
    for ____, lane in ipairs(LANES) do
        do
            local __continue101
            repeat
                if Siege.LaneAtHighGround(lane) then
                    __continue101 = true
                    break
                end
                local low = LowestTower(enemy, lane)
                if low == nil then
                    __continue101 = true
                    break
                end
                local score = Dist(
                    centre,
                    low[1]:GetLocation()
                )
                if Dist(
                    GetLaneFrontLocation(
                        GetTeam(),
                        lane,
                        0
                    ),
                    low[1]:GetLocation()
                ) <= 1500 then
                    score = score - 2000
                end
                if score < bestScore then
                    bestScore = score
                    best = lane
                end
                __continue101 = true
            until true
            if not __continue101 then
                break
            end
        end
    end
    return best
end
local function PushStartWhy(now)
    local allies = jmz.GetNumOfAliveHeroes(false)
    local enemies = jmz.GetNumOfAliveHeroes(true)
    if allies - enemies >= PUSH_LEAD then
        return (("lead" .. tostring(allies)) .. "v") .. tostring(enemies)
    end
    if allies > enemies and CountSince(enemyDeaths, now, WON_WINDOW) >= WON_KILLS and CountSince(allyDeaths, now, WON_WINDOW) == 0 then
        return "won_fight"
    end
    if jmz.DoesTeamHaveAegis() and allies >= enemies then
        return "aegis"
    end
    if now >= LATE_TIME and enemies <= LATE_ENEMIES and allies > enemies then
        return (("late" .. tostring(allies)) .. "v") .. tostring(enemies)
    end
    return nil
end
local function PushStopWhy(now)
    local allies = jmz.GetNumOfAliveHeroes(false)
    local enemies = jmz.GetNumOfAliveHeroes(true)
    local aegis = jmz.DoesTeamHaveAegis()
    if allies <= enemies and not (aegis and allies == enemies) then
        return (("numbers" .. tostring(allies)) .. "v") .. tostring(enemies)
    end
    if CountSince(allyDeaths, now, STOP_DEATH_WINDOW) >= STOP_DEATHS then
        return "deaths"
    end
    local unseen = 0
    for ____, e in ipairs(Brain.Get().enemies) do
        if e.alive and e.lastSeenAge > STOP_UNSEEN_TIME then
            unseen = unseen + 1
        end
    end
    if push.gathered and unseen >= STOP_UNSEEN and allies - enemies < PUSH_LEAD and not aegis then
        return "unseen" .. tostring(unseen)
    end
    if now - push.since > PUSH_MAX then
        return "time"
    end
    if Siege.CommitLane() ~= nil then
        return "siege"
    end
    for ____, lane in ipairs(LANES) do
        local d = defences[lane]
        if d ~= nil and d.needed >= #Bots() then
            return "defend"
        end
    end
    return nil
end
local function UpdatePush(now)
    if push ~= nil then
        local why = PushStopWhy(now)
        if why ~= nil then
            Log((((((("push lane=" .. LANE_NAMES[push.lane]) .. " end why=") .. why) .. " dur=") .. tostring(math.floor(now - push.since))) .. " gathered=") .. tostring(push.gathered))
            push = nil
            pushEndedAt = now
            return
        end
        push.ids = __TS__ArrayFilter(
            push.ids,
            function(____, id)
                local u = ById(id)
                return u ~= nil and jmz.GetHP(u) >= PUSH_MIN_HP * 0.6 and DefenceOf(id) == nil
            end
        )
        if not push.gathered then
            local point = PushGather(push.lane)
            local here = 0
            for ____, id in ipairs(push.ids) do
                local u = ById(id)
                if u ~= nil and Dist(
                    u:GetLocation(),
                    point
                ) <= PUSH_GATHER_RADIUS then
                    here = here + 1
                end
            end
            local atRoshan = 0
            for ____, id in ipairs(push.ids) do
                local u = ById(id)
                if u ~= nil and u:GetActiveMode() == BotMode.Roshan then
                    atRoshan = atRoshan + 1
                end
            end
            if atRoshan * 2 > #push.ids then
                push.gatherFrom = now
            end
            if here >= math.min(PUSH_GATHER_COUNT, #push.ids) or now - push.gatherFrom > PUSH_GATHER_TIMEOUT then
                push.gathered = true
                Log((((("push lane=" .. LANE_NAMES[push.lane]) .. " gathered here=") .. tostring(here)) .. "/") .. tostring(#push.ids))
            end
        end
        return
    end
    if laning or now - pushEndedAt < PUSH_COOLDOWN or Siege.CommitLane() ~= nil then
        return
    end
    local why = PushStartWhy(now)
    if why == nil then
        return
    end
    local lane = PickPushLane()
    if lane == nil then
        return
    end
    local ids = __TS__ArrayMap(
        __TS__ArrayFilter(
            Bots(),
            function(____, b) return jmz.GetHP(b) >= PUSH_MIN_HP and DefenceOf(b:GetPlayerID()) == nil end
        ),
        function(____, b) return b:GetPlayerID() end
    )
    if #ids < 2 then
        return
    end
    push = {
        lane = lane,
        ids = ids,
        since = now,
        gatherFrom = now,
        gathered = false,
        why = why
    }
    Log((((("push lane=" .. LANE_NAMES[lane]) .. " start why=") .. why) .. " ids=") .. Names(ids))
end
--- The first healthy core by position that is not retreating; else any healthy bot.
local function Anchor()
    local bots = __TS__ArrayFilter(
        Bots(),
        function(____, b) return jmz.GetHP(b) >= REGROUP_MIN_HP and b:GetActiveMode() ~= BotMode.Retreat end
    )
    local best = nil
    for ____, b in ipairs(bots) do
        if best == nil or jmz.GetPosition(b) < jmz.GetPosition(best) then
            best = b
        end
    end
    return best
end
local function UpdateRegroup(now)
    if EnemyGroupSize() >= ENEMY_GROUP then
        groupSeenAt = now
    end
    local want = not laning and now - groupSeenAt <= GROUP_MEMORY and not IsOn("noregroup")
    if not want then
        if regrouping then
            Log("regroup end")
        end
        regrouping = false
        rally = nil
        anchorId = -1
        return
    end
    local point = nil
    local anchor = nil
    if push ~= nil then
        point = PushGather(push.lane)
    end
    if point == nil then
        for ____, lane in ipairs(LANES) do
            local d = defences[lane]
            if d ~= nil and (point == nil or d.enemies >= 2) then
                point = d.gather
            end
        end
    end
    if point == nil then
        anchor = Anchor()
        if anchor ~= nil then
            point = anchor:GetLocation()
        end
    end
    if not regrouping and point ~= nil then
        Log("regroup start anchor=" .. (anchor ~= nil and Short(anchor) or (push ~= nil and "push" or "defence")))
    end
    if regrouping and point == nil then
        Log("regroup end why=no_rally")
    end
    regrouping = point ~= nil
    rally = point
    anchorId = anchor ~= nil and anchor:GetPlayerID() or -1
end
local function Update()
    local now = DotaTime()
    if now - updatedAt < UPDATE then
        return
    end
    updatedAt = now
    laning = TeamLaning()
    TrackDeaths(now)
    UpdateDefences(now)
    UpdatePush(now)
    UpdateRegroup(now)
end
--- For aba_defend: "defend" (go, HIGH), "defend_forced" (tier 3: FORCED), "gather" (assigned, still meeting:
-- team roam walks there), "skip" (a hero threat this bot is not picked for, or picked for another lane),
-- "none" (no hero threat here and not picked anywhere: plain OHA defence, e.g. creeps only).
function ____exports.DefendRoleOf(bot, lane)
    Update()
    local id = bot:GetPlayerID()
    local mine = DefenceOf(id)
    if mine ~= nil then
        if mine.lane ~= lane then
            return "skip"
        end
        if not mine.gathered then
            return "gather"
        end
        return mine.tier >= 3 and "defend_forced" or "defend"
    end
    if defences[lane] ~= nil then
        return "skip"
    end
    return "none"
end
--- For aba_push: "push" (member, gathered), "gather", "skip" (a push elsewhere or not a member), "none" (no push).
function ____exports.PushRoleOf(bot, lane)
    Update()
    if push == nil then
        return "none"
    end
    if push.lane ~= lane or not __TS__ArrayIncludes(
        push.ids,
        bot:GetPlayerID()
    ) then
        return "skip"
    end
    return push.gathered and "push" or "gather"
end
--- No team push running (aba_push caps lone pushing at LOW then).
function ____exports.NoPush()
    Update()
    return push == nil and not laning
end
--- Team roam: walk to a defence or push gather point. HIGH while walking there, else 0.
function ____exports.GatherDesire(bot)
    Update()
    if not bot:IsAlive() or not bot:IsBot() or ____exports.Bails(bot) then
        return 0
    end
    local id = bot:GetPlayerID()
    local d = DefenceOf(id)
    if d ~= nil and not d.gathered then
        target[id] = d.gather
        return Dist(
            bot:GetLocation(),
            d.gather
        ) > 300 and DesireTier.HIGH or 0
    end
    if push ~= nil and not push.gathered and __TS__ArrayIncludes(push.ids, id) then
        local point = PushGather(push.lane)
        target[id] = point
        return Dist(
            bot:GetLocation(),
            point
        ) > 400 and DesireTier.HIGH or 0
    end
    return 0
end
--- Far from the group while it should be together (and not assigned to a defence or push).
local function FarFromGroup(bot)
    if not regrouping or rally == nil or laning then
        return false
    end
    local id = bot:GetPlayerID()
    if id == anchorId or DefenceOf(id) ~= nil or push ~= nil and __TS__ArrayIncludes(push.ids, id) then
        return false
    end
    local d = Dist(
        bot:GetLocation(),
        rally
    )
    if moving[id] == true then
        if d <= REGROUP_ARRIVE then
            moving[id] = false
        end
    elseif d > REGROUP_RADIUS then
        moving[id] = true
    end
    return moving[id] == true
end
--- Behaviour flag `bail`: below BAIL_HP a bot drops every group role (push, siege commit, defence,
-- regroup, gather) so retreat can win. In the `group` batches the new team died 11.6 times per game
-- after 20:00 having started its retreat below 40% health (plain OHA 7.5): push and siege bid 0.75-0.85
-- down to 35% health, defence at least HIGH at any health, regroup and gather HIGH down to 40% or 0%,
-- while retreat was already asking 0.5 or more.
____exports.BAIL_HP = 0.55
--- Team roam: walk to the rally point. HIGH while far from it (hysteresis: REGROUP_RADIUS out, REGROUP_ARRIVE in), else 0.
function ____exports.RegroupDesire(bot)
    Update()
    if not bot:IsAlive() or not bot:IsBot() or jmz.GetHP(bot) < REGROUP_MIN_HP or ____exports.Bails(bot) then
        return 0
    end
    if not FarFromGroup(bot) then
        return 0
    end
    target[bot:GetPlayerID()] = rally
    return DesireTier.HIGH
end
function ____exports.Think(bot)
    local id = bot:GetPlayerID()
    local t = target[id]
    if t == nil or jmz.CanNotUseAction(bot) then
        return
    end
    local now = DotaTime()
    if lastMove[id] ~= nil and now - lastMove[id] < 0.3 then
        return
    end
    lastMove[id] = now
    local a = id % 5 * 1.2566
    bot:Action_MoveToLocation(Vector(
        t.x + math.cos(a) * 150,
        t.y + math.sin(a) * 150,
        t.z
    ))
end
--- Behaviour arbiter: while a bot is picked for a defence or push, or is far from the regrouping team,
-- farm, runes, wards, shops and roaming are capped at LOW so they do not pull it away alone.
function ____exports.Cap(bot, mode, value)
    if CAPPED[mode] ~= true or value <= LOW or value >= CAP_KEEP or not bot:IsBot() then
        return value
    end
    Update()
    if laning then
        return value
    end
    local id = bot:GetPlayerID()
    local busy = DefenceOf(id) ~= nil or push ~= nil and __TS__ArrayIncludes(push.ids, id) or FarFromGroup(bot)
    return busy and LOW or value
end
return ____exports
