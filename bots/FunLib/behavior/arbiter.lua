--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
local ____exports = {}
local ____flags = require(GetScriptDirectory().."/FunLib/behavior/flags")
local IsOn = ____flags.IsOn
--- Added to the running mode's desire so it must be beaten clearly before it is replaced. Tunable.
-- Was 0.06; in the S0b screen that cut mode changes by only about 13% (21.4 against 24.8 per bot
-- per minute). 0.12 is the most it can be while a mode one tier higher (tiers are 0.15 apart
-- from MODERATE upward) still always wins.
local INCUMBENT_BONUS = 0.12
--- Only a mode that still wants to run (raw above this) gets the incumbent bonus.
local INCUMBENT_MIN_RAW = 0.1
--- Normalises a legacy desire onto the 0..1 tier scale and applies the incumbent bonus.
-- 1. Values above 1 are compressed into 0.95..0.99, keeping their order. Negative values become 0.
-- 2. If the bot is already in `mode` and raw > 0.1, add INCUMBENT_BONUS, capped at 1.
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
    if raw > INCUMBENT_MIN_RAW and bot:GetActiveMode() == mode then
        value = math.min(value + INCUMBENT_BONUS, 1)
    end
    return value
end
--- Returns the GetDesire the engine should see for this mode file.
-- Flag off (or no GetDesire defined): returns `getDesire` itself, unchanged.
function ____exports.Wrap(bot, mode, getDesire)
    if getDesire == nil or not IsOn("arbiter") then
        return getDesire
    end
    return function() return ____exports.Finalize(
        bot,
        mode,
        getDesire()
    ) end
end
return ____exports
