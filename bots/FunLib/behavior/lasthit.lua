--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local function __TS__ArrayIndexOf(self, searchElement, fromIndex)
    if fromIndex == nil then
        fromIndex = 0
    end
    local len = #self
    if len == 0 then
        return -1
    end
    if fromIndex >= len then
        return -1
    end
    if fromIndex < 0 then
        fromIndex = len + fromIndex
        if fromIndex < 0 then
            fromIndex = 0
        end
    end
    for i = fromIndex + 1, len do
        if self[i] == searchElement then
            return i - 1
        end
    end
    return -1
end

local function __TS__StringIncludes(self, searchString, position)
    if not position then
        position = 1
    else
        position = position + 1
    end
    local index = string.find(self, searchString, position, true)
    return index ~= nil
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end

local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ClassExtends(target, base)
    target.____super = base
    local staticMetatable = setmetatable({__index = base}, base)
    setmetatable(target, staticMetatable)
    local baseMetatable = getmetatable(base)
    if baseMetatable then
        if type(baseMetatable.__index) == "function" then
            staticMetatable.__index = baseMetatable.__index
        end
        if type(baseMetatable.__newindex) == "function" then
            staticMetatable.__newindex = baseMetatable.__newindex
        end
    end
    setmetatable(target.prototype, base.prototype)
    if type(base.prototype.__index) == "function" then
        target.prototype.__index = base.prototype.__index
    end
    if type(base.prototype.__newindex) == "function" then
        target.prototype.__newindex = base.prototype.__newindex
    end
    if type(base.prototype.__tostring) == "function" then
        target.prototype.__tostring = base.prototype.__tostring
    end
end

local Error, RangeError, ReferenceError, SyntaxError, TypeError, URIError
do
    local function getErrorStack(self, constructor)
        if debug == nil then
            return nil
        end
        local level = 1
        while true do
            local info = debug.getinfo(level, "f")
            level = level + 1
            if not info then
                level = 1
                break
            elseif info.func == constructor then
                break
            end
        end
        if __TS__StringIncludes(_VERSION, "Lua 5.0") then
            return debug.traceback(("[Level " .. tostring(level)) .. "]")
        else
            return debug.traceback(nil, level)
        end
    end
    local function wrapErrorToString(self, getDescription)
        return function(self)
            local description = getDescription(self)
            local caller = debug.getinfo(3, "f")
            local isClassicLua = __TS__StringIncludes(_VERSION, "Lua 5.0") or _VERSION == "Lua 5.1"
            if isClassicLua or caller and caller.func ~= error then
                return description
            else
                return (description .. "\n") .. tostring(self.stack)
            end
        end
    end
    local function initErrorClass(self, Type, name)
        Type.name = name
        return setmetatable(
            Type,
            {__call = function(____, _self, message) return __TS__New(Type, message) end}
        )
    end
    local ____initErrorClass_1 = initErrorClass
    local ____class_0 = __TS__Class()
    ____class_0.name = ""
    function ____class_0.prototype.____constructor(self, message)
        if message == nil then
            message = ""
        end
        self.message = message
        self.name = "Error"
        self.stack = getErrorStack(nil, self.constructor.new)
        local metatable = getmetatable(self)
        if metatable and not metatable.__errorToStringPatched then
            metatable.__errorToStringPatched = true
            metatable.__tostring = wrapErrorToString(nil, metatable.__tostring)
        end
    end
    function ____class_0.prototype.__tostring(self)
        return self.message ~= "" and (self.name .. ": ") .. self.message or self.name
    end
    Error = ____initErrorClass_1(nil, ____class_0, "Error")
    local function createErrorClass(self, name)
        local ____initErrorClass_3 = initErrorClass
        local ____class_2 = __TS__Class()
        ____class_2.name = ____class_2.name
        __TS__ClassExtends(____class_2, Error)
        function ____class_2.prototype.____constructor(self, ...)
            ____class_2.____super.prototype.____constructor(self, ...)
            self.name = name
        end
        return ____initErrorClass_3(nil, ____class_2, name)
    end
    RangeError = createErrorClass(nil, "RangeError")
    ReferenceError = createErrorClass(nil, "ReferenceError")
    SyntaxError = createErrorClass(nil, "SyntaxError")
    TypeError = createErrorClass(nil, "TypeError")
    URIError = createErrorClass(nil, "URIError")
end

local function __TS__ObjectGetOwnPropertyDescriptors(object)
    local metatable = getmetatable(object)
    if not metatable then
        return {}
    end
    return rawget(metatable, "_descriptors") or ({})
end

local function __TS__Delete(target, key)
    local descriptors = __TS__ObjectGetOwnPropertyDescriptors(target)
    local descriptor = descriptors[key]
    if descriptor then
        if not descriptor.configurable then
            error(
                __TS__New(
                    TypeError,
                    ((("Cannot delete property " .. tostring(key)) .. " of ") .. tostring(target)) .. "."
                ),
                0
            )
        end
        descriptors[key] = nil
        return true
    end
    target[key] = nil
    return true
end
-- End of Lua Library inline imports
local ____exports = {}
local GapOf, whys, runGap
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local DamageType = ____dota.DamageType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
function GapOf(bot)
    local g = runGap[bot:GetPlayerID()]
    return g == nil and 0.3 or math.min(
        0.5,
        math.max(0.03, g)
    )
end
local ACTIVE_UNTIL = 12 * 60
local SCAN_RANGE = 1000
local ATTACKER_RANGE = 1600
local HOLD_AHEAD = 1.5
local HP_MARGIN = 1
local ATTACK_ACTIVITY = 1503
local TOWER_NEAR = 900
local TOWER_HP = 0.5
local RETREAT_HP = 0.5
local DANGER_HP = 0.3
local DANGER_RANGE = 800
local CORE_NEAR = 900
local DENY_HP = 0.5
local HIT_DESIRE = 0.9
local SCHED_EXTRA = 0.15
local HOLD_DESIRE = 0.7
local LOG_GAP = 60
local plans = {}
local stats = {}
local pending = {}
local commits = {}
local holds = {}
local function Stage(bot, creep, stage)
    if not Utils.DebugMode then
        return
    end
    local w = (whys[bot:GetPlayerID()] or ({}))[tostring(creep)]
    if w == nil then
        return
    end
    local order = {
        "chosen",
        "walk",
        "fired",
        "cancel",
        "released"
    }
    if __TS__ArrayIndexOf(order, stage) > __TS__ArrayIndexOf(order, w.stage) then
        w.stage = stage
    end
end
whys = {}
local whyCounts = {}
local lastCall = {}
local function Note(bot, creep, reason)
    if not Utils.DebugMode then
        return
    end
    local id = bot:GetPlayerID()
    if whys[id] == nil then
        whys[id] = {}
    end
    local key = tostring(creep)
    local old = whys[id][key]
    if old ~= nil and old.reason == "mine" and reason ~= "mine" and GameTime() - old.at < 2 then
        return
    end
    whys[id][key] = {
        creep = creep,
        reason = reason,
        at = GameTime(),
        window = old ~= nil and old.window,
        lh0 = reason == "mine" and bot:GetLastHits() or -1,
        stage = old ~= nil and old.reason == "mine" and old.stage or "chosen"
    }
end
local function MarkWindow(bot, creep)
    if not Utils.DebugMode then
        return
    end
    local id = bot:GetPlayerID()
    if whys[id] == nil then
        whys[id] = {}
    end
    local key = tostring(creep)
    if whys[id][key] == nil then
        whys[id][key] = {
            creep = creep,
            reason = "other",
            at = GameTime(),
            window = true,
            lh0 = -1,
            stage = "chosen"
        }
    else
        whys[id][key].window = true
    end
end
local MODE_NAMES = {
    [1] = "lane",
    [2] = "attack",
    [4] = "retreat",
    [7] = "rune",
    [16] = "roam",
    [17] = "farm",
    [19] = "evasive",
    [28] = "watcher"
}
local function NoteAll(bot, reason)
    if not Utils.DebugMode then
        return
    end
    for ____, c in ipairs(bot:GetNearbyLaneCreeps(SCAN_RANGE, true)) do
        Note(bot, c, reason)
    end
end
local function TrackDeaths(bot)
    if not Utils.DebugMode then
        return
    end
    local id = bot:GetPlayerID()
    local now = GameTime()
    local gap = lastCall[id] ~= nil and now - lastCall[id] > math.max(
        0.6,
        2 * GapOf(bot)
    )
    lastCall[id] = now
    local lh = bot:GetLastHits()
    local list = whys[id]
    if list == nil then
        return
    end
    if whyCounts[id] == nil then
        whyCounts[id] = {}
    end
    local counts = whyCounts[id]
    for key in pairs(list) do
        do
            local __continue23
            repeat
                local w = list[key]
                if jmz.IsValid(w.creep) and w.creep:IsAlive() then
                    if now - w.at > 2 then
                        __TS__Delete(list, key)
                    end
                    __continue23 = true
                    break
                end
                __TS__Delete(list, key)
                local r = gap and "gap" or (w.window and w.reason ~= "mine" and "win_" .. w.reason or w.reason)
                if w.reason == "mine" then
                    r = lh > w.lh0 and "got" or "lost_" .. w.stage
                end
                local m = bot:GetActiveMode()
                r = (r .. "@") .. (MODE_NAMES[m] or "m" .. tostring(m))
                counts[r] = (counts[r] or 0) + 1
                __continue23 = true
            until true
            if not __continue23 then
                break
            end
        end
    end
end
local function CheckHold(bot)
    local id = bot:GetPlayerID()
    local h = holds[id]
    if h == nil then
        return
    end
    if jmz.IsValid(h.creep) and h.creep:IsAlive() then
        return
    end
    holds[id] = nil
    if not Utils.DebugMode then
        return
    end
    print(((((((("LHHOLDMISS team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. string.format(
        "%.1f",
        DotaTime()
    )) .. " kind=") .. h.kind) .. ((((((" left=" .. tostring(math.floor(h.left))) .. " dmg=") .. tostring(math.floor(h.dmg))) .. " land=") .. string.format("%.2f", h.land)) .. " age=") .. string.format(
        "%.2f",
        DotaTime() - h.at
    ))
end
local function KindOf(creep)
    local n = creep:GetUnitName()
    if (string.find(n, "siege")) ~= nil then
        return "siege"
    end
    if (string.find(n, "ranged")) ~= nil then
        return "ranged"
    end
    return "melee"
end
local function CheckPending(bot)
    local id = bot:GetPlayerID()
    local p = pending[id]
    if p == nil then
        return
    end
    local now = GameTime()
    if p.point < 0 and bot:GetLastAttackTime() > p.atk0 then
        p.point = bot:GetLastAttackTime() - p.t0
    end
    local count = p.act == "deny" and bot:GetDenies() or bot:GetLastHits()
    local got = count > p.count0
    local alive = jmz.IsValid(p.creep) and p.creep:IsAlive()
    if not got and alive and now < p.t0 + p.pred + 0.6 then
        return
    end
    pending[id] = nil
    if not Utils.DebugMode then
        return
    end
    local res = got and "got" or (alive and "alive" or "lost")
    print(((((((((("LHPRED team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. string.format(
        "%.1f",
        DotaTime()
    )) .. " act=") .. p.act) .. " kind=") .. p.kind) .. ((((((((((" pred=" .. string.format("%.2f", p.pred)) .. " point=") .. string.format("%.2f", p.point)) .. " left=") .. tostring(math.floor(p.left))) .. " dmg=") .. tostring(math.floor(p.dmg))) .. " hp0=") .. tostring(p.hp0)) .. " res=") .. res)
end
local function Rate(u)
    local a = u:GetAttackSpeed()
    if a > 10 then
        a = a / 100
    end
    return math.max(0.2, a)
end
local function IsRanged(u)
    return u:IsTower() or u:GetAttackRange() > 300
end
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function InWindup(u)
    return u:GetAnimActivity() == ATTACK_ACTIVITY and u:GetAnimCycle() < u:GetAttackPoint()
end
--- Times (s from now) and damage of the hits coming at `creep` within `horizon` s.
local function Timeline(creep, attackers, horizon)
    local out = {}
    local now = GameTime()
    local loc = creep:GetLocation()
    for ____, p in ipairs(creep:GetIncomingTrackingProjectiles()) do
        do
            local __continue46
            repeat
                if not p.is_attack or p.caster == nil or p.caster == nil or not p.caster:CanBeSeen() then
                    __continue46 = true
                    break
                end
                local t = Dist(p.location, loc) / math.max(
                    300,
                    p.caster:GetAttackProjectileSpeed()
                )
                if t <= horizon then
                    out[#out + 1] = {
                        t,
                        creep:GetActualIncomingDamage(
                            p.caster:GetAttackDamage(),
                            DamageType.Physical
                        )
                    }
                end
                __continue46 = true
            until true
            if not __continue46 then
                break
            end
        end
    end
    for ____, a in ipairs(attackers) do
        do
            local __continue50
            repeat
                if a:GetAttackTarget() ~= creep then
                    __continue50 = true
                    break
                end
                local dmg = creep:GetActualIncomingDamage(
                    a:GetAttackDamage(),
                    DamageType.Physical
                )
                local rate = Rate(a)
                local ap = a:GetAttackPoint() / rate
                local spa = math.max(
                    0.3,
                    a:GetSecondsPerAttack()
                )
                local travel = IsRanged(a) and math.max(
                    0,
                    GetUnitToUnitDistance(a, creep) - 30
                ) / math.max(
                    300,
                    a:GetAttackProjectileSpeed()
                ) or 0
                local swing = InWindup(a) and (a:GetAttackPoint() - a:GetAnimCycle()) / rate or math.max(
                    ap,
                    a:GetLastAttackTime() + spa - now
                )
                while swing + travel <= horizon do
                    out[#out + 1] = {swing + travel, dmg}
                    swing = swing + spa
                end
                __continue50 = true
            until true
            if not __continue50 then
                break
            end
        end
    end
    return out
end
--- Predicted health at `t` s from now, counting the hits that land before `t`.
local function HealthAt(creep, events, t)
    local hp = creep:GetHealth() + creep:GetHealthRegen() * t
    for ____, ____value in ipairs(events) do
        local at = ____value[1]
        local dmg = ____value[2]
        if at < t then
            hp = hp - dmg
        end
    end
    return hp
end
--- Seconds until our hit on `creep` lands, and whether we must walk first.
local function OurHitTime(bot, creep)
    local rate = Rate(bot)
    local ap = bot:GetAttackPoint() / rate
    local reach = bot:GetAttackRange() + 40
    local d = GetUnitToUnitDistance(bot, creep)
    local travel = IsRanged(bot) and math.max(
        0,
        math.min(d, reach) - 30
    ) / math.max(
        300,
        bot:GetAttackProjectileSpeed()
    ) or 0
    local walk = math.max(0, d - reach) / math.max(
        200,
        bot:GetCurrentMovementSpeed()
    )
    local ready = math.max(
        0,
        bot:GetLastAttackTime() - ap + bot:GetSecondsPerAttack() - GameTime()
    )
    return {
        math.max(walk, ready) + 0.05 + ap + travel,
        walk > 0
    }
end
--- Our attack timing on `creep`: seconds until we may swing (cooldown), walk time, and swing-to-land time.
local function OurTiming(bot, creep)
    local rate = Rate(bot)
    local ap = bot:GetAttackPoint() / rate
    local reach = bot:GetAttackRange() + 40
    local d = GetUnitToUnitDistance(bot, creep)
    local travel = IsRanged(bot) and math.max(
        0,
        math.min(d, reach) - 30
    ) / math.max(
        300,
        bot:GetAttackProjectileSpeed()
    ) or 0
    local walk = math.max(0, d - reach) / math.max(
        200,
        bot:GetCurrentMovementSpeed()
    )
    local ready = math.max(
        0,
        bot:GetLastAttackTime() - ap + bot:GetSecondsPerAttack() - GameTime()
    )
    return {ready, walk, 0.05 + ap + travel}
end
local runAt = {}
runGap = {}
local function NoteRun(bot)
    local id = bot:GetPlayerID()
    local now = GameTime()
    local prev = runAt[id]
    runAt[id] = now
    if prev == nil or now - prev <= 0 or now - prev > 1 then
        return
    end
    runGap[id] = runGap[id] == nil and now - prev or 0.8 * runGap[id] + 0.2 * (now - prev)
end
local function OurDamage(bot, creep)
    local dmg = bot:GetAttackDamage() - 0.5 * bot:GetBaseDamageVariance()
    local qb = bot:FindItemSlot("item_quelling_blade")
    if qb >= 0 and bot:GetItemSlotType(qb) == 0 then
        dmg = dmg + (IsRanged(bot) and 4 or 8)
    end
    return creep:GetActualIncomingDamage(dmg, DamageType.Physical)
end
local function CountNear(units, loc, radius)
    local n = 0
    for ____, u in ipairs(units) do
        if jmz.IsValidHero(u) and Dist(
            u:GetLocation(),
            loc
        ) <= radius then
            n = n + 1
        end
    end
    return n
end
local function StatsOf(bot)
    local id = bot:GetPlayerID()
    if stats[id] == nil then
        stats[id] = {
            hit = 0,
            deny = 0,
            hold = 0,
            cancel = 0,
            sched = 0,
            bidWon = 0,
            bidLost = {},
            desires = 0,
            thinks = 0,
            logAt = DotaTime(),
            lastAct = ""
        }
    end
    return stats[id]
end
local function Log(bot)
    if not Utils.DebugMode then
        return
    end
    local s = StatsOf(bot)
    if DotaTime() - s.logAt < LOG_GAP then
        return
    end
    s.logAt = DotaTime()
    print((((((((((((((((((((("LASTHIT team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(DotaTime()))) .. " hit=") .. tostring(s.hit)) .. " deny=") .. tostring(s.deny)) .. " hold=") .. tostring(s.hold)) .. " cancel=") .. tostring(s.cancel)) .. " sched=") .. tostring(s.sched)) .. " desires=") .. tostring(s.desires)) .. " thinks=") .. tostring(s.thinks)) .. " gap=") .. string.format(
        "%.2f",
        GapOf(bot)
    ))
    local lost = ""
    for k in pairs(s.bidLost) do
        lost = lost .. ((" lost_" .. k) .. "=") .. tostring(s.bidLost[k])
    end
    print(((((((("LHBID team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(DotaTime()))) .. " won=") .. tostring(s.bidWon)) .. lost)
    local counts = whyCounts[bot:GetPlayerID()]
    if counts ~= nil then
        local text = ""
        for k in pairs(counts) do
            text = text .. ((" " .. k) .. "=") .. tostring(counts[k])
        end
        print(((((("LHWHY team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(DotaTime()))) .. text)
    end
end
--- The smallest delay (s) after which an attack order on `creep` lands with its health in (0, our damage], within the
-- next run gap plus SCHED_EXTRA; -1 when there is none. Candidate delays are just after each hit on the timeline.
local function SchedDelay(bot, creep, events, dmg, deny)
    local ready, ____, swing = unpack(OurTiming(bot, creep))
    local ahead = GapOf(bot) + SCHED_EXTRA
    local best = -1
    for ____, ____value in ipairs(events) do
        local at = ____value[1]
        do
            local __continue80
            repeat
                local delay = at - swing + 0.02
                if delay <= 0 or delay > ahead or best >= 0 and delay >= best then
                    __continue80 = true
                    break
                end
                local land = math.max(delay, ready) + swing
                local left = HealthAt(creep, events, land)
                if left <= 0 or left + HP_MARGIN > dmg then
                    __continue80 = true
                    break
                end
                if deny and HealthAt(creep, events, delay) / math.max(
                    1,
                    creep:GetMaxHealth()
                ) >= DENY_HP then
                    __continue80 = true
                    break
                end
                best = delay
                __continue80 = true
            until true
            if not __continue80 then
                break
            end
        end
    end
    return best
end
--- Plans for this moment: sets plans[id] and returns the bid (0: nothing to do). The engine polls GetDesire only
-- about 3 times a game second (ROAMSUB counts, timescale 1 and 8 alike), shorter than many last-hit windows, so
-- Desire only keeps team roam active while a creep is near its window and Think plans again on every call.
local function MakePlan(bot)
    local id = bot:GetPlayerID()
    plans[id] = nil
    CheckPending(bot)
    local t = DotaTime()
    if t < 0 or t >= ACTIVE_UNTIL or not bot:IsAlive() then
        return 0
    end
    TrackDeaths(bot)
    Log(bot)
    if bot:IsUsingAbility() or bot:IsChanneling() or bot:IsDisarmed() then
        NoteAll(bot, "busy")
        return 0
    end
    if jmz.IsInTeamFight(bot, 1200) then
        NoteAll(bot, "teamfight")
        return 0
    end
    local hp = jmz.GetHP(bot)
    local enemies = bot:GetNearbyHeroes(ATTACKER_RANGE, true, BotMode.None)
    local allies = bot:GetNearbyHeroes(ATTACKER_RANGE, false, BotMode.None)
    if hp < DANGER_HP and CountNear(
        enemies,
        bot:GetLocation(),
        DANGER_RANGE
    ) > 0 then
        NoteAll(bot, "danger")
        return 0
    end
    local retreating = jmz.IsRetreating(bot)
    if retreating and hp < RETREAT_HP then
        NoteAll(bot, "retreat")
        return 0
    end
    local enemyCreeps = bot:GetNearbyLaneCreeps(ATTACKER_RANGE, true)
    local ownCreeps = bot:GetNearbyLaneCreeps(ATTACKER_RANGE, false)
    local enemyTowers = bot:GetNearbyTowers(ATTACKER_RANGE, true)
    local ownTowers = bot:GetNearbyTowers(ATTACKER_RANGE, false)
    local attackers = {}
    for ____, list in ipairs({
        enemyCreeps,
        ownCreeps,
        enemyTowers,
        ownTowers,
        enemies,
        allies
    }) do
        for ____, u in ipairs(list) do
            if u ~= bot and u:CanBeSeen() and u:IsAlive() then
                attackers[#attackers + 1] = u
            end
        end
    end
    local isCore = jmz.IsCore(bot)
    CheckHold(bot)
    local c = commits[id]
    if c ~= nil and GameTime() < c.t0 and jmz.IsValid(c.creep) and c.creep:IsAlive() then
        local wait = c.t0 - GameTime()
        local at = wait + c.land
        local left = HealthAt(
            c.creep,
            Timeline(c.creep, attackers, at + 0.1),
            at
        )
        if left > 0 and left + HP_MARGIN <= OurDamage(bot, c.creep) then
            plans[id] = {act = "keep", creep = c.creep}
            if c.act == "hit" then
                Note(bot, c.creep, "mine")
            end
            return HIT_DESIRE
        end
        commits[id] = nil
        pending[id] = nil
    elseif c ~= nil then
        local now = GameTime()
        local released = bot:GetLastAttackTime() > c.atk0 + 0.001
        if released and jmz.IsValid(c.creep) then
            Stage(bot, c.creep, "released")
        end
        if released or not jmz.IsValid(c.creep) or not c.creep:IsAlive() or now > c.t0 + c.land + 0.3 then
            commits[id] = nil
        else
            local remaining = math.max(0.02, c.t0 + c.land - now)
            local left = HealthAt(
                c.creep,
                Timeline(c.creep, attackers, remaining + 0.1),
                remaining
            )
            local dmg = OurDamage(bot, c.creep)
            if left > dmg + math.max(5, 0.25 * dmg) then
                commits[id] = nil
                pending[id] = nil
                plans[id] = {act = "cancel", creep = c.creep}
                Stage(bot, c.creep, "cancel")
                if Utils.DebugMode then
                    print(((((((("LHCANCEL team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. string.format(
                        "%.1f",
                        DotaTime()
                    )) .. " why=") .. (left > 0 and "early" or "late")) .. ((((" land=" .. string.format("%.2f", remaining)) .. " left=") .. tostring(math.floor(left))) .. " dmg=") .. tostring(math.floor(dmg)))
                end
                return HIT_DESIRE
            end
            plans[id] = {act = c.act, creep = c.creep}
            NoteAll(bot, c.act == "deny" and "busy_deny" or "busy_commit")
            if c.act == "hit" then
                Note(bot, c.creep, "mine")
            end
            return HIT_DESIRE
        end
    end
    local best = nil
    local bestRank = 99
    local bestDist = 99999
    local function consider(creep, deny)
        local function note(r)
            if not deny then
                Note(bot, creep, r)
            end
        end
        if not jmz.IsValid(creep) or not jmz.CanBeAttacked(creep) then
            return
        end
        local d = GetUnitToUnitDistance(bot, creep)
        if d > SCAN_RANGE then
            return
        end
        local loc = creep:GetLocation()
        if deny and creep:GetHealth() / math.max(
            1,
            creep:GetMaxHealth()
        ) >= DENY_HP + 0.15 then
            return
        end
        if not deny and not isCore then
            for ____, a in ipairs(allies) do
                if a ~= bot and jmz.IsValidHero(a) and jmz.IsCore(a) and Dist(
                    a:GetLocation(),
                    loc
                ) <= CORE_NEAR then
                    return note("support")
                end
            end
        end
        for ____, tw in ipairs(enemyTowers) do
            do
                local __continue116
                repeat
                    if not tw:IsAlive() or Dist(
                        tw:GetLocation(),
                        loc
                    ) > TOWER_NEAR then
                        __continue116 = true
                        break
                    end
                    local shot = tw:GetAttackTarget()
                    if hp < TOWER_HP or shot == nil or shot == nil or shot == bot or shot:IsHero() then
                        return note("tower")
                    end
                    __continue116 = true
                until true
                if not __continue116 then
                    break
                end
            end
        end
        local land, walk = unpack(OurHitTime(bot, creep))
        if retreating and walk then
            return note("retreat_walk")
        end
        local outnumbered = CountNear(enemies, loc, 1000) > CountNear(allies, loc, 1000)
        if walk and outnumbered then
            return note("out_walk")
        end
        local events = Timeline(creep, attackers, land + HOLD_AHEAD)
        local dmg = OurDamage(bot, creep)
        local left = HealthAt(creep, events, land)
        if left <= 0 then
            return note(walk and "dying_walk" or (OurTiming(bot, creep)[1] > 0.05 and "dying_cd" or "dying"))
        end
        local rank
        local act
        if left + HP_MARGIN <= dmg then
            if deny and creep:GetHealth() / math.max(
                1,
                creep:GetMaxHealth()
            ) >= DENY_HP then
                return
            end
            act = deny and "deny" or "hit"
            if not deny then
                MarkWindow(bot, creep)
            end
            rank = deny and 1 or 0
        elseif not walk and (best == nil or bestRank > (deny and 1.5 or 0.5)) and SchedDelay(
            bot,
            creep,
            events,
            dmg,
            deny
        ) >= 0 then
            act = "sched"
            if not deny then
                MarkWindow(bot, creep)
            end
            rank = deny and 1.5 or 0.5
        else
            if retreating then
                return note("hold_retreat")
            end
            if outnumbered then
                return note("hold_out")
            end
            if HealthAt(creep, events, land + HOLD_AHEAD) > dmg then
                return note("not_soon")
            end
            act = "hold"
            rank = deny and 3 or 2
        end
        note("other")
        if rank < bestRank or rank == bestRank and d < bestDist then
            best = {act = act, creep = creep, left = left, deny = deny}
            if act == "sched" then
                best.delay = SchedDelay(
                    bot,
                    creep,
                    events,
                    dmg,
                    deny
                )
            end
            bestRank = rank
            bestDist = d
        end
    end
    for ____, c in ipairs(enemyCreeps) do
        consider(c, false)
    end
    for ____, c in ipairs(ownCreeps) do
        consider(c, true)
    end
    if best == nil then
        return 0
    end
    plans[id] = best
    local chosen = best
    if chosen.act == "hit" or chosen.act == "sched" and chosen.deny ~= true then
        Note(bot, chosen.creep, "mine")
        if OurHitTime(bot, chosen.creep)[2] then
            Stage(bot, chosen.creep, "walk")
        end
    elseif chosen.act == "hold" then
        Note(bot, chosen.creep, "hold")
    else
        NoteAll(bot, "deny_chosen")
    end
    if chosen.act == "hold" then
        local land = unpack(OurHitTime(bot, chosen.creep))
        holds[id] = {
            creep = chosen.creep,
            left = chosen.left == nil and -1 or chosen.left,
            dmg = OurDamage(bot, chosen.creep),
            land = land,
            at = DotaTime(),
            kind = KindOf(chosen.creep)
        }
    elseif holds[id] ~= nil and holds[id].creep == chosen.creep then
        holds[id] = nil
    end
    return best.act == "hold" and HOLD_DESIRE or HIT_DESIRE
end
local lastBid = {}
--- The bid for team roam (0 when there is nothing to do).
function ____exports.Desire(bot)
    local s = StatsOf(bot)
    s.desires = s.desires + 1
    NoteRun(bot)
    local id = bot:GetPlayerID()
    if lastBid[id] ~= nil and lastBid[id] > 0 then
        local m = bot:GetActiveMode()
        if m == BotMode.TeamRoam then
            s.bidWon = s.bidWon + 1
        else
            s.bidLost["m" .. tostring(m)] = (s.bidLost["m" .. tostring(m)] or 0) + 1
        end
    end
    local bid = MakePlan(bot)
    lastBid[id] = bid
    return bid
end
--- Plans again for this frame and acts on it.
function ____exports.Think(bot)
    local ____StatsOf_result_0, ____thinks_1 = StatsOf(bot), "thinks"
    ____StatsOf_result_0[____thinks_1] = ____StatsOf_result_0[____thinks_1] + 1
    NoteRun(bot)
    MakePlan(bot)
    local plan = plans[bot:GetPlayerID()]
    if plan == nil or not jmz.IsValid(plan.creep) then
        return
    end
    local s = StatsOf(bot)
    local creep = plan.creep
    if plan.act == "keep" then
        return
    end
    if plan.act == "sched" then
        local delay = plan.delay == nil and 0 or plan.delay
        local ready, ____, swing = unpack(OurTiming(bot, creep))
        bot:Action_Delay(delay)
        bot:ActionQueue_AttackUnit(creep, true)
        Stage(bot, creep, "fired")
        local id = bot:GetPlayerID()
        commits[id] = {
            creep = creep,
            act = plan.deny == true and "deny" or "hit",
            t0 = GameTime() + delay,
            land = math.max(0, ready - delay) + swing,
            atk0 = bot:GetLastAttackTime()
        }
        if holds[id] ~= nil and holds[id].creep == creep then
            holds[id] = nil
        end
        s.sched = s.sched + 1
        s.lastAct = "sched"
        if pending[id] == nil then
            pending[id] = {
                creep = creep,
                act = plan.deny == true and "deny" or "hit",
                t0 = GameTime(),
                pred = delay + math.max(0, ready - delay) + swing,
                left = plan.left == nil and -1 or plan.left,
                dmg = OurDamage(bot, creep),
                hp0 = creep:GetHealth(),
                atk0 = bot:GetLastAttackTime(),
                count0 = plan.deny == true and bot:GetDenies() or bot:GetLastHits(),
                point = -1,
                kind = "sched_" .. KindOf(creep)
            }
        end
        return
    end
    if plan.act == "cancel" then
        bot:Action_ClearActions(true)
        s.cancel = s.cancel + 1
        s.lastAct = "cancel"
        return
    end
    if plan.act == "hold" then
        local reach = bot:GetAttackRange() + 40
        local d = GetUnitToUnitDistance(bot, creep)
        if s.lastAct ~= "hold" then
            s.hold = s.hold + 1
        end
        s.lastAct = "hold"
        if d > reach - 20 then
            local from = creep:GetLocation()
            local to = bot:GetLocation()
            local k = math.max(0, reach - 60) / math.max(1, d)
            bot:Action_MoveToLocation(Vector(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, from.z))
        elseif bot:GetAttackTarget() ~= nil and bot:GetAttackTarget() ~= nil then
            bot:Action_ClearActions(true)
        end
        return
    end
    local id0 = bot:GetPlayerID()
    local commit = commits[id0]
    if commit ~= nil and commit.creep == creep then
        if bot:GetAttackTarget() ~= creep then
            bot:Action_AttackUnit(creep, true)
        end
        return
    end
    bot:Action_AttackUnit(creep, true)
    Stage(bot, creep, "fired")
    commits[id0] = {
        creep = creep,
        act = plan.act,
        t0 = GameTime(),
        land = OurHitTime(bot, creep)[1],
        atk0 = bot:GetLastAttackTime()
    }
    if holds[id0] ~= nil and holds[id0].creep == creep then
        holds[id0] = nil
    end
    local key = (plan.act .. ":") .. tostring(creep)
    if s.lastAct ~= key then
        if plan.act == "hit" then
            s.hit = s.hit + 1
        else
            s.deny = s.deny + 1
        end
        local id = bot:GetPlayerID()
        if pending[id] == nil then
            local land = unpack(OurHitTime(bot, creep))
            pending[id] = {
                creep = creep,
                act = plan.act,
                t0 = GameTime(),
                pred = land,
                left = plan.left == nil and -1 or plan.left,
                dmg = OurDamage(bot, creep),
                hp0 = creep:GetHealth(),
                atk0 = bot:GetLastAttackTime(),
                count0 = plan.act == "deny" and bot:GetDenies() or bot:GetLastHits(),
                point = -1,
                kind = KindOf(creep)
            }
        end
    end
    s.lastAct = key
end
return ____exports
