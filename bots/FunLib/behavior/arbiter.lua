--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local ____flags = require(GetScriptDirectory().."/FunLib/behavior/flags")
local IsOn = ____flags.IsOn
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Group = require(GetScriptDirectory().."/FunLib/behavior/group")
local Persona = require(GetScriptDirectory().."/FunLib/behavior/persona")
local Mood = require(GetScriptDirectory().."/FunLib/behavior/mood")
--- Errors in the group cap print once each and leave the desire unchanged.
local groupErrors = {}
--- Added to the running mode's desire so it must be beaten clearly before it is replaced. Tunable.
-- Was 0.06; in the S0b screen that cut mode changes by only about 13% (21.4 against 24.8 per bot
-- per minute). 0.12 is the most it can be while a mode one tier higher (tiers are 0.15 apart
-- from MODERATE upward) still always wins.
local INCUMBENT_BONUS = 0.12
--- Only a mode that still wants to run (raw above this) gets the incumbent bonus.
local INCUMBENT_MIN_RAW = 0.1
--- The bonus lifts a mode other than retreat no higher than this (just under SURVIVE 0.96). Game 9090005145:
-- a group defence at FORCED 0.9 plus the bonus reached 1.0 and held bots in defend mode while retreat
-- said 0.96 (fight_survive); four deaths came that way.
local INCUMBENT_CEIL = 0.95
--- Normalises a legacy desire onto the 0..1 tier scale and applies the incumbent bonus.
-- 1. Values above 1 are compressed into 0.95..0.99, keeping their order. Negative values become 0.
-- 2. If the bot is already in `mode` and raw > 0.1, add INCUMBENT_BONUS, capped at 1 for retreat and at
--    INCUMBENT_CEIL for other modes (never lowering a value already above it).
function ____exports.Finalize(bot, mode, raw)
    if raw == nil then
        return raw
    end
    local value = raw
    if value > 1 then
        value = 0.95 + math.min(value - 1, 0.5) * 0.08
    elseif value < 0 then
        value = 0
    end
    if IsOn("group") then
        local ok, capped = pcall(Group.Cap, bot, mode, value)
        if ok then
            value = capped
        elseif not groupErrors[capped] then
            groupErrors[capped] = true
            print((((("BEHAVIOR_ERROR group team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(DotaTime()))) .. " ") .. capped)
        end
    end
    local supportFarm = mode == BotMode.Farm and jmz.GetPosition(bot) >= 4
    if raw > INCUMBENT_MIN_RAW and bot:GetActiveMode() == mode and not supportFarm then
        local ceil = mode == BotMode.Retreat and 1 or math.max(value, INCUMBENT_CEIL)
        value = math.min(value + INCUMBENT_BONUS, ceil)
    end
    return value
end
--- Errors in the persona / mood scaling print once each and leave the desire unchanged.
local personaErrors = {}
local function ScaleFactor(bot, mode, persona, mood)
    local f = 1
    if persona then
        f = f * Persona.Factor(bot, mode)
    end
    if mood then
        f = f * Mood.Factor(bot, mode)
    end
    return f
end
--- Behaviour flags `persona` and `mood`: the bot's hidden persona and its current mood scale the raw desire
-- (behavior/persona, behavior/mood), within the limits of Persona.ApplyFactor.
local function PersonaScale(bot, mode, raw, persona, mood)
    if raw == nil then
        return raw
    end
    if mode == BotMode.TeamRoam and bot.roamSub == "lasthit" and IsOn("lasthit") then
        return raw
    end
    local ok, factor = pcall(
        ScaleFactor,
        bot,
        mode,
        persona,
        mood
    )
    if ok then
        return Persona.ApplyFactor(raw, factor)
    end
    if not personaErrors[factor] then
        personaErrors[factor] = true
        print((((("BEHAVIOR_ERROR persona team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(DotaTime()))) .. " ") .. factor)
    end
    return raw
end
--- Returns the GetDesire the engine should see for this mode file.
-- Flags `arbiter`, `persona` and `mood` off (or no GetDesire defined): returns `getDesire` itself, unchanged.
function ____exports.Wrap(bot, mode, getDesire)
    if getDesire == nil then
        return getDesire
    end
    local arbiter = IsOn("arbiter")
    local scaled = Persona.KnobOf(mode) ~= nil
    local persona = scaled and IsOn("persona")
    local mood = scaled and IsOn("mood")
    if not persona and not mood then
        return arbiter and (function() return ____exports.Finalize(
            bot,
            mode,
            getDesire()
        ) end) or getDesire
    end
    if not arbiter then
        return function() return PersonaScale(
            bot,
            mode,
            getDesire(),
            persona,
            mood
        ) end
    end
    return function() return ____exports.Finalize(
        bot,
        mode,
        PersonaScale(
            bot,
            mode,
            getDesire(),
            persona,
            mood
        )
    ) end
end
return ____exports
