--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local Tower = ____dota.Tower
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local DANGER_RADIUS = 1300
local SEEN_TIME = 3
local MIN_ENEMIES = 2
local MIN_ENEMIES_LANING = 3
local BLOCK_TIME = 10
local BLOCK_RADIUS = 1500
local FOUNTAIN_RADIUS = 2500
local BUILDING_RADIUS = 1300
local LOG_GAP = 3
local TP_ITEMS = {item_tpscroll = true, item_travel_boots = true, item_travel_boots_2 = true}
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
local function Fmt(v)
    return (tostring(math.floor(v.x)) .. ",") .. tostring(math.floor(v.y))
end
local function StateOf(bot)
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local s = states[key]
    if s == nil then
        s = {
            dest = nil,
            castAt = -999,
            blockedLoc = nil,
            blockedUntil = -999,
            lastLog = -999
        }
        states[key] = s
    end
    return s
end
--- Enemy heroes alive and seen near `loc` in the last SEEN_TIME s (visible or just out of vision).
local function EnemiesNear(loc, radius)
    local n = 0
    for ____, id in ipairs(GetTeamPlayers(GetOpposingTeam())) do
        do
            local __continue7
            repeat
                if not IsHeroAlive(id) then
                    __continue7 = true
                    break
                end
                local info = GetHeroLastSeenInfo(id)
                local seen = info ~= nil and info ~= nil and info[1] or nil
                if seen == nil or seen.time_since_seen > SEEN_TIME then
                    __continue7 = true
                    break
                end
                if Dist(seen.location, loc) <= radius then
                    n = n + 1
                end
                __continue7 = true
            until true
            if not __continue7 then
                break
            end
        end
    end
    return n
end
local function AlliesNear(bot, loc, radius)
    local n = 0
    for ____, ally in ipairs(GetUnitList(UnitType.AlliedHeroes)) do
        do
            local __continue13
            repeat
                if ally == nil or ally:IsNull() or not ally:IsAlive() or ally:IsIllusion() or ally == bot then
                    __continue13 = true
                    break
                end
                if jmz.IsMeepoClone(ally) then
                    __continue13 = true
                    break
                end
                if Dist(
                    ally:GetLocation(),
                    loc
                ) <= radius then
                    n = n + 1
                end
                __continue13 = true
            until true
            if not __continue13 then
                break
            end
        end
    end
    return n
end
local function BuildingsNear(loc)
    local n = 0
    for ____, id in ipairs(TOWERS) do
        local t = GetTower(
            GetTeam(),
            id
        )
        if t ~= nil and t ~= nil and not t:IsNull() and t:IsAlive() and Dist(
            t:GetLocation(),
            loc
        ) <= BUILDING_RADIUS then
            n = n + 1
        end
    end
    local ancient = GetAncient(GetTeam())
    if ancient ~= nil and ancient ~= nil and Dist(
        ancient:GetLocation(),
        loc
    ) <= BUILDING_RADIUS + 400 then
        n = n + 1
    end
    return n
end
--- [lost fight, text for the log].
local function LostFight(bot, dest)
    if Dist(
        dest,
        jmz.GetTeamFountain()
    ) <= FOUNTAIN_RADIUS then
        return {false, ""}
    end
    local enemies = EnemiesNear(dest, DANGER_RADIUS)
    if enemies < (jmz.IsInLaningPhase() and MIN_ENEMIES_LANING or MIN_ENEMIES) then
        return {false, ""}
    end
    local allies = AlliesNear(bot, dest, DANGER_RADIUS)
    local buildings = BuildingsNear(dest)
    if enemies <= allies + 1 + buildings then
        return {false, ""}
    end
    local loc = bot:GetLocation()
    local here = EnemiesNear(loc, DANGER_RADIUS) - AlliesNear(bot, loc, DANGER_RADIUS) - 1
    local there = enemies - allies - 1 - buildings
    if here >= there then
        return {false, ""}
    end
    return {
        true,
        (((((((("dest=" .. Fmt(dest)) .. " enemies=") .. tostring(enemies)) .. " allies=") .. tostring(allies)) .. " buildings=") .. tostring(buildings)) .. " here=") .. tostring(here)
    }
end
--- Skips are throttled (Blocked runs every item-usage tick); cancels always print.
local function Log(bot, s, text, always)
    if not Utils.DebugMode then
        return
    end
    local now = DotaTime()
    if not always and now - s.lastLog < LOG_GAP then
        return
    end
    s.lastLog = now
    print((((((("TPCANCEL team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(now))) .. " ") .. text)
end
function ____exports.IsTp(itemName)
    return TP_ITEMS[itemName] == true
end
--- Remember where this bot's TP goes (call when the cast order is given).
function ____exports.Record(bot, dest)
    local s = StateOf(bot)
    s.dest = dest
    s.castAt = DotaTime()
end
--- Do not start a TP to `dest`: it was cancelled there just now, or it is a lost fight already.
function ____exports.Blocked(bot, itemName, dest)
    if not ____exports.IsTp(itemName) or dest == nil or dest == nil or dest.x == nil then
        return false
    end
    local s = StateOf(bot)
    if s.blockedLoc ~= nil and DotaTime() < s.blockedUntil and Dist(s.blockedLoc, dest) <= BLOCK_RADIUS then
        return true
    end
    local lost = LostFight(bot, dest)
    if lost[1] then
        Log(bot, s, "action=skip " .. lost[2], false)
        return true
    end
    return false
end
--- Every frame: cancel this bot's TP channel when it would land in a lost fight. True when it cancelled.
function ____exports.Check(bot)
    local s = StateOf(bot)
    if s.dest == nil then
        return false
    end
    if not bot:HasModifier("modifier_teleporting") then
        if DotaTime() - s.castAt > 1 then
            s.dest = nil
        end
        return false
    end
    local lost = LostFight(bot, s.dest)
    if not lost[1] then
        return false
    end
    Log(bot, s, "action=cancel " .. lost[2], true)
    s.blockedLoc = s.dest
    s.blockedUntil = DotaTime() + BLOCK_TIME
    s.dest = nil
    bot:Action_ClearActions(true)
    return true
end
return ____exports
