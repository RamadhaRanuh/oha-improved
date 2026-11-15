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
local Dist, NearestAttackable, Customize, enabled, explore
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local DamageType = ____dota.DamageType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Rng = require(GetScriptDirectory().."/FunLib/behavior/rng")
local Flags = require(GetScriptDirectory().."/FunLib/behavior/flags")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
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
function Dist(a, b)
    return GetUnitToUnitDistance(a, b)
end
function NearestAttackable(bot, enemies)
    local nearest = nil
    for ____, e in ipairs(enemies) do
        do
            local __continue55
            repeat
                if not jmz.CanBeAttacked(e) then
                    __continue55 = true
                    break
                end
                if nearest == nil or Dist(bot, e) < Dist(bot, nearest) then
                    nearest = e
                end
                __continue55 = true
            until true
            if not __continue55 then
                break
            end
        end
    end
    return nearest
end
Customize = require(GetScriptDirectory().."/Customize/general")
local DECISION_PERIOD = 1
local SITUATION_RADIUS = 1600
local HORIZON = 10
local HORIZON_LONG = 30
local FORCE_TIME = 4
local UNSEEN_AGE = 3
local states = {}
explore = 0
local learnedOn
local model
local function LearnedOn()
    if learnedOn == nil then
        learnedOn = Flags.IsOn("learned")
    end
    return learnedOn
end
--- Decision log on, or the learned policy on for this team: the mode hooks are needed.
function ____exports.Active()
    return ____exports.Enabled() or LearnedOn()
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
            forcedTarget = nil,
            src = nil
        }
        states[id] = s
    end
    return s
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
                local __continue15
                repeat
                    local a = bot:GetAbilityInSlot(i)
                    if a == nil or a == nil or a:IsNull() then
                        __continue15 = true
                        break
                    end
                    if a:IsUltimate() and a:IsTrained() and a:IsFullyCastable() then
                        return 1
                    end
                    __continue15 = true
                until true
                if not __continue15 then
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
            local __continue23
            repeat
                if not IsHeroAlive(pid) then
                    __continue23 = true
                    break
                end
                local info = GetHeroLastSeenInfo(pid)
                local age = info ~= nil and info ~= nil and #info > 0 and info[1].time_since_seen or 999
                if age > UNSEEN_AGE then
                    n = n + 1
                end
                __continue23 = true
            until true
            if not __continue23 then
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
            local __continue34
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
                    __continue34 = true
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
                local tag = p.shortDone and "FIGHTOUT30" or "FIGHTOUT"
                if not p.shortDone or now - p.at >= HORIZON_LONG then
                    print((((((((((((tag .. " id=") .. p.id) .. " died=") .. tostring(p.selfDied and 1 or 0)) .. " kills=") .. tostring(kills)) .. " allyDeaths=") .. tostring(allyDeaths)) .. " hp=") .. F(bot:IsAlive() and jmz.GetHP(bot) or 0)) .. " nwGain=") .. tostring(bot:GetNetWorth() - p.nw))
                end
                if not p.shortDone then
                    p.shortDone = true
                    keep[#keep + 1] = p
                elseif now - p.at < HORIZON_LONG then
                    keep[#keep + 1] = p
                end
                __continue34 = true
            until true
            if not __continue34 then
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
    s.src = "explore"
    s.forcedUntil = now + FORCE_TIME
    local nearest = NearestAttackable(bot, enemies)
    s.forcedTarget = nearest
    if s.forced == "fight" and nearest == nil then
        s.forced = nil
    end
end
local function SituationOf(bot, enemies, allies, now)
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
    return {
        t = now,
        pos = jmz.GetPosition(bot),
        lvl = bot:GetLevel(),
        hp = jmz.GetHP(bot),
        mp = jmz.GetMP(bot),
        nw = bot:GetNetWorth(),
        allies = #allies,
        allyHp = allyHp / (#allies + 1),
        allyLvl = allyLvl,
        allyNw = allyNw,
        enemies = #enemies,
        enemyHp = enemyHp / #enemies,
        enemyLvl = enemyLvl,
        missing = MissingEnemies(),
        near = math.floor(Dist(bot, nearest)),
        nearHp = jmz.GetHP(nearest),
        inc = incoming / math.max(
            bot:GetHealth(),
            1
        ),
        out = out / nearestHealth,
        teamOut = teamOut / nearestHealth,
        ult = UltReady(bot),
        towerAlly = NearestTowerDist(bot, false),
        towerEnemy = NearestTowerDist(bot, true),
        home = math.floor(bot:DistanceFromFountain()),
        laning = jmz.IsInLaningPhase() and 1 or 0
    }
end
--- Same order and transforms as FEATURES in typescript/post-process/train-fight.js.
local FEATURE_NAMES = {
    "hp",
    "mp",
    "lvl",
    "allies",
    "enemies",
    "sideDiff",
    "allyHp",
    "enemyHp",
    "lvlDiff",
    "missing",
    "near",
    "nearHp",
    "inc",
    "out",
    "teamOut",
    "ult",
    "towerAlly",
    "towerEnemy",
    "home",
    "laning",
    "minute",
    "pos"
}
local function FeaturesOf(x)
    return {
        x.hp,
        x.mp,
        x.lvl,
        x.allies,
        x.enemies,
        x.allies + 1 - x.enemies,
        x.allyHp,
        x.enemyHp,
        x.allyLvl / (x.allies + 1) - x.enemyLvl / math.max(x.enemies, 1),
        x.missing,
        x.near,
        x.nearHp,
        math.min(x.inc, 5),
        math.min(x.out, 5),
        math.min(x.teamOut, 10),
        x.ult,
        math.min(x.towerAlly, 5000),
        math.min(x.towerEnemy, 5000),
        x.home,
        x.laning,
        x.t / 60,
        x.pos
    }
end
local function Model()
    if model ~= nil then
        return model
    end
    model = nil
    local ok, m = pcall(
        require,
        GetScriptDirectory() .. "/FunLib/behavior/learned_fight_model"
    )
    if not ok or m == nil or m == nil then
        print("LEARNED no model file: flag learned does nothing")
        return model
    end
    local lm = m
    local names = lm.features
    local same = names ~= nil and #names == #FEATURE_NAMES
    if same then
        do
            local i = 0
            while i < #FEATURE_NAMES do
                if names[i + 1] ~= FEATURE_NAMES[i + 1] then
                    same = false
                end
                i = i + 1
            end
        end
    end
    if not same then
        print("LEARNED model feature list does not match: flag learned does nothing")
        return model
    end
    model = lm
    return model
end
local function EvalTree(tree, x)
    local n = tree
    while n.v == nil do
        n = x[n.f] <= n.t and n.l or n.r
    end
    return n.v
end
local function Predict(e, lr, x)
    local sum = e.base
    for ____, t in ipairs(e.trees) do
        sum = sum + lr * EvalTree(t, x)
    end
    return sum
end
--- The learned policy acts only after the lane phase.
local LEARNED_FROM = 600
local function Learned(bot, s, now, enemies, sit)
    if s.forced ~= nil or now < LEARNED_FROM then
        return
    end
    local m = Model()
    if m == nil then
        return
    end
    local x = FeaturesOf(sit)
    local d = Predict(m.fight, m.lr, x) - Predict(m.run, m.lr, x)
    if math.abs(d) <= m.margin then
        return
    end
    if d <= 0 then
        return
    end
    local choice = "fight"
    local target = NearestAttackable(bot, enemies)
    if choice == "fight" and target == nil then
        return
    end
    s.forced = choice
    s.src = "learned"
    s.forcedUntil = now + FORCE_TIME
    s.forcedTarget = target
    if Utils.DebugMode then
        print((((((((("LEARNED team=" .. tostring(GetTeam())) .. " hero=") .. Short(bot)) .. " t=") .. F(now, 1)) .. " choice=") .. choice) .. " d=") .. F(d))
    end
end
--- Called from retreat's GetDesire for every bot. Returns true (SafeCall reads nil as an error).
function ____exports.Tick(bot)
    if not ____exports.Active() or bot:IsIllusion() then
        return true
    end
    local s = StateOf(bot)
    local now = DotaTime()
    if ____exports.Enabled() then
        Settle(bot, s, now)
    end
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
    local x = SituationOf(bot, enemies, allies, now)
    if LearnedOn() then
        Learned(
            bot,
            s,
            now,
            enemies,
            x
        )
    end
    if not ____exports.Enabled() then
        return true
    end
    local id = (((tostring(GetTeam()) .. "-") .. tostring(bot:GetPlayerID())) .. "-") .. tostring(math.floor(now * 10))
    print(((((((((((((((((((((("FIGHTDEC id=" .. id) .. " t=") .. F(now, 1)) .. " team=") .. tostring(GetTeam())) .. " hero=") .. Short(bot)) .. " pos=") .. tostring(x.pos)) .. " lvl=") .. tostring(x.lvl)) .. " hp=") .. F(x.hp)) .. " mp=") .. F(x.mp)) .. " nw=") .. tostring(x.nw)) .. ((((((" allies=" .. tostring(x.allies)) .. " allyHp=") .. F(x.allyHp)) .. " allyLvl=") .. tostring(x.allyLvl)) .. " allyNw=") .. tostring(x.allyNw)) .. ((((((" enemies=" .. tostring(x.enemies)) .. " enemyHp=") .. F(x.enemyHp)) .. " enemyLvl=") .. tostring(x.enemyLvl)) .. " missing=") .. tostring(x.missing)) .. ((((((((" near=" .. tostring(x.near)) .. " nearHp=") .. F(x.nearHp)) .. " inc=") .. F(x.inc)) .. " out=") .. F(x.out)) .. " teamOut=") .. F(x.teamOut)) .. ((((((((" ult=" .. tostring(x.ult)) .. " towerAlly=") .. tostring(x.towerAlly)) .. " towerEnemy=") .. tostring(x.towerEnemy)) .. " home=") .. tostring(x.home)) .. " laning=") .. tostring(x.laning)) .. ((((" act=" .. Action(bot, s)) .. " forced=") .. tostring(s.forced ~= nil and s.src == "explore" and 1 or 0)) .. " src=") .. (s.forced ~= nil and s.src ~= nil and s.src or "-"))
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
        nw = x.nw,
        shortDone = false
    }
    return true
end
--- The forced action running for this bot, if any (exploration).
function ____exports.Forced(bot)
    if not ____exports.Active() then
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
