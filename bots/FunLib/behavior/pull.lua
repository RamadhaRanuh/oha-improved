--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local function __TS__NumberToFixed(self, fractionDigits)
    if math.abs(self) >= 1e+21 or self ~= self then
        return tostring(self)
    end
    local f = math.floor(fractionDigits or 0)
    if f < 0 or f > 99 then
        error("toFixed() digits argument must be between 0 and 99", 0)
    end
    return string.format(
        ("%." .. tostring(f)) .. "f",
        self
    )
end
-- End of Lua Library inline imports
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local Lane = ____dota.Lane
local Team = ____dota.Team
local Tower = ____dota.Tower
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local ____desire_tiers = require(GetScriptDirectory().."/FunLib/behavior/desire_tiers")
local DesireTier = ____desire_tiers.DesireTier
local PULL_START_TIME = 75
local PUSHED_DIST = 1800
local PUSHED_AMOUNT = 0.6
local CAMP_MAX_FROM_LANE = 1600
local CREEP_SPEED = 325
local PULL_WAVE_DELAY = 0
local WAIT_MAX = 14
local LIVE_EVERY = 0.25
local LIVE_PATH_DIST = 450
local LIVE_MIN_INDEX = 5
local AGGRO_LEAD = 1
local MAX_PLAN_AHEAD = 28
local GO_EARLY = 3
local STAND_FROM_CAMP = 300
local HIT_TIMEOUT = 2
local DRAG_TIMEOUT = 9
local DRAG_BEYOND = 0.03
local ABORT_ENEMY_RADIUS = 900
local MIN_HP = 0.45
local NEUTRAL_TEAM = 4
local OFFLANER_ALONE = 2500
local PARTNER_RADIUS = 1600
local PARTNER_ENEMY = 1400
local states = {}
local function StateOf(bot)
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local s = states[key]
    if s == nil then
        s = {
            plan = nil,
            planLane = -1,
            phase = "none",
            hitAt = -999,
            waveAt = -999,
            phaseStart = -999,
            pulledWave = -999,
            firstCreepAt = -1,
            lastMoveTime = -999,
            maxOnNeutrals = 0,
            hitGameStart = -999,
            liveAt = -999,
            liveEta = nil
        }
        states[key] = s
    end
    return s
end
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function Toward(from, to, distance)
    local d = Dist(from, to)
    if d < 1 then
        return from
    end
    return Vector(from.x + (to.x - from.x) / d * distance, from.y + (to.y - from.y) / d * distance, from.z)
end
local function SafeLane()
    return GetTeam() == Team.Radiant and Lane.Bot or Lane.Top
end
local function OffLane()
    return GetTeam() == Team.Radiant and Lane.Top or Lane.Bot
end
--- The lane this bot pulls in, or null when it does not pull.
local function PullLane(bot)
    local pos = jmz.GetPosition(bot)
    if pos == 5 then
        return SafeLane()
    end
    if pos == 4 then
        return OffLane()
    end
    if pos ~= 3 then
        return nil
    end
    for ____, ally in ipairs(GetUnitList(UnitType.AlliedHeroes)) do
        do
            local __continue13
            repeat
                if ally == nil or ally == bot or ally:IsNull() or not ally:IsAlive() or ally:IsIllusion() then
                    __continue13 = true
                    break
                end
                if jmz.GetPosition(ally) == 4 and Dist(
                    ally:GetLocation(),
                    bot:GetLocation()
                ) < OFFLANER_ALONE then
                    return nil
                end
                __continue13 = true
            until true
            if not __continue13 then
                break
            end
        end
    end
    return OffLane()
end
--- Offlane: a lane ally (or we) has an enemy hero next to it; leaving would cost the partner.
local function PartnerPressed(bot)
    for ____, ally in ipairs(jmz.GetAlliesNearLoc(
        bot:GetLocation(),
        PARTNER_RADIUS
    )) do
        if #jmz.GetEnemiesNearLoc(
            ally:GetLocation(),
            PARTNER_ENEMY
        ) > 0 then
            return true
        end
    end
    return false
end
local ENEMY_T1 = {[Lane.Top] = Tower.Top1, [Lane.Mid] = Tower.Mid1, [Lane.Bot] = Tower.Bot1}
--- The camp to pull: one of ours, small or medium, closest to the safe-lane path (within 1600).
-- GetLocationAlongLane's 0 end may be either base, so the end nearer our fountain is taken as the spawn end.
local function MakePlan(lane)
    local fountain = jmz.GetTeamFountain()
    local fromZero = Dist(
        GetLocationAlongLane(lane, 0),
        fountain
    ) < Dist(
        GetLocationAlongLane(lane, 1),
        fountain
    )
    local STEPS = 100
    local path = {}
    do
        local i = 0
        while i <= STEPS do
            path[#path + 1] = GetLocationAlongLane(lane, fromZero and i / STEPS or 1 - i / STEPS)
            i = i + 1
        end
    end
    local best = nil
    local bestDist = CAMP_MAX_FROM_LANE
    local camps = GetNeutralSpawners()
    for key in pairs(camps) do
        do
            local __continue23
            repeat
                local camp = camps[key]
                if camp == nil or camp == nil or camp.location == nil or camp.location == nil then
                    __continue23 = true
                    break
                end
                if camp.team ~= nil and camp.team ~= GetTeam() then
                    __continue23 = true
                    break
                end
                local ____camp_type_0 = camp.type
                if ____camp_type_0 == nil then
                    ____camp_type_0 = ""
                end
                local ____type = tostring(____camp_type_0)
                if ____type ~= "small" and ____type ~= "medium" then
                    __continue23 = true
                    break
                end
                local loc = camp.location
                local nearest = -1
                local nearestDist = 99999
                do
                    local i = 0
                    while i <= STEPS do
                        local d = Dist(path[i + 1], loc)
                        if d < nearestDist then
                            nearestDist = d
                            nearest = i
                        end
                        i = i + 1
                    end
                end
                if nearest < 0 or nearestDist >= bestDist then
                    __continue23 = true
                    break
                end
                local cum = {0}
                do
                    local i = 1
                    while i <= STEPS do
                        cum[#cum + 1] = cum[i] + Dist(path[i], path[i + 1])
                        i = i + 1
                    end
                end
                local pathLen = cum[nearest + 1]
                local dragIndex = math.max(
                    0,
                    nearest - math.floor(DRAG_BEYOND * STEPS)
                )
                bestDist = nearestDist
                best = {
                    lane = lane,
                    campLoc = loc,
                    campType = ____type,
                    standLoc = Toward(loc, path[nearest + 1], STAND_FROM_CAMP),
                    pullLoc = path[nearest + 1],
                    dragLoc = path[dragIndex + 1],
                    pathLen = pathLen,
                    path = path,
                    cum = cum,
                    pullIndex = nearest
                }
                __continue23 = true
            until true
            if not __continue23 then
                break
            end
        end
    end
    return best
end
local function WavePushed(lane)
    local front = GetLaneFrontLocation(
        GetTeam(),
        lane,
        0
    )
    local tower = GetTower(
        GetOpposingTeam(),
        ENEMY_T1[lane]
    )
    if tower ~= nil and tower ~= nil and not tower:IsNull() and tower:IsAlive() then
        return Dist(
            front,
            tower:GetLocation()
        ) < PUSHED_DIST
    end
    return GetLaneFrontAmount(
        GetTeam(),
        lane,
        false
    ) > PUSHED_AMOUNT
end
local function EnemyNear(bot, loc, radius)
    for ____, enemy in ipairs(bot:GetNearbyHeroes(1600, true, BotMode.None)) do
        if jmz.IsValidHero(enemy) and not jmz.IsSuspiciousIllusion(enemy) and Dist(
            enemy:GetLocation(),
            loc
        ) < radius then
            return true
        end
    end
    return false
end
--- Arrival phase of our waves at each lane's pull point (seconds mod 30), shared by the team; unset until seen.
local wavePhase = {}
--- Seconds until the nearest allied lane creep still on our side of the pull point reaches it, or
-- null if none is on the path. Scanned at most every LIVE_EVERY s per bot.
local function LiveEta(s, plan, now)
    if now - s.liveAt < LIVE_EVERY then
        return s.liveEta
    end
    s.liveAt = now
    local best = nil
    for ____, creep in ipairs(GetUnitList(UnitType.AlliedCreeps)) do
        do
            local __continue40
            repeat
                if not jmz.IsValid(creep) or (string.find(
                    creep:GetUnitName(),
                    "guys",
                    nil,
                    true
                ) or 0) - 1 < 0 then
                    __continue40 = true
                    break
                end
                local loc = creep:GetLocation()
                local index = -1
                local nearest = LIVE_PATH_DIST
                do
                    local i = LIVE_MIN_INDEX
                    while i <= plan.pullIndex do
                        local d = Dist(plan.path[i + 1], loc)
                        if d < nearest then
                            nearest = d
                            index = i
                        end
                        i = i + 1
                    end
                end
                if index < 0 or index >= plan.pullIndex then
                    __continue40 = true
                    break
                end
                local eta = (plan.cum[plan.pullIndex + 1] - plan.cum[index + 1]) / CREEP_SPEED
                if best == nil or eta < best then
                    best = eta
                end
                __continue40 = true
            until true
            if not __continue40 then
                break
            end
        end
    end
    s.liveEta = best
    if best ~= nil then
        wavePhase[plan.lane] = ((now + best) % 30 + 30) % 30
    end
    return best
end
--- Seconds until the next wave reaches the pull point: the live wave if one is on the path, else from the phase.
local function NextArrival(s, plan, now)
    local live = LiveEta(s, plan, now)
    if live ~= nil then
        return live
    end
    local seen = wavePhase[plan.lane]
    local phase = seen ~= nil and seen or (plan.pathLen / CREEP_SPEED + PULL_WAVE_DELAY) % 30
    return ((phase - now) % 30 + 30) % 30
end
local function DragTime(bot, plan)
    return Dist(plan.standLoc, plan.dragLoc) / math.max(
        bot:GetCurrentMovementSpeed(),
        200
    )
end
local function CountOnNeutrals(bot)
    local n = 0
    for ____, creep in ipairs(bot:GetNearbyLaneCreeps(1200, false)) do
        do
            local __continue52
            repeat
                if not jmz.IsValid(creep) then
                    __continue52 = true
                    break
                end
                local t = creep:GetAttackTarget()
                if t ~= nil and t ~= nil and t:GetTeam() == NEUTRAL_TEAM then
                    n = n + 1
                end
                __continue52 = true
            until true
            if not __continue52 then
                break
            end
        end
    end
    return n
end
local function End(bot, s, result)
    if Utils.DebugMode and s.phase ~= "none" and s.phase ~= "go" then
        local onNeutrals = math.max(
            s.maxOnNeutrals,
            CountOnNeutrals(bot)
        )
        if result == "fought" and onNeutrals == 0 then
            result = "missed"
        end
        local eta = s.firstCreepAt > 0 and __TS__NumberToFixed(s.firstCreepAt - s.waveAt, 1) or "none"
        print((((((((((((((("PULL team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(DotaTime()))) .. " result=") .. result) .. " creepsOnNeutrals=") .. tostring(onNeutrals)) .. " waveEta=") .. eta) .. " camp=") .. (s.plan and s.plan.campType or "?")) .. " lane=") .. tostring(s.plan and s.plan.lane or "?"))
    elseif Utils.DebugMode and s.phase == "go" then
        print(((((((("PULL team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(DotaTime()))) .. " result=") .. result) .. " (before reaching the camp)")
    end
    s.phase = "none"
    s.firstCreepAt = -1
    s.maxOnNeutrals = 0
    bot.laningHoldUntil = nil
end
local function SetPhase(s, phase)
    s.phase = phase
    s.phaseStart = DotaTime()
end
--- HIGH while a pull runs or should start now, else 0. Positions 5 and 4 pull, and an offlaner alone in lane.
function ____exports.Desire(bot)
    local s = StateOf(bot)
    local now = DotaTime()
    local ____temp_1
    if jmz.IsInLaningPhase() and bot:IsAlive() then
        ____temp_1 = PullLane(bot)
    else
        ____temp_1 = nil
    end
    local lane = ____temp_1
    if lane == nil then
        if s.phase ~= "none" then
            End(bot, s, "stopped")
        end
        return 0
    end
    if s.phase ~= "none" then
        local plan = s.plan
        if jmz.GetHP(bot) < MIN_HP then
            End(bot, s, "low_hp")
            return 0
        end
        if EnemyNear(
            bot,
            bot:GetLocation(),
            ABORT_ENEMY_RADIUS
        ) then
            End(bot, s, "enemy_near")
            return 0
        end
        if s.phase == "hit" and now - s.phaseStart > HIT_TIMEOUT then
            End(bot, s, "no_hit")
            return 0
        end
        if s.phase == "wait" or s.phase == "go" then
            local live = LiveEta(s, plan, now)
            if live ~= nil and math.abs(now + live - s.waveAt) < 12 then
                s.waveAt = now + live
                s.hitAt = s.waveAt - DragTime(bot, plan) - AGGRO_LEAD
            end
        end
        if s.phase == "drag" then
            s.maxOnNeutrals = math.max(
                s.maxOnNeutrals,
                CountOnNeutrals(bot)
            )
            if s.firstCreepAt < 0 then
                for ____, creep in ipairs(bot:GetNearbyLaneCreeps(1200, false)) do
                    if jmz.IsValid(creep) and Dist(
                        creep:GetLocation(),
                        plan.pullLoc
                    ) < 400 then
                        s.firstCreepAt = now
                        break
                    end
                end
            end
            if s.firstCreepAt > 0 and now - s.firstCreepAt > 1.5 then
                End(bot, s, "fought")
                return 0
            end
            if now - s.phaseStart > DRAG_TIMEOUT then
                End(bot, s, "timeout")
                return 0
            end
        end
        if s.phase == "wait" and now > s.hitAt + 1 then
            End(bot, s, "late")
            return 0
        end
        bot.laningHoldUntil = now + 0.5
        return DesireTier.HIGH
    end
    if now < PULL_START_TIME or bot:GetActiveMode() ~= BotMode.Laning or jmz.GetHP(bot) < 0.6 then
        return 0
    end
    if s.planLane ~= lane then
        s.planLane = lane
        s.plan = MakePlan(lane)
        if Utils.DebugMode then
            local types = {}
            local camps = GetNeutralSpawners()
            for key in pairs(camps) do
                local ____opt_2 = camps[key]
                if ____opt_2 ~= nil then
                    ____opt_2 = ____opt_2.type
                end
                local ____opt_4 = camps[key]
                if ____opt_4 ~= nil then
                    ____opt_4 = ____opt_4.team
                end
                types[#types + 1] = (tostring(____opt_2) .. "/") .. tostring(____opt_4)
            end
            local p = s.plan
            print((((((((("PULLPLAN team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " lane=") .. tostring(lane)) .. " camp=") .. (p and (((((p.campType .. "@") .. tostring(math.floor(p.campLoc.x))) .. ",") .. tostring(math.floor(p.campLoc.y))) .. " pathLen=") .. tostring(math.floor(p.pathLen)) or "none")) .. " seen=") .. table.concat(types, ","))
        end
    end
    local plan = s.plan
    if plan == nil or not WavePushed(lane) then
        return 0
    end
    if lane == OffLane() and PartnerPressed(bot) then
        return 0
    end
    if EnemyNear(bot, plan.campLoc, 1200) or EnemyNear(
        bot,
        bot:GetLocation(),
        ABORT_ENEMY_RADIUS
    ) then
        return 0
    end
    local speed = math.max(
        bot:GetCurrentMovementSpeed(),
        200
    )
    local walk = Dist(
        bot:GetLocation(),
        plan.standLoc
    ) / speed
    local drag = DragTime(bot, plan)
    local eta = NextArrival(s, plan, now)
    if eta - drag - AGGRO_LEAD < walk + 1 then
        eta = eta + 30
    end
    if eta > MAX_PLAN_AHEAD + 30 then
        return 0
    end
    local waveAt = now + eta
    local hitAt = waveAt - drag - AGGRO_LEAD
    if math.abs(waveAt - s.pulledWave) < 10 then
        return 0
    end
    if now < hitAt - walk - GO_EARLY then
        return 0
    end
    if hitAt - (now + walk) > WAIT_MAX then
        return 0
    end
    s.pulledWave = waveAt
    s.waveAt = waveAt
    s.hitAt = hitAt
    s.firstCreepAt = -1
    SetPhase(s, "go")
    bot.laningHoldUntil = now + 0.5
    return DesireTier.HIGH
end
function ____exports.Active(bot)
    return StateOf(bot).phase ~= "none"
end
local function Move(bot, s, loc)
    local now = DotaTime()
    if now - s.lastMoveTime < 0.3 then
        return
    end
    bot:Action_MoveToLocation(loc)
    s.lastMoveTime = now
end
function ____exports.Think(bot)
    local s = StateOf(bot)
    local plan = s.plan
    if plan == nil or plan == nil or s.phase == "none" or jmz.CanNotUseAction(bot) then
        return
    end
    local now = DotaTime()
    if s.phase == "go" then
        if Dist(
            bot:GetLocation(),
            plan.standLoc
        ) < 150 then
            SetPhase(s, "wait")
        else
            Move(bot, s, plan.standLoc)
        end
        return
    end
    if s.phase == "wait" then
        if now < s.hitAt then
            if Dist(
                bot:GetLocation(),
                plan.standLoc
            ) > 100 then
                Move(bot, s, plan.standLoc)
            end
            return
        end
        SetPhase(s, "hit")
        s.hitGameStart = GameTime()
    end
    if s.phase == "hit" then
        local target = nil
        local best = 99999
        for ____, creep in ipairs(bot:GetNearbyNeutralCreeps(900, true)) do
            do
                local __continue103
                repeat
                    if not jmz.IsValid(creep) or creep:IsAncientCreep() then
                        __continue103 = true
                        break
                    end
                    local d = Dist(
                        creep:GetLocation(),
                        plan.campLoc
                    )
                    if d < 700 and d < best then
                        best = d
                        target = creep
                    end
                    __continue103 = true
                until true
                if not __continue103 then
                    break
                end
            end
        end
        if target == nil then
            End(bot, s, "empty_camp")
            return
        end
        local aggro = false
        for ____, creep in ipairs(bot:GetNearbyNeutralCreeps(900, true)) do
            if jmz.IsValid(creep) and creep:GetAttackTarget() == bot then
                aggro = true
            end
        end
        if bot:GetLastAttackTime() >= s.hitGameStart or aggro then
            SetPhase(s, "drag")
        elseif bot:GetAttackTarget() ~= target then
            bot:Action_AttackUnit(target, true)
            return
        else
            return
        end
    end
    if s.phase == "drag" then
        Move(bot, s, plan.dragLoc)
    end
end
return ____exports
