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
-- End of Lua Library inline imports
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local Team = ____dota.Team
local Customize = require(GetScriptDirectory().."/Customize/general")
local cache = {}
function ____exports.IsOn(name)
    local team = GetTeam()
    local key = (tostring(team) .. ":") .. name
    local cached = cache[key]
    if cached ~= nil then
        return cached
    end
    local on = false
    local behavior = Customize.Behavior
    if behavior ~= nil then
        local ____temp_0
        if team == Team.Radiant then
            ____temp_0 = behavior.Radiant
        else
            ____temp_0 = behavior.Dire
        end
        local teamFlags = ____temp_0
        on = teamFlags ~= nil and teamFlags[name] == true
    end
    cache[key] = on
    return on
end
local tuneCache = {}
local tuneLogged = {}
local function TeamTune(team)
    local behavior = Customize.Behavior
    if behavior == nil then
        return nil
    end
    local ____temp_1
    if team == Team.Radiant then
        ____temp_1 = behavior.Radiant
    else
        ____temp_1 = behavior.Dire
    end
    local teamFlags = ____temp_1
    if teamFlags == nil or type(teamFlags.tune) ~= "table" then
        return nil
    end
    return teamFlags.tune
end
local function LogTune(team, tune)
    tuneLogged[team] = true
    local names = {}
    for k in pairs(tune) do
        names[#names + 1] = k
    end
    __TS__ArraySort(names)
    local text = ""
    for ____, k in ipairs(names) do
        text = text .. ((" " .. k) .. "=") .. tostring(tune[k])
    end
    print(("TUNE team=" .. tostring(team)) .. text)
end
function ____exports.Tune(name, def)
    local team = GetTeam()
    local key = (tostring(team) .. ":") .. name
    local cached = tuneCache[key]
    if cached ~= nil then
        return cached
    end
    local value = def
    local tune = TeamTune(team)
    if tune ~= nil then
        if tuneLogged[team] ~= true then
            LogTune(team, tune)
        end
        local v = tune[name]
        if type(v) == "number" then
            value = v
        end
    end
    tuneCache[key] = value
    return value
end
--- A Tune value as a getter that reads it once, on its first call, for sites that run every frame.
-- Module-level is per team: each team has its own Lua state (Phase 0 check P0-2).
function ____exports.Tuned(name, def)
    local value
    return function()
        if value == nil then
            value = ____exports.Tune(name, def)
        end
        return value
    end
end
return ____exports
