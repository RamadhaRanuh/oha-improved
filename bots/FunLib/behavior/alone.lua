--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
local ____exports = {}
local MISSING_TIME, missingAt, missingCount
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
--- Living enemy heroes not seen for MISSING_TIME s. Cached 0.5 s (one VM per team).
function ____exports.MissingEnemies()
    local now = DotaTime()
    if now - missingAt < 0.5 then
        return missingCount
    end
    missingAt = now
    local n = 0
    for ____, id in ipairs(GetTeamPlayers(GetOpposingTeam())) do
        do
            local __continue9
            repeat
                if not IsHeroAlive(id) then
                    __continue9 = true
                    break
                end
                local info = GetHeroLastSeenInfo(id)
                local seen = info ~= nil and info ~= nil and info[1] or nil
                if seen == nil or seen.time_since_seen >= MISSING_TIME then
                    n = n + 1
                end
                __continue9 = true
            until true
            if not __continue9 then
                break
            end
        end
    end
    missingCount = n
    return n
end
MISSING_TIME = 15
local MISSING_COUNT = 3
local ALONE_RADIUS = 2000
local DEFEND_ENEMIES = 2
local DEFEND_ENEMY_RADIUS = 1600
local DEFEND_HELP_RADIUS = 8000
local DEFEND_HELP_HP = 0.4
local BASE_RADIUS = 5000
local LOG_GAP = 20
local DEEP_DIST = 7000
missingAt = -999
missingCount = 0
local lastLog = {}
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function Log(bot, kind, text)
    if not Utils.DebugMode then
        return
    end
    local key = (tostring(bot:GetPlayerID()) .. ":") .. kind
    local now = DotaTime()
    if lastLog[key] ~= nil and now - lastLog[key] < LOG_GAP then
        return
    end
    lastLog[key] = now
    print((((((((((("ALONE team=" .. tostring(GetTeam())) .. " hero=") .. bot:GetUnitName()) .. " t=") .. tostring(math.floor(now))) .. " blocked=") .. kind) .. " missing=") .. tostring(____exports.MissingEnemies())) .. " ") .. text)
end
local function Fmt(v)
    return (tostring(math.floor(v.x)) .. ",") .. tostring(math.floor(v.y))
end
local function AlliesNear(loc, radius, except, minHp)
    local n = 0
    for ____, ally in ipairs(GetUnitList(UnitType.AlliedHeroes)) do
        do
            local __continue14
            repeat
                if ally == nil or ally:IsNull() or not ally:IsAlive() or ally:IsIllusion() or ally == except then
                    __continue14 = true
                    break
                end
                if jmz.IsMeepoClone(ally) or jmz.GetHP(ally) < minHp then
                    __continue14 = true
                    break
                end
                if minHp > 0 and ally:GetActiveMode() == BotMode.Retreat then
                    __continue14 = true
                    break
                end
                if Dist(
                    ally:GetLocation(),
                    loc
                ) <= radius then
                    n = n + 1
                end
                __continue14 = true
            until true
            if not __continue14 then
                break
            end
        end
    end
    return n
end
function ____exports.EnemyHalf(loc)
    return Dist(
        loc,
        GetAncient(GetOpposingTeam()):GetLocation()
    ) < Dist(
        loc,
        GetAncient(GetTeam()):GetLocation()
    )
end
--- No ally near and too many enemies unseen, after the laning phase.
function ____exports.Exposed(bot)
    if jmz.IsInLaningPhase() then
        return false
    end
    if ____exports.MissingEnemies() < MISSING_COUNT then
        return false
    end
    return AlliesNear(
        bot:GetLocation(),
        ALONE_RADIUS,
        bot,
        0
    ) == 0
end
--- Deep in enemy territory: see DEEP_DIST.
function ____exports.Deep(loc)
    return ____exports.EnemyHalf(loc) and Dist(
        loc,
        GetAncient(GetOpposingTeam()):GetLocation()
    ) < DEEP_DIST
end
--- Farm or ward at `loc` is unsafe for `bot` now (logs once per LOG_GAP).
function ____exports.Risky(bot, loc, kind)
    if not ____exports.Deep(loc) or not ____exports.Exposed(bot) then
        return false
    end
    Log(
        bot,
        kind,
        "spot=" .. Fmt(loc)
    )
    return true
end
--- Defending the tower at `defendLoc` would be a lone fight: see the module comment.
function ____exports.DefendAlone(bot, defendLoc)
    if jmz.IsInLaningPhase() then
        return false
    end
    if Dist(
        defendLoc,
        GetAncient(GetTeam()):GetLocation()
    ) < BASE_RADIUS then
        return false
    end
    local enemies = #jmz.GetEnemiesNearLoc(defendLoc, DEFEND_ENEMY_RADIUS)
    if enemies < DEFEND_ENEMIES then
        return false
    end
    local radius = math.max(
        DEFEND_HELP_RADIUS,
        Dist(
            bot:GetLocation(),
            defendLoc
        ) + 1500
    )
    local helpers = AlliesNear(defendLoc, radius, bot, DEFEND_HELP_HP)
    if helpers > 0 then
        return false
    end
    Log(
        bot,
        "defend",
        (((("at=" .. Fmt(defendLoc)) .. " enemies=") .. tostring(enemies)) .. " helpers=") .. tostring(helpers)
    )
    return true
end
return ____exports
