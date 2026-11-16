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
local Utils = require(GetScriptDirectory().."/FunLib/utils")
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
            local __continue4
            repeat
                if raw == nil or raw == nil then
                    __continue4 = true
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
                    __continue4 = true
                    break
                end
                out[#out + 1] = {
                    centre = centre,
                    type = tostring(raw.type),
                    team = raw.team,
                    raw = raw
                }
                __continue4 = true
            until true
            if not __continue4 then
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
return ____exports
