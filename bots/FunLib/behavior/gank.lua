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

local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
end

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

local function __TS__ArraySlice(self, first, last)
    local len = #self
    first = first or 0
    if first < 0 then
        first = len + first
        if first < 0 then
            first = 0
        end
    else
        if first > len then
            first = len
        end
    end
    last = last or len
    if last < 0 then
        last = len + last
        if last < 0 then
            last = 0
        end
    else
        if last > len then
            last = len
        end
    end
    local out = {}
    first = first + 1
    last = last + 1
    local n = 1
    while first < last do
        out[n] = self[first]
        first = first + 1
        n = n + 1
    end
    return out
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
local Log, UseSmoke, gank
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local Tower = ____dota.Tower
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local ____desire_tiers = require(GetScriptDirectory().."/FunLib/behavior/desire_tiers")
local DesireTier = ____desire_tiers.DesireTier
local TpCancel = require(GetScriptDirectory().."/FunLib/behavior/tpcancel")
function Log(text)
    if Utils.DebugMode then
        print((((("GANK team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(DotaTime()))) .. " ") .. text)
    end
end
function UseSmoke(here)
    if gank == nil then
        return
    end
    for ____, h in ipairs(here) do
        do
            local slot = 0
            while slot <= 5 do
                local item = h:GetItemInSlot(slot)
                if item ~= nil and item ~= nil and item:GetName() == "item_smoke_of_deceit" and jmz.CanCastAbility(item) then
                    h:Action_UseAbility(item)
                    gank.smoked = true
                    Log((("smoke by=" .. h:GetUnitName()) .. " here=") .. tostring(#here))
                    return
                end
                slot = slot + 1
            end
        end
    end
    Log("go no_smoke here=" .. tostring(#here))
end
local GANK_START = 10 * 60
local GANK_END = 40 * 60
local GANK_COOLDOWN = 180
local TOWER_GAP = 1800
local TARGET_ALONE = 1500
local SQUAD_MIN = 3
local SQUAD_MAX = 4
local SQUAD_RADIUS = 5000
local SQUAD_HP = 0.6
local GATHER_BACK = 2000
local GATHER_RADIUS = 700
local GATHER_TIMEOUT = 20
local LOST_TIME = 8
local GO_TIMEOUT = 40
local ENGAGE_RADIUS = 1000
local MAX_LIFE = GATHER_TIMEOUT + GO_TIMEOUT + 15
local TP_START = 3 * 60
local TP_ENEMIES = 2
local TP_FIGHT_RADIUS = 1000
local TP_TOWER_RADIUS = 1600
local TP_MIN_DIST = 3500
local TP_HP = 0.6
local TP_MAX = 2
local TP_ALLY_COOLDOWN = 30
local TP_AFTER = 3
____exports.TP_DESIRE = 0.9
local TOWERS = {
    Tower.Top1,
    Tower.Top2,
    Tower.Top3,
    Tower.Mid1,
    Tower.Mid2,
    Tower.Mid3,
    Tower.Bot1,
    Tower.Bot2,
    Tower.Bot3,
    Tower.Base1,
    Tower.Base2
}
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function Short(unit)
    return __TS__StringReplace(
        unit:GetUnitName(),
        "npc_dota_hero_",
        ""
    )
end
local function LiveTower(team, id)
    local t = GetTower(team, id)
    if t == nil or t == nil or t:IsNull() or not t:IsAlive() then
        return nil
    end
    return t
end
local function NearTower(team, loc, radius)
    for ____, id in ipairs(TOWERS) do
        local t = LiveTower(team, id)
        if t ~= nil and Dist(
            t:GetLocation(),
            loc
        ) < radius then
            return t
        end
    end
    return nil
end
local function Allies()
    return __TS__ArrayFilter(
        GetUnitList(UnitType.AlliedHeroes),
        function(____, h) return h ~= nil and not h:IsNull() and h:IsAlive() and not h:IsIllusion() and not jmz.IsMeepoClone(h) end
    )
end
local function Enemies(loc, radius)
    return jmz.GetEnemiesNearLoc(loc, radius)
end
local function Free(h, minHp)
    local mode = h:GetActiveMode()
    return jmz.GetHP(h) >= minHp and mode ~= BotMode.Retreat and mode ~= BotMode.EvasiveManeuvers and not h:IsChanneling() and not jmz.CanNotUseAction(h)
end
gank = nil
local gankEndAt = -999
local gankCheckAt = -999
local function InSquad(bot)
    return gank ~= nil and __TS__ArraySome(
        gank.squad,
        function(____, h) return h == bot end
    )
end
local function EndGank(result)
    if gank == nil then
        return
    end
    local g = gank
    gank = nil
    gankEndAt = DotaTime()
    Log((((("end result=" .. result) .. " dur=") .. tostring(math.floor(DotaTime() - g.startAt))) .. " target=") .. g.targetName)
end
local function FindGank()
    local now = DotaTime()
    if now < GANK_START or now > GANK_END or now - gankEndAt < GANK_COOLDOWN then
        return
    end
    if jmz.IsInLaningPhase() then
        return
    end
    local ourAncient = GetAncient(GetTeam()):GetLocation()
    for ____, enemy in ipairs(GetUnitList(UnitType.EnemyHeroes)) do
        do
            local __continue23
            repeat
                if not jmz.IsValidHero(enemy) or jmz.IsSuspiciousIllusion(enemy) then
                    __continue23 = true
                    break
                end
                local loc = enemy:GetLocation()
                if NearTower(
                    GetOpposingTeam(),
                    loc,
                    TOWER_GAP
                ) ~= nil then
                    __continue23 = true
                    break
                end
                if #Enemies(loc, TARGET_ALONE) > 1 then
                    __continue23 = true
                    break
                end
                local squad = __TS__ArraySlice(
                    __TS__ArraySort(
                        __TS__ArrayFilter(
                            Allies(),
                            function(____, h) return Free(h, SQUAD_HP) and Dist(
                                h:GetLocation(),
                                loc
                            ) < SQUAD_RADIUS end
                        ),
                        function(____, a, b) return Dist(
                            a:GetLocation(),
                            loc
                        ) - Dist(
                            b:GetLocation(),
                            loc
                        ) end
                    ),
                    0,
                    SQUAD_MAX
                )
                if #squad < SQUAD_MIN then
                    __continue23 = true
                    break
                end
                local back = math.max(
                    Dist(loc, ourAncient),
                    1
                )
                local gather = Vector(loc.x + (ourAncient.x - loc.x) / back * GATHER_BACK, loc.y + (ourAncient.y - loc.y) / back * GATHER_BACK, loc.z)
                gank = {
                    target = enemy,
                    targetName = Short(enemy),
                    targetId = enemy:GetPlayerID(),
                    squad = squad,
                    gather = gather,
                    phase = "gather",
                    startAt = now,
                    goAt = -1,
                    smoked = false,
                    lastLoc = loc
                }
                Log((((((("start target=" .. Short(enemy)) .. " squad=") .. table.concat(
                    __TS__ArrayMap(
                        squad,
                        function(____, h) return Short(h) end
                    ),
                    ","
                )) .. " gather=") .. tostring(math.floor(gather.x))) .. ",") .. tostring(math.floor(gather.y)))
                return
            until true
            if not __continue23 then
                break
            end
        end
    end
end
--- Update the plan (once per 0.3 s for the team).
local function UpdateGank()
    local now = DotaTime()
    if now - gankCheckAt < 0.3 then
        return
    end
    gankCheckAt = now
    if gank == nil then
        FindGank()
        return
    end
    local g = gank
    if now - g.startAt > MAX_LIFE then
        EndGank("max_life")
        return
    end
    g.squad = __TS__ArrayFilter(
        g.squad,
        function(____, h) return not h:IsNull() and h:IsAlive() and jmz.GetHP(h) > 0.3 end
    )
    if not IsHeroAlive(g.targetId) then
        EndGank("kill")
        return
    end
    local info = GetHeroLastSeenInfo(g.targetId)
    local seen = info ~= nil and info ~= nil and info[1] or nil
    if seen ~= nil and seen.time_since_seen < 1 then
        g.lastLoc = seen.location
    end
    if g.phase == "gather" then
        local here = __TS__ArrayFilter(
            g.squad,
            function(____, h) return Dist(
                h:GetLocation(),
                g.gather
            ) <= GATHER_RADIUS end
        )
        if #here >= math.min(SQUAD_MIN, #g.squad) and #g.squad >= SQUAD_MIN then
            g.phase = "go"
            g.goAt = now
            UseSmoke(here)
            return
        end
        if now - g.startAt > GATHER_TIMEOUT or #g.squad < SQUAD_MIN then
            EndGank("no_gather")
        end
        return
    end
    if seen ~= nil and seen.time_since_seen > LOST_TIME and now - g.goAt > LOST_TIME then
        EndGank("lost")
        return
    end
    if now - g.goAt > GO_TIMEOUT then
        EndGank("timeout")
        return
    end
    local centre = #g.squad > 0 and g.squad[1]:GetLocation() or g.lastLoc
    if #Enemies(centre, 1400) > #__TS__ArrayFilter(
        g.squad,
        function(____, h) return Dist(
            h:GetLocation(),
            centre
        ) < 1400 end
    ) then
        EndGank("outnumbered")
    end
end
--- HIGH while this bot is in a running smoke gank, else 0.
function ____exports.GankDesire(bot)
    UpdateGank()
    if gank == nil or not InSquad(bot) or not bot:IsAlive() then
        return 0
    end
    if DotaTime() - gank.startAt > MAX_LIFE then
        return 0
    end
    return DesireTier.HIGH
end
function ____exports.GankThink(bot)
    if gank == nil or jmz.CanNotUseAction(bot) then
        return
    end
    local g = gank
    if g.phase == "gather" then
        if Dist(
            bot:GetLocation(),
            g.gather
        ) > GATHER_RADIUS / 2 then
            bot:Action_MoveToLocation(g.gather)
        end
        return
    end
    local t = g.target
    if not t:IsNull() and t:CanBeSeen() and t:IsAlive() and Dist(
        bot:GetLocation(),
        t:GetLocation()
    ) < ENGAGE_RADIUS + 600 then
        bot:Action_AttackUnit(t, false)
        return
    end
    bot:Action_MoveToLocation(g.lastLoc)
end
local tpStates = {}
local tpResponders = {}
local tpAllyAt = {}
local function TpStateOf(bot)
    local key = (tostring(bot:GetPlayerID()) .. ":") .. bot:GetUnitName()
    local s = tpStates[key]
    if s == nil then
        s = {
            ally = nil,
            castAt = -999,
            landAt = -999,
            dest = Vector(0, 0, 0)
        }
        tpStates[key] = s
    end
    return s
end
local function TpScroll(bot)
    local item = bot:GetItemInSlot(15)
    if item ~= nil and item ~= nil and item:GetName() == "item_tpscroll" and jmz.CanCastAbility(item) then
        return item
    end
    return nil
end
--- An ally under a gank near our tower that this bot can TP to: [ally, tower].
local function FindTp(bot)
    local now = DotaTime()
    for ____, ally in ipairs(Allies()) do
        do
            local __continue66
            repeat
                if ally == bot then
                    __continue66 = true
                    break
                end
                local id = ally:GetPlayerID()
                if tpAllyAt[id] ~= nil and now - tpAllyAt[id] < TP_ALLY_COOLDOWN and #(tpResponders[id] or ({})) >= TP_MAX then
                    __continue66 = true
                    break
                end
                if not ally:WasRecentlyDamagedByAnyHero(2) then
                    __continue66 = true
                    break
                end
                local loc = ally:GetLocation()
                local enemies = #Enemies(loc, TP_FIGHT_RADIUS)
                if enemies < TP_ENEMIES then
                    __continue66 = true
                    break
                end
                local tower = NearTower(
                    GetTeam(),
                    loc,
                    TP_TOWER_RADIUS
                )
                if tower == nil then
                    __continue66 = true
                    break
                end
                if Dist(
                    bot:GetLocation(),
                    tower:GetLocation()
                ) < TP_MIN_DIST then
                    __continue66 = true
                    break
                end
                local defenders = #__TS__ArrayFilter(
                    Allies(),
                    function(____, h) return Dist(
                        h:GetLocation(),
                        loc
                    ) < TP_FIGHT_RADIUS + 400 end
                )
                local coming = tpAllyAt[id] ~= nil and now - tpAllyAt[id] < TP_ALLY_COOLDOWN and #(tpResponders[id] or ({})) or 0
                if defenders + coming + 1 < enemies then
                    __continue66 = true
                    break
                end
                return {ally, tower}
            until true
            if not __continue66 then
                break
            end
        end
    end
    return nil
end
--- TP_DESIRE while this bot is teleporting to help (and just after), else 0.
function ____exports.TpDesire(bot)
    local s = TpStateOf(bot)
    local now = DotaTime()
    if s.ally ~= nil then
        if bot:IsChanneling() then
            return ____exports.TP_DESIRE
        end
        if now - s.castAt < 0.5 then
            return ____exports.TP_DESIRE
        end
        if Dist(
            bot:GetLocation(),
            s.dest
        ) > 1500 then
            s.ally = nil
            return 0
        end
        if s.landAt < 0 then
            s.landAt = now
        end
        if now - s.landAt < TP_AFTER and now - s.castAt < 10 then
            return ____exports.TP_DESIRE
        end
        s.ally = nil
        return 0
    end
    if now < TP_START or not bot:IsAlive() or bot:IsIllusion() or not Free(bot, TP_HP) then
        return 0
    end
    if #Enemies(
        bot:GetLocation(),
        1400
    ) > 0 then
        return 0
    end
    local tp = TpScroll(bot)
    if tp == nil then
        return 0
    end
    local found = FindTp(bot)
    if found == nil then
        return 0
    end
    local ally = found[1]
    local tower = found[2]
    local id = ally:GetPlayerID()
    local tl = tower:GetLocation()
    local al = ally:GetLocation()
    local d = math.max(
        Dist(tl, al),
        1
    )
    local target = Vector(
        tl.x + (al.x - tl.x) / d * math.min(300, d),
        tl.y + (al.y - tl.y) / d * math.min(300, d),
        tl.z
    )
    if TpCancel.Blocked(
        bot,
        tp:GetName(),
        target
    ) then
        return 0
    end
    if tpAllyAt[id] == nil or now - tpAllyAt[id] >= TP_ALLY_COOLDOWN then
        tpAllyAt[id] = now
        tpResponders[id] = {}
    end
    local ____tpResponders_id_0 = tpResponders[id]
    ____tpResponders_id_0[#____tpResponders_id_0 + 1] = now
    s.ally = ally
    s.castAt = now
    s.landAt = -1
    s.dest = target
    bot:Action_UseAbilityOnLocation(tp, target)
    TpCancel.Record(bot, target)
    if Utils.DebugMode then
        print((((((((((((("TPHELP team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(now))) .. " ally=") .. ally:GetUnitName()) .. " enemies=") .. tostring(#Enemies(al, TP_FIGHT_RADIUS))) .. " defenders=") .. tostring(#__TS__ArrayFilter(
            Allies(),
            function(____, h) return Dist(
                h:GetLocation(),
                al
            ) < TP_FIGHT_RADIUS + 400 end
        ))) .. " dist=") .. tostring(math.floor(Dist(
            bot:GetLocation(),
            tl
        ))))
    end
    return ____exports.TP_DESIRE
end
function ____exports.TpActive(bot)
    return TpStateOf(bot).ally ~= nil
end
--- While channeling: nothing (any order cuts the TP). After landing: go hit the nearest attacker.
function ____exports.TpThink(bot)
    local s = TpStateOf(bot)
    if s.ally == nil or bot:IsChanneling() or jmz.CanNotUseAction(bot) then
        return
    end
    if DotaTime() - s.castAt < 0.5 then
        return
    end
    local ally = s.ally
    if ally:IsNull() or not ally:IsAlive() then
        return
    end
    local enemies = Enemies(
        ally:GetLocation(),
        TP_FIGHT_RADIUS
    )
    if #enemies > 0 then
        bot:Action_AttackUnit(enemies[1], false)
    else
        bot:Action_MoveToLocation(ally:GetLocation())
    end
end
return ____exports
