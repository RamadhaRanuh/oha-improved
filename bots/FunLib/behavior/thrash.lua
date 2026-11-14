--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
local ____exports = {}
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local ____team_brain = require(GetScriptDirectory().."/FunLib/behavior/team_brain")
local DescribeForDebug = ____team_brain.DescribeForDebug
local REPORT_EVERY = 60
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
        tracks[key] = {mode = mode, changes = 0, since = now}
        return
    end
    if mode ~= track.mode then
        track.changes = track.changes + 1
        track.mode = mode
    end
    if now - track.since >= REPORT_EVERY then
        print((((((("THRASH team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " changes=") .. tostring(track.changes)) .. " seconds=") .. tostring(math.floor(now - track.since)))
        track.changes = 0
        track.since = now
    end
    local team = GetTeam()
    local last = brainReportAt[team]
    if last == nil or now - last >= REPORT_EVERY then
        brainReportAt[team] = now
        print((("BRAIN team=" .. tostring(team)) .. " ") .. DescribeForDebug())
    end
end
return ____exports
