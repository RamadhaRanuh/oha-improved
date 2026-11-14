--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
local ____exports = {}
--- Desire tiers (docs/specs/smarter-bot-behaviour.md section 3.2).
-- 
-- New behaviour code returns one of these values, or interpolates between two adjacent tiers
-- with RemapValClamped. Nothing new returns more than 1.
____exports.DesireTier = {
    SURVIVE = 0.96,
    FORCED = 0.9,
    HIGH = 0.75,
    MODERATE = 0.5,
    LOW = 0.25,
    NONE = 0
}
return ____exports
