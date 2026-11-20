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
-- End of Lua Library inline imports
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local Rng = require(GetScriptDirectory().."/FunLib/behavior/rng")
local LOCKED = 0.9
local FLOOR = 0.05
local MAX_PER_PERSONA = 2
--- retreat < 1: stays in fights longer. farm > 1: farms longer, joins fights late.
-- gank: team roam (ganks, joining a teammate's fight). push / defend: tower modes.
____exports.PERSONAS = {
    greedy = {
        retreat = 1.05,
        farm = 1.2,
        gank = 0.7,
        push = 0.9,
        defend = 0.85,
        rune = 0.9,
        ward = 1,
        roshan = 0.9
    },
    playmaker = {
        retreat = 0.9,
        farm = 0.85,
        gank = 1.3,
        push = 1,
        defend = 1,
        rune = 1.25,
        ward = 1,
        roshan = 1.1
    },
    bully = {
        retreat = 0.85,
        farm = 0.95,
        gank = 1.1,
        push = 1.15,
        defend = 0.95,
        rune = 1,
        ward = 1,
        roshan = 1.05
    },
    guardian = {
        retreat = 1.15,
        farm = 0.9,
        gank = 1,
        push = 0.95,
        defend = 1.15,
        rune = 1,
        ward = 1.3,
        roshan = 1
    },
    hothead = {
        retreat = 0.85,
        farm = 1,
        gank = 1.15,
        push = 1.1,
        defend = 0.9,
        rune = 1.05,
        ward = 0.9,
        roshan = 1.1
    }
}
--- Draw weights by position (1-5).
local WEIGHTS = {
    [1] = {greedy = 5, hothead = 2, playmaker = 1, bully = 1},
    [2] = {playmaker = 4, hothead = 3, greedy = 2, bully = 1},
    [3] = {bully = 5, hothead = 2, playmaker = 2, guardian = 1},
    [4] = {playmaker = 4, bully = 2, guardian = 2, hothead = 2},
    [5] = {guardian = 5, playmaker = 2, hothead = 1, bully = 1}
}
local ORDER = {
    "greedy",
    "playmaker",
    "bully",
    "guardian",
    "hothead"
}
--- Module state is per team: each team has its own Lua state. Keyed by player id.
local assigned = {}
local taken = {}
local function Draw(pos)
    local weights = WEIGHTS[pos] or WEIGHTS[3]
    local total = 0
    for ____, p in ipairs(ORDER) do
        local w = weights[p] or 0
        if w > 0 and (taken[p] or 0) < MAX_PER_PERSONA then
            total = total + w
        end
    end
    if total <= 0 then
        return ORDER[Rng.Int(0, #ORDER - 1) + 1]
    end
    local roll = Rng.Float(0, total)
    for ____, p in ipairs(ORDER) do
        do
            local __continue7
            repeat
                local w = weights[p] or 0
                if w <= 0 or (taken[p] or 0) >= MAX_PER_PERSONA then
                    __continue7 = true
                    break
                end
                if roll < w then
                    return p
                end
                roll = roll - w
                __continue7 = true
            until true
            if not __continue7 then
                break
            end
        end
    end
    return ORDER[1]
end
--- The bot's persona, drawn on first use.
function ____exports.Get(bot)
    local id = bot:GetPlayerID()
    local have = assigned[id]
    if have ~= nil then
        return have
    end
    local pos = jmz.GetPosition(bot)
    local p = Draw(pos)
    assigned[id] = p
    taken[p] = (taken[p] or 0) + 1
    if Utils.DebugMode then
        print((((((("PERSONA team=" .. tostring(GetTeam())) .. " hero=") .. __TS__StringReplace(
            bot:GetUnitName(),
            "npc_dota_hero_",
            ""
        )) .. " pos=") .. tostring(pos)) .. " persona=") .. p)
    end
    return p
end
--- The knob a mode answers to, or undefined for modes personas leave alone.
function ____exports.KnobOf(mode)
    repeat
        local ____switch15 = mode
        local ____cond15 = ____switch15 == BotMode.Retreat
        if ____cond15 then
            return "retreat"
        end
        ____cond15 = ____cond15 or ____switch15 == BotMode.Farm
        if ____cond15 then
            return "farm"
        end
        ____cond15 = ____cond15 or ____switch15 == BotMode.TeamRoam
        if ____cond15 then
            return "gank"
        end
        ____cond15 = ____cond15 or (____switch15 == BotMode.PushTowerTop or ____switch15 == BotMode.PushTowerMid or ____switch15 == BotMode.PushTowerBot)
        if ____cond15 then
            return "push"
        end
        ____cond15 = ____cond15 or (____switch15 == BotMode.DefendTowerTop or ____switch15 == BotMode.DefendTowerMid or ____switch15 == BotMode.DefendTowerBot)
        if ____cond15 then
            return "defend"
        end
        ____cond15 = ____cond15 or ____switch15 == BotMode.Rune
        if ____cond15 then
            return "rune"
        end
        ____cond15 = ____cond15 or ____switch15 == BotMode.Ward
        if ____cond15 then
            return "ward"
        end
        ____cond15 = ____cond15 or ____switch15 == BotMode.Roshan
        if ____cond15 then
            return "roshan"
        end
        do
            return nil
        end
    until true
end
--- Applies a multiplier to a raw desire within the limits in the header.
-- Exported for the mood module, which scales on top of the persona.
function ____exports.ApplyFactor(value, factor)
    if value >= LOCKED or value <= FLOOR or factor == 1 then
        return value
    end
    return math.min(value * factor, LOCKED - 0.01)
end
--- The persona factor of a bot for a mode (1 for modes personas leave alone).
function ____exports.Factor(bot, mode)
    local knob = ____exports.KnobOf(mode)
    if knob == nil then
        return 1
    end
    return ____exports.PERSONAS[____exports.Get(bot)][knob]
end
return ____exports
