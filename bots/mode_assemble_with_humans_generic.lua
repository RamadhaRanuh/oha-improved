local bot = GetBot()
local botName = bot:GetUnitName()
if bot == nil or bot:IsInvulnerable() or not bot:IsHero() or not bot:IsAlive() or not string.find(botName, "hero") or bot:IsIllusion() then return end

function GetDesire()
	return BOT_MODE_DESIRE_NONE
end

-- Behaviour flag `arbiter` (docs/specs/smarter-bot-behaviour.md 3.2). Flag off: GetDesire stays the function above.
GetDesire = require(GetScriptDirectory()..'/FunLib/behavior/arbiter').Wrap(bot, BOT_MODE_ASSEMBLE_WITH_HUMANS, GetDesire)
