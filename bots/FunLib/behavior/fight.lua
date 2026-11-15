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

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
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

local function __TS__Number(value)
    local valueType = type(value)
    if valueType == "number" then
        return value
    elseif valueType == "string" then
        local numberValue = tonumber(value)
        if numberValue then
            return numberValue
        end
        if value == "Infinity" then
            return math.huge
        end
        if value == "-Infinity" then
            return -math.huge
        end
        local stringWithoutSpaces = string.gsub(value, "%s", "")
        if stringWithoutSpaces == "" then
            return 0
        end
        return 0 / 0
    elseif valueType == "boolean" then
        return value and 1 or 0
    else
        return 0 / 0
    end
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

local function __TS__StringStartsWith(self, searchString, position)
    if position == nil or position < 0 then
        position = 0
    end
    return string.sub(self, position + 1, #searchString + position) == searchString
end
-- End of Lua Library inline imports
local ____exports = {}
local FoggedHealth, Dist, Short, Log, Live, Allies, Centre, EnemyName, InitiatorWeight, EnemyEntries, Groups, Ratio, Fighting, Contact, SetState, Unaccounted, LowTarget, Trap, UpdateState, FocusScore, UpdateFocus, Build, FocusUnit, FinishingKill, Survive, BUCKET, SEEN_RECENT, GROUP_LINK, CONTACT, JOIN_TIME, MISSING_AGE, MISSING_TRAVEL, MISSING_WEIGHT, ENGAGE_RATIO, ENGAGE_RATIO_LANING, DISENGAGE_RATIO, HUMAN_FACTOR, ELSEWHERE_AGE, ELSEWHERE_DIST, LOW_TARGET_HP, OUTNUMBERED_RATIO, HOLD_AFTER, MIN_ENGAGE, DEATH_WINDOW, CLEAR_RADIUS, FIGHTING_RADIUS, FOCUS_NEAR, FOCUS_FAR, SWITCH_FACTOR, LOST_TIME, FOCUS_LEASH_DIST, LEASH_TIME, LEASH_DROP, LEASH_SKIP, SURVIVE_HP, SURVIVE_LOW_HP, SURVIVE_RADIUS, SURVIVE_PROJECTED, PROJECT_RADIUS, PROJECT_TIME, CAUGHT_RANGE, CAUGHT_MIN_HP, CAUGHT_SPEED_MARGIN, CAUGHT_LOG_GAP, SKIP_MODS, BLADE_MAIL, fights, builtAt, nextId, skipUntil, lastHealth, lastMaxHealth, FOGGED_MIN_HP, humanIds, trapLogged, caughtLogAt
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local DamageType = ____dota.DamageType
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local Brain = require(GetScriptDirectory().."/FunLib/behavior/team_brain")
local ____aba_hero_roles_map = require(GetScriptDirectory().."/FunLib/aba_hero_roles_map")
local HeroRolesMap = ____aba_hero_roles_map.HeroRolesMap
local ____desire_tiers = require(GetScriptDirectory().."/FunLib/behavior/desire_tiers")
local DesireTier = ____desire_tiers.DesireTier
function FoggedHealth(id)
    local hp = lastHealth[id]
    if hp == nil then
        return 1000
    end
    local max = lastMaxHealth[id]
    return max ~= nil and math.max(hp, max * FOGGED_MIN_HP) or hp
end
function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
function Short(name)
    return __TS__StringReplace(name, "npc_dota_hero_", "")
end
function Log(f, text)
    if Utils.DebugMode then
        print((((((("FIGHT team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(DotaTime()))) .. " eng=") .. tostring(f.id)) .. " ") .. text)
    end
end
function Live(u)
    return u ~= nil and u ~= nil and not u:IsNull() and u:CanBeSeen()
end
function Allies()
    return __TS__ArrayFilter(
        GetUnitList(UnitType.AlliedHeroes),
        function(____, h) return h ~= nil and not h:IsNull() and h:IsAlive() and not h:IsIllusion() and not jmz.IsMeepoClone(h) end
    )
end
function Centre(points)
    local x = 0
    local y = 0
    for ____, p in ipairs(points) do
        x = x + p.x
        y = y + p.y
    end
    local n = math.max(#points, 1)
    return Vector(x / n, y / n, 0)
end
function EnemyName(f, id)
    for ____, e in ipairs(f.enemies) do
        if e.id == id and Live(e.unit) then
            return Short(e.unit:GetUnitName())
        end
    end
    return "#" .. tostring(id)
end
function InitiatorWeight(h)
    local roles = HeroRolesMap[h:GetUnitName()]
    local ____temp_0
    if roles ~= nil and roles.initiator ~= nil then
        ____temp_0 = roles.initiator
    else
        ____temp_0 = 0
    end
    return ____temp_0
end
function EnemyEntries()
    local out = {}
    for ____, e in ipairs(Brain.Get().enemies) do
        do
            local __continue20
            repeat
                if not e.alive or e.lastSeenLoc == nil or e.lastSeenAge > SEEN_RECENT then
                    __continue20 = true
                    break
                end
                local unit = nil
                local health = FoggedHealth(e.id)
                if e.visible and Live(e.unit) then
                    unit = e.unit
                    health = unit:GetHealth()
                    lastHealth[e.id] = health
                    lastMaxHealth[e.id] = unit:GetMaxHealth()
                    if not unit:IsBot() then
                        humanIds[e.id] = true
                    end
                end
                out[#out + 1] = {
                    id = e.id,
                    unit = unit,
                    loc = e.lastSeenLoc,
                    weight = 1,
                    health = health,
                    power = e.rawPower
                }
                __continue20 = true
            until true
            if not __continue20 then
                break
            end
        end
    end
    return out
end
function Groups(entries)
    local groups = {}
    local used = __TS__ArrayMap(
        entries,
        function() return false end
    )
    do
        local i = 0
        while i < #entries do
            do
                local __continue27
                repeat
                    if used[i + 1] then
                        __continue27 = true
                        break
                    end
                    used[i + 1] = true
                    local group = {entries[i + 1]}
                    do
                        local k = 0
                        while k < #group do
                            do
                                local j = 0
                                while j < #entries do
                                    if not used[j + 1] and Dist(group[k + 1].loc, entries[j + 1].loc) <= GROUP_LINK then
                                        used[j + 1] = true
                                        group[#group + 1] = entries[j + 1]
                                    end
                                    j = j + 1
                                end
                            end
                            k = k + 1
                        end
                    end
                    groups[#groups + 1] = group
                    __continue27 = true
                until true
                if not __continue27 then
                    break
                end
            end
            i = i + 1
        end
    end
    return groups
end
function Ratio(f)
    local ourDps = 0
    local ourHp = 0
    for ____, a in ipairs(f.allies) do
        ourDps = ourDps + math.max(
            a:GetOffensivePower(),
            0
        ) / 5
        ourHp = ourHp + a:GetHealth()
    end
    local unknownPower = #f.allies > 0 and ourDps * 5 / #f.allies or 0
    local theirDps = 0
    local theirHp = 0
    for ____, e in ipairs(f.enemies) do
        theirDps = theirDps + (e.power > 0 and e.power or unknownPower) / 5 * e.weight
        theirHp = theirHp + e.health * e.weight
    end
    if ourDps <= 0 or ourHp <= 0 then
        return 0
    end
    if theirDps <= 0 or theirHp <= 0 then
        return 99
    end
    local human = __TS__ArraySome(
        f.enemies,
        function(____, e) return e.weight >= 1 and humanIds[e.id] == true end
    )
    return ourDps / theirHp / (theirDps / ourHp) * (human and HUMAN_FACTOR or 1)
end
function Fighting(f)
    for ____, a in ipairs(f.allies) do
        do
            local __continue41
            repeat
                if not a:WasRecentlyDamagedByAnyHero(2) then
                    __continue41 = true
                    break
                end
                for ____, e in ipairs(f.enemies) do
                    if e.weight >= 1 and Dist(
                        a:GetLocation(),
                        e.loc
                    ) <= FIGHTING_RADIUS then
                        return true
                    end
                end
                __continue41 = true
            until true
            if not __continue41 then
                break
            end
        end
    end
    return false
end
function Contact(f, radius)
    for ____, a in ipairs(f.allies) do
        for ____, e in ipairs(f.enemies) do
            if e.weight >= 1 and Dist(
                a:GetLocation(),
                e.loc
            ) <= radius then
                return true
            end
        end
    end
    return false
end
function SetState(f, state, why)
    if f.state == state then
        return
    end
    local was = f.state
    f.state = state
    f.stateSince = DotaTime()
    if state == "disengage" then
        f.disengageAt = DotaTime()
    end
    if state == "engage" then
        for ____, e in ipairs(f.enemies) do
            if e.id == f.focusId and Live(e.unit) then
                f.focusHp = e.unit:GetHealth() / math.max(
                    e.unit:GetMaxHealth(),
                    1
                )
            end
        end
    end
    Log(
        f,
        (((((((((((((was .. ">") .. state) .. " why=") .. why) .. " ratio=") .. tostring(math.floor(f.ratio * 100) / 100)) .. " allies=") .. table.concat(
            __TS__ArrayMap(
                f.allies,
                function(____, a) return Short(a:GetUnitName()) end
            ),
            ","
        )) .. " enemies=") .. table.concat(
            __TS__ArrayMap(
                __TS__ArrayFilter(
                    f.enemies,
                    function(____, e) return e.weight >= 1 end
                ),
                function(____, e) return EnemyName(f, e.id) end
            ),
            ","
        )) .. " focus=") .. (f.focusId >= 0 and EnemyName(f, f.focusId) or "-")) .. " init=") .. (f.initiator ~= nil and Short(f.initiator:GetUnitName()) or "-")
    )
end
function Unaccounted(f)
    local n = 0
    for ____, e in ipairs(Brain.Get().enemies) do
        do
            local __continue64
            repeat
                if not e.alive or __TS__ArraySome(
                    f.enemies,
                    function(____, x) return x.id == e.id end
                ) then
                    __continue64 = true
                    break
                end
                local elsewhere = e.lastSeenLoc ~= nil and e.lastSeenAge <= ELSEWHERE_AGE and Dist(e.lastSeenLoc, f.centre) > ELSEWHERE_DIST
                if not elsewhere then
                    n = n + 1
                end
                __continue64 = true
            until true
            if not __continue64 then
                break
            end
        end
    end
    return n
end
function LowTarget(f)
    for ____, e in ipairs(f.enemies) do
        if Live(e.unit) and e.unit:GetHealth() / math.max(
            e.unit:GetMaxHealth(),
            1
        ) < LOW_TARGET_HP then
            return true
        end
    end
    return false
end
function Trap(f, laning)
    if laning or f.ratio >= OUTNUMBERED_RATIO or LowTarget(f) then
        return false
    end
    local missing = Unaccounted(f)
    if missing <= #f.allies then
        return false
    end
    if not trapLogged[f.id] then
        trapLogged[f.id] = true
        Log(
            f,
            (((("trap ratio=" .. tostring(math.floor(f.ratio * 100) / 100)) .. " unaccounted=") .. tostring(missing)) .. " allies=") .. tostring(#f.allies)
        )
    end
    return true
end
function UpdateState(f)
    local now = DotaTime()
    local laning = jmz.IsInLaningPhase()
    for id in pairs(f.alive) do
        if f.alive[id] and not IsHeroAlive(__TS__Number(id)) then
            f.alive[id] = false
            local ____f_deaths_1 = f.deaths
            ____f_deaths_1[#____f_deaths_1 + 1] = now
        end
    end
    for ____, a in ipairs(f.allies) do
        f.alive[a:GetPlayerID()] = true
    end
    f.deaths = __TS__ArrayFilter(
        f.deaths,
        function(____, t) return now - t <= DEATH_WINDOW end
    )
    local visibleEnemies = #__TS__ArrayFilter(
        f.enemies,
        function(____, e) return e.unit ~= nil end
    )
    local outnumbered = visibleEnemies - #f.allies >= 2 and f.ratio < OUTNUMBERED_RATIO
    local engageAt = laning and ENGAGE_RATIO_LANING or ENGAGE_RATIO
    if f.state ~= "disengage" and f.state ~= "none" and #f.deaths >= 2 then
        SetState(f, "disengage", "deaths")
        return
    end
    if f.state == "none" then
        if f.ratio >= engageAt and not outnumbered and visibleEnemies > 0 and Contact(f, CONTACT) then
            if Trap(f, laning) then
                return
            end
            SetState(f, "engage", "stronger")
        elseif not laning and f.ratio > DISENGAGE_RATIO and visibleEnemies > 0 and Fighting(f) then
            SetState(f, "hold", "fighting")
        end
        return
    end
    if f.state == "engage" then
        if f.ratio <= DISENGAGE_RATIO and now - f.stateSince >= MIN_ENGAGE then
            SetState(f, "disengage", "weaker")
            return
        end
        if f.ratio < engageAt then
            if f.holdSince < 0 then
                f.holdSince = now
            end
            if now - f.holdSince >= HOLD_AFTER then
                f.holdSince = -1
                SetState(f, laning and "none" or "hold", "even")
            end
        else
            f.holdSince = -1
        end
        return
    end
    if f.state == "hold" then
        if f.ratio <= DISENGAGE_RATIO then
            SetState(f, "disengage", "weaker")
        elseif f.ratio >= engageAt and not outnumbered and visibleEnemies > 0 and not Trap(f, laning) then
            SetState(f, "engage", "stronger")
        elseif not Contact(f, CLEAR_RADIUS) then
            SetState(f, "none", "apart")
        end
        return
    end
    if not Contact(f, CLEAR_RADIUS) then
        SetState(f, "none", "clear")
    end
end
function FocusScore(f, e, allyCentre)
    local u = e.unit
    if not Live(u) or not u:IsAlive() or not jmz.CanBeAttacked(u) or jmz.IsSuspiciousIllusion(u) then
        return 0
    end
    if skipUntil[e.id] ~= nil and DotaTime() < skipUntil[e.id] then
        return 0
    end
    for ____, m in ipairs(SKIP_MODS) do
        if u:HasModifier(m) then
            return 0
        end
    end
    local dps = 0
    for ____, a in ipairs(f.allies) do
        if Dist(
            a:GetLocation(),
            e.loc
        ) <= FOCUS_NEAR then
            dps = dps + math.max(
                a:GetOffensivePower(),
                0
            ) / 5
        end
    end
    if dps <= 0 then
        for ____, a in ipairs(f.allies) do
            dps = dps + math.max(
                a:GetOffensivePower(),
                0
            ) / 5 * 0.5
        end
    end
    if dps <= 0 then
        dps = 1
    end
    local ttk = math.max(
        u:GetHealth(),
        1
    ) / dps
    local score = math.sqrt(math.max(e.power, 1)) / ttk
    if Dist(e.loc, allyCentre) > FOCUS_FAR then
        score = score * 0.5
    end
    if u:HasModifier(BLADE_MAIL) then
        score = score * 0.2
    end
    return score
end
function UpdateFocus(f)
    local now = DotaTime()
    local allyCentre = Centre(__TS__ArrayMap(
        f.allies,
        function(____, a) return a:GetLocation() end
    ))
    local current = nil
    for ____, e in ipairs(f.enemies) do
        if e.id == f.focusId then
            current = e
        end
    end
    local chasing = f.state == "engage" and now - math.max(f.focusSince, f.stateSince) or 0
    if current ~= nil and Live(current.unit) and chasing >= LEASH_TIME then
        local hp = current.unit:GetHealth() / math.max(
            current.unit:GetMaxHealth(),
            1
        )
        if f.focusHp - hp < LEASH_DROP then
            skipUntil[current.id] = now + LEASH_SKIP
            Log(
                f,
                ((("leash " .. EnemyName(f, current.id)) .. " hp=") .. tostring(math.floor(hp * 100))) .. "%"
            )
            current = nil
            f.focusId = -1
            f.focusSince = now
        end
    end
    if current ~= nil and current.unit ~= nil then
        f.focusSeenAt = now
    end
    local invalid = current == nil or now - f.focusSeenAt > LOST_TIME or Dist(current.loc, f.centre) > FOCUS_LEASH_DIST
    local curScore = current ~= nil and not invalid and FocusScore(f, current, allyCentre) or 0
    if curScore <= 0 and current ~= nil and current.unit ~= nil then
        invalid = true
    end
    local best = nil
    local bestScore = 0
    for ____, e in ipairs(f.enemies) do
        local s = FocusScore(f, e, allyCentre)
        if s > bestScore then
            bestScore = s
            best = e
        end
    end
    if best == nil then
        return
    end
    if not invalid and best.id ~= f.focusId and bestScore < curScore * SWITCH_FACTOR then
        return
    end
    if best.id == f.focusId then
        return
    end
    local was = f.focusId >= 0 and EnemyName(f, f.focusId) or "-"
    f.focusId = best.id
    f.focusSince = now
    f.focusSeenAt = now
    local u = best.unit
    f.focusHp = u:GetHealth() / math.max(
        u:GetMaxHealth(),
        1
    )
    if f.state ~= "none" then
        Log(
            f,
            (((("focus=" .. EnemyName(f, best.id)) .. " (was ") .. was) .. ") score=") .. tostring(math.floor(bestScore * 100) / 100)
        )
    end
end
function Build()
    local now = DotaTime()
    if now - builtAt < BUCKET then
        return
    end
    builtAt = now
    local entries = EnemyEntries()
    local allies = Allies()
    local prev = fights
    local next = {}
    local taken = {}
    for ____, group in ipairs(Groups(entries)) do
        do
            local __continue134
            repeat
                local centre = Centre(__TS__ArrayMap(
                    group,
                    function(____, e) return e.loc end
                ))
                local inContact = __TS__ArraySome(
                    allies,
                    function(____, a) return __TS__ArraySome(
                        group,
                        function(____, e) return Dist(
                            a:GetLocation(),
                            e.loc
                        ) <= CONTACT end
                    ) end
                )
                if not inContact then
                    __continue134 = true
                    break
                end
                local members = __TS__ArrayFilter(
                    allies,
                    function(____, a)
                        if taken[a:GetPlayerID()] then
                            return false
                        end
                        if __TS__ArraySome(
                            group,
                            function(____, e) return Dist(
                                a:GetLocation(),
                                e.loc
                            ) <= CONTACT end
                        ) then
                            return true
                        end
                        return Dist(
                            a:GetLocation(),
                            centre
                        ) / math.max(
                            a:GetCurrentMovementSpeed(),
                            250
                        ) <= JOIN_TIME
                    end
                )
                if #members == 0 then
                    __continue134 = true
                    break
                end
                for ____, a in ipairs(members) do
                    taken[a:GetPlayerID()] = true
                end
                local enemies = __TS__ArraySlice(group)
                for ____, e in ipairs(Brain.Get().enemies) do
                    do
                        local __continue146
                        repeat
                            if not e.alive or e.visible or e.lastSeenLoc == nil or e.lastSeenAge <= SEEN_RECENT or e.lastSeenAge > MISSING_AGE then
                                __continue146 = true
                                break
                            end
                            if __TS__ArraySome(
                                enemies,
                                function(____, x) return x.id == e.id end
                            ) then
                                __continue146 = true
                                break
                            end
                            if Dist(e.lastSeenLoc, centre) / 300 > MISSING_TRAVEL then
                                __continue146 = true
                                break
                            end
                            enemies[#enemies + 1] = {
                                id = e.id,
                                unit = nil,
                                loc = e.lastSeenLoc,
                                weight = MISSING_WEIGHT,
                                health = FoggedHealth(e.id),
                                power = e.rawPower
                            }
                            __continue146 = true
                        until true
                        if not __continue146 then
                            break
                        end
                    end
                end
                local old = nil
                for ____, p in ipairs(prev) do
                    if __TS__ArraySome(
                        p.enemies,
                        function(____, pe) return pe.weight >= 1 and __TS__ArraySome(
                            group,
                            function(____, e) return e.id == pe.id end
                        ) end
                    ) and not __TS__ArraySome(
                        next,
                        function(____, n) return n == p end
                    ) then
                        old = p
                        break
                    end
                end
                local ____temp_3
                if old ~= nil then
                    ____temp_3 = old
                else
                    local ____nextId_2 = nextId
                    nextId = ____nextId_2 + 1
                    ____temp_3 = {
                        id = ____nextId_2,
                        centre = centre,
                        allies = members,
                        enemies = enemies,
                        state = "none",
                        stateSince = now,
                        ratio = 0,
                        focusId = -1,
                        focusSince = now,
                        focusHp = 1,
                        focusSeenAt = now,
                        initiator = nil,
                        deaths = {},
                        alive = {},
                        holdSince = -1,
                        disengageAt = -999
                    }
                end
                local f = ____temp_3
                f.centre = centre
                f.allies = members
                f.enemies = enemies
                f.ratio = Ratio(f)
                local init = nil
                local initWeight = 0
                for ____, a in ipairs(members) do
                    local w = InitiatorWeight(a)
                    if w > initWeight or w == initWeight and w > 0 and init ~= nil and a:GetHealth() > init:GetHealth() then
                        init = a
                        initWeight = w
                    end
                end
                f.initiator = init
                UpdateFocus(f)
                UpdateState(f)
                next[#next + 1] = f
                __continue134 = true
            until true
            if not __continue134 then
                break
            end
        end
    end
    fights = next
end
--- The engagement this bot takes part in, if any.
function ____exports.FightOf(bot)
    Build()
    for ____, f in ipairs(fights) do
        if __TS__ArraySome(
            f.allies,
            function(____, a) return a == bot end
        ) then
            return f
        end
    end
    return nil
end
function FocusUnit(f)
    for ____, e in ipairs(f.enemies) do
        if e.id == f.focusId and Live(e.unit) and e.unit:IsAlive() then
            return e.unit
        end
    end
    return nil
end
--- The enemy hero that caught this bot (see CAUGHT_RANGE), or null.
function ____exports.Catcher(bot)
    if not bot:IsAlive() or jmz.GetHP(bot) < CAUGHT_MIN_HP then
        return nil
    end
    local speed = bot:GetCurrentMovementSpeed()
    for ____, e in ipairs(bot:GetNearbyHeroes(CAUGHT_RANGE, true, BotMode.None)) do
        do
            local __continue224
            repeat
                if not jmz.IsValidHero(e) or jmz.IsSuspiciousIllusion(e) or not jmz.CanBeAttacked(e) then
                    __continue224 = true
                    break
                end
                if e:GetCurrentMovementSpeed() < speed - CAUGHT_SPEED_MARGIN then
                    __continue224 = true
                    break
                end
                local id = bot:GetPlayerID()
                if Utils.DebugMode and DotaTime() - (caughtLogAt[id] or -999) >= CAUGHT_LOG_GAP then
                    caughtLogAt[id] = DotaTime()
                    print((((((((("FIGHT team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(DotaTime()))) .. " caught hero=") .. Short(bot:GetUnitName())) .. " by=") .. Short(e:GetUnitName())) .. " hp=") .. __TS__NumberToFixed(
                        jmz.GetHP(bot),
                        2
                    ))
                end
                return e
            until true
            if not __continue224 then
                break
            end
        end
    end
    return nil
end
function FinishingKill(bot)
    local f = ____exports.FightOf(bot)
    local ____temp_4
    if f ~= nil then
        ____temp_4 = FocusUnit(f)
    else
        ____temp_4 = nil
    end
    local t = ____temp_4
    if t == nil then
        return false
    end
    return Dist(
        t:GetLocation(),
        bot:GetLocation()
    ) <= bot:GetAttackRange() + 150 and t:GetHealth() <= bot:GetAttackDamage() * 2
end
function Survive(bot)
    local hp = jmz.GetHP(bot)
    local loc = bot:GetLocation()
    local incoming = 0
    local close = false
    for ____, e in ipairs(jmz.GetEnemiesNearLoc(loc, PROJECT_RADIUS)) do
        do
            local __continue233
            repeat
                if not jmz.IsValidHero(e) then
                    __continue233 = true
                    break
                end
                if Dist(
                    e:GetLocation(),
                    loc
                ) <= SURVIVE_RADIUS then
                    close = true
                end
                incoming = incoming + e:GetEstimatedDamageToTarget(true, bot, PROJECT_TIME, DamageType.All)
                __continue233 = true
            until true
            if not __continue233 then
                break
            end
        end
    end
    if close and hp < SURVIVE_HP then
        return true
    end
    if hp < SURVIVE_LOW_HP and not FinishingKill(bot) then
        return true
    end
    return (bot:GetHealth() - incoming) / math.max(
        bot:GetMaxHealth(),
        1
    ) < SURVIVE_PROJECTED and incoming > 0
end
BUCKET = 0.25
SEEN_RECENT = 3
GROUP_LINK = 1200
CONTACT = 1600
JOIN_TIME = 4
MISSING_AGE = 8
MISSING_TRAVEL = 5
MISSING_WEIGHT = 0.75
ENGAGE_RATIO = 1.25
ENGAGE_RATIO_LANING = 1.6
DISENGAGE_RATIO = 0.8
HUMAN_FACTOR = 0.75
ELSEWHERE_AGE = 10
ELSEWHERE_DIST = 4000
LOW_TARGET_HP = 0.35
OUTNUMBERED_RATIO = 2
HOLD_AFTER = 1.5
MIN_ENGAGE = 3
DEATH_WINDOW = 5
CLEAR_RADIUS = 1200
FIGHTING_RADIUS = 900
FOCUS_NEAR = 1200
FOCUS_FAR = 1000
SWITCH_FACTOR = 1.3
LOST_TIME = 1.5
FOCUS_LEASH_DIST = 1600
LEASH_TIME = 5
LEASH_DROP = 0.1
LEASH_SKIP = 6
local FOLLOW_WAIT = 1.5
local FOLLOW_GAP = 700
local INITIATOR_IN = 300
local SWAP_RANGE = 400
local REATTACK = 1
local KITE_RANGE = 300
local KITE_STEP = 200
local MELEE_RANGE = 350
local FOG_TIME = 3
____exports.SURVIVE = 0.96
SURVIVE_HP = 0.2
SURVIVE_LOW_HP = 0.15
SURVIVE_RADIUS = 900
SURVIVE_PROJECTED = 0.15
PROJECT_RADIUS = 1200
PROJECT_TIME = 3
local ENGAGE_RETREAT_CAP = 0.3
local ENGAGE_DESIRE = 0.83
local DISENGAGE_RETREAT = 0.88
local DISENGAGE_MIN = 2
CAUGHT_RANGE = 450
CAUGHT_MIN_HP = 0.45
CAUGHT_SPEED_MARGIN = 15
CAUGHT_LOG_GAP = 10
SKIP_MODS = {
    "modifier_dazzle_shallow_grave",
    "modifier_abaddon_borrowed_time",
    "modifier_item_aeon_disk_buff",
    "modifier_ursa_enrage",
    "modifier_troll_warlord_battle_trance",
    "modifier_winter_wyvern_cold_embrace",
    "modifier_oracle_false_promise_timer"
}
BLADE_MAIL = "modifier_item_blade_mail_reflect"
fights = {}
builtAt = -999
nextId = 1
skipUntil = {}
lastHealth = {}
lastMaxHealth = {}
FOGGED_MIN_HP = 0.5
local lastAttackOrder = {}
humanIds = {}
trapLogged = {}
--- Attack mode desire (spec 6.2).
function ____exports.AttackDesire(bot)
    if not bot:IsAlive() or bot:IsIllusion() then
        return 0
    end
    local f = ____exports.FightOf(bot)
    if f == nil then
        return 0
    end
    local hp = jmz.GetHP(bot)
    if f.state ~= "engage" and ____exports.Catcher(bot) ~= nil and not Survive(bot) then
        return DesireTier.HIGH
    end
    if f.state == "engage" then
        if FocusUnit(f) == nil and DotaTime() - f.focusSeenAt > FOG_TIME then
            return 0
        end
        if Survive(bot) then
            return 0
        end
        return RemapValClamped(
            hp,
            0.35,
            0.2,
            ENGAGE_DESIRE,
            DesireTier.HIGH
        )
    end
    if jmz.IsInLaningPhase() then
        return 0
    end
    if f.state == "hold" then
        local range = bot:GetAttackRange() + 200
        for ____, e in ipairs(f.enemies) do
            if e.unit ~= nil and Dist(
                e.loc,
                bot:GetLocation()
            ) <= range then
                return DesireTier.HIGH
            end
        end
        return DesireTier.MODERATE
    end
    return 0
end
--- Follower hold (spec 6.3 step 2). True when it gave this tick's order.
local function FollowerHold(bot, f)
    if f.state ~= "engage" or DotaTime() - f.stateSince > FOLLOW_WAIT then
        return false
    end
    local init = f.initiator
    if init == nil or init == bot or init:IsNull() or not init:IsAlive() then
        return false
    end
    local nearest = nil
    local nearestDist = 99999
    for ____, e in ipairs(f.enemies) do
        do
            local __continue186
            repeat
                if not Live(e.unit) then
                    __continue186 = true
                    break
                end
                if jmz.IsDisabled(e.unit) then
                    return false
                end
                if Dist(
                    init:GetLocation(),
                    e.loc
                ) <= INITIATOR_IN then
                    return false
                end
                local d = Dist(
                    bot:GetLocation(),
                    e.loc
                )
                if d < nearestDist then
                    nearestDist = d
                    nearest = e
                end
                __continue186 = true
            until true
            if not __continue186 then
                break
            end
        end
    end
    if nearest == nil then
        return false
    end
    if nearestDist >= FOLLOW_GAP then
        bot:Action_ClearActions(false)
        return true
    end
    local away = math.max(nearestDist, 1)
    local loc = bot:GetLocation()
    bot:Action_MoveToLocation(Vector(loc.x + (loc.x - nearest.loc.x) / away * (FOLLOW_GAP - nearestDist + 50), loc.y + (loc.y - nearest.loc.y) / away * (FOLLOW_GAP - nearestDist + 50), loc.z))
    return true
end
--- Ranged kiting (spec 6.3 step 5). True when it stepped away.
local function Kite(bot, f)
    if bot:GetAttackRange() < MELEE_RANGE + 100 then
        return false
    end
    local since = GameTime() - bot:GetLastAttackTime()
    if since < bot:GetAttackPoint() or since > bot:GetSecondsPerAttack() * 0.8 then
        return false
    end
    for ____, e in ipairs(f.enemies) do
        do
            local __continue197
            repeat
                local u = e.unit
                if not Live(u) or u:GetAttackRange() > MELEE_RANGE then
                    __continue197 = true
                    break
                end
                local d = Dist(
                    bot:GetLocation(),
                    e.loc
                )
                if d > KITE_RANGE then
                    __continue197 = true
                    break
                end
                local loc = bot:GetLocation()
                local len = math.max(d, 1)
                bot:Action_MoveToLocation(Vector(loc.x + (loc.x - e.loc.x) / len * KITE_STEP, loc.y + (loc.y - e.loc.y) / len * KITE_STEP, loc.z))
                return true
            until true
            if not __continue197 then
                break
            end
        end
    end
    return false
end
function ____exports.AttackThink(bot)
    if jmz.CanNotUseAction(bot) then
        return
    end
    local f = ____exports.FightOf(bot)
    if f == nil then
        return
    end
    if f.state ~= "engage" then
        local c = ____exports.Catcher(bot)
        if c ~= nil then
            bot:SetTarget(c)
            if bot:GetAttackTarget() ~= c then
                bot:Action_AttackUnit(c, true)
            end
            return
        end
    end
    if FollowerHold(bot, f) then
        return
    end
    local t = FocusUnit(f)
    if t == nil then
        for ____, e in ipairs(f.enemies) do
            if e.id == f.focusId then
                bot:Action_MoveToLocation(e.loc)
                return
            end
        end
        return
    end
    local range = bot:GetAttackRange()
    if Dist(
        bot:GetLocation(),
        t:GetLocation()
    ) > range + SWAP_RANGE then
        for ____, e in ipairs(f.enemies) do
            do
                local __continue213
                repeat
                    local u = e.unit
                    if not Live(u) or u == t or not jmz.CanBeAttacked(u) then
                        __continue213 = true
                        break
                    end
                    local skip = false
                    for ____, m in ipairs(SKIP_MODS) do
                        if u:HasModifier(m) then
                            skip = true
                        end
                    end
                    if not skip and Dist(
                        bot:GetLocation(),
                        e.loc
                    ) <= range + 50 then
                        t = u
                        break
                    end
                    __continue213 = true
                until true
                if not __continue213 then
                    break
                end
            end
        end
    end
    bot:SetTarget(t)
    if Kite(bot, f) then
        return
    end
    local id = bot:GetPlayerID()
    local last = lastAttackOrder[id]
    local tid = t:GetPlayerID()
    if last == nil or last[1] ~= tid or GameTime() - last[2] >= REATTACK then
        bot:Action_AttackUnit(t, true)
        lastAttackOrder[id] = {
            tid,
            GameTime()
        }
    end
end
caughtLogAt = {}
--- Caught and not about to die: fight back rather than run (retreat's fight_outnumbered reads this).
function ____exports.IsCaught(bot)
    return ____exports.Catcher(bot) ~= nil and not Survive(bot)
end
--- Retreat desire under the team fight (spec 7): while engaged only SURVIVE (other retreat reasons are
-- capped at ENGAGE_RETREAT_CAP); while disengaging every member runs at DISENGAGE_RETREAT.
-- `why` is the retreat mode's reason; spell dodges ("run:") are kept.
function ____exports.RetreatAdjust(bot, desire, why)
    if not bot:IsAlive() or bot:IsIllusion() then
        return desire
    end
    local f = ____exports.FightOf(bot)
    if f == nil then
        return desire
    end
    if f.state == "engage" then
        if Survive(bot) then
            return math.max(desire, ____exports.SURVIVE)
        end
        if __TS__StringStartsWith(why, "run:") then
            return desire
        end
        if jmz.IsInLaningPhase() then
            return desire
        end
        return math.min(desire, ENGAGE_RETREAT_CAP)
    end
    if f.state == "disengage" then
        if ____exports.IsCaught(bot) then
            return desire
        end
        local near = #jmz.GetEnemiesNearLoc(
            bot:GetLocation(),
            CLEAR_RADIUS
        ) > 0
        if near or DotaTime() - f.disengageAt < DISENGAGE_MIN then
            return math.max(desire, DISENGAGE_RETREAT)
        end
    end
    return desire
end
--- Team roam steps aside while this bot's engagement has a decision (engage, hold or disengage): hero
-- targets belong to the fight module then (spec 6.4). With no engagement or state none, plain OHA's
-- "help the targeted core" and "help an ally" run. Bot game 9090959010: switching them off for the whole
-- game after laning left lone bots without help (Radiant 3 kills, Dire 51).
function ____exports.OwnsHeroTargets(bot)
    if jmz.IsInLaningPhase() then
        return false
    end
    local f = ____exports.FightOf(bot)
    return f ~= nil and f.state ~= "none"
end
return ____exports
