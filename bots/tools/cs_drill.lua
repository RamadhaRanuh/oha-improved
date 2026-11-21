--[[
Last-hit drill (docs/TESTING.md, "Last-hit drill").

Runs in the server-side (game rules) VM next to the match recorder, never in the bot sandbox. headless/game.sh
loads it in every game with

    script_reload_code bots/tools/cs_drill

and it does nothing unless bots/Customize/general.lua has a Customize.Drill table (npm run match -- ... --drill=...):

    Customize.Drill = { mode = 'solo', team = 'Radiant', pos = 2 }

Every hero except the drilled ones is stunned in its fountain for the whole game, so the drilled heroes lane alone:
  solo   only the hero at slot `pos` of `team` plays (no enemy hero in its lane): pure last hits and denies
  duel   the hero at slot `pos` of both teams plays (pos 2: mid against mid): contested last hits
The slot is the hero's place in Customize.Radiant_Heros / Dire_Heros, which is its position in fixed lineups.
The match recorder's CSREC lines score the drill.

Prints "CSDRILL mode= team= pos= active=<heroes>" once the heroes exist, and "CSDRILL frozen=<hero>" per hero.
--]]

local rawPrint = print

local RADIANT = DOTA_TEAM_GOODGUYS or 2
local DIRE = DOTA_TEAM_BADGUYS or 3
local THINK_INTERVAL = 0.2

if CsDrill == nil then
	CsDrill = {}
end
local D = CsDrill
D.frozen = D.frozen or {}

local ok, customize = pcall(require, 'bots.Customize.general')
local cfg = ok and type(customize) == 'table' and customize.Drill or nil
if type(cfg) ~= 'table' then
	rawPrint('CSDRILL off')
	return
end

local mode = cfg.mode == 'duel' and 'duel' or 'solo'
local pos = tonumber(cfg.pos) or 2
local drillTeam = cfg.team == 'Dire' and DIRE or RADIANT

-- Hero names that keep playing.
local active = {}
local function addActive(list)
	local name = type(list) == 'table' and list[pos] or nil
	if type(name) == 'string' and name ~= 'Random' then active[name] = true end
end
if mode == 'duel' or drillTeam == RADIANT then addActive(customize.Radiant_Heros) end
if mode == 'duel' or drillTeam == DIRE then addActive(customize.Dire_Heros) end

local function activeText()
	local names = {}
	for name, _ in pairs(active) do table.insert(names, name) end
	table.sort(names)
	return table.concat(names, ',')
end

function D:Think()
	local state = GameRules:State_Get()
	if state >= DOTA_GAMERULES_STATE_POST_GAME then return nil end
	if state < DOTA_GAMERULES_STATE_PRE_GAME then return THINK_INTERVAL end
	if not D.announced then
		D.announced = true
		rawPrint(string.format('CSDRILL mode=%s team=%d pos=%d active=%s', mode, drillTeam, pos, activeText()))
	end
	for _, hero in ipairs(HeroList:GetAllHeroes()) do
		if hero ~= nil and not hero:IsNull() and hero:IsRealHero() then
			local name = hero:GetUnitName()
			if not active[name] then
				if not hero:HasModifier('modifier_stunned') then
					hero:AddNewModifier(hero, nil, 'modifier_stunned', {})
				end
				if not D.frozen[name] then
					D.frozen[name] = true
					rawPrint('CSDRILL frozen=' .. name)
				end
			end
		end
	end
	return THINK_INTERVAL
end

local THINKER_NAME = 'cs_drill_thinker'
local thinkOk, err = pcall(function()
	local ent = Entities:FindByName(nil, THINKER_NAME)
	if ent == nil then
		ent = SpawnEntityFromTableSynchronous('info_target', { targetname = THINKER_NAME })
	end
	ent:SetThink('Think', CsDrill, 'CsDrillThink', THINK_INTERVAL)
end)
rawPrint('CSDRILL loaded mode=' .. mode .. ' pos=' .. pos .. ' active=' .. activeText() .. (thinkOk and '' or (' think FAILED: ' .. tostring(err))))
