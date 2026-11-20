--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
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

local function __TS__CountVarargs(...)
    return select("#", ...)
end

local function __TS__SparseArrayNew(...)
    local sparseArray = {...}
    sparseArray.sparseLength = __TS__CountVarargs(...)
    return sparseArray
end

local function __TS__SparseArrayPush(sparseArray, ...)
    local args = {...}
    local argsLen = __TS__CountVarargs(...)
    local listLen = sparseArray.sparseLength
    for i = 1, argsLen do
        sparseArray[listLen + i] = args[i]
    end
    sparseArray.sparseLength = listLen + argsLen
end

local function __TS__SparseArraySpread(sparseArray)
    local _unpack = unpack or table.unpack
    return _unpack(sparseArray, 1, sparseArray.sparseLength)
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

local function __TS__StringSubstring(self, start, ____end)
    if ____end ~= ____end then
        ____end = 0
    end
    if ____end ~= nil and start > ____end then
        start, ____end = ____end, start
    end
    if start >= 0 then
        start = start + 1
    else
        start = 1
    end
    if ____end ~= nil and ____end < 0 then
        ____end = 0
    end
    return string.sub(self, start, ____end)
end

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
-- End of Lua Library inline imports
local ____exports = {}
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local Rng = require(GetScriptDirectory().."/FunLib/behavior/rng")
local Persona = require(GetScriptDirectory().."/FunLib/behavior/persona")
local Mood = require(GetScriptDirectory().."/FunLib/behavior/mood")
local ____talk_lines = require(GetScriptDirectory().."/FunLib/behavior/talk_lines")
local LINES = ____talk_lines.LINES
local Text = require(GetScriptDirectory().."/FunLib/behavior/talk_text")
local Customize = require(GetScriptDirectory().."/Customize/general")
local UPDATE_PERIOD = 0.5
local BOT_GAP = 3
local TEAM_PER_MIN = 10
local REPLY_GAP = 4
local FIGHT_WINDOW = 12
local FIGHT_GAP = 30
local TEAM_LINE_GAP = 300
local HEAT_DECAY = 120
local QUOTE_MAX = 32
local RECENT_MAX = 40
--- Chance a persona taunts after a kill.
local KILL_TALK = {
    hothead = 0.7,
    bully = 0.6,
    playmaker = 0.5,
    greedy = 0.3,
    guardian = 0.15
}
--- Weight of a persona when a random bot is picked to speak.
local TALKATIVE = {
    hothead = 1,
    bully = 0.9,
    playmaker = 0.7,
    greedy = 0.5,
    guardian = 0.3
}
--- Chance of replying, by intent.
local REPLY_CHANCE = {
    qmark = 0.6,
    report = 0.85,
    bot = 0.95,
    mom = 0.9,
    ez = 0.95,
    insult = 0.9,
    challenge = 0.85,
    excuse = 0.7,
    chill = 0.7,
    ["end"] = 0.75,
    gg = 0.7,
    compliment = 0.55,
    laugh = 0.45,
    greet = 0.6,
    question = 0.6,
    unknown = 0.3
}
local PILE_ON = {
    "insult",
    "ez",
    "bot",
    "report",
    "mom"
}
local humans = {}
local queues = {}
local lastSpoke = {}
local killerOf = {}
local counts = {}
local sentTimes = {}
local recent = {}
local enemyDeaths = {}
local ourDeaths = {}
local lastUpdate = -999
local lastFightTalk = -999
local lastTeamLine = -999
local teamMood = "even"
local started = false
local ancientOurs = false
local ancientTheirs = false
local callbackInstalled = false
local custom
local function Rand()
    return Rng.Float(0, 1)
end
local function Level()
    if Customize.Allow_Trash_Talk == false then
        return 0
    end
    local l = Customize.Trash_Talk_Level
    return type(l) == "number" and l or 1
end
--- Customize/trash_talk.lua: the user's own lines, by kind. The game/Customize copy wins, as for general.lua.
local function Custom()
    if custom ~= nil then
        return custom
    end
    custom = {}
    for ____, path in ipairs({
        "game/Customize/trash_talk",
        GetScriptDirectory() .. "/Customize/trash_talk"
    }) do
        local ok, mod = pcall(require, path)
        if ok and type(mod) == "table" and mod ~= nil then
            custom = mod
            break
        end
    end
    return custom
end
local function HumanOf(pid)
    local h = humans[pid]
    if h == nil then
        h = {
            heat = 0,
            quote = nil,
            lastMsg = -999,
            lastReply = -999,
            lastBot = -1,
            greeted = false
        }
        humans[pid] = h
    end
    return h
end
local function Kda(pid)
    return (tostring(GetHeroKills(pid)) .. "-") .. tostring(GetHeroDeaths(pid))
end
local function NickOf(pid)
    return Text.Nick(GetSelectedHeroName(pid) or "")
end
--- Our team's bots: player id -> unit.
local function OurBots()
    local out = {}
    do
        local i = 1
        while i <= 5 do
            local m = GetTeamMember(i)
            if m ~= nil and m ~= nil and m:IsHero() and not m:IsIllusion() and IsPlayerBot(m:GetPlayerID()) then
                out[m:GetPlayerID()] = m
            end
            i = i + 1
        end
    end
    return out
end
local function PersonaOf(pid)
    local b = OurBots()[pid]
    return b ~= nil and Persona.Get(b) or "playmaker"
end
local function Tilted(pid)
    local b = OurBots()[pid]
    return b ~= nil and Mood.Info(b).mood == "tilted"
end
--- A random bot of ours, weighted by persona; `prefer` (when given) doubles a bot's weight.
local function PickSpeaker(exclude, prefer)
    local bots = OurBots()
    local total = 0
    local ids = {}
    local weights = {}
    for k in pairs(bots) do
        do
            local __continue20
            repeat
                local pid = __TS__Number(k)
                if pid == exclude then
                    __continue20 = true
                    break
                end
                local w = TALKATIVE[Persona.Get(bots[pid])]
                if prefer ~= nil and prefer(pid) then
                    w = w * 2
                end
                ids[#ids + 1] = pid
                weights[#weights + 1] = w
                total = total + w
                __continue20 = true
            until true
            if not __continue20 then
                break
            end
        end
    end
    if #ids == 0 then
        return -1
    end
    local roll = Rand() * total
    do
        local i = 0
        while i < #ids do
            if roll < weights[i + 1] then
                return ids[i + 1]
            end
            roll = roll - weights[i + 1]
            i = i + 1
        end
    end
    return ids[#ids]
end
local function Vars(speaker, target)
    local v = {
        me = NickOf(speaker),
        mk = Kda(speaker)
    }
    local ours = 0
    local theirs = 0
    for ____, pid in ipairs(GetTeamPlayers(GetTeam())) do
        ours = ours + GetHeroKills(pid)
    end
    for ____, pid in ipairs(GetTeamPlayers(GetOpposingTeam())) do
        theirs = theirs + GetHeroKills(pid)
    end
    v.score = (tostring(ours) .. "-") .. tostring(theirs)
    local allies = {}
    for ____, pid in ipairs(GetTeamPlayers(GetTeam())) do
        if pid ~= speaker then
            allies[#allies + 1] = pid
        end
    end
    if #allies > 0 then
        v.ally = NickOf(allies[math.min(
            #allies - 1,
            math.floor(Rand() * #allies)
        ) + 1])
    end
    if target >= 0 then
        v.t = NickOf(target)
        v.tk = Kda(target)
        v.d = tostring(GetHeroDeaths(target))
        local h = humans[target]
        if h ~= nil and h.quote ~= nil then
            v.q = h.quote
        end
    end
    return v
end
local function Pool(kind, persona, harshOnly)
    local set = LINES[kind]
    local harsh = Level() >= 3 and set.harsh ~= nil and set.harsh or ({})
    local extra = Custom()[kind] or ({})
    if harshOnly and #harsh + #extra > 0 then
        local ____array_0 = __TS__SparseArrayNew(unpack(harsh))
        __TS__SparseArrayPush(
            ____array_0,
            unpack(extra)
        )
        return {__TS__SparseArraySpread(____array_0)}
    end
    local own = set.persona ~= nil and (set.persona[persona] or ({})) or ({})
    local ____array_1 = __TS__SparseArrayNew(unpack(set.mild))
    __TS__SparseArrayPush(
        ____array_1,
        unpack(harsh)
    )
    __TS__SparseArrayPush(
        ____array_1,
        unpack(own)
    )
    __TS__SparseArrayPush(
        ____array_1,
        unpack(own)
    )
    __TS__SparseArrayPush(
        ____array_1,
        unpack(extra)
    )
    return {__TS__SparseArraySpread(____array_1)}
end
local function TeamBudget(now)
    sentTimes = __TS__ArrayFilter(
        sentTimes,
        function(____, t) return now - t < 60 end
    )
    return #sentTimes < TEAM_PER_MIN
end
--- Queues a line of `kind` from `speaker` (a bot of ours) about `target` (any player, -1 for none).
local function Say(speaker, kind, target, extraDelay)
    if extraDelay == nil then
        extraDelay = 0
    end
    if speaker < 0 then
        return false
    end
    local now = DotaTime()
    if now - (lastSpoke[speaker] or -999) < BOT_GAP or not TeamBudget(now) then
        return false
    end
    local persona = PersonaOf(speaker)
    local tilted = Tilted(speaker)
    local h = target >= 0 and humans[target] or nil
    local harshOnly = Level() >= 3 and (tilted or h ~= nil and h.heat >= 3) and Rand() < 0.6
    local vars = Vars(speaker, target)
    local line = Text.Choose(
        Pool(kind, persona, harshOnly),
        recent,
        vars,
        Rand
    ) or Text.Choose(
        Pool(kind, persona, false),
        recent,
        vars,
        Rand
    )
    if line == nil then
        return false
    end
    recent[#recent + 1] = line
    if #recent > RECENT_MAX then
        recent = __TS__ArraySlice(recent, #recent - RECENT_MAX)
    end
    local caps = (tilted or persona == "hothead") and Rand() < (tilted and 0.45 or 0.15)
    local due = now + extraDelay
    local q = queues[speaker] or ({})
    for ____, part in ipairs(Text.Bursts(Text.Fill(line, vars))) do
        local text = Text.Style(part, {caps = caps, typo = 0.06}, Rand)
        due = due + (0.8 + #text * 0.05 + Rand() * 1.2) * (tilted and 0.6 or 1)
        q[#q + 1] = {due = due, text = text, kind = kind, to = target}
    end
    queues[speaker] = q
    lastSpoke[speaker] = due
    if __TS__StringSubstring(kind, 0, 6) == "reply_" or kind == "pile_on" then
        if h ~= nil then
            h.lastReply = now
        end
    end
    return true
end
local function OnKill(bot, victim, firstBlood)
    if Level() < 2 then
        return
    end
    local persona = PersonaOf(bot)
    local p = KILL_TALK[persona] + (teamMood == "cocky" and 0.15 or 0)
    local kind = "kill"
    local h = humans[victim]
    local b = OurBots()[bot]
    if firstBlood then
        kind = "first_blood"
        p = 0.8
    elseif h ~= nil and h.quote ~= nil and Rand() < 0.7 then
        kind = "throwback"
        p = 0.95
    elseif killerOf[bot] == victim or b ~= nil and Mood.Info(b).grudge == victim then
        kind = "revenge"
        p = 0.85
    elseif GetHeroKills(bot) >= 5 and GetHeroDeaths(bot) <= 2 and Rand() < 0.35 then
        kind = "streak"
    end
    if Rand() < p and Say(bot, kind, victim) and kind == "throwback" and h ~= nil then
        h.quote = nil
    end
end
local function OnDeath(bot, killer)
    local persona = PersonaOf(bot)
    local tilted = Tilted(bot)
    if tilted or persona == "hothead" then
        if Rand() < 0.55 then
            Say(
                bot,
                Rand() < 0.4 and "flame_team" or "death_tilt",
                killer
            )
        end
    elseif persona == "guardian" then
        if Rand() < 0.25 then
            Say(bot, "death_calm", killer)
        end
    elseif Rand() < 0.25 then
        Say(bot, "death_tilt", killer)
    end
end
local function Scan(now)
    local ours = GetTeamPlayers(GetTeam())
    local theirs = GetTeamPlayers(GetOpposingTeam())
    local ourScorers = {}
    local theirScorers = {}
    local ourDied = {}
    local theirDied = {}
    local ourKills = 0
    local theirKills = 0
    for ____, pid in ipairs(ours) do
        local k = GetHeroKills(pid)
        local d = GetHeroDeaths(pid)
        ourKills = ourKills + k
        local c = counts[pid]
        if c ~= nil then
            if k > c.kills then
                ourScorers[#ourScorers + 1] = pid
            end
            if d > c.deaths then
                ourDied[#ourDied + 1] = pid
            end
        end
        counts[pid] = {kills = k, deaths = d}
    end
    for ____, pid in ipairs(theirs) do
        local k = GetHeroKills(pid)
        local d = GetHeroDeaths(pid)
        theirKills = theirKills + k
        local c = counts[pid]
        if c ~= nil then
            if k > c.kills then
                theirScorers[#theirScorers + 1] = pid
            end
            if d > c.deaths then
                theirDied[#theirDied + 1] = pid
            end
        end
        counts[pid] = {kills = k, deaths = d}
    end
    for ____, victim in ipairs(theirDied) do
        enemyDeaths[#enemyDeaths + 1] = now
        local killer = #ourScorers > 0 and ourScorers[1] or -1
        if killer >= 0 then
            HumanOf(victim).lastBot = killer
            if IsPlayerBot(killer) then
                OnKill(killer, victim, ourKills == 1 and theirKills == 0)
            end
        end
    end
    for ____, victim in ipairs(ourDied) do
        ourDeaths[#ourDeaths + 1] = now
        local killer = #theirScorers > 0 and theirScorers[1] or -1
        killerOf[victim] = killer
        if killer >= 0 then
            HumanOf(killer).lastBot = victim
        end
        if IsPlayerBot(victim) then
            OnDeath(victim, killer)
        end
    end
end
local function Fights(now)
    enemyDeaths = __TS__ArrayFilter(
        enemyDeaths,
        function(____, t) return now - t <= FIGHT_WINDOW end
    )
    ourDeaths = __TS__ArrayFilter(
        ourDeaths,
        function(____, t) return now - t <= FIGHT_WINDOW end
    )
    if now - lastFightTalk < FIGHT_GAP then
        return
    end
    if #enemyDeaths >= 3 and #ourDeaths <= 1 then
        if Say(
            PickSpeaker(-1),
            "fight_won",
            -1
        ) then
            lastFightTalk = now
        end
    elseif #ourDeaths >= 3 and #enemyDeaths <= 1 then
        if Say(
            PickSpeaker(
                -1,
                function(pid) return Tilted(pid) or PersonaOf(pid) == "hothead" end
            ),
            "fight_lost",
            -1
        ) then
            lastFightTalk = now
        end
    end
end
local function TeamLines(now)
    local bots = OurBots()
    local any
    for k in pairs(bots) do
        any = bots[__TS__Number(k)]
        break
    end
    if any == nil then
        return
    end
    local next = Mood.Info(any).team
    if next ~= teamMood then
        teamMood = next
        if next ~= "even" and now - lastTeamLine >= TEAM_LINE_GAP then
            local speaker = next == "desperate" and PickSpeaker(
                -1,
                function(pid) return PersonaOf(pid) == "hothead" end
            ) or PickSpeaker(-1)
            if Say(speaker, next, -1) then
                lastTeamLine = now
            end
        end
    end
    local function ancient(team)
        local a = GetAncient(team)
        return a ~= nil and a ~= nil and a:GetHealth() / math.max(
            1,
            a:GetMaxHealth()
        ) or 1
    end
    if not ancientOurs and ancient(GetTeam()) < 0.25 then
        ancientOurs = true
        Say(
            PickSpeaker(-1),
            "our_ancient_low",
            -1
        )
    end
    if not ancientTheirs and ancient(GetOpposingTeam()) < 0.25 then
        ancientTheirs = true
        Say(
            PickSpeaker(-1),
            "their_ancient_low",
            -1
        )
    end
end
local function ReplyKind(intent)
    if intent == "gg" or intent == "end" then
        local bots = OurBots()
        local lead = 0
        for k in pairs(bots) do
            lead = Mood.Info(bots[__TS__Number(k)]).lead
            break
        end
        return (("reply_" .. intent) .. "_") .. (lead >= 0 and "ahead" or "behind")
    end
    return "reply_" .. intent
end
local function OnChat(c)
    local pid = c.player_id
    if Utils.DebugMode then
        print((((((((((((("CHATIN team=" .. tostring(GetTeam())) .. " t=") .. tostring(math.floor(DotaTime()))) .. " pid=") .. tostring(pid)) .. " bot=") .. tostring(IsPlayerBot(pid))) .. " ally=") .. tostring(IsTeamPlayer(pid))) .. " teamonly=") .. tostring(c.team_only)) .. " text=") .. c.string)
    end
    if pid == nil or c.team_only or IsTeamPlayer(pid) then
        return
    end
    if IsPlayerBot(pid) and not Utils.DebugMode then
        return
    end
    local now = DotaTime()
    local text = c.string or ""
    local intent = Text.Classify(text)
    local h = HumanOf(pid)
    h.heat = math.max(
        0,
        h.heat - math.floor((now - h.lastMsg) / HEAT_DECAY)
    )
    h.lastMsg = now
    if __TS__ArrayIndexOf(Text.TRASH_INTENTS, intent) >= 0 then
        h.heat = h.heat + (intent == "ez" and 2 or 1)
        if intent ~= "qmark" and #text <= QUOTE_MAX then
            h.quote = string.lower(text)
        end
    elseif intent == "compliment" or intent == "laugh" or intent == "greet" then
        h.heat = math.max(0, h.heat - 1)
    end
    if intent == "greet" then
        if h.greeted then
            return
        end
        h.greeted = true
    end
    if now - h.lastReply < REPLY_GAP then
        return
    end
    local bots = OurBots()
    local ids = {}
    local nicks = {}
    for k in pairs(bots) do
        ids[#ids + 1] = __TS__Number(k)
        nicks[#nicks + 1] = NickOf(__TS__Number(k))
    end
    if #ids == 0 then
        return
    end
    local named = Text.FindAddressed(text, nicks)
    local speaker = named >= 0 and ids[named + 1] or (bots[h.lastBot] ~= nil and h.lastBot or PickSpeaker(-1))
    if speaker < 0 then
        speaker = ids[1]
    end
    local persona = PersonaOf(speaker)
    local p = REPLY_CHANCE[intent] * (persona == "guardian" and 0.6 or (persona == "hothead" and 1.2 or 1))
    if named >= 0 then
        p = math.max(p, 0.85)
    end
    if Rand() >= p then
        return
    end
    if not Say(
        speaker,
        ReplyKind(intent),
        pid
    ) then
        return
    end
    if __TS__ArrayIndexOf(PILE_ON, intent) >= 0 and Level() >= 2 and Rand() < 0.15 then
        Say(
            PickSpeaker(speaker),
            "pile_on",
            pid,
            2.5
        )
    end
end
local function Update()
    local now = DotaTime()
    if now - lastUpdate < UPDATE_PERIOD then
        return
    end
    lastUpdate = now
    if not started and now >= 0 then
        started = true
        if Rand() < 0.35 then
            Say(
                PickSpeaker(-1),
                "game_start",
                -1,
                Rand() * 4
            )
        end
    end
    Scan(now)
    Fights(now)
    TeamLines(now)
end
local function Flush(bot)
    local pid = bot:GetPlayerID()
    local q = queues[pid]
    if q == nil or #q == 0 then
        return
    end
    local now = DotaTime()
    while #q > 0 and q[1].due <= now do
        local m = table.remove(q, 1)
        bot:ActionImmediate_Chat(m.text, true)
        sentTimes[#sentTimes + 1] = now
        if Utils.DebugMode then
            local to = m.to >= 0 and __TS__StringReplace(
                GetSelectedHeroName(m.to) or "",
                "npc_dota_hero_",
                ""
            ) or "-"
            print((((((((((("TALK team=" .. tostring(GetTeam())) .. " hero=") .. __TS__StringReplace(
                bot:GetUnitName(),
                "npc_dota_hero_",
                ""
            )) .. " t=") .. tostring(math.floor(now))) .. " kind=") .. m.kind) .. " to=") .. to) .. " text=") .. m.text)
        end
    end
end
--- Called from each bot's courier think (every 0.5 s, alive or dead). Returns true (SafeCall reads nil as an error).
function ____exports.Tick(bot)
    if Level() <= 0 or not bot:IsHero() or bot:IsIllusion() then
        return true
    end
    if not callbackInstalled then
        callbackInstalled = true
        InstallChatCallback(function(c) return OnChat(c) end)
    end
    Update()
    Flush(bot)
    return true
end
return ____exports
