--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
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
return ____exports
