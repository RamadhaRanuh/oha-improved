local bot = GetBot()
local botName = bot:GetUnitName();
if bot == nil or bot:IsInvulnerable() or not bot:IsHero() or not bot:IsAlive() or not string.find(botName, "hero") or bot:IsIllusion() then return end

local J = require( GetScriptDirectory()..'/FunLib/jmz_func' )
local Customize = require( GetScriptDirectory()..'/Customize/general' )
-- Behaviour flag `group`: Roshan before a high-ground push the numbers do not allow (behavior/siege).
local bGroupFlag = require(GetScriptDirectory()..'/FunLib/behavior/flags').IsOn('group')
local Siege = bGroupFlag and require(GetScriptDirectory()..'/FunLib/behavior/siege') or nil
-- Behaviour flag `roshsafe`: no Roshan bid at low hp, team abort after deaths at the pit (behavior/roshsafe).
local bRoshSafe = require(GetScriptDirectory()..'/FunLib/behavior/flags').IsOn('roshsafe')
local RoshSafe = bRoshSafe and require(GetScriptDirectory()..'/FunLib/behavior/roshsafe') or nil
-- Own Roshan handle for roshsafe, refreshed when the old one died (`Roshan` below is found once and never again).
local RoshSafeUnit = nil
local fRoshSafeSearch = -999

local killTime = 0.0
local shouldKillRoshan = false
local DoingRoshanMessage = DotaTime()

-- local rTwinGate = nil
-- local dTwinGate = nil
-- local rTwinGateLoc = Vector(5888, -7168, 256)
-- local dTwinGateLoc = Vector(6144, 7552, 256)

local sinceRoshAliveTime = 0
local roshTimeFlag = false
local initDPSFlag = false

local Roshan

function GetDesire()
	local res = GetDesireHelper()
	if bRoshSafe then
		if (RoshSafeUnit == nil or not J.Utils.IsValidUnit(RoshSafeUnit)) and DotaTime() - fRoshSafeSearch > 0.5 then
			fRoshSafeSearch = DotaTime()
			RoshSafeUnit = nil
			for _, c in pairs(bot:GetNearbyNeutralCreeps(700)) do
				if c:GetUnitName() == "npc_dota_roshan" then RoshSafeUnit = c end
			end
		end
		res = RoshSafe.Filter(bot, res, RoshSafeUnit)
	end
	if res > 0.6 then J.ModeAnnounce(bot, 'say_roshan', 30) end
	return res
end
-- Behaviour flag `group`: when siege says Roshan first, log why this bot does not go (once per 30 s).
-- Game 9089589000: roshanFirst=true for 9 minutes and Roshan mode never ran.
local fRoshBlockLog = -999
local function RoshBlock(reason)
	if bGroupFlag and J.Utils.DebugMode and DotaTime() - fRoshBlockLog > 30 and Siege.RoshanFirst() then
		fRoshBlockLog = DotaTime()
		print('ROSHFIRST team='..GetTeam()..' hero='..botName..' t='..math.floor(DotaTime())..' blocked='..reason)
	end
	return BOT_MODE_DESIRE_NONE
end

-- Behaviour flag `group`: J.HasEnoughDPSForRoshan divides the team's DPS by the hero count and compares
-- that average with all of Roshan's health, and uses armor/(armor+20) as the damage cut. Game
-- 9089630662: blocked=low_dps 121 times, Roshan never taken. Here: the team's summed right-click DPS,
-- with Dota's armor formula, must kill Roshan within ROSH_KILL_TIME seconds.
local ROSH_KILL_TIME = 90 -- right-clicks only (spells and items add more), and the Roshan stats above are rough (tunable)
local function TeamHasRoshanDPS(heroes)
	local nMinute = math.floor(DotaTime() / 60)
	local nHealth = 6000 + 260 * nMinute
	local nDPS = 0
	for _, h in pairs(heroes) do
		local nArmor = 30 + 0.375 * nMinute - J.GetArmorReducers(h)
		local nMul = 1 - (0.06 * nArmor) / (1 + 0.06 * math.abs(nArmor))
		nDPS = nDPS + h:GetAttackDamage() * h:GetAttackSpeed() * nMul
	end
	return nDPS * ROSH_KILL_TIME >= nHealth
end

function GetDesireHelper()
	if bot:IsInvulnerable() or not bot:IsHero() or not bot:IsAlive() or not string.find(botName, "hero") or bot:IsIllusion() then return BOT_MODE_DESIRE_NONE end
    if Roshan == nil then
        local nCreeps = bot:GetNearbyNeutralCreeps(700)
        for _, creepOrRoshan in pairs(nCreeps)
        do
            if creepOrRoshan:GetUnitName() == "npc_dota_roshan"
            then
                Roshan = creepOrRoshan
            end
        end
    end

	-- 如果在打高地 就别撤退去干别的
	if J.Utils.IsTeamPushingSecondTierOrHighGround(bot) and not (bGroupFlag and Siege.RoshanFirst()) then
		return BOT_MODE_DESIRE_NONE
	end

	if J.GetEnemiesAroundAncient(bot, 3200) > 0 or J.GetHP(GetAncient(bot:GetTeam())) < 0.8 then
		return RoshBlock('ancient')
	end

    local timeOfDay = J.CheckTimeOfDay()

    local nTeamFightLocation = J.GetTeamFightLocation(bot)
    if nTeamFightLocation ~= nil
    then
        if timeOfDay == 'day'
        and GetUnitToLocationDistance(bot, J.Utils.RadiantRoshanLoc) < 1600
        and GetUnitToLocationDistance(bot, nTeamFightLocation) < 2000
        then
            return RoshBlock('teamfight')
        else
            if timeOfDay == 'night'
            and GetUnitToLocationDistance(bot, J.Utils.DireRoshanLoc) < 1600
            and GetUnitToLocationDistance(bot, nTeamFightLocation) < 2000
            then
                return RoshBlock('teamfight')
            end
        end
    end

    local lEnemyHeroesAroundLoc = J.GetLastSeenEnemiesNearLoc(bot:GetLocation(), 1200)
    if #lEnemyHeroesAroundLoc >= 2 then
        return RoshBlock('enemies_seen_near')
    end

    -- if Roshan is about to get killed, kill it unless there are other absolute actions.
    if J.Utils.IsValidUnit(Roshan) then
        local roshHP = Roshan:GetHealth() / Roshan:GetMaxHealth()
        if roshHP < 0.5 and #lEnemyHeroesAroundLoc == 0 then
            return RemapValClamped(roshHP, 100, 0, BOT_MODE_DESIRE_MODERATE, BOT_MODE_DESIRE_ABSOLUTE )
        end
    end

    local aliveAlly = J.GetNumOfAliveHeroes(false)
    local aliveEnemy = J.GetNumOfAliveHeroes(true)
    local hasSameOrMoreHero = aliveAlly >= aliveEnemy

    if not hasSameOrMoreHero then
        return RoshBlock('fewer_alive')
    end

    local nCoreWithNoEmptySlot = 0
    local aliveHeroesList = {}
    for _, h in pairs(GetUnitList(UNIT_LIST_ALLIED_HEROES)) do
        if h:IsAlive()
        then
            if J.Utils.CountBackpackEmptySpace(h) <= 0 and J.IsCore(h) then
                nCoreWithNoEmptySlot = nCoreWithNoEmptySlot + 1
            end

            -- do not take rosh if the cores do not have any empty slot, it may get dropped on ground.
            -- Not when siege wants Roshan first: by then cores are often full, and the gate kept Roshan
            -- untouched for the rest of the game (9089589000). Another hero with a free slot takes the Aegis.
            if nCoreWithNoEmptySlot >= 2 and not (bGroupFlag and Siege.RoshanFirst()) then
                return RoshBlock('cores_full')
            end
            table.insert(aliveHeroesList, h)
        end
    end

    shouldKillRoshan = J.IsRoshanAlive()

    if shouldKillRoshan
    and not roshTimeFlag
    then
        sinceRoshAliveTime = DotaTime()
        roshTimeFlag = true
    else
        if not shouldKillRoshan
        then
            sinceRoshAliveTime = 0
            roshTimeFlag = false
        end
    end

    if (bGroupFlag and TeamHasRoshanDPS(aliveHeroesList)) or (not bGroupFlag and J.HasEnoughDPSForRoshan(aliveHeroesList))
    then
        initDPSFlag = true
    end

    if J.IsRoshanCloseToChangingSides()
    then
        local botTarget = J.GetProperTarget(bot)
        if J.IsRoshan(botTarget) then
            return RemapValClamped(J.GetHP(botTarget), 1, 0, BOT_ACTION_DESIRE_NONE, BOT_ACTION_DESIRE_VERYHIGH )
        end
        if not J.IsValid(botTarget) or not J.IsRoshan(botTarget) then
            return RoshBlock('changing_sides')
        end
    end

    local nEnemyHeroes = J.GetEnemiesNearLoc(bot:GetLocation(), 1300)
    if nEnemyHeroes ~= nil and #nEnemyHeroes > 0
    then
        return RoshBlock('enemy_near')
    end

    -- Behaviour flag `group`: ahead at high ground without the numbers -> the whole team takes Roshan first.
    if bGroupFlag and shouldKillRoshan and Siege.RoshanFirst() and J.GetHP(bot) > 0.4
    and initDPSFlag
    then
        return 0.8
    end
    if bGroupFlag and shouldKillRoshan and Siege.RoshanFirst() then
        RoshBlock(not initDPSFlag and 'low_dps' or 'low_hp')
    end

    if shouldKillRoshan
    and initDPSFlag
    then
        local human, humanPing = J.GetHumanPing()
        if human ~= nil and DotaTime() > 5.0 then
            if humanPing ~= nil
            and humanPing.normal_ping
            and GetUnitToLocationDistance(human, J.GetCurrentRoshanLocation()) < 4500
            and J.GetDistance(humanPing.location, J.GetCurrentRoshanLocation()) < 600
            and DotaTime() < humanPing.time + 5.0
            then
                return 0.95
            end
        end

        local mul = RemapValClamped(DotaTime(), sinceRoshAliveTime, sinceRoshAliveTime + (2.5 * 60), 1, 2)
        local nRoshanDesire = (GetRoshanDesire() * mul)

        if hasSameOrMoreHero or (not hasSameOrMoreHero and J.HasEnoughDPSForRoshan(aliveHeroesList)) then
            return Clamp(nRoshanDesire, 0, 0.95)
        end
    end

    return BOT_ACTION_DESIRE_NONE
end

-- Behaviour flag `arbiter` (docs/specs/smarter-bot-behaviour.md 3.2). Flag off: GetDesire stays the function above.
GetDesire = require(GetScriptDirectory()..'/FunLib/behavior/arbiter').Wrap(bot, BOT_MODE_ROSHAN, GetDesire)
