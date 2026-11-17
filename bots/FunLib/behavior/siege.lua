--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
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
-- End of Lua Library inline imports
local ____exports = {}
local Holding, ENEMY_FEW, HOLD_LEAD
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local Barracks = ____dota.Barracks
local Lane = ____dota.Lane
local Tower = ____dota.Tower
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local ____flags = require(GetScriptDirectory().."/FunLib/behavior/flags")
local Tuned = ____flags.Tuned
function Holding()
    local allies = jmz.GetNumOfAliveHeroes(false)
    local enemies = jmz.GetNumOfAliveHeroes(true)
    return allies - enemies >= HOLD_LEAD or enemies <= ENEMY_FEW or jmz.DoesTeamHaveAegis() and allies >= enemies
end
local ROSHAN_FIRST_TIME = Tuned("roshan_first_time", 20 * 60)
local NUMBERS_LEAD = 2
ENEMY_FEW = 2
local T1 = {[Lane.Top] = Tower.Top1, [Lane.Mid] = Tower.Mid1, [Lane.Bot] = Tower.Bot1}
local T2 = {[Lane.Top] = Tower.Top2, [Lane.Mid] = Tower.Mid2, [Lane.Bot] = Tower.Bot2}
local LANES = {Lane.Top, Lane.Mid, Lane.Bot}
local LANE_NAMES = {[Lane.Top] = "top", [Lane.Mid] = "mid", [Lane.Bot] = "bot"}
--- Whether the enemy tower stands. Not jmz.IsValidBuilding: that also needs the tower visible and not
-- invulnerable, so out-of-vision towers and tier-2s still protected by their tier-1 read as down, and
-- every lane was "high ground" from 15:00 (quick test 9089566083: all pushes held, game lost).
local function TowerUp(id)
    local tower = GetTower(
        GetOpposingTeam(),
        id
    )
    return tower ~= nil and tower ~= nil and not tower:IsNull() and tower:IsAlive()
end
--- The enemy tier-1 and tier-2 towers in `lane` are down: the next push target is on high ground.
function ____exports.LaneAtHighGround(lane)
    if T1[lane] == nil then
        return false
    end
    return not TowerUp(T1[lane]) and not TowerUp(T2[lane])
end
function ____exports.AnyLaneAtHighGround()
    return __TS__ArraySome(
        LANES,
        function(____, l) return ____exports.LaneAtHighGround(l) end
    )
end
local cacheAt = -999
local cacheOpen = false
local cacheWhy = ""
--- Whether we have the numbers (or the Aegis) to go up high ground, and why. Cached 0.5 s.
function ____exports.HighGroundOpen()
    local now = DotaTime()
    if now - cacheAt < 0.5 then
        return {cacheOpen, cacheWhy}
    end
    local allies = jmz.GetNumOfAliveHeroes(false)
    local enemies = jmz.GetNumOfAliveHeroes(true)
    local aegis = jmz.DoesTeamHaveAegis()
    if allies - enemies >= NUMBERS_LEAD then
        cacheOpen = true
        cacheWhy = (("lead" .. tostring(allies)) .. "v") .. tostring(enemies)
    elseif enemies <= ENEMY_FEW then
        cacheOpen = true
        cacheWhy = (("few" .. tostring(allies)) .. "v") .. tostring(enemies)
    elseif aegis and allies >= enemies then
        cacheOpen = true
        cacheWhy = (("aegis" .. tostring(allies)) .. "v") .. tostring(enemies)
    else
        cacheOpen = false
        cacheWhy = (("numbers" .. tostring(allies)) .. "v") .. tostring(enemies)
    end
    cacheAt = now
    return {cacheOpen, cacheWhy}
end
--- Push into `lane` is held back: it is at high ground and high ground is closed.
function ____exports.PushBlocked(lane)
    if not ____exports.LaneAtHighGround(lane) then
        return false
    end
    return not ____exports.HighGroundOpen()[1]
end
--- Take Roshan before going up: see the module comment.
function ____exports.RoshanFirst()
    if DotaTime() < ROSHAN_FIRST_TIME() or not ____exports.AnyLaneAtHighGround() then
        return false
    end
    if ____exports.HighGroundOpen()[1] or jmz.DoesTeamHaveAegis() or not jmz.IsRoshanAlive() then
        return false
    end
    return jmz.GetNumOfAliveHeroes(false) >= jmz.GetNumOfAliveHeroes(true)
end
local reportAt = -999
--- Debug line, at most once a game minute per team (one VM per team).
function ____exports.Report()
    if not Utils.DebugMode then
        return
    end
    local now = DotaTime()
    if now - reportAt < 60 then
        return
    end
    reportAt = now
    local hg = __TS__ArrayMap(
        __TS__ArrayFilter(
            LANES,
            function(____, l) return ____exports.LaneAtHighGround(l) end
        ),
        function(____, l) return LANE_NAMES[l] end
    )
    if #hg == 0 then
        return
    end
    local gate = ____exports.HighGroundOpen()
    print((((((((((((("SIEGE team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(now))) .. " hg=") .. table.concat(hg, ",")) .. " open=") .. tostring(gate[1])) .. " why=") .. gate[2]) .. " roshanFirst=") .. tostring(____exports.RoshanFirst())) .. " aegis=") .. tostring(jmz.DoesTeamHaveAegis()))
end
____exports.COMMIT_DESIRE = 0.85
____exports.COMMIT_MIN_HP = 0.35
local GATHER_BACK = -1200
local GATHER_RADIUS = 1600
local GATHER_COUNT = 3
local GATHER_TIMEOUT = 25
HOLD_LEAD = 1
local BARRACKS = {
    Barracks.TopMelee,
    Barracks.TopRanged,
    Barracks.MidMelee,
    Barracks.MidRanged,
    Barracks.BotMelee,
    Barracks.BotRanged
}
local commitLane = nil
local commitAt = -999
local commitWhy = ""
local gathered = false
local commitCheckedAt = -999
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function Progress()
    local rax = 0
    for ____, id in ipairs(BARRACKS) do
        local b = GetBarracks(
            GetOpposingTeam(),
            id
        )
        if b ~= nil and b ~= nil and not b:IsNull() and b:IsAlive() then
            rax = rax + 1
        end
    end
    local anc = GetAncient(GetOpposingTeam())
    local seen = anc ~= nil and not anc:IsNull() and anc:CanBeSeen() and anc:GetHealth() >= 0
    return (("rax=" .. tostring(rax)) .. " anc=") .. tostring(seen and math.floor(anc:GetHealth() / anc:GetMaxHealth() * 100) / 100 or "?")
end
local function LiveAllies()
    return __TS__ArrayFilter(
        GetUnitList(UnitType.AlliedHeroes),
        function(____, h) return h ~= nil and not h:IsNull() and h:IsAlive() and not h:IsIllusion() and not jmz.IsMeepoClone(h) and h:IsHero() end
    )
end
--- The high-ground lane nearest our living heroes: everyone goes to the same one.
local function PickLane()
    local allies = LiveAllies()
    local best = nil
    local bestDist = 99999
    for ____, lane in ipairs(LANES) do
        do
            local __continue32
            repeat
                if not ____exports.LaneAtHighGround(lane) then
                    __continue32 = true
                    break
                end
                local front = GetLaneFrontLocation(
                    GetTeam(),
                    lane,
                    0
                )
                local sum = 0
                for ____, a in ipairs(allies) do
                    sum = sum + Dist(
                        a:GetLocation(),
                        front
                    )
                end
                local d = #allies > 0 and sum / #allies or 0
                if d < bestDist then
                    bestDist = d
                    best = lane
                end
                __continue32 = true
            until true
            if not __continue32 then
                break
            end
        end
    end
    return best
end
--- The lane the team commits to now, or null. Updated at most every 0.5 s (one VM per team).
function ____exports.CommitLane()
    local now = DotaTime()
    if now - commitCheckedAt < 0.5 then
        return commitLane
    end
    commitCheckedAt = now
    local gate = ____exports.HighGroundOpen()
    local stillOk = commitLane ~= nil and ____exports.LaneAtHighGround(commitLane)
    local holding = commitLane ~= nil and stillOk and Holding()
    if (gate[1] or holding) and (stillOk or ____exports.AnyLaneAtHighGround()) then
        if commitLane == nil or not stillOk then
            commitLane = PickLane()
            if commitLane ~= nil then
                commitAt = now
                commitWhy = gate[2]
                gathered = false
                if Utils.DebugMode then
                    print((((((((("SIEGEGO team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(now))) .. " start lane=") .. LANE_NAMES[commitLane]) .. " why=") .. commitWhy) .. " ") .. Progress())
                end
            end
        end
    elseif commitLane ~= nil then
        if Utils.DebugMode then
            print((((((((((((("SIEGEGO team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(now))) .. " end lane=") .. LANE_NAMES[commitLane]) .. " why=") .. gate[2]) .. " dur=") .. tostring(math.floor(now - commitAt))) .. " gathered=") .. tostring(gathered)) .. " ") .. Progress())
        end
        commitLane = nil
    end
    return commitLane
end
--- Where the team meets before going up: behind our lane front in the committed lane.
function ____exports.GatherPoint(lane)
    return GetLaneFrontLocation(
        GetTeam(),
        lane,
        GATHER_BACK
    )
end
--- Whether enough heroes met at the gather point (sticky for the window), or it took too long.
function ____exports.Gathered(lane)
    if gathered then
        return true
    end
    local point = ____exports.GatherPoint(lane)
    local allies = LiveAllies()
    local need = math.min(GATHER_COUNT, #allies)
    local here = 0
    for ____, a in ipairs(allies) do
        if Dist(
            a:GetLocation(),
            point
        ) <= GATHER_RADIUS then
            here = here + 1
        end
    end
    if here >= need or DotaTime() - commitAt > GATHER_TIMEOUT then
        gathered = true
        if Utils.DebugMode then
            print((((((((("SIEGEGO team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(DotaTime()))) .. " gathered lane=") .. LANE_NAMES[lane]) .. " here=") .. tostring(here)) .. "/") .. tostring(#allies))
        end
    end
    return gathered
end
return ____exports
