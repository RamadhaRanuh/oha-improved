local bot = GetBot()
local botName = bot:GetUnitName()
if bot == nil or bot:IsInvulnerable() or not bot:IsHero() or not bot:IsAlive() or not string.find(botName, "hero") or bot:IsIllusion() then return end

local Utils = require( GetScriptDirectory()..'/FunLib/utils')

local local_mode_attack_generic
if bot:IsInvulnerable() or not bot:IsHero() or not string.find(botName, "hero") or bot:IsIllusion() then
	return
end

if Utils.BuggyHeroesDueToValveTooLazy[botName] then
	local_mode_attack_generic = dofile( GetScriptDirectory().."/FunLib/override_generic/mode_attack_generic" )
end

-- Behaviour flag `fight` (behavior/fight, spec section 6): one team-wide fight state, focus target and
-- initiator for every hero; Valve's attack mode and the override above are not used then.
local Fight = require(GetScriptDirectory()..'/FunLib/behavior/flags').IsOn('fight') and require(GetScriptDirectory()..'/FunLib/behavior/fight') or nil
local tBehaviorErrors = {}
local function SafeCall(sName, fn, ...)
	local ok, res = pcall(fn, ...)
	if ok then return res end
	local sMsg = tostring(res)
	if not tBehaviorErrors[sMsg] then
		tBehaviorErrors[sMsg] = true
		print('BEHAVIOR_ERROR '..sName..' team='..GetTeam()..' t='..math.floor(DotaTime())..' '..sMsg)
	end
	return nil
end

if Fight ~= nil then
	function GetDesire() return SafeCall('fight', Fight.AttackDesire, bot) or 0 end
	function Think() SafeCall('fight', Fight.AttackThink, bot) end
	function OnStart() end
	function OnEnd() end
elseif local_mode_attack_generic ~= nil then
	function GetDesire() return local_mode_attack_generic.GetDesire() end
	function Think() return local_mode_attack_generic.Think() end
	function OnStart() return local_mode_attack_generic.OnStart() end
	function OnEnd() return local_mode_attack_generic.OnEnd() end
end

-- Behaviour flag `arbiter` (docs/specs/smarter-bot-behaviour.md 3.2). Flag off: GetDesire stays the function above.
GetDesire = require(GetScriptDirectory()..'/FunLib/behavior/arbiter').Wrap(bot, BOT_MODE_ATTACK, GetDesire)
