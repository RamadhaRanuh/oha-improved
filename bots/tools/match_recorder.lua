--[[
Match recorder (docs/specs/smarter-bot-behaviour.md section 3.4).

Runs in the server-side (game rules) VM, not in the bot sandbox. Load it once per game, in the
pick phase or right after, with:

    sv_cheats 1; script_reload_code bots/tools/match_recorder

It does not touch FretBots or Buff and is never loaded by them. It gives bots nothing.

At post-game it prints one line, prefixed "MATCHREC ", with a JSON record:
  winner   "radiant" | "dire" | "unknown" (from the destroyed npc_dota_fort)
  duration game seconds (clock time, pre-game excluded)
  flags    Customize.Behavior per team, as read from bots/Customize/general.lua
  lineup   hero internal names per team, in team slot order
  kills    team kills, at "10" (10:00), "20" (20:00) and "end"
  towers   enemy towers destroyed BY each team, at "10", "20" and "end"
           (counted from tower deaths seen after the recorder loaded)
  nw10 / nw20 / nwEnd   summed net worth per team
  lh10     last hits per hero at 10:00
  seed     the per-bot personality seeds are the MATCHSEED lines in console.log; join on time
  timescale  host_timescale when the game ended (null if it could not be read)
A snapshot taken before the recorder was loaded is null.

Launch Dota with -console -condebug so the line lands in game/dota/console.log.
--]]

-- Keep the print we were loaded with. FretBots (server side) replaces print when it loads,
-- and it is meant to stay off in measurement games.
local rawPrint = print

local RADIANT = DOTA_TEAM_GOODGUYS or 2
local DIRE = DOTA_TEAM_BADGUYS or 3
local THINK_INTERVAL = 1

if MatchRecorder == nil then
	MatchRecorder = {}
end
local R = MatchRecorder

-- State survives a second script_reload_code in the same game.
R.towers = R.towers or { [RADIANT] = 0, [DIRE] = 0 }
R.snap = R.snap or {}
R.printed = R.printed or false

---------------------------------------------------------------------------
-- JSON (small, enough for this record)
---------------------------------------------------------------------------
local function encodeString(s)
	s = string.gsub(s, '[%c"\\]', function(c)
		if c == '"' then return '\\"' end
		if c == '\\' then return '\\\\' end
		if c == '\n' then return '\\n' end
		if c == '\t' then return '\\t' end
		return string.format('\\u%04x', string.byte(c))
	end)
	return '"' .. s .. '"'
end

local encode
encode = function(v)
	local t = type(v)
	if v == nil then return 'null' end
	if t == 'boolean' then return tostring(v) end
	if t == 'number' then
		if v ~= v or v == math.huge or v == -math.huge then return 'null' end
		if v == math.floor(v) then return string.format('%d', v) end
		return string.format('%.3f', v)
	end
	if t == 'string' then return encodeString(v) end
	if t == 'table' then
		if v.__array or #v > 0 then
			local parts = {}
			for i = 1, #v do parts[i] = encode(v[i]) end
			return '[' .. table.concat(parts, ',') .. ']'
		end
		local keys = {}
		for k, _ in pairs(v) do
			if k ~= '__array' then table.insert(keys, tostring(k)) end
		end
		table.sort(keys)
		local parts = {}
		for _, k in ipairs(keys) do
			local val = v[k]
			if val == nil then val = v[tonumber(k)] end
			table.insert(parts, encodeString(k) .. ':' .. encode(val))
		end
		return '{' .. table.concat(parts, ',') .. '}'
	end
	return 'null'
end

---------------------------------------------------------------------------
-- Readers
---------------------------------------------------------------------------
local function teamKey(team)
	if team == RADIANT then return 'radiant' end
	if team == DIRE then return 'dire' end
	return nil
end

local function gameTime()
	return GameRules:GetDOTATime(false, false)
end

local function playerIdsOf(team)
	local ids = {}
	for n = 1, PlayerResource:GetPlayerCountForTeam(team) do
		local id = PlayerResource:GetNthPlayerIDOnTeam(team, n)
		if id ~= nil and id >= 0 and PlayerResource:IsValidPlayerID(id) then
			table.insert(ids, id)
		end
	end
	return ids
end

local function lineup()
	local res = {}
	for _, team in ipairs({ RADIANT, DIRE }) do
		local heroes = { __array = true }
		for _, id in ipairs(playerIdsOf(team)) do
			table.insert(heroes, PlayerResource:GetSelectedHeroName(id) or '')
		end
		res[teamKey(team)] = heroes
	end
	return res
end

local function netWorthByTeam()
	local res = {}
	for _, team in ipairs({ RADIANT, DIRE }) do
		local sum = 0
		for _, id in ipairs(playerIdsOf(team)) do
			sum = sum + (PlayerResource:GetNetWorth(id) or 0)
		end
		res[teamKey(team)] = sum
	end
	return res
end

local function killsByTeam()
	return {
		radiant = PlayerResource:GetTeamKills(RADIANT),
		dire = PlayerResource:GetTeamKills(DIRE),
	}
end

-- Towers destroyed BY each team = towers the other team lost.
local function towersByTeam()
	return { radiant = R.towers[DIRE], dire = R.towers[RADIANT] }
end

local function lastHitsByHero()
	local res = {}
	for _, team in ipairs({ RADIANT, DIRE }) do
		for _, id in ipairs(playerIdsOf(team)) do
			local name = PlayerResource:GetSelectedHeroName(id)
			if name ~= nil and name ~= '' then
				res[name] = PlayerResource:GetLastHits(id)
			end
		end
	end
	return res
end

local function readFlags()
	local ok, customize = pcall(require, 'bots.Customize.general')
	if not ok or type(customize) ~= 'table' or type(customize.Behavior) ~= 'table' then
		return { radiant = {}, dire = {} }
	end
	return {
		radiant = customize.Behavior.Radiant or {},
		dire = customize.Behavior.Dire or {},
	}
end

-- host_timescale at post-game, so timescale-fidelity games (check P0-5) can be grouped. nil if unreadable.
local function readTimescale()
	local ok, v = pcall(function() return Convars:GetFloat('host_timescale') end)
	if ok and type(v) == 'number' then return v end
	return nil
end

local function winner()
	if R.losingTeam == nil then
		-- Fallback: look for a fort that is dead.
		for _, fort in ipairs(Entities:FindAllByClassname('npc_dota_fort')) do
			if fort ~= nil and not fort:IsNull() and (not fort:IsAlive() or fort:GetHealth() <= 0) then
				R.losingTeam = fort:GetTeamNumber()
			end
		end
	end
	if R.losingTeam == RADIANT then return 'dire' end
	if R.losingTeam == DIRE then return 'radiant' end
	return 'unknown'
end

---------------------------------------------------------------------------
-- Snapshots and the final line
---------------------------------------------------------------------------
local function takeSnapshot(minute)
	if R.snap[minute] ~= nil then return end
	local s = {
		nw = netWorthByTeam(),
		kills = killsByTeam(),
		towers = towersByTeam(),
	}
	if minute == 10 then s.lh = lastHitsByHero() end
	R.snap[minute] = s
end

local function snapField(minute, field)
	local s = R.snap[minute]
	if s == nil then return nil end
	return s[field]
end

function R:PrintRecord()
	if R.printed then return end
	R.printed = true

	local record = {
		winner = winner(),
		duration = math.floor(gameTime()),
		flags = readFlags(),
		lineup = lineup(),
		kills = { ['10'] = snapField(10, 'kills'), ['20'] = snapField(20, 'kills'), ['end'] = killsByTeam() },
		towers = { ['10'] = snapField(10, 'towers'), ['20'] = snapField(20, 'towers'), ['end'] = towersByTeam() },
		nw10 = snapField(10, 'nw'),
		nw20 = snapField(20, 'nw'),
		nwEnd = netWorthByTeam(),
		lh10 = snapField(10, 'lh'),
		seed = { source = 'MATCHSEED lines in console.log' },
		timescale = readTimescale(),
	}
	rawPrint('MATCHREC ' .. encode(record))
end

---------------------------------------------------------------------------
-- Events and think
---------------------------------------------------------------------------
function R:OnEntityKilled(keys)
	local unit = keys and keys.entindex_killed and EntIndexToHScript(keys.entindex_killed)
	if unit == nil or unit:IsNull() then return end
	local team = unit:GetTeamNumber()
	if unit:GetClassname() == 'npc_dota_fort' then
		R.losingTeam = team
	elseif unit.IsTower and unit:IsTower() and R.towers[team] ~= nil then
		R.towers[team] = R.towers[team] + 1
	end
end

function R:OnStateChange()
	if GameRules:State_Get() == DOTA_GAMERULES_STATE_POST_GAME then
		R:PrintRecord()
	end
end

function R:Think()
	if R.printed then return nil end
	local state = GameRules:State_Get()
	if state >= DOTA_GAMERULES_STATE_POST_GAME then
		R:PrintRecord()
		return nil
	end
	if state == DOTA_GAMERULES_STATE_GAME_IN_PROGRESS then
		local t = gameTime()
		if t >= 10 * 60 then takeSnapshot(10) end
		if t >= 20 * 60 then takeSnapshot(20) end
	end
	return THINK_INTERVAL
end

-- Setup. Each step reports its own failure, so a broken step shows up as one readable console line.
local function step(name, fn)
	local ok, err = pcall(fn)
	if not ok then rawPrint('MATCHREC_INFO setup step "' .. name .. '" failed: ' .. tostring(err)) end
	return ok
end

rawPrint('MATCHREC_INFO recorder file loaded')

-- (Re)register. On a reload the old listeners are removed first so nothing fires twice.
local listenersOk = step('listeners', function()
	if R.listeners ~= nil then
		for _, id in ipairs(R.listeners) do StopListeningToGameEvent(id) end
	end
	R.listeners = {
		ListenToGameEvent('entity_killed', Dynamic_Wrap(MatchRecorder, 'OnEntityKilled'), MatchRecorder),
		ListenToGameEvent('game_rules_state_change', Dynamic_Wrap(MatchRecorder, 'OnStateChange'), MatchRecorder),
	}
end)

-- A normal lobby has no game mode entity (that is for custom games), so think on our own
-- info_target, as the FretBots Timers library does. Reuse it on a reload.
local THINKER_NAME = 'match_recorder_thinker'
local thinkOk = step('think', function()
	local ent = Entities:FindByName(nil, THINKER_NAME)
	if ent == nil then
		ent = SpawnEntityFromTableSynchronous('info_target', { targetname = THINKER_NAME })
	end
	ent:SetThink('Think', MatchRecorder, 'MatchRecorderThink', THINK_INTERVAL)
end)

step('status', function()
	rawPrint('MATCHREC_INFO recorder loaded at game state ' .. tostring(GameRules:State_Get())
		.. ', clock ' .. string.format('%.0f', gameTime()) .. 's'
		.. ', listeners ' .. (listenersOk and 'ok' or 'FAILED')
		.. ', snapshots ' .. (thinkOk and 'ok' or 'FAILED'))
end)
