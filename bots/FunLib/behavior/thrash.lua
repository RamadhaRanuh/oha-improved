--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local function __TS__Number(value)
    local valueType = type(value)
    if valueType == "number" then
        return value
    elseif valueType == "string" then
        local numberValue = tonumber(value)
        if numberValue then
            return numberValue
        end
        if value == "Infinity" then
            return math.huge
        end
        if value == "-Infinity" then
            return -math.huge
        end
        local stringWithoutSpaces = string.gsub(value, "%s", "")
        if stringWithoutSpaces == "" then
            return 0
        end
        return 0 / 0
    elseif valueType == "boolean" then
        return value and 1 or 0
    else
        return 0 / 0
    end
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
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local ____team_brain = require(GetScriptDirectory().."/FunLib/behavior/team_brain")
local DescribeForDebug = ____team_brain.DescribeForDebug
local REPORT_EVERY = 60
local function ModeName(mode)
    local name = BotMode[mode]
    return name ~= nil and string.lower(name) or tostring(mode)
end
local function DescribeModes(track, seconds)
    local parts = {}
    local modes = {}
    for key in pairs(track.time) do
        modes[#modes + 1] = __TS__Number(key)
    end
    __TS__ArraySort(
        modes,
        function(____, a, b) return track.time[b] - track.time[a] end
    )
    for ____, mode in ipairs(modes) do
        parts[#parts + 1] = ((ModeName(mode) .. "=") .. tostring(math.floor(100 * track.time[mode] / math.max(seconds, 1)))) .. "%"
    end
    local ____pairs = {}
    for key in pairs(track.switches) do
        ____pairs[#____pairs + 1] = key
    end
    __TS__ArraySort(
        ____pairs,
        function(____, a, b) return track.switches[b] - track.switches[a] end
    )
    local top = {}
    do
        local i = 0
        while i < #____pairs and i < 4 do
            top[#top + 1] = (____pairs[i + 1] .. ":") .. tostring(track.switches[____pairs[i + 1]])
            i = i + 1
        end
    end
    return (table.concat(parts, " ") .. " top=") .. table.concat(top, ",")
end
--- Keyed by player id and unit name: Lone Druid's bear shares the hero's player id.
local tracks = {}
local brainReportAt = {}
function ____exports.Observe(bot)
    if not Utils.DebugMode then
        return
    end
    local now = DotaTime()
    if now < 0 then
        return
    end
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local mode = bot:GetActiveMode()
    local track = tracks[key]
    if track == nil then
        tracks[key] = {
            mode = mode,
            changes = 0,
            since = now,
            lastObserved = now,
            time = {},
            switches = {}
        }
        return
    end
    track.time[track.mode] = (track.time[track.mode] or 0) + (now - track.lastObserved)
    track.lastObserved = now
    if mode ~= track.mode then
        track.changes = track.changes + 1
        local pair = (ModeName(track.mode) .. ">") .. ModeName(mode)
        track.switches[pair] = (track.switches[pair] or 0) + 1
        track.mode = mode
    end
    if now - track.since >= REPORT_EVERY then
        local seconds = math.floor(now - track.since)
        print((((((("THRASH team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " changes=") .. tostring(track.changes)) .. " seconds=") .. tostring(seconds))
        print((((((((((("MODES team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " lh=") .. tostring(bot:GetLastHits())) .. " dn=") .. tostring(bot:GetDenies())) .. " nw=") .. tostring(bot:GetNetWorth())) .. " ") .. DescribeModes(track, now - track.since))
        track.changes = 0
        track.since = now
        track.time = {}
        track.switches = {}
    end
    local team = GetTeam()
    local last = brainReportAt[team]
    if last == nil or now - last >= REPORT_EVERY then
        brainReportAt[team] = now
        print((("BRAIN team=" .. tostring(team)) .. " ") .. DescribeForDebug())
    end
end
return ____exports
