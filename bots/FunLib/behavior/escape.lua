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

local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
end

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
    end
    return result
end

local function __TS__CountVarargs(...)
    return select("#", ...)
end

local function __TS__SparseArrayNew(...)
    local sparseArray = {...}
    sparseArray.sparseLength = __TS__CountVarargs(...)
    return sparseArray
end

local function __TS__SparseArrayPush(sparseArray, ...)
    local args = {...}
    local argsLen = __TS__CountVarargs(...)
    local listLen = sparseArray.sparseLength
    for i = 1, argsLen do
        sparseArray[listLen + i] = args[i]
    end
    sparseArray.sparseLength = listLen + argsLen
end

local function __TS__SparseArraySpread(sparseArray)
    local _unpack = unpack or table.unpack
    return _unpack(sparseArray, 1, sparseArray.sparseLength)
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

local function __TS__ArrayFind(self, predicate, thisArg)
    for i = 1, #self do
        local elem = self[i]
        if predicate(thisArg, elem, i - 1, self) then
            return elem
        end
    end
    return nil
end
-- End of Lua Library inline imports
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local Tower = ____dota.Tower
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local Brain = require(GetScriptDirectory().."/FunLib/behavior/team_brain")
local PLAN = 0.4
local THREAT_RADIUS = 2000
local THREAT_SEEN = 3
local ENEMY_SPEED = 320
local ENEMY_REACH_MIN = 500
local SAMPLE_STEP = 250
local SAMPLE_LEN = 1500
local CATCH_CAP = 6
local DANGER_WEIGHT = 4
local TOWER_SAFE = 700
local TOWER_RANGE = 4500
local SIDE_AHEAD = 700
local SIDE_NEAR = 900
local SIDE_FAR = 1600
local ALLY_RANGE = 2500
local ALLY_MIN_HP = 0.5
local WAYPOINT_DONE = 250
local KEEP_FACTOR = 1.15
local KEEP_MARGIN = 0.3
local HOME = 1200
local TOWERS = {
    Tower.Top1,
    Tower.Top2,
    Tower.Top3,
    Tower.Mid1,
    Tower.Mid2,
    Tower.Mid3,
    Tower.Bot1,
    Tower.Bot2,
    Tower.Bot3,
    Tower.Base1,
    Tower.Base2
}
local states = {}
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function Short(u)
    return __TS__StringReplace(
        u:GetUnitName(),
        "npc_dota_hero_",
        ""
    )
end
local function Threats(bot)
    local out = {}
    local here = bot:GetLocation()
    for ____, e in ipairs(Brain.Get().enemies) do
        do
            local __continue5
            repeat
                if not e.alive or e.lastSeenLoc == nil or e.lastSeenAge > THREAT_SEEN then
                    __continue5 = true
                    break
                end
                if Dist(e.lastSeenLoc, here) > THREAT_RADIUS then
                    __continue5 = true
                    break
                end
                local speed = ENEMY_SPEED
                local reach = ENEMY_REACH_MIN
                local u = e.unit
                if e.visible and u ~= nil and not u:IsNull() and u:CanBeSeen() then
                    speed = math.max(
                        u:GetCurrentMovementSpeed(),
                        200
                    )
                    reach = math.max(
                        u:GetAttackRange() + 100,
                        ENEMY_REACH_MIN
                    )
                end
                out[#out + 1] = {loc = e.lastSeenLoc, speed = speed, reach = reach}
                __continue5 = true
            until true
            if not __continue5 then
                break
            end
        end
    end
    return out
end
local function OurTowers()
    local out = {}
    for ____, id in ipairs(TOWERS) do
        local t = GetTower(
            GetTeam(),
            id
        )
        if t ~= nil and t ~= nil and not t:IsNull() and t:IsAlive() then
            out[#out + 1] = t
        end
    end
    return out
end
--- Sample points along the route's first SAMPLE_LEN, with the distance walked to each.
local function Samples(from, points)
    local out = {}
    local walked = 0
    local a = from
    for ____, b in ipairs(points) do
        local len = Dist(a, b)
        local s = 0
        while s < len and walked + s <= SAMPLE_LEN do
            local k = len > 0 and s / len or 0
            out[#out + 1] = {
                Vector(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 0),
                walked + s
            }
            s = s + SAMPLE_STEP
        end
        walked = walked + len
        if walked > SAMPLE_LEN then
            break
        end
        a = b
    end
    return out
end
function ____exports.Cost(from, points, speed, threats, towers)
    local length = 0
    local a = from
    for ____, b in ipairs(points) do
        length = length + Dist(a, b)
        a = b
    end
    local cost = length / speed
    local samples = Samples(from, points)
    for ____, t in ipairs(threats) do
        local worst = 0
        for ____, ____value in ipairs(samples) do
            local p = ____value[1]
            local walked = ____value[2]
            local ours = walked / speed
            local theirs = math.max(
                Dist(t.loc, p) - t.reach,
                0
            ) / t.speed
            local wait = math.min(
                math.max(ours - theirs, 0),
                CATCH_CAP
            )
            if wait > 0 and __TS__ArraySome(
                towers,
                function(____, tw) return Dist(tw, p) <= TOWER_SAFE end
            ) then
                wait = wait * 0.5
            end
            if wait > worst then
                worst = wait
            end
        end
        cost = cost + DANGER_WEIGHT * worst
    end
    return cost
end
local function Passable(p)
    return IsLocationPassable(p)
end
--- Candidate routes home, cheapest first.
function ____exports.Routes(bot, threats)
    local here = bot:GetLocation()
    local home = jmz.GetTeamFountain()
    local speed = math.max(
        bot:GetCurrentMovementSpeed(),
        200
    )
    local towerUnits = OurTowers()
    local towers = __TS__ArrayMap(
        towerUnits,
        function(____, t) return t:GetLocation() end
    )
    local homeDist = Dist(here, home)
    local out = {}
    local function add(kind, via)
        local ____array_0 = __TS__SparseArrayNew(unpack(via))
        __TS__SparseArrayPush(____array_0, home)
        local points = {__TS__SparseArraySpread(____array_0)}
        out[#out + 1] = {
            kind = kind,
            points = points,
            cost = ____exports.Cost(
                here,
                points,
                speed,
                threats,
                towers
            )
        }
    end
    add("direct", {})
    for ____, t in ipairs(towers) do
        do
            local __continue33
            repeat
                if Dist(here, t) > TOWER_RANGE or Dist(t, home) >= homeDist then
                    __continue33 = true
                    break
                end
                if Dist(here, t) < WAYPOINT_DONE then
                    __continue33 = true
                    break
                end
                add("tower", {t})
                __continue33 = true
            until true
            if not __continue33 then
                break
            end
        end
    end
    local dx = (home.x - here.x) / math.max(homeDist, 1)
    local dy = (home.y - here.y) / math.max(homeDist, 1)
    for ____, side in ipairs({SIDE_NEAR, -SIDE_NEAR, SIDE_FAR, -SIDE_FAR}) do
        local p = Vector(here.x + dx * SIDE_AHEAD - dy * side, here.y + dy * SIDE_AHEAD + dx * side, here.z)
        if Passable(p) then
            add("side", {p})
        end
    end
    for ____, a in ipairs(GetUnitList(UnitType.AlliedHeroes)) do
        do
            local __continue40
            repeat
                if a == nil or a:IsNull() or not a:IsAlive() or a:IsIllusion() or a == bot then
                    __continue40 = true
                    break
                end
                if jmz.GetHP(a) < ALLY_MIN_HP or jmz.IsRetreating(a) then
                    __continue40 = true
                    break
                end
                local loc = a:GetLocation()
                if Dist(here, loc) > ALLY_RANGE or Dist(here, loc) < WAYPOINT_DONE then
                    __continue40 = true
                    break
                end
                add("ally", {loc})
                __continue40 = true
            until true
            if not __continue40 then
                break
            end
        end
    end
    __TS__ArraySort(
        out,
        function(____, x, y) return x.cost - y.cost end
    )
    return out
end
local function Log(bot, route, direct, threats)
    if not Utils.DebugMode then
        return
    end
    print((((((((((((("ESCAPE team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(DotaTime()))) .. " hero=") .. Short(bot)) .. " route=") .. route.kind) .. " cost=") .. tostring(math.floor(route.cost * 10) / 10)) .. " direct=") .. tostring(math.floor(direct * 10) / 10)) .. " threats=") .. tostring(threats))
end
--- Where to walk now, or null to walk straight home.
function ____exports.Next(bot)
    local id = bot:GetPlayerID()
    local st = states[id]
    if st == nil then
        st = {route = nil, plannedAt = -999, loggedKind = "direct"}
        states[id] = st
    end
    local now = DotaTime()
    if bot:DistanceFromFountain() <= HOME then
        st.route = nil
        return nil
    end
    if st.route ~= nil then
        while #st.route.points > 1 and Dist(
            bot:GetLocation(),
            st.route.points[1]
        ) <= WAYPOINT_DONE do
            table.remove(st.route.points, 1)
        end
    end
    if now - st.plannedAt >= PLAN or st.route == nil then
        st.plannedAt = now
        local threats = Threats(bot)
        if #threats == 0 then
            st.route = nil
            st.loggedKind = "direct"
            return nil
        end
        local routes = ____exports.Routes(bot, threats)
        local best = routes[1]
        local keep = false
        if st.route ~= nil and #st.route.points > 1 then
            local speed = math.max(
                bot:GetCurrentMovementSpeed(),
                200
            )
            local towers = __TS__ArrayMap(
                OurTowers(),
                function(____, t) return t:GetLocation() end
            )
            local current = ____exports.Cost(
                bot:GetLocation(),
                st.route.points,
                speed,
                threats,
                towers
            )
            st.route.cost = current
            keep = current <= best.cost * KEEP_FACTOR + KEEP_MARGIN
        end
        if not keep then
            st.route = {
                kind = best.kind,
                points = __TS__ArraySlice(best.points),
                cost = best.cost
            }
        end
        local route = st.route
        if route.kind ~= st.loggedKind then
            local direct = __TS__ArrayFind(
                routes,
                function(____, r) return r.kind == "direct" end
            )
            Log(bot, route, direct ~= nil and direct.cost or 0, #threats)
            st.loggedKind = route.kind
        end
    end
    return st.route ~= nil and st.route.points[1] or nil
end
--- Retreat Think: walk the chosen route, or straight to the fountain. Returns true (the caller's SafeCall reads nil as an error).
function ____exports.Think(bot)
    if jmz.CanNotUseAction(bot) then
        return true
    end
    local next = ____exports.Next(bot)
    bot:Action_MoveToLocation(next ~= nil and next or jmz.GetTeamFountain())
    return true
end
return ____exports
