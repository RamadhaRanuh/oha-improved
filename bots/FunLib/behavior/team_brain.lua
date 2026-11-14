--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
local function __TS__ArrayIncludes(self, searchElement, fromIndex)
    if fromIndex == nil then
        fromIndex = 0
    end
    local len = #self
    local k = fromIndex
    if fromIndex < 0 then
        k = len + fromIndex
    end
    if k < 0 then
        k = 0
    end
    for i = k + 1, len do
        if self[i] == searchElement then
            return true
        end
    end
    return false
end
-- End of Lua Library inline imports
local ____exports = {}
local VisibleEnemyHeroes, BuildEnemies, NEVER_SEEN_AGE, memory
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local Lane = ____dota.Lane
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local ____global_cache = require(GetScriptDirectory().."/FunLib/global_cache")
local getGlobalUnitState = ____global_cache.getGlobalUnitState
function VisibleEnemyHeroes()
    local byId = {}
    for ____, unit in ipairs(getGlobalUnitState().enemyHeroes) do
        do
            local __continue5
            repeat
                if unit == nil or unit:IsNull() or not unit:CanBeSeen() then
                    __continue5 = true
                    break
                end
                if unit:IsIllusion() or jmz.IsSuspiciousIllusion(unit) then
                    __continue5 = true
                    break
                end
                local id = unit:GetPlayerID()
                if byId[id] == nil then
                    byId[id] = unit
                end
                __continue5 = true
            until true
            if not __continue5 then
                break
            end
        end
    end
    return byId
end
function BuildEnemies(time)
    local visible = VisibleEnemyHeroes()
    local enemies = {}
    for ____, id in ipairs(GetTeamPlayers(GetOpposingTeam())) do
        local mem = memory[id]
        if mem == nil then
            mem = {sightingStart = -1, hpFrac = 1, rawPower = 0}
            memory[id] = mem
        end
        local alive = IsHeroAlive(id)
        local unit = visible[id]
        if unit ~= nil then
            if mem.sightingStart < 0 then
                mem.sightingStart = time
            end
            local maxHealth = unit:GetMaxHealth()
            mem.hpFrac = maxHealth > 0 and unit:GetHealth() / maxHealth or 0
            mem.rawPower = unit:GetRawOffensivePower()
            enemies[#enemies + 1] = {
                id = id,
                unit = unit,
                visible = true,
                alive = alive,
                lastSeenLoc = unit:GetLocation(),
                lastSeenAge = 0,
                firstSeenThisSighting = mem.sightingStart,
                hpFrac = mem.hpFrac,
                rawPower = mem.rawPower
            }
        else
            mem.sightingStart = -1
            if not alive then
                mem.hpFrac = 0
            end
            local info = GetHeroLastSeenInfo(id)
            local last = info ~= nil and #info > 0 and info[1] or nil
            enemies[#enemies + 1] = {
                id = id,
                unit = nil,
                visible = false,
                alive = alive,
                lastSeenLoc = last ~= nil and last.location or nil,
                lastSeenAge = last ~= nil and last.time_since_seen or NEVER_SEEN_AGE,
                firstSeenThisSighting = -1,
                hpFrac = mem.hpFrac,
                rawPower = mem.rawPower
            }
        end
    end
    return enemies
end
local BUCKET = 0.25
NEVER_SEEN_AGE = 9999
local LANES = {Lane.Top, Lane.Mid, Lane.Bot}
--- The memoised view, per team.
local views = {}
memory = {}
--- The team's current view, recomputed at most once per 0.25 s of game time.
function ____exports.Get()
    local team = GetTeam()
    local time = math.floor(DotaTime() / BUCKET) * BUCKET
    local cached = views[team]
    if cached ~= nil and cached.time == time then
        return cached
    end
    local view = {
        time = time,
        enemies = BuildEnemies(time),
        engagements = {},
        group = {kind = "none", lane = nil, memberIds = {}, since = time},
        defenders = {},
        farm = {},
        gank = nil
    }
    views[team] = view
    return view
end
--- The engagement this bot takes part in, if any.
function ____exports.EngagementOf(bot)
    local id = bot:GetPlayerID()
    for ____, engagement in ipairs(____exports.Get().engagements) do
        if __TS__ArrayIncludes(engagement.allyIds, id) then
            return engagement
        end
    end
    return nil
end
--- Whether this bot is a member of the team's current push, defence or Roshan group.
function ____exports.IsGroupMember(bot)
    local group = ____exports.Get().group
    return group.kind ~= "none" and __TS__ArrayIncludes(
        group.memberIds,
        bot:GetPlayerID()
    )
end
--- The lane this bot is assigned to defend, if any.
function ____exports.DefenderLane(bot)
    local id = bot:GetPlayerID()
    local defenders = ____exports.Get().defenders
    for ____, lane in ipairs(LANES) do
        local ids = defenders[lane]
        if ids ~= nil and __TS__ArrayIncludes(ids, id) then
            return lane
        end
    end
    return nil
end
--- The farm area allotted to this bot, if any.
function ____exports.FarmAreaOf(bot)
    return ____exports.Get().farm[bot:GetPlayerID()] or nil
end
--- Whether this bot is a ganker in the team's current gank plan.
function ____exports.IsGanker(bot)
    local gank = ____exports.Get().gank
    return gank ~= nil and __TS__ArrayIncludes(
        gank.gankerIds,
        bot:GetPlayerID()
    )
end
--- One-line summary for debug output: alive, visible and per-enemy state.
function ____exports.DescribeForDebug()
    local view = ____exports.Get()
    local alive = 0
    local visible = 0
    local parts = {}
    for ____, enemy in ipairs(view.enemies) do
        if enemy.alive then
            alive = alive + 1
        end
        if enemy.visible then
            visible = visible + 1
        end
        local age = enemy.visible and "v" or (enemy.lastSeenAge >= NEVER_SEEN_AGE and "never" or tostring(math.floor(enemy.lastSeenAge)) .. "s")
        parts[#parts + 1] = (((((((tostring(enemy.id) .. ":") .. (enemy.alive and "up" or "dead")) .. "/") .. age) .. "/hp") .. tostring(math.floor(enemy.hpFrac * 100))) .. "/pow") .. tostring(math.floor(enemy.rawPower))
    end
    return (((((((("t=" .. tostring(view.time)) .. " enemies=") .. tostring(#view.enemies)) .. " alive=") .. tostring(alive)) .. " visible=") .. tostring(visible)) .. " ") .. table.concat(parts, " ")
end
return ____exports
