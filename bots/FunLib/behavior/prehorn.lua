--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local function __TS__ArraySort(self, compareFn)
    if compareFn ~= nil then
        table.sort(
            self,
            function(a, b) return compareFn(nil, a, b) < 0 end
        )
    else
        table.sort(self)
    end
    return self
end

local function __TS__ArrayFilter(self, callbackfn, thisArg)
    local result = {}
    local len = 0
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            len = len + 1
            result[len] = self[i]
        end
    end
    return result
end
-- End of Lua Library inline imports
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotScriptEnums = ____dota.BotScriptEnums
local Lane = ____dota.Lane
local Rune = ____dota.Rune
local Team = ____dota.Team
local Tower = ____dota.Tower
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local Rng = require(GetScriptDirectory().."/FunLib/behavior/rng")
local ____desire_tiers = require(GetScriptDirectory().."/FunLib/behavior/desire_tiers")
local DesireTier = ____desire_tiers.DesireTier
local ____camps = require(GetScriptDirectory().."/FunLib/behavior/camps")
local Camps = ____camps.Camps
local WEIGHTS = {
    {"standard", 0.3},
    {"feint", 0.2},
    {"bounty", 0.15},
    {"ambush", 0.15},
    {"block", 0.2}
}
local SPOT_JITTER = 500
local OUT_MIN = -88
local OUT_MAX = -65
local LEAVE_MIN = -22
local LEAVE_MAX = -6
local FEINT_SWITCH_MIN = -40
local FEINT_SWITCH_MAX = -25
local BOUNTY_END = 15
local BOUNTY_WAIT_OFFSET = 300
local AMBUSH_END = 20
local ENGAGED_END = 35
local AMBUSH_TOWER_GAP = 1600
local AMBUSH_SIDE = 350
local SPOT_REACHED = 250
local WAVE_RADIUS = 1000
local SEE_RADIUS = 1200
local CHASE_RADIUS = 1800
local TOWER_DANGER = 950
local COUNT_RADIUS = 1200
local MOVE_EVERY = 0.4
local BLOCK_STAND = 50
local BLOCK_END = 62
local SENTRY = "item_ward_sentry"
local SENTRY_CAST = 400
local SENTRY_DEADLINE = -3
local ENEMY_TOWER_SAFE = 850
local SPOTS = {
    [Team.Radiant] = {
        safe = {
            Vector(526, -3893, 256),
            Vector(1999, -4838, 256)
        },
        mid = {
            Vector(-3456, 649, 256),
            Vector(-1945, 60, 128)
        }
    },
    [Team.Dire] = {
        safe = {
            Vector(-1051, 3384, 256),
            Vector(-2415, 4641, 256)
        },
        mid = {
            Vector(2734, -1155, 256),
            Vector(1142, -337, 128)
        }
    }
}
local BOUNTIES = {Rune.Bounty1, Rune.Bounty2}
local ENEMY_TOWERS = {
    Tower.Top1,
    Tower.Mid1,
    Tower.Bot1,
    Tower.Top2,
    Tower.Mid2,
    Tower.Bot2
}
local states = {}
local plan = nil
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function Toward(from, to, distance)
    local d = math.max(
        Dist(from, to),
        1
    )
    return Vector(from.x + (to.x - from.x) / d * distance, from.y + (to.y - from.y) / d * distance, from.z)
end
local function Add(a, b)
    return Vector(a.x + b.x, a.y + b.y, a.z)
end
local function Log(text)
    if Utils.DebugMode then
        print((("PREHORN team=" .. tostring(GetTeam())) .. " ") .. text)
    end
end
local function Fmt(v)
    return (tostring(math.floor(v.x)) .. ",") .. tostring(math.floor(v.y))
end
--- The team's plan, drawn once per game (one VM per team, so all five bots share it).
function ____exports.Plan()
    if plan ~= nil then
        return plan
    end
    plan = "standard"
    local roll = 0
    if not jmz.IsModeTurbo() then
        roll = Rng.Float(0, 1)
        local acc = 0
        for ____, entry in ipairs(WEIGHTS) do
            acc = acc + entry[2]
            if roll < acc then
                plan = entry[1]
                break
            end
        end
    end
    Log((("plan=" .. plan) .. " roll=") .. tostring(math.floor(roll * 100) / 100))
    return plan
end
local function Jitter(v, radius)
    do
        local i = 0
        while i < 4 do
            local p = Add(
                v,
                Rng.Direction(Rng.Float(0, radius))
            )
            if IsLocationPassable(p) then
                return p
            end
            i = i + 1
        end
    end
    return v
end
local function StandardSpot(pos, other)
    local spots = SPOTS[GetTeam()]
    local safeGroup = pos == 1 or pos == 5
    local list = safeGroup ~= other and spots.safe or spots.mid
    return Jitter(
        list[Rng.Int(0, #list - 1) + 1],
        SPOT_JITTER
    )
end
local function TowerUp(team, id)
    local tower = GetTower(team, id)
    if tower == nil or tower == nil or tower:IsNull() or not tower:IsAlive() then
        return nil
    end
    return tower
end
local function NearEnemyTower(loc, radius)
    for ____, id in ipairs(ENEMY_TOWERS) do
        local tower = TowerUp(
            GetOpposingTeam(),
            id
        )
        if tower ~= nil and Dist(
            tower:GetLocation(),
            loc
        ) < radius then
            return true
        end
    end
    return false
end
--- The enemy-side bounty rune: the valid spawn nearest the enemy ancient.
local function StealRune()
    local enemyAncient = GetAncient(GetOpposingTeam()):GetLocation()
    local best = nil
    local bestDist = 99999
    for ____, rune in ipairs(BOUNTIES) do
        do
            local __continue25
            repeat
                local loc = GetRuneSpawnLocation(rune)
                if loc == nil or loc == nil or math.abs(loc.x) + math.abs(loc.y) < 500 then
                    __continue25 = true
                    break
                end
                local d = Dist(loc, enemyAncient)
                if d < bestDist then
                    bestDist = d
                    best = rune
                end
                __continue25 = true
            until true
            if not __continue25 then
                break
            end
        end
    end
    return best
end
--- Where the enemy offlaner walks in: plain OHA (and most humans) go from the river rune into the lane
-- where it crosses the river. So: the point on our safe lane about as far from both ancients (the
-- river crossing), at least AMBUSH_TOWER_GAP from every enemy tower, stepped AMBUSH_SIDE toward the
-- map centre.
local function AmbushSpot()
    local lane = GetTeam() == Team.Radiant and Lane.Bot or Lane.Top
    local enemyAncient = GetAncient(GetOpposingTeam()):GetLocation()
    local ourAncient = GetAncient(GetTeam()):GetLocation()
    local candidates = {}
    do
        local i = 1
        while i <= 19 do
            local loc = GetLocationAlongLane(lane, i * 0.05)
            if not NearEnemyTower(loc, AMBUSH_TOWER_GAP) then
                candidates[#candidates + 1] = loc
            end
            i = i + 1
        end
    end
    if #candidates == 0 then
        return nil
    end
    local function river(v)
        return math.abs(Dist(v, enemyAncient) - Dist(v, ourAncient))
    end
    __TS__ArraySort(
        candidates,
        function(____, a, b) return river(a) - river(b) end
    )
    local loc = candidates[Rng.Int(
        0,
        math.min(1, #candidates - 1)
    ) + 1]
    local toCentre = Vector(-loc.x, -loc.y, 0)
    local len = math.max(
        Dist(
            toCentre,
            Vector(0, 0, 0)
        ),
        1
    )
    for ____, side in ipairs({AMBUSH_SIDE, AMBUSH_SIDE / 2, 0}) do
        local p = Vector(loc.x + toCentre.x / len * side, loc.y + toCentre.y / len * side, loc.z)
        if IsLocationPassable(p) then
            return p
        end
    end
    return loc
end
local ambushSpot = nil
--- Block: the enemy small or medium camp nearest the enemy safe-lane tier 1 tower.
local function BlockCamp()
    local enemy = GetOpposingTeam()
    local tower = TowerUp(enemy, enemy == Team.Dire and Tower.Top1 or Tower.Bot1)
    if tower == nil then
        return nil
    end
    local best = nil
    local bestDist = 99999
    for ____, c in ipairs(Camps()) do
        do
            local __continue40
            repeat
                if c.team ~= enemy or c.type ~= "small" and c.type ~= "medium" then
                    __continue40 = true
                    break
                end
                local d = Dist(
                    c.centre,
                    tower:GetLocation()
                )
                if d < bestDist then
                    bestDist = d
                    best = c
                end
                __continue40 = true
            until true
            if not __continue40 then
                break
            end
        end
    end
    return best
end
local function StateOf(bot)
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local s = states[key]
    if s ~= nil then
        return s
    end
    local pos = jmz.GetPosition(bot)
    local p = ____exports.Plan()
    local role = p == "feint" and "feint" or "standard"
    local spot = StandardSpot(pos, false)
    local rune = nil
    local camp = nil
    if p == "block" and pos == 4 then
        camp = BlockCamp()
        if camp ~= nil then
            role = "block"
        end
    end
    if p == "bounty" and (pos == 3 or pos == 4 or pos == 5) then
        rune = StealRune()
        if rune ~= nil then
            role = "steal"
            local runeLoc = GetRuneSpawnLocation(rune)
            local ourAncient = GetAncient(GetTeam()):GetLocation()
            local back = Dist(runeLoc, ourAncient)
            spot = Jitter(
                Vector(runeLoc.x + (ourAncient.x - runeLoc.x) / back * BOUNTY_WAIT_OFFSET, runeLoc.y + (ourAncient.y - runeLoc.y) / back * BOUNTY_WAIT_OFFSET, runeLoc.z),
                120
            )
        end
    elseif p == "ambush" and (pos == 1 or pos == 4 or pos == 5) then
        if ambushSpot == nil then
            ambushSpot = AmbushSpot()
        end
        if ambushSpot ~= nil then
            role = "hide"
            spot = Jitter(ambushSpot, 150)
        end
    end
    s = {
        role = role,
        done = false,
        spot = spot,
        decoy = role == "feint" and StandardSpot(pos, true) or nil,
        switchAt = Rng.Float(FEINT_SWITCH_MIN, FEINT_SWITCH_MAX),
        outAt = (role == "standard" or role == "feint" or role == "block") and Rng.Float(OUT_MIN, OUT_MAX) or -999,
        leaveAt = Rng.Float(LEAVE_MIN, LEAVE_MAX),
        runeOffset = Rng.Direction(Rng.Float(0, 80)),
        rune = rune,
        target = nil,
        camp = camp,
        buyTried = false,
        castFrom = nil,
        sentryCharges = -1,
        sentryCastAt = -999,
        sentryFailed = false,
        engagedAt = -999,
        lastMoveTime = -999
    }
    states[key] = s
    local leave = (role == "standard" or role == "feint" or role == "block") and tostring(math.floor(s.leaveAt)) or "-"
    Log((((((((((((((("hero=" .. bot:GetUnitName()) .. " pos=") .. tostring(pos)) .. " plan=") .. p) .. " role=") .. role) .. " spot=") .. Fmt(spot)) .. (camp ~= nil and ((" camp=" .. camp.type) .. "@") .. Fmt(camp.centre) or "")) .. (s.decoy ~= nil and ((" decoy=" .. Fmt(s.decoy)) .. " switch=") .. tostring(math.floor(s.switchAt)) or "")) .. " out=") .. tostring(math.floor(s.outAt))) .. " leave=") .. leave)
    return s
end
local function End(bot, s, result)
    if s.done then
        return
    end
    s.done = true
    s.target = nil
    Log((((((("hero=" .. bot:GetUnitName()) .. " role=") .. s.role) .. " result=") .. result) .. " t=") .. tostring(math.floor(DotaTime())))
end
local function Enemies(loc, radius)
    return __TS__ArrayFilter(
        jmz.GetEnemiesNearLoc(loc, radius),
        function(____, e) return jmz.IsValidHero(e) and not jmz.IsSuspiciousIllusion(e) end
    )
end
local function Outnumbered(bot)
    local loc = bot:GetLocation()
    local enemies = #Enemies(loc, COUNT_RADIUS)
    return enemies > 0 and enemies > #jmz.GetAlliesNearLoc(loc, COUNT_RADIUS)
end
local function Move(bot, s, loc)
    local now = DotaTime()
    if now - s.lastMoveTime < MOVE_EVERY then
        return
    end
    s.lastMoveTime = now
    bot:Action_MoveToLocation(loc)
end
--- The rune plain OHA sends this bot to after -10 (same choice, so lanes keep their rune).
local function OwnRune(bot)
    local lane = bot:GetAssignedLane()
    if GetTeam() == Team.Radiant then
        return lane == Lane.Bot and Rune.Bounty2 or Rune.Power1
    end
    return lane == Lane.Top and Rune.Bounty1 or Rune.Power2
end
--- The weakest visible enemy hero near `centre` that we can fight: as many allies as enemies around it.
local function PickTarget(centre)
    local enemies = Enemies(centre, SEE_RADIUS)
    if #enemies == 0 then
        return nil
    end
    if #jmz.GetAlliesNearLoc(centre, SEE_RADIUS + 300) <= #Enemies(centre, SEE_RADIUS + 500) then
        return nil
    end
    local best = nil
    for ____, enemy in ipairs(enemies) do
        do
            local __continue65
            repeat
                if NearEnemyTower(
                    enemy:GetLocation(),
                    TOWER_DANGER
                ) then
                    __continue65 = true
                    break
                end
                if best == nil or enemy:GetHealth() < best:GetHealth() then
                    best = enemy
                end
                __continue65 = true
            until true
            if not __continue65 then
                break
            end
        end
    end
    return best
end
--- Ambush: our creep wave has reached this hider and no fight started (go last-hit instead).
local function WaveArrived(bot, s)
    if s.role ~= "hide" or s.engagedAt >= 0 or s.target ~= nil then
        return false
    end
    return #bot:GetNearbyLaneCreeps(WAVE_RADIUS, false) > 0
end
--- Fight `s.target`, or pick one near `centre`. True while fighting.
local function Fight(bot, s, centre)
    local t = s.target
    if t ~= nil and (not jmz.IsValidHero(t) or Dist(
        t:GetLocation(),
        centre
    ) > CHASE_RADIUS or NearEnemyTower(
        t:GetLocation(),
        TOWER_DANGER
    )) then
        Log((((((((("hero=" .. bot:GetUnitName()) .. " role=") .. s.role) .. " fight_over t=") .. tostring(math.floor(DotaTime()))) .. " target=") .. (t:IsNull() and "?" or t:GetUnitName())) .. " alive=") .. tostring(not t:IsNull() and t:IsAlive()))
        s.target = nil
    end
    if s.target == nil then
        local pick = PickTarget(centre)
        if pick == nil then
            return false
        end
        s.target = pick
        if s.engagedAt < 0 then
            s.engagedAt = DotaTime()
            Log((((((("hero=" .. bot:GetUnitName()) .. " role=") .. s.role) .. " result=engaged t=") .. tostring(math.floor(DotaTime()))) .. " target=") .. pick:GetUnitName())
        end
    end
    bot:Action_AttackUnit(s.target, false)
    return true
end
--- Whether this bot's plan still runs.
function ____exports.Active(bot)
    if DotaTime() > BLOCK_END + 1 then
        return false
    end
    local s = StateOf(bot)
    if s.role ~= "block" and DotaTime() > ENGAGED_END then
        return false
    end
    return not s.done
end
local function SentrySlot(bot)
    return bot:FindItemSlot(SENTRY)
end
local function SentryCharges(bot)
    local slot = SentrySlot(bot)
    if slot < 0 then
        return 0
    end
    local item = bot:GetItemInSlot(slot)
    return (item == nil or item == nil) and 0 or item:GetCurrentCharges()
end
--- Where to stand to place the sentry: SENTRY_CAST from the centre, passable, away from enemy towers, nearest us.
local function CastFrom(bot, centre)
    local best = nil
    local bestDist = 99999
    do
        local i = 0
        while i < 12 do
            do
                local __continue83
                repeat
                    local a = i / 12 * 2 * math.pi
                    local p = Vector(
                        centre.x + math.cos(a) * SENTRY_CAST,
                        centre.y + math.sin(a) * SENTRY_CAST,
                        centre.z
                    )
                    if not IsLocationPassable(p) or NearEnemyTower(p, ENEMY_TOWER_SAFE) then
                        __continue83 = true
                        break
                    end
                    local d = Dist(
                        bot:GetLocation(),
                        p
                    )
                    if d < bestDist then
                        bestDist = d
                        best = p
                    end
                    __continue83 = true
                until true
                if not __continue83 then
                    break
                end
            end
            i = i + 1
        end
    end
    return best
end
local function SentryFail(bot, s, reason)
    if s.sentryFailed then
        return
    end
    s.sentryFailed = true
    Log((((("hero=" .. bot:GetUnitName()) .. " role=block result=no_sentry_fallback reason=") .. reason) .. " t=") .. tostring(math.floor(DotaTime())))
end
--- Block, before the horn: buy and place the sentry. True when it gave this tick's order (or waits);
-- false to play standard (after placing, or when it fell back to the body block).
local function SentryThink(bot, s, now)
    if s.sentryFailed then
        return false
    end
    local c = s.camp
    if not s.buyTried and SentrySlot(bot) < 0 and bot:DistanceFromFountain() < 900 then
        s.buyTried = true
        if bot:GetGold() >= GetItemCost(SENTRY) then
            bot:ActionImmediate_PurchaseItem(SENTRY)
        else
            SentryFail(
                bot,
                s,
                "gold=" .. tostring(bot:GetGold())
            )
            return false
        end
        return true
    end
    if s.sentryCharges >= 0 then
        if SentryCharges(bot) < s.sentryCharges then
            End(
                bot,
                s,
                (("sentry_placed at=" .. Fmt(c.centre)) .. " camp=") .. c.type
            )
            return false
        end
        if now - s.sentryCastAt < 1.5 then
            return true
        end
        s.sentryCharges = -1
    end
    if now >= SENTRY_DEADLINE then
        SentryFail(
            bot,
            s,
            SentrySlot(bot) < 0 and "none" or "not_placed"
        )
        return false
    end
    if now < s.outAt then
        return true
    end
    local slot = SentrySlot(bot)
    if slot < 0 then
        SentryFail(bot, s, s.buyTried and "buy_failed" or "none")
        return false
    end
    bot._lastWardSwapTime = now + 5
    if slot >= 6 and slot <= 8 then
        local main = 5
        do
            local i = 0
            while i <= 5 do
                if bot:GetItemInSlot(i) == nil or bot:GetItemInSlot(i) == nil then
                    main = i
                    break
                end
                i = i + 1
            end
        end
        bot:ActionImmediate_SwapItems(slot, main)
        return true
    end
    if s.castFrom == nil then
        s.castFrom = CastFrom(bot, c.centre)
        if s.castFrom == nil then
            SentryFail(bot, s, "no_cast_spot")
            return false
        end
    end
    if Dist(
        bot:GetLocation(),
        c.centre
    ) <= SENTRY_CAST + 80 then
        local item = bot:GetItemInSlot(slot)
        if item ~= nil and item ~= nil and jmz.CanCastAbility(item) then
            s.sentryCharges = item:GetCurrentCharges()
            s.sentryCastAt = now
            bot:Action_UseAbilityOnLocation(item, c.centre)
        end
        return true
    end
    Move(bot, s, s.castFrom)
    return true
end
--- Last time any bot's plan can still run (rune mode's Think gate).
____exports.LAST_TIME = BLOCK_END + 1
--- Block: at BLOCK_END, log whether the camp spawned.
local function BlockResult(bot, s)
    local c = s.camp
    local neutrals = #__TS__ArrayFilter(
        bot:GetNearbyNeutralCreeps(1200, true),
        function(____, n) return not n:IsNull() and n:IsAlive() and Dist(
            n:GetLocation(),
            c.centre
        ) < 700 end
    )
    local inBox = Dist(
        bot:GetLocation(),
        c.centre
    ) < 200
    End(
        bot,
        s,
        ((((((neutrals == 0 and "blocked" or "spawned") .. " neutrals=") .. tostring(neutrals)) .. " inBox=") .. tostring(inBox)) .. " camp=") .. c.type
    )
end
--- HIGH after the horn while a steal or ambush still runs, else 0. Before the horn rune mode already
-- runs (its own MODERATE pre-game desire), so this stays 0 then and lets warding take its turn.
function ____exports.Desire(bot)
    local now = DotaTime()
    if now < 0 or now > BLOCK_END + 1 or not bot:IsAlive() or bot:IsIllusion() then
        return 0
    end
    local s = StateOf(bot)
    if s.done or s.role ~= "steal" and s.role ~= "hide" and s.role ~= "block" then
        return 0
    end
    if s.role == "block" then
        if now > BLOCK_END then
            BlockResult(bot, s)
            return 0
        end
        if Outnumbered(bot) or bot:WasRecentlyDamagedByAnyHero(1.5) then
            End(bot, s, "block_danger")
            return 0
        end
        return DesireTier.HIGH
    end
    if now > ENGAGED_END then
        return 0
    end
    if Outnumbered(bot) then
        End(bot, s, "outnumbered")
        return 0
    end
    if s.role == "steal" and now > BOUNTY_END then
        End(bot, s, "steal_timeout")
        return 0
    end
    if s.role == "hide" and now > (s.engagedAt >= 0 and ENGAGED_END or AMBUSH_END) then
        End(bot, s, s.engagedAt >= 0 and "fight_timeout" or "nobody_came")
        return 0
    end
    if WaveArrived(bot, s) then
        End(bot, s, "wave_arrived")
        return 0
    end
    return DesireTier.HIGH
end
--- Runs from rune mode's Think. True when it gave this tick's order (or chose to idle).
function ____exports.Think(bot)
    local now = DotaTime()
    if now > BLOCK_END + 1 or jmz.CanNotUseAction(bot) then
        return false
    end
    local s = StateOf(bot)
    if s.done or s.role ~= "block" and now > ENGAGED_END then
        return false
    end
    if now >= 0 and s.role ~= "standard" and s.role ~= "feint" then
        bot.laningHoldUntil = now + 1
    end
    if s.role == "block" and now >= 0 then
        local c = s.camp
        if now > BLOCK_END then
            BlockResult(bot, s)
            return false
        end
        if Outnumbered(bot) then
            End(bot, s, "block_danger")
            return false
        end
        local target = now >= BLOCK_STAND - 5 and c.centre or Toward(
            c.centre,
            bot:GetLocation(),
            400
        )
        if Dist(
            bot:GetLocation(),
            target
        ) > 60 then
            Move(bot, s, target)
        end
        return true
    end
    if Outnumbered(bot) then
        End(bot, s, "outnumbered")
        return false
    end
    if s.role == "block" and now < 0 and SentryThink(bot, s, now) then
        return true
    end
    if s.done then
        return false
    end
    if s.role == "standard" or s.role == "feint" or s.role == "block" then
        if now >= 0 then
            End(bot, s, "horn")
            return false
        end
        if now < s.outAt then
            return true
        end
        if now >= s.leaveAt then
            Move(
                bot,
                s,
                Add(
                    GetRuneSpawnLocation(OwnRune(bot)),
                    s.runeOffset
                )
            )
            return true
        end
        local target = s.role == "feint" and s.decoy ~= nil and now < s.switchAt and s.decoy or s.spot
        if Dist(
            bot:GetLocation(),
            target
        ) > SPOT_REACHED then
            Move(bot, s, target)
        elseif now - s.lastMoveTime > Rng.Float(1.5, 3.5) then
            Move(
                bot,
                s,
                Add(
                    target,
                    Rng.Direction(120)
                )
            )
        end
        return true
    end
    if s.role == "steal" then
        if now > BOUNTY_END then
            End(bot, s, "steal_timeout")
            return false
        end
        local rune = s.rune
        local runeLoc = GetRuneSpawnLocation(rune)
        if Fight(bot, s, runeLoc) then
            return true
        end
        if now >= 0 then
            local status = GetRuneStatus(rune)
            if status == RUNE_STATUS_AVAILABLE then
                bot:Action_PickUpRune(rune)
                return true
            end
            if status == RUNE_STATUS_MISSING and now > 1 then
                End(bot, s, "rune_gone")
                return false
            end
        end
        if Dist(
            bot:GetLocation(),
            s.spot
        ) > SPOT_REACHED then
            Move(bot, s, s.spot)
        end
        return true
    end
    if now > (s.engagedAt >= 0 and ENGAGED_END or AMBUSH_END) then
        End(bot, s, s.engagedAt >= 0 and "fight_timeout" or "nobody_came")
        return false
    end
    if now >= 0 and WaveArrived(bot, s) then
        End(bot, s, "wave_arrived")
        return false
    end
    if Fight(bot, s, s.spot) then
        return true
    end
    if Dist(
        bot:GetLocation(),
        s.spot
    ) > SPOT_REACHED / 2 then
        Move(bot, s, s.spot)
    end
    return true
end
return ____exports
