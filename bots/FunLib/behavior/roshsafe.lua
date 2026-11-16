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
local UnitType = ____dota.UnitType
local jmz = require(GetScriptDirectory().."/FunLib/jmz_func")
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local LOW_HP = 0.4
local FINISH_ROSH_HP = 0.15
local FINISH_HP = 0.2
local PIT_RADIUS = 1200
local ATTEMPT_GAP = 10
local DEATH_WINDOW = 3
local SLOW_TIME = 40
local SLOW_ROSH_HP = 0.5
local ABORT_DEATHS = 2
local ABORT_TIME = 60
local ROSH_HP_FRESH = 3
local UPDATE_GAP = 0.2
local LOG_GAP = 5
____exports.DPS_LOG_GAP = 30
local updatedAt = -999
local attemptStart = -1
local lastAtPit = -999
local deaths = 0
local abortUntil = -999
local abortWhy = ""
local roshHp = 1
local roshHpAt = -999
local dpsLogAt = -999
local inRoshan = {}
local wasAlive = {}
local logAt = {}
local function Dist(a, b)
    local dx = a.x - b.x
    local dy = a.y - b.y
    return math.sqrt(dx * dx + dy * dy)
end
local function AtPit(u)
    local loc = u:GetLocation()
    return Dist(loc, Utils.RadiantRoshanLoc) <= PIT_RADIUS or Dist(loc, Utils.DireRoshanLoc) <= PIT_RADIUS
end
--- Roshan's hp fraction when a bot of ours saw it within ROSH_HP_FRESH s, else -1.
local function KnownRoshHp(now)
    return now - roshHpAt <= ROSH_HP_FRESH and roshHp or -1
end
local function EndAttempt()
    attemptStart = -1
    deaths = 0
end
local function Update(now)
    if now - updatedAt < UPDATE_GAP then
        return
    end
    updatedAt = now
    local any = false
    local ids = GetTeamPlayers(GetTeam())
    for ____, ally in ipairs(GetUnitList(UnitType.AlliedHeroes)) do
        do
            local __continue8
            repeat
                if ally == nil or ally:IsNull() or not ally:IsAlive() or ally:IsIllusion() then
                    __continue8 = true
                    break
                end
                if ally:GetActiveMode() == BotMode.Roshan and AtPit(ally) then
                    inRoshan[ally:GetPlayerID()] = now
                    any = true
                end
                __continue8 = true
            until true
            if not __continue8 then
                break
            end
        end
    end
    for ____, id in ipairs(ids) do
        local alive = IsHeroAlive(id)
        if not alive and wasAlive[id] == true and attemptStart >= 0 and now - (inRoshan[id] or -999) <= DEATH_WINDOW then
            deaths = deaths + 1
        end
        wasAlive[id] = alive
    end
    if not jmz.IsRoshanAlive() then
        EndAttempt()
        return
    end
    if any then
        if attemptStart < 0 then
            attemptStart = now
            deaths = 0
        end
        lastAtPit = now
    elseif attemptStart >= 0 and now - lastAtPit > ATTEMPT_GAP then
        EndAttempt()
        return
    end
    if attemptStart < 0 then
        return
    end
    local rhp = KnownRoshHp(now)
    local why = ""
    if deaths >= ABORT_DEATHS then
        why = "abort_deaths"
    elseif now - attemptStart > SLOW_TIME and rhp > SLOW_ROSH_HP then
        why = "abort_slow"
    end
    if why == "" then
        return
    end
    abortUntil = now + ABORT_TIME
    abortWhy = why
    if Utils.DebugMode then
        print((((((((((("ROSHSAFE team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(now))) .. " abort why=") .. why) .. " dur=") .. tostring(math.floor(now - attemptStart))) .. " deaths=") .. tostring(deaths)) .. " roshhp=") .. __TS__NumberToFixed(rhp, 2))
    end
    EndAttempt()
end
--- One trace line, at most once per LOG_GAP s per hero.
function ____exports.Log(bot, why, now)
    if not Utils.DebugMode then
        return
    end
    local name = bot:GetUnitName()
    if now - (logAt[name] or -999) < LOG_GAP then
        return
    end
    logAt[name] = now
    print((((((((((("ROSHSAFE team=" .. tostring(GetTeam())) .. " hero=") .. name) .. " t=") .. tostring(math.floor(now))) .. " why=") .. why) .. " hp=") .. __TS__NumberToFixed(
        jmz.GetHP(bot),
        2
    )) .. " roshhp=") .. __TS__NumberToFixed(
        KnownRoshHp(now),
        2
    ))
end
--- The `dps` line: once per DPS_LOG_GAP s per team (and LOG_GAP per hero).
function ____exports.LogDps(bot)
    local now = DotaTime()
    if now - dpsLogAt < ____exports.DPS_LOG_GAP then
        return
    end
    dpsLogAt = now
    ____exports.Log(bot, "dps", now)
end
--- mode_roshan_generic's desire after the roshsafe rules. Called every frame from each bot's GetDesire
-- (that also keeps the team state current). `roshan`: the bot's Roshan handle, or nil.
function ____exports.Filter(bot, desire, roshan)
    local now = DotaTime()
    if roshan ~= nil and Utils.IsValidUnit(roshan) then
        roshHp = roshan:GetHealth() / roshan:GetMaxHealth()
        roshHpAt = now
    end
    Update(now)
    if desire <= 0 then
        return desire
    end
    local hp = jmz.GetHP(bot)
    local rhp = KnownRoshHp(now)
    local finish = rhp >= 0 and rhp < FINISH_ROSH_HP and hp > FINISH_HP
    if finish then
        return desire
    end
    if now < abortUntil then
        ____exports.Log(bot, abortWhy, now)
        return 0
    end
    if hp < LOW_HP then
        ____exports.Log(bot, "lowhp", now)
        return 0
    end
    return desire
end
return ____exports
