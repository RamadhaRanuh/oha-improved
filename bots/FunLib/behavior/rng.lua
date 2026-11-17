--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
local ____exports = {}
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local MOD = 2147483647
local MUL = 16807
local state = 0
local function Seed()
    local ms = math.floor(RealTime() * 1000) + GetTeam() * 7919
    state = ms % (MOD - 1) + 1
    do
        local i = 0
        while i < 3 do
            state = state * MUL % MOD
            i = i + 1
        end
    end
    if Utils.DebugMode then
        print((("RNG team=" .. tostring(GetTeam())) .. " seed=") .. tostring(state))
    end
end
--- Uniform in [0, 1).
local function Next()
    if state == 0 then
        Seed()
    end
    state = state * MUL % MOD
    return (state - 1) / (MOD - 1)
end
--- Uniform in [min, max).
function ____exports.Float(min, max)
    return min + (max - min) * Next()
end
--- Uniform integer in [min, max], both included.
function ____exports.Int(min, max)
    return math.min(
        max,
        min + math.floor(Next() * (max - min + 1))
    )
end
function ____exports.Seeded(seed, salt)
    local s = math.abs(math.floor(seed * 7919 + salt * 104729)) % (MOD - 1) + 1
    do
        local i = 0
        while i < 3 do
            s = s * MUL % MOD
            i = i + 1
        end
    end
    local function step()
        s = s * MUL % MOD
        return (s - 1) / (MOD - 1)
    end
    return {
        Next = step,
        Float = function(min, max) return min + (max - min) * step() end,
        Int = function(min, max) return math.min(
            max,
            min + math.floor(step() * (max - min + 1))
        ) end
    }
end
--- A vector of length `length` in a random direction (as Valve's RandomVector).
function ____exports.Direction(length)
    local a = Next() * 2 * math.pi
    return Vector(
        math.cos(a) * length,
        math.sin(a) * length,
        0
    )
end
return ____exports
