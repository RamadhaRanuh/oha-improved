local X = {}

local J = require(GetScriptDirectory()..'/FunLib/jmz_func')
local bLaningFlag = require(GetScriptDirectory()..'/FunLib/behavior/flags').IsOn('laning')
-- Fight decision log for the learned policy (behavior/decision_log; Customize.DecisionLog), all bots.
local DecisionLog = require(GetScriptDirectory()..'/FunLib/behavior/decision_log')
if not DecisionLog.Active() then DecisionLog = nil end
-- Debug trace (behavior/trace): POS / ITEM / CAST lines for each bot hero, Utils.DebugMode only.
local Trace = J.Utils.DebugMode and require(GetScriptDirectory()..'/FunLib/behavior/trace') or nil
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
local Customize = require(GetScriptDirectory()..'/Customize/general')

local bot = GetBot()

local botHP, botMP, botName, botHealth, botHealthRegen, botManaRegen, botLocation, botTarget
local botLevel, botActiveMode
local fStuckLogAt = -99
local bFountainGuard = require(GetScriptDirectory()..'/FunLib/behavior/flags').IsOn('arbiter') or require(GetScriptDirectory()..'/FunLib/behavior/flags').IsOn('escape')
local nAllyHeroes, nEnemyHeroes

local fRetreatFromTormentorTime = 0
local fRetreatFromRoshanTime   = 0

local fCurrentRunTime = 0
local fShouldRunTime  = 0

local hTeamAncient, hEnemyAncient

-- Debug (Utils.DebugMode only): which rule produced the retreat desire. Once a game minute per bot,
-- for the frames retreat was the active mode:  RETREAT team=2 hero=... seconds=60 formula=120 run:anti_chase=300
local sWhy, sRunWhy = 'none', 'none'
local tWhyCount, fWhySince = {}, -1
local function Why(tag, value) sWhy = tag; return value end
local function RunWhy(tag, value) sRunWhy = tag; return value end
local function CountWhy()
    if not J.Utils.DebugMode then return end
    local now = DotaTime()
    if fWhySince < 0 then fWhySince = now end
    if bot:GetActiveMode() == BOT_MODE_RETREAT then tWhyCount[sWhy] = (tWhyCount[sWhy] or 0) + 1 end
    if now - fWhySince < 60 then return end
    local parts = {}
    for k, v in pairs(tWhyCount) do parts[#parts + 1] = k..'='..v end
    table.sort(parts)
    if #parts > 0 then
        print('RETREAT team='..GetTeam()..' hero='..bot:GetUnitName()..' seconds='..math.floor(now - fWhySince)..' '..table.concat(parts, ' '))
    end
    tWhyCount, fWhySince = {}, now
end
-- Debug: on death, print the last ~6 s in 0.5 s steps (time before death, health, active mode,
-- raw retreat desire and its rule, enemy/ally heroes within 1600, distance to the enemy ancient):
--   DEATH team=3 hero=... t=812 -2.5:hp0.41,m4,r0.62,formula,e2,a1,d5400 ...   (,s<sub> in team roam: bot.roamSub)
local tDeathHist, bWasAlive = {}, true
local function TrackDeath(res)
    if not J.Utils.DebugMode then return end
    local now = DotaTime()
    if bot:IsAlive() then
        bWasAlive = true
        local last = tDeathHist[#tDeathHist]
        if last == nil or now - last.t >= 0.5 then
            tDeathHist[#tDeathHist + 1] = { t = now, hp = J.GetHP(bot), mode = bot:GetActiveMode(), want = res or 0, why = sWhy,
                e = nEnemyHeroes and #nEnemyHeroes or 0, a = nAllyHeroes and #nAllyHeroes or 0,
                d = GetUnitToUnitDistance(bot, GetAncient(GetOpposingTeam())),
                sub = bot:GetActiveMode() == BOT_MODE_TEAM_ROAM and bot.roamSub or nil }
            if #tDeathHist > 12 then table.remove(tDeathHist, 1) end
        end
    elseif bWasAlive then
        bWasAlive = false
        local parts = {}
        for _, h in ipairs(tDeathHist) do
            parts[#parts + 1] = string.format('%.1f:hp%.2f,m%d,r%.2f,%s,e%d,a%d,d%d', h.t - now, h.hp, h.mode, h.want, h.why, h.e, h.a, math.floor(h.d))
                ..(h.sub and (',s'..h.sub) or '')
        end
        print('DEATH team='..GetTeam()..' hero='..bot:GetUnitName()..' t='..math.floor(now)..' '..table.concat(parts, ' '))
        tDeathHist = {}
    end
end

-- === NEW: lightweight world context built once per GetDesireHelper() ===
local C = {
    allyHeroes = {},
    enemyHeroes = {},
    enemyNearbyExtra = 0, -- warlock golem / tombstone / phoenix sun / tower danger within 1200
    allyNearbyExtra  = 0, -- allied phoenix sun within 1200
    haveEnemyTowerThreat = false,
    enemyTowers1200 = nil,
    allyTowers1200  = nil,
    enemyLaneCreeps1200 = nil,
    aegisNearby1200 = false, -- reused by roshan logic branches
}

local function scanDroppedForAegis(radius)
    for _, dropped in pairs(GetDroppedItemList()) do
        if dropped and dropped.item:GetName() == 'item_aegis'
           and GetUnitToLocationDistance(bot, dropped.location) < radius
        then
            return true
        end
    end
    return false
end

local function buildContext()
	-- local cacheKey = 'buildContext'..tostring(bot:GetPlayerID())
	-- local cachedVar = J.Utils.GetCachedVars(cacheKey, 0.35 * (1 + Customize.ThinkLess))
	-- if cachedVar ~= nil then return cachedVar end

    -- reset
    C.allyHeroes, C.enemyHeroes = {}, {}
    C.enemyNearbyExtra, C.allyNearbyExtra = 0, 0
    C.haveEnemyTowerThreat = false

    -- cache these (used multiple times downstream)
    C.allyTowers1200       = bot:GetNearbyTowers(1200, false)
    C.enemyTowers1200      = bot:GetNearbyTowers(1200, true)
    C.enemyLaneCreeps1200  = bot:GetNearbyLaneCreeps(1200, true)

    -- single pass over ALL units; do 2 distance checks so we can fill both 1600-hero lists and 1200-specials
    local unitList = GetUnitList(UNIT_LIST_ALL)
    for _, u in pairs(unitList) do
        if J.IsValid(u)
           and u:GetTeam() ~= TEAM_NEUTRAL
           and u:GetTeam() ~= TEAM_NONE
           and not string.find(botName, 'lone_druid_bear')
           and not u:HasModifier('modifier_necrolyte_reapers_scythe')
           and not u:HasModifier('modifier_dazzle_nothl_projection_physical_body_debuff')
           and not u:HasModifier('modifier_skeleton_king_reincarnation_scepter_active')
           and not u:HasModifier('modifier_item_helm_of_the_undying_active')
           and not u:HasModifier('modifier_teleporting')
        then
            -- fill hero lists within 1600 (original semantics)
            if J.IsValidHero(u)
               and GetUnitToUnitDistance(bot, u) <= 1600
               and ((J.IsSuspiciousIllusion(u) and u:HasModifier('modifier_arc_warden_tempest_double')) or not J.IsSuspiciousIllusion(u))
               and not J.IsMeepoClone(u)
            then
                if GetTeam() == u:GetTeam() then
                    table.insert(C.allyHeroes, u)
                else
                    table.insert(C.enemyHeroes, u)
                end
            end

            -- special nearby adjustments within 1200
            if J.IsInRange(bot, u, 1200) then
                local name = u:GetUnitName()
                if bot:GetTeam() ~= u:GetTeam() then
                    if string.find(name, 'warlock_golem')
                        or string.find(name, 'tombstone')
                        or string.find(name, 'npc_dota_phoenix_sun')
                    then
                        C.enemyNearbyExtra = C.enemyNearbyExtra + 1
                    end
                    if string.find(name, 'tower') then
                        local towerDamage = bot:GetActualIncomingDamage(u:GetAttackDamage() * u:GetAttackSpeed() * 5.0, DAMAGE_TYPE_PHYSICAL) - botHealthRegen * 5.0
                        if towerDamage / botHealth >= 0.5 then
                            C.enemyNearbyExtra = C.enemyNearbyExtra + 1
                            C.haveEnemyTowerThreat = true
                        end
                    end
                else
                    if string.find(name, 'npc_dota_phoenix_sun') then
                        C.allyNearbyExtra = C.allyNearbyExtra + 1
                    end
                end
            end
        end
    end

    -- cache aegis proximity (used twice originally)
    C.aegisNearby1200 = scanDroppedForAegis(1200)

	-- J.Utils.SetCachedVars(cacheKey, C)
	return C
end

-- === existing functions, now reusing context ===

function GetDesire()
    -- local cacheKey = 'GetRetreatDesire'..tostring(bot:GetPlayerID())
    -- local cachedVar = J.Utils.GetCachedVars(cacheKey, 0.35 * (1 + Customize.ThinkLess))
    -- if DotaTime() > 30 and cachedVar ~= nil then return cachedVar end
    sWhy = 'none'
    local res = GetDesireHelper()
    if DecisionLog ~= nil then
        SafeCall('decision_log', DecisionLog.Tick, bot)
        local sForced = DecisionLog.Forced(bot)
        if sForced == 'run' then res = math.max(res, 0.97); sWhy = 'explore_run'
        elseif sForced == 'fight' then res = math.min(res, 0.05); sWhy = 'explore_fight' end
    end
    -- Guard: healed up at the fountain with no enemy near, retreat has nothing left to do. Game 9091079067:
    -- all five Dire bots stood in their fountain in retreat ('formula') for 3-4 game minutes with full health.
    -- RETREATSTUCK prints what retreat asked for there (Utils.DebugMode), to find the cause.
    -- Only for teams with a behaviour flag that can hold retreat (arbiter, escape): plain OHA stays as it was.
    if bFountainGuard and bot:IsAlive() and bot:GetActiveMode() == BOT_MODE_RETREAT and bot:DistanceFromFountain() < 1500
    and J.GetHP(bot) > 0.9 and J.GetMP(bot) > 0.8 and #J.GetEnemiesNearLoc(bot:GetLocation(), 1600) == 0 then
        if J.Utils.DebugMode and DotaTime() - fStuckLogAt >= 5 then
            fStuckLogAt = DotaTime()
            print('RETREATSTUCK team='..GetTeam()..' hero='..bot:GetUnitName()..' t='..math.floor(DotaTime())..' raw='..string.format('%.3f', res)..' why='..sWhy..' active='..string.format('%.3f', bot:GetActiveModeDesire()))
        end
        res = 0; sWhy = 'healed_at_fountain'
    end
    CountWhy()
    TrackDeath(res)
    if Trace ~= nil then SafeCall('trace', Trace.Tick, bot) end
    -- J.Utils.SetCachedVars(cacheKey, res)
    return res
end

function GetDesireHelper()
    botActiveMode = bot:GetActiveMode()

    if not bot:IsAlive()
    or bot:HasModifier('modifier_dazzle_nothl_projection_soul_clone')
    or bot:HasModifier('modifier_skeleton_king_reincarnation_scepter_active')
    or bot:HasModifier('modifier_item_helm_of_the_undying_active')
    or botActiveMode == BOT_MODE_EVASIVE_MANEUVERS
    or (bot:GetUnitName() == 'npc_dota_hero_lone_druid' and bot:HasModifier('modifier_fountain_aura_buff') and DotaTime() < 0)
    or bot:HasModifier('modifier_item_satanic_unholy')
    or J.GetModifierTime(bot, "modifier_abaddon_borrowed_time") > 2
    or J.GetModifierTime(bot, "modifier_muerta_pierce_the_veil_buff") > 2
    or J.GetModifierTime(bot, 'modifier_dazzle_shallow_grave') > 3
    or J.GetModifierTime(bot, 'modifier_oracle_false_promise_timer') > 3
    then
        return BOT_MODE_DESIRE_NONE
    end

    -- cache bot state
    botHP          = J.GetHP(bot)
    botMP          = J.GetMP(bot)
    botName        = bot:GetUnitName()
    botHealth      = bot:GetHealth()
    botHealthRegen = bot:GetHealthRegen()
    botManaRegen   = bot:GetManaRegen()
    botLocation    = bot:GetLocation()
    botTarget      = J.GetProperTarget(bot)
    botLevel       = bot:GetLevel()
    hTeamAncient   = GetAncient(GetTeam())
    hEnemyAncient  = GetAncient(GetOpposingTeam())

    -- build world once
    buildContext()
    nAllyHeroes  = C.allyHeroes
    nEnemyHeroes = C.enemyHeroes

    local nAllyTowers      = C.allyTowers1200
    local nEnemyTowers     = C.enemyTowers1200
    local nEnemyLaneCreeps = C.enemyLaneCreeps1200

    local bWeAreStronger = J.WeAreStronger(bot, 1600)
    local bTeamFight     = J.IsInTeamFight(bot, 1200)

    if bTeamFight and botName == "npc_dota_hero_skeleton_king"
        and bot:GetLevel() >= 6
    then
        local abilityR = bot:GetAbilityByName("skeleton_king_reincarnation")
        if abilityR:GetCooldownTimeRemaining() <= 1.0 and bot:GetMana() >= 160 then
            return BOT_MODE_DESIRE_NONE
        end
    end

    -- Before the horn: leave once a human hurts us, or as soon as more enemy heroes are in sight than allies
    -- here (us included). 9089836233: Sniper stood at the river at full health with 4-5 enemies in sight
    -- for 3 s (this rule needed damage first) and died at -0:01.
    if DotaTime() < 0 then
        local nSeen, bHuman = 0, false
        for _, enemy in pairs(nEnemyHeroes) do
            if J.IsValidHero(enemy) and not J.IsSuspiciousIllusion(enemy) then
                nSeen = nSeen + 1
                if not enemy:IsBot() then bHuman = true end
            end
        end
        local nDesire = RemapValClamped(botHP, 1, 0.1, BOT_MODE_DESIRE_HIGH, BOT_MODE_DESIRE_ABSOLUTE)
        -- Outnumbered: 0.9 from full health, above team roam (Sniper was in team roam there).
        if nSeen > #J.GetAlliesNearLoc(bot:GetLocation(), 1200) then return Why('prehorn', math.max(nDesire, 0.9)) end
        if botHP < 1 and bHuman then return Why('prehorn', nDesire) end
    end

    if botHP < 0.3 and #nEnemyHeroes >= 2 and bot:WasRecentlyDamagedByAnyHero(1) then
        return Why('lowhp_2enemies', RemapValClamped(botHP, 0.5, 0, BOT_MODE_DESIRE_HIGH, BOT_MODE_DESIRE_ABSOLUTE))
    end
    if X.LowChanceToRun() then
        return Why('low_chance_to_run', BOT_MODE_DESIRE_MODERATE)
    end

    -- Not part of actual retreat
    if (botName == 'npc_dota_hero_lone_druid' and DotaTime() > 25 and DotaTime() < fRetreatFromRoshanTime + 6.5) then
        return Why('druid', 3.33)
    end

    local vRoshanLocation = J.GetCurrentRoshanLocation()

    if botName == 'npc_dota_hero_lone_druid'
        and botActiveMode == BOT_MODE_ITEM
        and GetUnitToLocationDistance(bot, vRoshanLocation)
        and IsLocationVisible(vRoshanLocation)
    then
        if C.aegisNearby1200 then
            fRetreatFromRoshanTime = DotaTime()
            return Why('druid', 3.33)
        end
    end

    -- when roshan dies, every desire sometimes drops to 0 somehow and it lingers in Roshan mode (which is also 0)
    if botActiveMode == BOT_MODE_ROSHAN
        and not J.IsRoshanAlive()
        and GetUnitToLocationDistance(bot, vRoshanLocation)
        and IsLocationVisible(vRoshanLocation)
    then
        if not C.aegisNearby1200 then
            return Why('roshan_dead', BOT_MODE_DESIRE_MODERATE)
        end
    end

    if bot:HasModifier('modifier_fountain_fury_swipes_damage_increase')
        or (not bTeamFight and J.IsTargetedByEnemyWithModifier(nEnemyHeroes, 'modifier_skeleton_king_reincarnation_scepter_active'))
        or (not bTeamFight and J.IsTargetedByEnemyWithModifier(nEnemyHeroes, 'modifier_item_helm_of_the_undying_active'))
    then
        return Why('swipes_or_undying', RemapValClamped(botHP, 0.9, 0.5, BOT_MODE_DESIRE_VERYLOW, BOT_MODE_DESIRE_ABSOLUTE))
    end

    if (bot:HasModifier('modifier_doom_bringer_doom_aura_enemy') and (#nEnemyHeroes > 0 or #nEnemyHeroes > #nAllyHeroes + 1))
        or (bot:HasModifier('modifier_razor_static_link_debuff') and J.IsUnitNearby(bot ,nEnemyHeroes, 700, 'npc_dota_hero_razor', true) and #nEnemyHeroes >= #nAllyHeroes)
        or (bot:HasModifier('modifier_ursa_fury_swipes_damage_increase') and not bTeamFight and J.IsUnitNearby(bot, nEnemyHeroes, 700, 'npc_dota_hero_ursa', true))
        or (bot:HasModifier('modifier_ice_blast') and not bTeamFight and #nEnemyHeroes > #nAllyHeroes)
    then
        return Why('deadly_debuff', RemapValClamped(botHP, 0.9, 0.6, BOT_MODE_DESIRE_HIGH, BOT_MODE_DESIRE_ABSOLUTE))
    end

    if botName == 'npc_dota_hero_huskar' and not bot:HasModifier('modifier_item_spirit_vessel_damage') then
        local hAbility = bot:GetAbilityByName('huskar_berserkers_blood')
        if hAbility and hAbility:IsTrained() and hAbility:GetLevel() >= 3 then
            if botHP > 0.2 and botHealthRegen > 30 then botHP = 1 end
            if botHP < 0.3 and (#nEnemyHeroes == 0 and J.HasItem(bot, 'item_armlet')) then botHP = 1 end
        end
    end

    if ((botMP < 0.4) and bot:DistanceFromFountain() <= 4000 and not bTeamFight) then
        return Why('low_mana_near_fountain', RemapValClamped(botHP, 0.9, 0.2, BOT_MODE_DESIRE_HIGH, BOT_MODE_DESIRE_VERYHIGH))
    end

    if bot:HasModifier('modifier_fountain_aura_buff') then
        if botHP <= 0.9 or (botMP <= 0.8 and botName ~= 'npc_dota_hero_huskar') then
            return Why('fountain_heal', RemapValClamped(botHP, 0.9, 0.5, BOT_MODE_DESIRE_HIGH, BOT_MODE_DESIRE_ABSOLUTE))
        end

        if (#nEnemyHeroes > #nAllyHeroes) and not bWeAreStronger and not J.CanBeAttacked(hTeamAncient)
        then
            return Why('fountain_outnumbered', RemapValClamped(botHP, 0.9, 0.5, BOT_MODE_DESIRE_HIGH, BOT_MODE_DESIRE_HIGH))
        end
    end

    -- Behaviour flag `laning`: during a lane trade burst with health fine, the burst steps back itself;
    -- this retreat took over after every harass hit.
    if (J.IsInLaningPhase() or botHP < 0.35)
    and not (bLaningFlag and (bot.laningHoldUntil ~= nil and DotaTime() < bot.laningHoldUntil) and botHP >= 0.5) then
        local creepDamage = 0
        local nEnemyCreeps = bot:GetNearbyCreeps(1200, true)
        for _, creep in pairs(nEnemyCreeps) do
            if J.IsValid(creep)
                and not J.IsRoshan(creep)
                and not J.IsTormentor(creep)
                and creep:GetAttackTarget() == bot
            then
                creepDamage = creepDamage + bot:GetActualIncomingDamage(creep:GetAttackDamage() * creep:GetAttackSpeed() * 3.0, DAMAGE_TYPE_PHYSICAL)
            end
        end

        if creepDamage / (botHealth + botHealthRegen * 3.0) > 0.15 then
            return Why('creep_aggro', RemapValClamped(botHP, 0.9, 0.5, BOT_MODE_DESIRE_HIGH, BOT_MODE_DESIRE_VERYHIGH))
        end
    end

    -- should directly run
    if bot:IsAlive() then
        if fCurrentRunTime ~= 0 and DotaTime() < fCurrentRunTime + fShouldRunTime then
            return Why('run:'..sRunWhy, BOT_MODE_DESIRE_ABSOLUTE * 1.1)
        else
            fCurrentRunTime = 0
        end

        fShouldRunTime = X.ShouldRun()
        if fShouldRunTime ~= 0 then
            if fCurrentRunTime == 0 then
                fCurrentRunTime = DotaTime()
            end
            return Why('run:'..sRunWhy, BOT_MODE_DESIRE_ABSOLUTE * 1.1)
        end
    end

    -- try complete items
    local nCompletItemDesire = X.ConsiderCompleteItem()
    if nCompletItemDesire > 0 then
        return Why('complete_item', nCompletItemDesire)
    end

    -- ==== nearby counts (reusing context + last-seen augmentation) ====
    local nEnemyNearbyCount = #nEnemyHeroes
    local nAllyNearbyCount  = #nAllyHeroes

    local unseenCount = 0
    for _, id in pairs(GetTeamPlayers(GetOpposingTeam())) do
        if IsHeroAlive(id) then
            local info = GetHeroLastSeenInfo(id)
            if info ~= nil then
                local dInfo = info[1]
                if dInfo ~= nil and GetUnitToLocationDistance(bot, dInfo.location) <= 3200 and dInfo.time_since_seen <= 5.0 then
                    unseenCount = unseenCount + 1
                end
            end
        end
    end
    if unseenCount > #nEnemyHeroes then nEnemyNearbyCount = unseenCount end

    -- apply single-pass extras (golem/tombstone/sun/tower danger; ally sun)
    nEnemyNearbyCount = nEnemyNearbyCount + C.enemyNearbyExtra
    nAllyNearbyCount  = nAllyNearbyCount  + C.allyNearbyExtra

    if J.IsInLaningPhase()
        and J.IsValidBuilding(nAllyTowers[1])
        and bot:HasModifier('modifier_tower_aura_bonus')
        and #nEnemyLaneCreeps <= 1
    then
        nAllyNearbyCount = nAllyNearbyCount + 1
    end

    -- regen over 5s lookahead (unchanged)
    botHP = botHP + (botHealthRegen * 5.0 / bot:GetMaxHealth())
    botMP = botMP + (botManaRegen * 5.0 / bot:GetMaxMana())

    local nHealth = 0
    if botName == 'npc_dota_hero_medusa' then
        local unitHealth    = botHealth - bot:GetMana()
        local unitMaxHealth = bot:GetMaxHealth() - bot:GetMaxMana()
        nHealth = (unitHealth / unitMaxHealth) * 0.2 + botMP * 0.8
    elseif botName == 'npc_dota_hero_huskar' then
        nHealth = botHP
    else
        nHealth = botHP * 0.8 + botMP * 0.2
    end

    local nDesire = 1 - ((nHealth + 1 - (1 - nHealth) ^ 4) / 2)

    if nEnemyNearbyCount > 0 then
        if nEnemyNearbyCount - nAllyNearbyCount > 0 then
            nDesire = nDesire + (nEnemyNearbyCount - nAllyNearbyCount) * (0.75 / 4)
            if J.IsInLaningPhase() then
                nDesire = nDesire + (#J.GetHeroesTargetingUnit(nEnemyHeroes, bot)) * (0.75 / 4)
            end
        end

        if not bWeAreStronger and nEnemyNearbyCount >= nAllyNearbyCount then nDesire = nDesire + 0.25 end
        if nAllyNearbyCount >= nEnemyNearbyCount or bWeAreStronger then
            if bot:HasModifier('modifier_oracle_false_promise_timer') and J.GetModifierTime(bot, 'modifier_oracle_false_promise_timer') > 2.0 and J.IsUnitNearby(bot, nAllyHeroes, 1200, 'npc_dota_hero_oracle', true) then
                nDesire = nDesire - 0.25
            end
            if bot:HasModifier('modifier_dazzle_shallow_grave') and J.GetModifierTime(bot, 'modifier_dazzle_shallow_grave') >= 2.0 and J.IsUnitNearby(bot, nAllyHeroes, 1200, 'npc_dota_hero_dazzle', true) then
                nDesire = nDesire - 0.2
            end
            if bot:HasModifier('modifier_item_satanic_unholy') then
                nDesire = nDesire - 0.3
            end

            local hAbility = bot:GetAbilityByName('slark_shadow_dance')
            if J.CanCastAbility(hAbility)
                or (hAbility ~= nil and hAbility:IsTrained() and hAbility:GetCooldownTimeRemaining() <= 3 and bot:GetMana() >= 150)
                or (bot:HasModifier('modifier_slark_shadow_dance') and J.GetModifierTime(bot, 'modifier_slark_shadow_dance') > 1.5)
            then
                nDesire = nDesire - 0.3
            end
        end
    end

    if bot:DistanceFromFountain() > 4000 then
        if (nEnemyNearbyCount == 0 and unseenCount == 0) and #nEnemyTowers == 0 then nDesire = nDesire - 0.25 end
    end

    if J.IsInLaningPhase() then
        if not bot:WasRecentlyDamagedByAnyHero(3.0)
            and botHP > 0.25
            and bot:DistanceFromFountain() > 4000
            and (#J.GetHeroesTargetingUnit(nEnemyHeroes, bot) == 0)
        then
            nDesire = nDesire - 0.75
        end
    end

    -- nDesire = nDesire + X.GetUnitDesire(1200) -- (left commented as original)
    local nTowerDesire = X.RetreatWhenTowerTargetedDesire()
    nDesire = nDesire + nTowerDesire

    return Why(nTowerDesire > 0 and 'formula+tower' or 'formula', Min(nDesire, 1.0))
end

function X.LowChanceToRun()
    local nEnemysHeroes = J.GetNearbyHeroes(bot, 900, true, BOT_MODE_NONE)
    if #nEnemysHeroes >= 3 and #nEnemysHeroes >= #nAllyHeroes and botHP < 0.4
        and bot:WasRecentlyDamagedByAnyHero(1) and bot:GetCurrentMovementSpeed() < 330
    then
        if J.IsValidHero(botTarget) and J.CanKillTarget(botTarget, bot:GetAttackDamage() * 2.5, DAMAGE_TYPE_PHYSICAL) then
            return true
        end
        for _, enemy in pairs(nEnemysHeroes) do
            if J.IsValidHero(enemy) and J.CanKillTarget(enemy, bot:GetAttackDamage() * 2.5, DAMAGE_TYPE_PHYSICAL) then
                if not J.IsValidHero(botTarget) then
                    bot:SetTarget(enemy)
                end
                return true
            end
        end
    end
    return false
end

function X.GetUnitDesire(nRadius)
    local unitList = GetUnitList(UNIT_LIST_ENEMIES)
    for _, unit in pairs(unitList) do
        if J.IsValid(unit)
            and not unit:IsBuilding()
            and J.IsInRange(bot, unit, nRadius)
        then
            local sUnitName = unit:GetUnitName()
            local unitDamage = 0
            local bIsTargetingThisBot = J.IsChasingTarget(unit, bot) or unit:GetAttackTarget() == bot

            if not unit:HasModifier('modifier_arc_warden_tempest_double') and J.IsSuspiciousIllusion(unit) then
                local tIllusions = J.GetSameUnitType(bot, 1600, sUnitName, false)
                unitDamage = J.GetUnitListTotalAttackDamage(bot, tIllusions, 5.0)
                local illusionDamage = bot:GetActualIncomingDamage(unitDamage, DAMAGE_TYPE_PHYSICAL) - botHealthRegen * 5.0
                if illusionDamage / botHealth > 0.5 then
                    if illusionDamage / botHealth > 0.65 then return 0.9 else return 0.75 end
                end
            elseif string.find(sUnitName, 'warlock_golem') and bIsTargetingThisBot then
                local tWarlockGolems = J.GetSameUnitType(bot, 1600, sUnitName, false)
                unitDamage = J.GetUnitListTotalAttackDamage(bot, tWarlockGolems, 5.0)
                local golemsDamage = bot:GetActualIncomingDamage(unitDamage, DAMAGE_TYPE_PHYSICAL) - botHealthRegen * 5.0
                if golemsDamage / botHealth > 0.45 then return 0.9 end
            elseif string.find(sUnitName, 'spiderlings') and bIsTargetingThisBot and not J.IsInTeamFight(bot, 1600) then
                local tSpiderlings = J.GetSameUnitType(bot, 1600, sUnitName, true)
                unitDamage = J.GetUnitListTotalAttackDamage(bot, tSpiderlings, 5.0)
                local spiderlingsDamage = bot:GetActualIncomingDamage(unitDamage, DAMAGE_TYPE_PHYSICAL) - botHealthRegen * 5.0
                if spiderlingsDamage / botHealth > 0.25 then return 0.75 end
            elseif string.find(sUnitName, 'eidolon') and bIsTargetingThisBot and not J.IsInTeamFight(bot, 1600) then
                local tEidolons = J.GetSameUnitType(bot, 1600, sUnitName, true)
                unitDamage = J.GetUnitListTotalAttackDamage(bot, tEidolons, 5.0)
                local eidolonDamage = bot:GetActualIncomingDamage(unitDamage, DAMAGE_TYPE_PHYSICAL) - botHealthRegen * 5.0
                if eidolonDamage / botHealth > 0.25 then return 0.9 end
            end
        end
    end
    return 0
end

function X.RetreatWhenTowerTargetedDesire()
    if DotaTime() > 10 * 60 or J.IsInTeamFight(bot, 1600) then
        return 0
    end

    local nEnemyTowers = bot:GetNearbyTowers(800, true)

    if J.IsValidBuilding(nEnemyTowers[1]) and not J.IsPushing(bot) then
        if J.IsGoingOnSomeone(bot) then
            if J.IsValidHero(botTarget)
                and not J.IsSuspiciousIllusion(botTarget)
                and not botTarget:HasModifier('modifier_dazzle_shallow_grave')
                and not botTarget:HasModifier('modifier_necrolyte_reapers_scythe')
            then
                local nDamage = bot:GetEstimatedDamageToTarget(true, botTarget, 5.0, DAMAGE_TYPE_ALL) * 1.2
                nDamage = botTarget:GetActualIncomingDamage(nDamage, DAMAGE_TYPE_ALL)
                if nDamage / botTarget:GetHealth() < 0.88 then
                    return 0.9
                end
            end
        end

        if nEnemyTowers[1]:GetAttackTarget() == bot then
            return 0.9
        end
    end

    return 0
end

local enemyPids = nil;
function X.ShouldRun()
    if bot:HasModifier('modifier_medusa_stone_gaze_facing') 
	then
		AttackTarget=bot:GetAttackTarget()
		if AttackTarget~=nil and AttackTarget:GetUnitName() == "npc_dota_hero_medusa"  
		and J.IsOtherAllyCanKillTarget( bot, AttackTarget )
		then
			
		else  
			return RunWhy('medusa', 3.33)
		end
	end
    
		
	if bot:IsChanneling() 
    or not bot:IsAlive()
    then
        return 0
    end	   
    
    local botMode     = bot:GetActiveMode();
    local hEnemyHeroList = J.GetEnemyList(bot,1600);
    local hAllyHeroList  = J.GetAllyList(bot,1600);
    local enemyFountainDistance = J.GetDistanceFromEnemyFountain(bot);
    local enemyAncient = GetAncient(GetOpposingTeam());
    local enemyAncientDistance = GetUnitToUnitDistance(bot,enemyAncient);
    local aliveEnemyCount = J.GetNumOfAliveHeroes(true)
    local rushEnemyTowerDistance = 250;

    if enemyFountainDistance < 1000
    then
        return RunWhy('enemy_fountain', 2);
    end

    if bot:DistanceFromFountain() < 200
		and botMode ~= BOT_MODE_RETREAT
		and ( J.GetHP(bot) + J.GetMP(bot) < 1.7 )
	then
		return RunWhy('at_fountain', 3);
	end

    if botLevel < 6
		and DotaTime() > 30
		and DotaTime() < 8 * 60
		and enemyFountainDistance < 8111
		-- Behaviour flag `laning`: a lane trade burst is not a chase (same rule as mode_farm_generic).
		and not (bLaningFlag and (bot.laningHoldUntil ~= nil and DotaTime() < bot.laningHoldUntil))
	then
		if botTarget ~= nil and botTarget:IsHero()
		   and J.GetHP(botTarget) > 0.35
		   and (  not J.IsInRange(bot,botTarget,bot:GetAttackRange() + 150) 
				  or not J.CanKillTarget(botTarget, bot:GetAttackDamage() * 2.33, DAMAGE_TYPE_PHYSICAL) )
		then
			return RunWhy('anti_chase', 2.88);
		end
	end

    for _, enemyHero in pairs(nEnemyHeroes) do
        if J.IsValidHero(enemyHero)
            and not J.IsSuspiciousIllusion(enemyHero)
            and not enemyHero:HasModifier('modifier_necrolyte_reapers_scythe')
        then
            local enemyHeroAttackRange = enemyHero:GetAttackRange()
            if (enemyHero:HasModifier('modifier_muerta_pierce_the_veil_buff') and J.IsInRange(bot, enemyHero, enemyHeroAttackRange) and botHP < 0.5) then
                local fModifierTime = J.GetModifierTime(enemyHero, 'modifier_muerta_pierce_the_veil_buff')
                if enemyHero:GetEstimatedDamageToTarget(false, bot, fModifierTime, DAMAGE_TYPE_MAGICAL) >= (botHealth + botHealthRegen * fModifierTime) then
                    return RunWhy('muerta', fModifierTime)
                end
            elseif (enemyHero:HasModifier('modifier_bristleback_active_conical_quill_spray') and J.IsInRange(bot, enemyHero, 400) and not enemyHero:IsFacingLocation(botLocation, 70)) then
                return RunWhy('bb_quills', 3)
            end
        end
    end

    local nEnemyTowers = bot:GetNearbyTowers(898, true);
	local nEnemyBrracks = bot:GetNearbyBarracks(800,true);
	
	if #nEnemyBrracks >= 1 and aliveEnemyCount >= 2 and #hEnemyHeroList >= #hAllyHeroList
	then
		if #nEnemyTowers >= 2
		   or enemyAncientDistance <= 1314
		   or enemyFountainDistance <= 2828
		then
			return RunWhy('barracks', 2);
		end
	end
    if nEnemyTowers[1] ~= nil and botLevel < 16
	then
		if nEnemyTowers[1]:HasModifier("modifier_invulnerable") and aliveEnemyCount > 1
		then
			return RunWhy('invuln_tower', 2.5);
		end
		
		if  enemyAncientDistance > 2100
			and enemyAncientDistance < GetUnitToUnitDistance(nEnemyTowers[1],enemyAncient) - rushEnemyTowerDistance
		then
			local nTarget = J.GetProperTarget(bot);
			if nTarget == nil
			then
				return RunWhy('tower_dive_no_target', 3.9);
			end
			
			if J.IsValidHero(nTarget) and aliveEnemyCount > 2
			then
				
				local assistAlly = false;
				
				for _,ally in pairs(hAllyHeroList)
				do
					if GetUnitToUnitDistance(ally,nTarget) <= ally:GetAttackRange() + 100
						and (ally:GetAttackTarget() == nTarget or ally:GetTarget() == nTarget)
					then
						assistAlly = true;
						break;
					end
				end
				
				if not assistAlly 
				then
					return RunWhy('tower_dive_no_assist', 2.5);
				end
				
			end
		end
    end
        
	-- 前期谨慎冲塔
	if botLevel <= 10 and DotaTime() > 0
    and (#hEnemyHeroList > 0 or bot:GetHealth() < 800)
    then
        local nLongEnemyTowers = bot:GetNearbyTowers(1200, true);
        if bot:GetAssignedLane() == LANE_MID
        then
            nLongEnemyTowers = bot:GetNearbyTowers(1100, true);
            nEnemyTowers     = bot:GetNearbyTowers(980, true);
        end
        if ( botLevel <= 5 or DotaTime() < 5 * 60 )
            and nEnemyTowers[1] ~= nil
        then
            return RunWhy('early_enemy_tower', 2);
        end
        if botLevel <= 9
            and nEnemyTowers[1] ~= nil
            and nEnemyTowers[1]:CanBeSeen()
            and nEnemyTowers[1]:GetAttackTarget() == bot
            and #hAllyHeroList <= 1
        then
            return RunWhy('tower_targets_me', 2);
        end
    end

    if #hAllyHeroList <= 1 
    and botMode ~= BOT_MODE_TEAM_ROAM
    and botMode ~= BOT_MODE_LANING
    and botMode ~= BOT_MODE_RETREAT
    and ( botLevel <= 1 or botLevel > 5 ) 
    and bot:DistanceFromFountain() > 1400
    then
        if enemyPids == nil then
            enemyPids = GetTeamPlayers(GetOpposingTeam())
        end	
        local enemyCount = 0
        for i = 1, #enemyPids do
            local info = GetHeroLastSeenInfo(enemyPids[i])
            if info ~= nil then
                local dInfo = info[1]; 
                if dInfo ~= nil and dInfo.time_since_seen < 2.0  
                    and GetUnitToLocationDistance(bot,dInfo.location) < 1000 
                then
                    enemyCount = enemyCount +1;
                end
            end	
        end
        if (enemyCount >= 4 or #hEnemyHeroList >= 4) 
            and botMode ~= BOT_MODE_ATTACK
            and botMode ~= BOT_MODE_TEAM_ROAM
            and bot:GetCurrentMovementSpeed() > 300
        then
            local nNearByHeroes = bot:GetNearbyHeroes(700,true,BOT_MODE_NONE);
            if #nNearByHeroes < 2
            then
                return RunWhy('outnumbered4', 4);
            end
        end	
        if  botLevel >= 9 and botLevel <= 17  
            and (enemyCount >= 3 or #hEnemyHeroList >= 3) 
            and botMode ~= BOT_MODE_LANING
            and bot:GetCurrentMovementSpeed() > 300
        then
            local nNearByHeroes = bot:GetNearbyHeroes(700,true,BOT_MODE_NONE);
            if #nNearByHeroes < 2
            then
                return RunWhy('outnumbered3', 3);
            end
        end
        local nEnemy = bot:GetNearbyHeroes(800,true,BOT_MODE_NONE);
        for _,enemy in pairs(nEnemy) do
            if J.IsValid(enemy)
                and enemy:GetUnitName() == "npc_dota_hero_necrolyte"
                and enemy:GetMana() >= 200
                and J.GetHP(bot) < 0.45
                and enemy:IsFacingLocation(bot:GetLocation(),20)
            then
                return RunWhy('necro', 3);
            end
        end
	end

    if J.Utils.HasModifierContainsName(bot, "warlock_golem") then
        local nUnits = GetUnitList(UNIT_LIST_ENEMIES)
        for _, unit in pairs(nUnits) do
            if J.IsValid(unit)
                and J.IsInRange(bot, unit, unit:GetAttackRange() + 400)
            then
                if ((J.GetHP(bot) < J.GetHP(unit) and J.GetHP(bot) < 0.75) or J.GetHP(bot) < 0.5) then
                    return RunWhy('golem', 3)
                end
            end
        end
    end

    if botLevel < 10
        and bot:GetAttackDamage() < 133
        and J.IsValid(botTarget)
        and botTarget:IsAncientCreep()
        and #nAllyHeroes <= 1
        and bot:DistanceFromFountain() > 3000
    then
        return RunWhy('ancient_creep', 6.21)
    end

    if J.IsRealInvisible(bot)
        and not J.IsEarlyGame()
        and J.IsRetreating(bot)
        and bot:GetActiveModeDesire() > 0.4
        and #nAllyHeroes <= 1
        and J.IsValidHero(nEnemyHeroes[1])
        and botName ~= "npc_dota_hero_riki"
        and botName ~= "npc_dota_hero_bounty_hunter"
        and botName ~= "npc_dota_hero_slark"
        and J.GetDistanceFromAncient(bot, false) < J.GetDistanceFromAncient(nEnemyHeroes[1], false)
    then
        return RunWhy('invisible', 5)
    end

    return 0
end

function X.ConsiderCompleteItem()
    local nTeamFightLocation = J.GetTeamFightLocation(bot)
    if nTeamFightLocation == nil and #nEnemyHeroes == 0 and bot:DistanceFromFountain() < 4400 and not bot:HasModifier('modifier_fountain_aura_buff') then
        if J.Item.GetEmptyInventoryAmount(bot) == 0 then
            -- check if stash has recipe
            local bRecipeInStash = false
            local sItemRecipe = ''
            for i = 9, 14 do
                local hStashItem = bot:GetItemInSlot(i)
                if hStashItem then
                    if string.find(hStashItem:GetName(), 'item_recipe') then
                        sItemRecipe = hStashItem:GetName()
                        bRecipeInStash = true
                        break
                    end
                end
            end

            if bRecipeInStash then
                local sItemName = string.gsub(sItemRecipe, '_recipe', '')
                local tItemComponents = GetItemComponents(sItemName)[1]
                local count = 0
                for i = 0, 14 do
                    local hItem = bot:GetItemInSlot(i)
                    if hItem and not hItem:IsCombineLocked() then
                        local sItemName_ = hItem:GetName()
                        if i <= 8 and string.find(sItemName_, 'recipe') then
                            return 0
                        end
                        for j = 1, #tItemComponents do
                            if sItemName_ == tItemComponents[j] then
                                count = count + 1
                            end
                        end
                    end
                end

                if count > 0 and count == #tItemComponents then
                    return BOT_MODE_DESIRE_ABSOLUTE * 1.5
                end
            end
        end
    end
    return 0
end

-- Behaviour flag `escape` (behavior/escape): walk a route home that keeps away from the chasing enemies.
-- Flag off: no Think here, so the engine's default retreat (straight to the fountain) runs as before.
if require(GetScriptDirectory()..'/FunLib/behavior/flags').IsOn('escape') then
	local Escape = require(GetScriptDirectory()..'/FunLib/behavior/escape')
	function Think()
		local ok = SafeCall('escape', Escape.Think, bot)
		if ok == nil and not J.CanNotUseAction(bot) and bot:GetCurrentActionType() ~= BOT_ACTION_TYPE_MOVE_TO then
			bot:Action_MoveToLocation(J.GetTeamFountain())
		end
	end
end

-- Behaviour flag `arbiter` (docs/specs/smarter-bot-behaviour.md 3.2). Flag off: GetDesire stays the function above.
GetDesire = require(GetScriptDirectory()..'/FunLib/behavior/arbiter').Wrap(bot, BOT_MODE_RETREAT, GetDesire)

return X
