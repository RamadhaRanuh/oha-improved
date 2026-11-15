--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local __TS__StringReplace
do
    local sub = string.sub
    function __TS__StringReplace(source, searchValue, replaceValue)
        local startPos, endPos = string.find(source, searchValue, nil, true)
        if not startPos then
            return source
        end
        local before = sub(source, 1, startPos - 1)
        local replacement = type(replaceValue) == "string" and replaceValue or replaceValue(nil, searchValue, startPos - 1, source)
        local after = sub(source, endPos + 1)
        return (before .. replacement) .. after
    end
end

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

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
    end
    return result
end
-- End of Lua Library inline imports
local ____exports = {}
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local DamageType = ____dota.DamageType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Rng = require(GetScriptDirectory().."/FunLib/behavior/rng")
local Customize = require(GetScriptDirectory().."/Customize/general")
local DECISION_PERIOD = 1
local SITUATION_RADIUS = 1600
local HORIZON = 10
local FORCE_TIME = 4
local UNSEEN_AGE = 3
local states = {}
local enabled
local explore = 0
function ____exports.Enabled()
    if enabled == nil then
        local cfg = Customize.DecisionLog
        enabled = cfg ~= nil and cfg.enabled == true
        explore = enabled and type(cfg.explore) == "number" and math.max(
            0,
            math.min(cfg.explore, 1)
        ) or 0
    end
    return enabled
end
local function StateOf(bot)
    local id = bot:GetPlayerID()
    local s = states[id]
    if s == nil then
        s = {
            lastDecision = -999,
            pending = {},
            forced = nil,
            forcedUntil = -1,
            forcedTarget = nil
        }
        states[id] = s
    end
    return s
end
local function Dist(a, b)
    return GetUnitToUnitDistance(a, b)
end
local function Short(u)
    return __TS__StringReplace(
        u:GetUnitName(),
        "npc_dota_hero_",
        ""
    )
end
local function F(x, d)
    if d == nil then
        d = 2
    end
    return __TS__NumberToFixed(x, d)
end
local function RealHeroes(bot, enemy)
    return __TS__ArrayFilter(
        bot:GetNearbyHeroes(SITUATION_RADIUS, enemy, BotMode.None),
        function(____, h) return jmz.IsValidHero(h) and not jmz.IsSuspiciousIllusion(h) and h ~= bot end
    )
end
local function UltReady(bot)
    do
        local i = 0
        while i <= 5 do
            do
                local __continue12
                repeat
                    local a = bot:GetAbilityInSlot(i)
                    if a == nil or a == nil or a:IsNull() then
                        __continue12 = true
                        break
                    end
                    if a:IsUltimate() and a:IsTrained() and a:IsFullyCastable() then
                        return 1
                    end
                    __continue12 = true
                until true
                if not __continue12 then
                    break
                end
            end
            i = i + 1
        end
    end
    return 0
end
local function NearestTowerDist(bot, enemy)
    local best = 99999
    for ____, t in ipairs(bot:GetNearbyTowers(1600, enemy)) do
        if t ~= nil and not t:IsNull() and t:IsAlive() then
            best = math.min(
                best,
                Dist(bot, t)
            )
        end
    end
    return math.floor(best)
end
local function MissingEnemies()
    local n = 0
    for ____, pid in ipairs(GetTeamPlayers(GetOpposingTeam())) do
        do
            local __continue20
            repeat
                if not IsHeroAlive(pid) then
                    __continue20 = true
                    break
                end
                local info = GetHeroLastSeenInfo(pid)
                local age = info ~= nil and info ~= nil and #info > 0 and info[1].time_since_seen or 999
                if age > UNSEEN_AGE then
                    n = n + 1
                end
                __continue20 = true
            until true
            if not __continue20 then
                break
            end
        end
    end
    return n
end
local function Action(bot, s)
    if s.forced ~= nil then
        return s.forced
    end
    local mode = bot:GetActiveMode()
    if mode == BotMode.Retreat or mode == BotMode.EvasiveManeuvers then
        return "run"
    end
    if mode == BotMode.Attack then
        return "fight"
    end
    if mode == BotMode.TeamRoam then
        local t = bot:GetTarget()
        if t ~= nil and t ~= nil and not t:IsNull() and t:IsHero() then
            return "fight"
        end
    end
    return "other"
end
--- Outcome bookkeeping: deaths seen at any tick in the window, then the FIGHTOUT line.
local function Settle(bot, s, now)
    local keep = {}
    for ____, p in ipairs(s.pending) do
        do
            local __continue31
            repeat
                if not bot:IsAlive() then
                    p.selfDied = true
                end
                for ____, pid in ipairs(p.enemyIds) do
                    if not IsHeroAlive(pid) then
                        p.enemyDied[pid] = true
                    end
                end
                for ____, pid in ipairs(p.allyIds) do
                    if not IsHeroAlive(pid) then
                        p.allyDied[pid] = true
                    end
                end
                if now - p.at < HORIZON then
                    keep[#keep + 1] = p
                    __continue31 = true
                    break
                end
                local kills = #__TS__ArrayFilter(
                    p.enemyIds,
                    function(____, pid) return p.enemyDied[pid] end
                )
                local allyDeaths = #__TS__ArrayFilter(
                    p.allyIds,
                    function(____, pid) return p.allyDied[pid] end
                )
                print((((((((((("FIGHTOUT id=" .. p.id) .. " died=") .. tostring(p.selfDied and 1 or 0)) .. " kills=") .. tostring(kills)) .. " allyDeaths=") .. tostring(allyDeaths)) .. " hp=") .. F(bot:IsAlive() and jmz.GetHP(bot) or 0)) .. " nwGain=") .. tostring(bot:GetNetWorth() - p.nw))
                __continue31 = true
            until true
            if not __continue31 then
                break
            end
        end
    end
    s.pending = keep
end
local function MaybeForce(bot, s, now, enemies)
    if s.forced ~= nil and now >= s.forcedUntil then
        s.forced = nil
        s.forcedTarget = nil
    end
    if s.forced ~= nil or explore <= 0 or #enemies == 0 then
        return
    end
    if Rng.Float(0, 1) >= explore then
        return
    end
    s.forced = Rng.Float(0, 1) < 0.5 and "fight" or "run"
    s.forcedUntil = now + FORCE_TIME
    local nearest = nil
    for ____, e in ipairs(enemies) do
        do
            local __continue47
            repeat
                if not jmz.CanBeAttacked(e) then
                    __continue47 = true
                    break
                end
                if nearest == nil or Dist(bot, e) < Dist(bot, nearest) then
                    nearest = e
                end
                __continue47 = true
            until true
            if not __continue47 then
                break
            end
        end
    end
    s.forcedTarget = nearest
    if s.forced == "fight" and nearest == nil then
        s.forced = nil
    end
end
--- Called from retreat's GetDesire for every bot. Returns true (SafeCall reads nil as an error).
function ____exports.Tick(bot)
    if not ____exports.Enabled() or bot:IsIllusion() then
        return true
    end
    local s = StateOf(bot)
    local now = DotaTime()
    Settle(bot, s, now)
    if not bot:IsAlive() then
        s.forced = nil
        return true
    end
    if now - s.lastDecision < DECISION_PERIOD then
        return true
    end
    local enemies = RealHeroes(bot, true)
    if #enemies == 0 then
        if s.forced ~= nil and now >= s.forcedUntil then
            s.forced = nil
        end
        return true
    end
    s.lastDecision = now
    MaybeForce(bot, s, now, enemies)
    local allies = RealHeroes(bot, false)
    local nearest = enemies[1]
    local enemyHp = 0
    local enemyLvl = 0
    local incoming = 0
    for ____, e in ipairs(enemies) do
        if Dist(bot, e) < Dist(bot, nearest) then
            nearest = e
        end
        enemyHp = enemyHp + jmz.GetHP(e)
        enemyLvl = enemyLvl + e:GetLevel()
        incoming = incoming + e:GetEstimatedDamageToTarget(true, bot, 3, DamageType.All)
    end
    local allyHp = jmz.GetHP(bot)
    local allyLvl = bot:GetLevel()
    local allyNw = bot:GetNetWorth()
    local teamOut = bot:GetEstimatedDamageToTarget(true, nearest, 3, DamageType.All)
    local out = teamOut
    for ____, a in ipairs(allies) do
        allyHp = allyHp + jmz.GetHP(a)
        allyLvl = allyLvl + a:GetLevel()
        allyNw = allyNw + a:GetNetWorth()
        if Dist(a, nearest) <= SITUATION_RADIUS then
            teamOut = teamOut + a:GetEstimatedDamageToTarget(true, nearest, 3, DamageType.All)
        end
    end
    local nearestHealth = math.max(
        nearest:GetHealth(),
        1
    )
    local id = (((tostring(GetTeam()) .. "-") .. tostring(bot:GetPlayerID())) .. "-") .. tostring(math.floor(now * 10))
    print(((((((((((((((((((((("FIGHTDEC id=" .. id) .. " t=") .. F(now, 1)) .. " team=") .. tostring(GetTeam())) .. " hero=") .. Short(bot)) .. " pos=") .. tostring(jmz.GetPosition(bot))) .. " lvl=") .. tostring(bot:GetLevel())) .. " hp=") .. F(jmz.GetHP(bot))) .. " mp=") .. F(jmz.GetMP(bot))) .. " nw=") .. tostring(bot:GetNetWorth())) .. ((((((" allies=" .. tostring(#allies)) .. " allyHp=") .. F(allyHp / (#allies + 1))) .. " allyLvl=") .. tostring(allyLvl)) .. " allyNw=") .. tostring(allyNw)) .. ((((((" enemies=" .. tostring(#enemies)) .. " enemyHp=") .. F(enemyHp / #enemies)) .. " enemyLvl=") .. tostring(enemyLvl)) .. " missing=") .. tostring(MissingEnemies())) .. ((((((((" near=" .. tostring(math.floor(Dist(bot, nearest)))) .. " nearHp=") .. F(jmz.GetHP(nearest))) .. " inc=") .. F(incoming / math.max(
        bot:GetHealth(),
        1
    ))) .. " out=") .. F(out / nearestHealth)) .. " teamOut=") .. F(teamOut / nearestHealth)) .. ((((((((" ult=" .. tostring(UltReady(bot))) .. " towerAlly=") .. tostring(NearestTowerDist(bot, false))) .. " towerEnemy=") .. tostring(NearestTowerDist(bot, true))) .. " home=") .. tostring(math.floor(bot:DistanceFromFountain()))) .. " laning=") .. tostring(jmz.IsInLaningPhase() and 1 or 0)) .. ((" act=" .. Action(bot, s)) .. " forced=") .. tostring(s.forced ~= nil and 1 or 0))
    local ____s_pending_0 = s.pending
    ____s_pending_0[#____s_pending_0 + 1] = {
        id = id,
        at = now,
        enemyIds = __TS__ArrayMap(
            enemies,
            function(____, e) return e:GetPlayerID() end
        ),
        allyIds = __TS__ArrayMap(
            allies,
            function(____, a) return a:GetPlayerID() end
        ),
        enemyDied = {},
        allyDied = {},
        selfDied = false,
        nw = bot:GetNetWorth()
    }
    return true
end
--- The forced action running for this bot, if any (exploration).
function ____exports.Forced(bot)
    if not ____exports.Enabled() or explore <= 0 then
        return nil
    end
    local s = StateOf(bot)
    if s.forced == nil then
        return nil
    end
    if DotaTime() >= s.forcedUntil or not bot:IsAlive() then
        s.forced = nil
        s.forcedTarget = nil
        return nil
    end
    if s.forced == "fight" then
        local t = s.forcedTarget
        if t == nil or t:IsNull() or not t:IsAlive() or not t:CanBeSeen() or not jmz.CanBeAttacked(t) then
            s.forced = nil
            s.forcedTarget = nil
            return nil
        end
    end
    return s.forced
end
--- Team roam Think while a forced fight runs: attack the chosen enemy. Returns true.
function ____exports.FightThink(bot)
    local s = StateOf(bot)
    local t = s.forcedTarget
    if jmz.CanNotUseAction(bot) or t == nil or t:IsNull() then
        return true
    end
    bot:SetTarget(t)
    if bot:GetAttackTarget() ~= t then
        bot:Action_AttackUnit(t, true)
    end
    return true
end
return ____exports
