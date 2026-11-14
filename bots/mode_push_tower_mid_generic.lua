local Push = require( GetScriptDirectory()..'/FunLib/aba_push')
local bot = GetBot()
local botName = bot:GetUnitName()
if bot == nil or bot:IsInvulnerable() or not bot:IsHero() or not bot:IsAlive() or not string.find(botName, "hero") or bot:IsIllusion() then return end
if bot.PushLaneDesire == nil then bot.PushLaneDesire = {0, 0, 0} end

function GetDesire()
    bot.PushLaneDesire[LANE_MID] = Push.GetPushDesire(bot, LANE_MID)
    return bot.PushLaneDesire[LANE_MID]
end
function Think() Push.PushThink(bot, LANE_MID) end

-- Behaviour flag `arbiter` (docs/specs/smarter-bot-behaviour.md 3.2). Flag off: GetDesire stays the function above.
GetDesire = require(GetScriptDirectory()..'/FunLib/behavior/arbiter').Wrap(bot, BOT_MODE_PUSH_TOWER_MID, GetDesire)
