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
  humans   heroes played by people (not bots), per team; empty in bot-only games
  kda      [kills, deaths, assists] per hero at the end
  kills    team kills, at "10" (10:00), "20" (20:00) and "end"
  towers   enemy towers destroyed BY each team, at "10", "20" and "end"
           (counted from tower deaths seen after the recorder loaded)
  nw10 / nw20 / nwEnd   summed net worth per team
  lh10     last hits per hero at 10:00
  dn10     denies per hero at 10:00
  cs10     last-hit accounting per hero at 10:00 (the CSREC fields below)
  seed    the per-bot personality seeds are the MATCHSEED lines in console.log; join on time
  timescale  host_timescale when the game ended (null if it could not be read)
A snapshot taken before the recorder was loaded is null.

At 5:00 and 10:00 it also prints "CSREC {json}" (screen games stop before MATCHREC, so this line is
printed on its own): t, near, and per hero {team, lh, dn, lhNear, lhLane, lhAlly, lhDenied, lhMissed,
dnNear, dnLane, dnLost}, and lanes: lane creeps that died by the creep's team and lane (top / mid / bot:
mid within 2500 of the diagonal). Every lane creep that dies counts for each living real hero within CS_NEAR of it:
  enemy creep -> lhNear; the hero took it (lhLane), a teammate did (lhAlly), the creep's own side denied
                 it (lhDenied), or a creep / tower / nobody got it (lhMissed)
  own creep   -> dnNear; the hero denied it (dnLane), or an enemy player last-hit it (dnLost)
Kills by a hero's summons or illusions count for the hero, as the scoreboard does. lh and dn are the
scoreboard's GetLastHits / GetDenies, so they also hold kills outside the lane (neutrals).

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
-- Last-hit accounting per hero name (see the header), and which CSREC minutes are printed.
R.cs = R.cs or {}
R.csPrinted = R.csPrinted or {}
-- Lane creeps that died before CS_UNTIL, by the creep's team and lane.
R.laneDeaths = R.laneDeaths or { radiant = { top = 0, mid = 0, bot = 0 }, dire = { top = 0, mid = 0, bot = 0 } }
local CS_NEAR = 1000
local CS_UNTIL = 10 * 60

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

-- Heroes played by people (not bots), per team: human-vs-bot games.
local function humans()
	local res = {}
	for _, team in ipairs({ RADIANT, DIRE }) do
		local heroes = { __array = true }
		for _, id in ipairs(playerIdsOf(team)) do
			if not PlayerResource:IsFakeClient(id) then
				table.insert(heroes, PlayerResource:GetSelectedHeroName(id) or '')
			end
		end
		res[teamKey(team)] = heroes
	end
	return res
end

-- Kills / deaths / assists per hero at the end.
local function kda()
	local res = {}
	for _, team in ipairs({ RADIANT, DIRE }) do
		for _, id in ipairs(playerIdsOf(team)) do
			local name = PlayerResource:GetSelectedHeroName(id)
			if name ~= nil and name ~= '' then
				res[name] = { __array = true, PlayerResource:GetKills(id) or 0, PlayerResource:GetDeaths(id) or 0, PlayerResource:GetAssists(id) or 0 }
			end
		end
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

local function deniesByHero()
	local res = {}
	for _, team in ipairs({ RADIANT, DIRE }) do
		for _, id in ipairs(playerIdsOf(team)) do
			local name = PlayerResource:GetSelectedHeroName(id)
			if name ~= nil and name ~= '' then
				res[name] = PlayerResource:GetDenies(id)
			end
		end
	end
	return res
end

-- Last-hit accounting row of a hero, created on first use.
local function csRow(name, team)
	local row = R.cs[name]
	if row == nil then
		row = { team = teamKey(team), lhNear = 0, lhAlly = 0, lhDenied = 0, lhMissed = 0, dnNear = 0, dnLost = 0, lhLane = 0, dnLane = 0 }
		R.cs[name] = row
	end
	return row
end

local function isLaneCreep(unit)
	local c = unit:GetClassname()
	return c == 'npc_dota_creep_lane' or c == 'npc_dota_creep_siege'
end

-- The player behind a killer (a hero, or its summon or illusion), or -1 for creeps, towers and nobody.
local function killerPlayer(killer)
	if killer == nil or killer:IsNull() then return -1 end
	local ok, id = pcall(function() return killer:GetPlayerOwnerID() end)
	if ok and type(id) == 'number' and id >= 0 and PlayerResource:IsValidPlayerID(id) then return id end
	return -1
end

-- Lane of a point: mid within 2500 of the diagonal, top above it, bot below it.
local function laneOf(loc)
	if math.abs(loc.x - loc.y) < 2500 then return 'mid' end
	if loc.y > loc.x then return 'top' end
	return 'bot'
end

-- One lane creep died before CS_UNTIL: count it for its lane, and for every living real hero within CS_NEAR.
local function countCreepDeath(unit, killer)
	local creepTeam = unit:GetTeamNumber()
	local lanes = R.laneDeaths[teamKey(creepTeam)]
	if lanes ~= nil then
		local lane = laneOf(unit:GetAbsOrigin())
		lanes[lane] = lanes[lane] + 1
	end
	local pid = killerPlayer(killer)
	local pidTeam = pid >= 0 and PlayerResource:GetTeam(pid) or -1
	local loc = unit:GetAbsOrigin()
	for _, hero in ipairs(HeroList:GetAllHeroes()) do
		if hero ~= nil and not hero:IsNull() and hero:IsRealHero() and hero:IsAlive()
			and not (hero.IsClone and hero:IsClone()) and not (hero.IsTempestDouble and hero:IsTempestDouble())
			and (hero:GetAbsOrigin() - loc):Length2D() <= CS_NEAR then
			local heroTeam = hero:GetTeamNumber()
			local heroPid = hero:GetPlayerOwnerID()
			local row = csRow(hero:GetUnitName(), heroTeam)
			if heroTeam ~= creepTeam then
				row.lhNear = row.lhNear + 1
				if pid == heroPid then row.lhLane = row.lhLane + 1
				elseif pidTeam == heroTeam then row.lhAlly = row.lhAlly + 1
				elseif pidTeam == creepTeam then row.lhDenied = row.lhDenied + 1
				else row.lhMissed = row.lhMissed + 1 end
			else
				row.dnNear = row.dnNear + 1
				if pid == heroPid then row.dnLane = row.dnLane + 1
				elseif pid >= 0 and pidTeam ~= heroTeam then row.dnLost = row.dnLost + 1 end
			end
		end
	end
end

-- CSREC line: the accounting rows plus the scoreboard's last hits and denies.
local function printCsRecord(minute)
	if R.csPrinted[minute] then return end
	R.csPrinted[minute] = true
	local lh, dn = lastHitsByHero(), deniesByHero()
	local heroes = {}
	for name, row in pairs(R.cs) do
		local out = {}
		for k, v in pairs(row) do out[k] = v end
		out.lh = lh[name]
		out.dn = dn[name]
		heroes[name] = out
	end
	-- Heroes never near a dying creep (frozen in a drill, or always away) still get a row.
	for name, v in pairs(lh) do
		if heroes[name] == nil then heroes[name] = { lh = v, dn = dn[name], lhNear = 0, dnNear = 0 } end
	end
	R.snap['cs' .. minute] = heroes
	rawPrint('CSREC ' .. encode({ t = minute * 60, near = CS_NEAR, heroes = heroes, lanes = R.laneDeaths }))
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
	if minute == 10 then
		s.lh = lastHitsByHero()
		s.dn = deniesByHero()
	end
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
		humans = humans(),
		kda = kda(),
		kills = { ['10'] = snapField(10, 'kills'), ['20'] = snapField(20, 'kills'), ['end'] = killsByTeam() },
		towers = { ['10'] = snapField(10, 'towers'), ['20'] = snapField(20, 'towers'), ['end'] = towersByTeam() },
		nw10 = snapField(10, 'nw'),
		nw20 = snapField(20, 'nw'),
		nwEnd = netWorthByTeam(),
		lh10 = snapField(10, 'lh'),
		dn10 = snapField(10, 'dn'),
		cs10 = R.snap['cs10'],
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
	-- KILLREC lines (tower and Roshan kills) close a gap in the gold analysis: neither was logged before.
	local killer = keys.entindex_attacker and EntIndexToHScript(keys.entindex_attacker)
	local killerTeam = (killer ~= nil and not killer:IsNull()) and killer:GetTeamNumber() or -1
	if unit:GetClassname() == 'npc_dota_fort' then
		R.losingTeam = team
	elseif unit.IsTower and unit:IsTower() and R.towers[team] ~= nil then
		R.towers[team] = R.towers[team] + 1
		rawPrint(string.format('KILLREC kind=tower team=%d by=%d t=%d name=%s', team, killerTeam, math.floor(gameTime()), unit:GetUnitName()))
	elseif unit:GetUnitName() == 'npc_dota_roshan' then
		rawPrint(string.format('KILLREC kind=roshan by=%d t=%d', killerTeam, math.floor(gameTime())))
	elseif isLaneCreep(unit) and gameTime() >= 0 and gameTime() < CS_UNTIL then
		local ok, err = pcall(countCreepDeath, unit, killer)
		if not ok and not R.csError then
			R.csError = true
			rawPrint('MATCHREC_INFO creep accounting failed: ' .. tostring(err))
		end
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
		if t >= 5 * 60 then printCsRecord(5) end
		if t >= 10 * 60 then
			takeSnapshot(10)
			printCsRecord(10)
		end
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
