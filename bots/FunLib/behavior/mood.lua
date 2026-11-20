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
-- End of Lua Library inline imports
local ____exports = {}
local PersonaOf
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local UnitType = ____dota.UnitType
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local Persona = require(GetScriptDirectory().."/FunLib/behavior/persona")
function PersonaOf(pid)
    do
        local i = 1
        while i <= 5 do
            local m = GetTeamMember(i)
            if m ~= nil and m ~= nil and m:GetPlayerID() == pid then
                return Persona.Get(m)
            end
            i = i + 1
        end
    end
    return nil
end
local UPDATE_PERIOD = 0.5
local TEAM_PERIOD = 2
local LEAD_LOG_PERIOD = 60
local TILT_DEATHS = 3
local TILT_WINDOW = 240
local GRUDGE_WINDOW = 600
local TILT_TIME = 240
local FEED_GUARD = 2
local CALM_TIME = 300
local CLOSE_OUT_TIME = 40 * 60
local KILL_WORTH = 200
local LEVEL_WORTH = 250
local TOWER_WORTH = 600
--- Team moods hold until the lead falls back by this much, so they do not flicker.
local HYSTERESIS = 1500
local BOT_FACTORS = {calm = {}, tilted = {retreat = 0.85, gank = 1.15, farm = 0.9, push = 1.05}}
local TEAM_FACTORS = {even = {}, cocky = {
    retreat = 0.9,
    farm = 1.15,
    gank = 1.1,
    push = 0.85,
    defend = 0.9
}, desperate = {
    retreat = 1.1,
    farm = 0.9,
    gank = 0.9,
    push = 0.9,
    defend = 1.15
}}
local bots = {}
local counts = {}
local teamMood = "even"
local lastUpdate = -999
local lastTeam = -999
local lastLeadLog = -999
local lead = 0
local function Short(pid)
    local name = GetSelectedHeroName(pid)
    return name ~= nil and name ~= nil and __TS__StringReplace(name, "npc_dota_hero_", "") or "p" .. tostring(pid)
end
local function State(pid)
    local s = bots[pid]
    if s == nil then
        s = {
            mood = "calm",
            deaths = {},
            killers = {},
            lastDeath = -999,
            tiltDeaths = 0,
            calmUntil = -999,
            grudge = -1,
            lastKiller = -1
        }
        bots[pid] = s
    end
    return s
end
local function SetMood(pid, s, mood, now, why)
    if s.mood == mood then
        return
    end
    s.mood = mood
    if mood == "calm" then
        s.tiltDeaths = 0
    end
    if Utils.DebugMode then
        local g = mood == "tilted" and s.grudge >= 0 and " grudge=" .. tostring(s.grudge) or ""
        print(((((((((("MOOD team=" .. tostring(GetTeam())) .. " hero=") .. Short(pid)) .. " t=") .. tostring(math.floor(now))) .. " mood=") .. mood) .. " why=") .. why) .. g)
    end
end
--- Kills and deaths since the last update, per player; returns the enemies whose kills went up.
local function Scan()
    local died = {}
    local scorers = {}
    for ____, pid in ipairs(GetTeamPlayers(GetTeam())) do
        local d = GetHeroDeaths(pid)
        local c = counts[pid]
        if c ~= nil and d > c.deaths then
            died[#died + 1] = pid
        end
        counts[pid] = {
            kills = GetHeroKills(pid),
            deaths = d
        }
    end
    for ____, pid in ipairs(GetTeamPlayers(GetOpposingTeam())) do
        local k = GetHeroKills(pid)
        local c = counts[pid]
        if c ~= nil and k > c.kills then
            scorers[#scorers + 1] = pid
        end
        counts[pid] = {
            kills = k,
            deaths = GetHeroDeaths(pid)
        }
    end
    return {died = died, scorers = scorers}
end
local function OnDeath(pid, killer, now)
    local s = State(pid)
    s.lastDeath = now
    s.lastKiller = killer
    s.deaths = __TS__ArrayFilter(
        s.deaths,
        function(____, t) return now - t <= GRUDGE_WINDOW end
    )
    local ____s_deaths_0 = s.deaths
    ____s_deaths_0[#____s_deaths_0 + 1] = now
    if s.mood == "tilted" then
        s.tiltDeaths = s.tiltDeaths + 1
        if s.tiltDeaths >= FEED_GUARD then
            s.calmUntil = now + CALM_TIME
            SetMood(
                pid,
                s,
                "calm",
                now,
                "feedguard"
            )
            return
        end
    end
    if now < s.calmUntil then
        return
    end
    local grudge = false
    if killer >= 0 then
        local times = __TS__ArrayFilter(
            s.killers[killer] or ({}),
            function(____, t) return now - t <= GRUDGE_WINDOW end
        )
        times[#times + 1] = now
        s.killers[killer] = times
        if #times >= 2 then
            grudge = true
            s.grudge = killer
        end
    end
    local recent = #__TS__ArrayFilter(
        s.deaths,
        function(____, t) return now - t <= TILT_WINDOW end
    )
    local need = TILT_DEATHS + (IsPlayerBot(pid) and PersonaOf(pid) == "guardian" and 1 or 0)
    if grudge then
        SetMood(
            pid,
            s,
            "tilted",
            now,
            "grudge"
        )
    elseif recent >= need then
        SetMood(
            pid,
            s,
            "tilted",
            now,
            "deaths"
        )
    end
end
local function Towers(team)
    local up = 0
    do
        local i = 0
        while i <= 10 do
            local t = GetTower(team, i)
            if t ~= nil and t ~= nil and t:IsAlive() then
                up = up + 1
            end
            i = i + 1
        end
    end
    return up
end
--- Our scoreboard lead in rough gold: kills, summed hero levels, towers.
local function Lead(now)
    local kills = 0
    local levels = 0
    for ____, pid in ipairs(GetTeamPlayers(GetTeam())) do
        kills = kills + GetHeroKills(pid)
        levels = levels + GetHeroLevel(pid)
    end
    for ____, pid in ipairs(GetTeamPlayers(GetOpposingTeam())) do
        kills = kills - GetHeroKills(pid)
        levels = levels - GetHeroLevel(pid)
    end
    local towers = Towers(GetTeam()) - Towers(GetOpposingTeam())
    local value = kills * KILL_WORTH + levels * LEVEL_WORTH + towers * TOWER_WORTH
    if Utils.DebugMode and now - lastLeadLog >= LEAD_LOG_PERIOD then
        lastLeadLog = now
        local anw = 0
        local enw = 0
        do
            local i = 1
            while i <= 5 do
                local m = GetTeamMember(i)
                if m ~= nil and m ~= nil then
                    anw = anw + m:GetNetWorth()
                end
                i = i + 1
            end
        end
        for ____, pid in ipairs(GetTeamPlayers(GetOpposingTeam())) do
            for ____, h in ipairs(GetUnitList(UnitType.EnemyHeroes)) do
                if h:GetPlayerID() == pid and not h:IsIllusion() then
                    enw = enw + h:GetNetWorth()
                    break
                end
            end
        end
        print((((((((((((((("LEAD team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(now))) .. " lead=") .. tostring(value)) .. " kills=") .. tostring(kills)) .. " levels=") .. tostring(levels)) .. " towers=") .. tostring(towers)) .. " anw=") .. tostring(anw)) .. " enw=") .. tostring(enw))
    end
    return value
end
--- The lead a team mood needs at this game time: 5000 at 15:00, growing 100 per minute.
local function LeadNeeded(now)
    return 5000 + math.max(0, now / 60 - 15) * 100
end
local function UpdateTeam(now)
    lead = Lead(now)
    local need = LeadNeeded(now)
    local next = teamMood
    if now < 15 * 60 then
        next = "even"
    elseif teamMood == "cocky" then
        next = (lead < need - HYSTERESIS or now >= CLOSE_OUT_TIME) and "even" or "cocky"
    elseif teamMood == "desperate" then
        next = lead > -need + HYSTERESIS and "even" or "desperate"
    elseif lead >= need and now < CLOSE_OUT_TIME then
        next = "cocky"
    elseif lead <= -need then
        next = "desperate"
    end
    if next ~= teamMood then
        teamMood = next
        if Utils.DebugMode then
            print((((((((("TEAMMOOD team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(now))) .. " mood=") .. next) .. " lead=") .. tostring(lead)) .. " need=") .. tostring(math.floor(need)))
        end
    end
end
--- Team-wide update, run from any bot's desire call at most every UPDATE_PERIOD s.
function ____exports.Update()
    local now = DotaTime()
    if now - lastUpdate < UPDATE_PERIOD then
        return
    end
    lastUpdate = now
    local ____Scan_result_1 = Scan()
    local died = ____Scan_result_1.died
    local scorers = ____Scan_result_1.scorers
    for ____, pid in ipairs(died) do
        local killer = #scorers > 0 and scorers[1] or -1
        if #scorers > 1 then
            do
                local i = 1
                while i <= 5 do
                    do
                        local __continue59
                        repeat
                            local m = GetTeamMember(i)
                            if m == nil or m == nil or m:GetPlayerID() ~= pid then
                                __continue59 = true
                                break
                            end
                            for ____, e in ipairs(scorers) do
                                if m:WasRecentlyDamagedByPlayer(e, 3) then
                                    killer = e
                                end
                            end
                            __continue59 = true
                        until true
                        if not __continue59 then
                            break
                        end
                    end
                    i = i + 1
                end
            end
        end
        OnDeath(pid, killer, now)
    end
    for pidKey in pairs(bots) do
        local pid = __TS__Number(pidKey)
        local s = bots[pid]
        if s.mood == "tilted" and now - s.lastDeath > TILT_TIME then
            SetMood(
                pid,
                s,
                "calm",
                now,
                "time"
            )
        end
    end
    if now - lastTeam >= TEAM_PERIOD then
        lastTeam = now
        UpdateTeam(now)
    end
end
local function Amplified(f, amp)
    return 1 + (f - 1) * amp
end
--- The mood factor of a bot for a mode (bot mood times team mood).
function ____exports.Factor(bot, mode)
    local knob = Persona.KnobOf(mode)
    if knob == nil then
        return 1
    end
    ____exports.Update()
    local amp = Persona.Get(bot) == "hothead" and 1.5 or 1
    local s = State(bot:GetPlayerID())
    local fb = BOT_FACTORS[s.mood][knob] or 1
    local ft = TEAM_FACTORS[teamMood][knob] or 1
    return Amplified(fb, amp) * Amplified(ft, amp)
end
function ____exports.Info(bot)
    ____exports.Update()
    local s = State(bot:GetPlayerID())
    return {
        mood = s.mood,
        team = teamMood,
        grudge = s.grudge,
        lastKiller = s.lastKiller,
        lead = lead
    }
end
return ____exports
