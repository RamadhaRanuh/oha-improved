--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
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
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local Rng = require(GetScriptDirectory().."/FunLib/behavior/rng")
local WINDOW = 300
local DEATHS_IN_WINDOW = 2
local DEATHS_TOTAL = 3
local LANE_DEATH_DIST = 2500
local CHANCE = {
    [1] = 0.4,
    [2] = 0.3,
    [3] = 0.6,
    [4] = 0,
    [5] = 0
}
local MIN_LEVEL = 6
local MIN_START = 6 * 60
local BEHIND_LEVELS = 2
local LARGE_LEVEL = 7
local MIN_TIME = 90
local REROLL_TIME = 240
local SAFE_HP = 0.7
local LEVEL_MEMORY = 60
local EMPTY_TIME = 20
local LANE_RADIUS = 2000
local VISION_RADIUS = 1500
____exports.JUNGLE_DESIRE = 0.6
local states = {}
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function Log(bot, text)
    if Utils.DebugMode then
        print((((((("JUNGLE team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(DotaTime()))) .. " ") .. text)
    end
end
local function StateOf(bot)
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local s = states[key]
    if s == nil then
        s = {
            deaths = GetHeroDeaths(bot:GetPlayerID()),
            laneDeaths = {},
            lastAliveLoc = nil,
            active = false,
            startAt = -999,
            rollAt = -999,
            lane = bot:GetAssignedLane(),
            laneSeenAt = -999,
            laneLevels = {}
        }
        states[key] = s
    end
    return s
end
local function NearLane(loc, lane)
    do
        local i = 0
        while i <= 20 do
            if Dist(
                loc,
                GetLocationAlongLane(lane, i * 0.05)
            ) <= LANE_DEATH_DIST then
                return true
            end
            i = i + 1
        end
    end
    return false
end
local function Chance(bot)
    local c = CHANCE[jmz.GetPosition(bot)]
    return c == nil and 0 or c
end
--- Remember the enemy heroes seen in our lane (by anyone on the team) and their levels.
local function WatchLane(s)
    local now = DotaTime()
    local front = GetLaneFrontLocation(
        GetTeam(),
        s.lane,
        0
    )
    for ____, enemy in ipairs(GetUnitList(UnitType.EnemyHeroes)) do
        do
            local __continue12
            repeat
                if not jmz.IsValidHero(enemy) or jmz.IsSuspiciousIllusion(enemy) then
                    __continue12 = true
                    break
                end
                if Dist(
                    enemy:GetLocation(),
                    front
                ) > LANE_RADIUS then
                    __continue12 = true
                    break
                end
                s.laneSeenAt = now
                s.laneLevels[enemy:GetUnitName()] = {
                    enemy:GetLevel(),
                    now
                }
                __continue12 = true
            until true
            if not __continue12 then
                break
            end
        end
    end
end
local function LaneMaxLevel(s)
    local now = DotaTime()
    local max = -1
    for name in pairs(s.laneLevels) do
        local entry = s.laneLevels[name]
        if now - entry[2] <= LEVEL_MEMORY and entry[1] > max then
            max = entry[1]
        end
    end
    return max
end
local function LaneWatched(bot, s)
    local front = GetLaneFrontLocation(
        GetTeam(),
        s.lane,
        0
    )
    for ____, ally in ipairs(jmz.GetAlliesNearLoc(front, VISION_RADIUS)) do
        if ally ~= bot then
            return true
        end
    end
    return false
end
local function Stop(bot, s, reason)
    s.active = false
    Log(
        bot,
        (((((("result=end reason=" .. reason) .. " lvl=") .. tostring(bot:GetLevel())) .. " laneMax=") .. tostring(LaneMaxLevel(s))) .. " hp=") .. tostring(math.floor(jmz.GetHP(bot) * 100) / 100)
    )
end
--- Track deaths; roll to start jungling after too many lane deaths.
local function OnDeaths(bot, s)
    local now = DotaTime()
    local deaths = GetHeroDeaths(bot:GetPlayerID())
    if deaths <= s.deaths then
        return
    end
    s.deaths = deaths
    if not jmz.IsInLaningPhase() then
        return
    end
    if s.lastAliveLoc ~= nil and NearLane(s.lastAliveLoc, s.lane) then
        local ____s_laneDeaths_0 = s.laneDeaths
        ____s_laneDeaths_0[#____s_laneDeaths_0 + 1] = now
    end
    if s.active then
        Stop(bot, s, "died_jungling")
        return
    end
    local recent = #__TS__ArrayFilter(
        s.laneDeaths,
        function(____, t) return now - t <= WINDOW end
    )
    local total = #s.laneDeaths
    if recent < DEATHS_IN_WINDOW and total < DEATHS_TOTAL then
        return
    end
    local chance = Chance(bot)
    if chance <= 0 or bot:GetLevel() < MIN_LEVEL or now < MIN_START then
        return
    end
    local roll = Rng.Float(0, 1)
    local start = roll < chance
    Log(
        bot,
        (((((((((((((("roll=" .. tostring(math.floor(roll * 100) / 100)) .. " chance=") .. tostring(chance)) .. " result=") .. (start and "start" or "stay")) .. " deaths=") .. tostring(recent)) .. "/") .. tostring(WINDOW)) .. "s,") .. tostring(total)) .. " lane=") .. tostring(s.lane)) .. " lvl=") .. tostring(bot:GetLevel())
    )
    if start then
        s.active = true
        s.startAt = now
        s.rollAt = now
    end
end
--- Call every frame (farm mode GetDesire). Returns JUNGLE_DESIRE while this bot should jungle, else 0.
function ____exports.Desire(bot)
    if bot:IsIllusion() then
        return 0
    end
    local s = StateOf(bot)
    if bot:IsAlive() then
        s.lastAliveLoc = bot:GetLocation()
    end
    OnDeaths(bot, s)
    if not s.active then
        return 0
    end
    WatchLane(s)
    local now = DotaTime()
    if not jmz.IsInLaningPhase() then
        Stop(bot, s, "laning_over")
        return 0
    end
    if not bot:IsAlive() then
        return ____exports.JUNGLE_DESIRE
    end
    if now - s.startAt >= MIN_TIME then
        local laneMax = LaneMaxLevel(s)
        if laneMax > 0 and bot:GetLevel() <= laneMax - BEHIND_LEVELS then
            Stop(bot, s, "falling_behind")
            return 0
        end
        if laneMax > 0 and bot:GetLevel() >= laneMax and jmz.GetHP(bot) > SAFE_HP then
            Stop(bot, s, "caught_up")
            return 0
        end
        if LaneWatched(bot, s) and now - s.laneSeenAt > EMPTY_TIME then
            Stop(bot, s, "lane_empty")
            return 0
        end
    end
    if now - s.rollAt >= REROLL_TIME then
        s.rollAt = now
        local roll = Rng.Float(0, 1)
        if roll >= Chance(bot) then
            Stop(bot, s, "reroll")
            return 0
        end
        Log(
            bot,
            "result=keep roll=" .. tostring(math.floor(roll * 100) / 100)
        )
    end
    return ____exports.JUNGLE_DESIRE
end
--- Whether this bot is jungling now (laning mode steps aside).
function ____exports.Active(bot)
    local s = states[(tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()]
    return s ~= nil and s.active
end
--- Camps an early jungler can take: our own small and medium camps, large ones from LARGE_LEVEL.
function ____exports.Camps(bot, all)
    local level = bot:GetLevel()
    return __TS__ArrayFilter(
        all,
        function(____, camp)
            local c = camp.cattr
            if c == nil or c.team ~= GetTeam() then
                return false
            end
            return c.type == "small" or c.type == "medium" or c.type == "large" and level >= LARGE_LEVEL
        end
    )
end
--- Where to wait for a respawn when every camp is cleared: beside the nearest own camp, never inside it.
function ____exports.WaitSpot(bot, camps)
    local best = nil
    local bestDist = 99999
    for ____, camp in ipairs(camps) do
        local loc = camp.cattr.location
        local d = Dist(
            bot:GetLocation(),
            loc
        )
        if d < bestDist then
            bestDist = d
            best = loc
        end
    end
    if best == nil then
        return nil
    end
    local home = GetAncient(GetTeam()):GetLocation()
    local len = math.max(
        Dist(best, home),
        1
    )
    return Vector(best.x + (home.x - best.x) / len * 450, best.y + (home.y - best.y) / len * 450, best.z)
end
return ____exports
