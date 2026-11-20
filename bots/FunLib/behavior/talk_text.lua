--[[ Generated with https://github.com/TypeScriptToLua/TypeScriptToLua ]]
-- Lua Library inline imports
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

local __TS__StringSplit
do
    local sub = string.sub
    local find = string.find
    function __TS__StringSplit(source, separator, limit)
        if limit == nil then
            limit = 4294967295
        end
        if limit == 0 then
            return {}
        end
        local result = {}
        local resultIndex = 1
        if separator == nil or separator == "" then
            for i = 1, #source do
                result[resultIndex] = sub(source, i, i)
                resultIndex = resultIndex + 1
            end
        else
            local currentPos = 1
            while resultIndex <= limit do
                local startPos, endPos = find(source, separator, currentPos, true)
                if not startPos then
                    break
                end
                result[resultIndex] = sub(source, currentPos, startPos - 1)
                resultIndex = resultIndex + 1
                currentPos = endPos + 1
            end
            if resultIndex <= limit then
                result[resultIndex] = sub(source, currentPos)
            end
        end
        return result
    end
end
-- End of Lua Library inline imports
local ____exports = {}
--- Intents that count as trash talk from a human: they raise heat and can be quoted back later.
____exports.TRASH_INTENTS = {
    "qmark",
    "report",
    "bot",
    "mom",
    "ez",
    "insult",
    "challenge"
}
local function IsAlnum(c)
    local b = string.byte(c, 1) or 0 / 0
    return b >= 48 and b <= 57 or b >= 97 and b <= 122
end
--- Lowercase words of a message; anything that is not a letter or digit splits words.
function ____exports.Words(msg)
    local text = string.lower(msg)
    local out = {}
    local cur = ""
    do
        local i = 0
        while i < #text do
            local c = __TS__StringSubstring(text, i, i + 1)
            if IsAlnum(c) then
                cur = cur .. c
            elseif #cur > 0 then
                out[#out + 1] = cur
                cur = ""
            end
            i = i + 1
        end
    end
    if #cur > 0 then
        out[#out + 1] = cur
    end
    return out
end
local function Trim(s)
    local a = 0
    local b = #s
    while a < b and __TS__StringSubstring(s, a, a + 1) == " " do
        a = a + 1
    end
    while b > a and __TS__StringSubstring(s, b - 1, b) == " " do
        b = b - 1
    end
    return __TS__StringSubstring(s, a, b)
end
--- "ez", "ezz", "ezzzz", "easy".
local function IsEz(w)
    if w == "easy" or w == "ezpz" or w == "izi" then
        return true
    end
    if #w < 2 or __TS__StringSubstring(w, 0, 2) ~= "ez" then
        return false
    end
    do
        local i = 2
        while i < #w do
            if __TS__StringSubstring(w, i, i + 1) ~= "z" then
                return false
            end
            i = i + 1
        end
    end
    return true
end
--- "lol", "lmao", "xd", "xddd", "haha", "hahaha", "kek".
local function IsLaugh(w)
    if w == "lol" or w == "lmao" or w == "lmfao" or w == "kek" or w == "rofl" or w == "lul" or w == "kekw" then
        return true
    end
    if #w >= 2 and __TS__StringSubstring(w, 0, 2) == "xd" then
        return true
    end
    if #w >= 4 and (__TS__StringSubstring(w, 0, 4) == "haha" or __TS__StringSubstring(w, 0, 4) == "ahah" or __TS__StringSubstring(w, 0, 4) == "hehe") then
        return true
    end
    return false
end
local function Has(words, list)
    for ____, w in ipairs(words) do
        if __TS__ArrayIndexOf(list, w) >= 0 then
            return true
        end
    end
    return false
end
local function HasPair(words, a, b)
    do
        local i = 0
        while i + 1 < #words do
            if words[i + 1] == a and words[i + 1 + 1] == b then
                return true
            end
            i = i + 1
        end
    end
    return false
end
local INSULTS = {
    "noob",
    "nub",
    "noobs",
    "newb",
    "trash",
    "garbage",
    "bad",
    "dog",
    "idiot",
    "stupid",
    "feeder",
    "feed",
    "feeding",
    "useless",
    "loser",
    "pathetic",
    "uninstall",
    "clown",
    "shit",
    "suck",
    "sucks",
    "dumb",
    "braindead",
    "boosted",
    "cringe",
    "l2p",
    "stfu",
    "noobest",
    "scrub",
    "potato",
    "rat",
    "monkey",
    "fuck",
    "fucking",
    "bitch",
    "bozo",
    "ass"
}
--- What a human's message is about, from its words. The first matching rule wins.
function ____exports.Classify(msg)
    local raw = Trim(msg)
    if #raw == 0 then
        return "unknown"
    end
    local allMarks = true
    do
        local i = 0
        while i < #raw do
            local c = __TS__StringSubstring(raw, i, i + 1)
            if c ~= "?" and c ~= "!" and c ~= " " then
                allMarks = false
            end
            i = i + 1
        end
    end
    if allMarks and (string.find(raw, "?", nil, true) or 0) - 1 >= 0 then
        return "qmark"
    end
    local w = ____exports.Words(raw)
    if #w == 0 then
        return "unknown"
    end
    if Has(w, {"report", "reported", "reporting"}) then
        return "report"
    end
    if Has(w, {
        "bot",
        "bots",
        "ai",
        "robot",
        "botting"
    }) then
        return "bot"
    end
    if Has(w, {
        "mom",
        "mother",
        "mum",
        "mama",
        "momma",
        "ur mom"
    }) then
        return "mom"
    end
    for ____, x in ipairs(w) do
        if IsEz(x) then
            return "ez"
        end
    end
    if Has(w, {"1v1", "1vs1", "fightme"}) or HasPair(w, "fight", "me") or HasPair(w, "come", "here") or #w <= 2 and w[1] == "come" then
        return "challenge"
    end
    if Has(w, INSULTS) then
        return "insult"
    end
    if Has(w, {
        "lag",
        "lagging",
        "door",
        "afk",
        "dc",
        "disconnect",
        "ping"
    }) then
        return "excuse"
    end
    if Has(w, {
        "toxic",
        "chill",
        "calm",
        "relax",
        "stop",
        "cry"
    }) then
        return "chill"
    end
    if Has(w, {
        "end",
        "ff",
        "surrender",
        "ff20",
        "ff15",
        "concede"
    }) then
        return "end"
    end
    if Has(w, {"gg", "ggwp", "ggs", "gege"}) then
        return "gg"
    end
    if Has(w, {
        "hi",
        "hello",
        "glhf",
        "gl",
        "hf",
        "hey",
        "yo",
        "sup",
        "hola",
        "hii"
    }) then
        return "greet"
    end
    if Has(w, {
        "wp",
        "nice",
        "gj",
        "ns",
        "respect",
        "well",
        "clean",
        "good",
        "gw",
        "nt"
    }) then
        return "compliment"
    end
    for ____, x in ipairs(w) do
        if IsLaugh(x) then
            return "laugh"
        end
    end
    if Has(w, {
        "why",
        "how",
        "what",
        "wtf",
        "who",
        "when"
    }) or __TS__StringSubstring(raw, #raw - 1) == "?" then
        return "question"
    end
    return "unknown"
end
--- Nicknames players actually type. Others: initials of multi-word names, or the single word.
local NICKS = {
    antimage = "am",
    earthshaker = "es",
    juggernaut = "jugg",
    faceless_void = "void",
    nevermore = "sf",
    queenofpain = "qop",
    skeleton_king = "wk",
    zuus = "zeus",
    rattletrap = "clock",
    furion = "np",
    obsidian_destroyer = "od",
    shredder = "timber",
    wisp = "io",
    windrunner = "wr",
    life_stealer = "naix",
    magnataur = "magnus",
    doom_bringer = "doom",
    abyssal_underlord = "underlord",
    vengefulspirit = "venge",
    drow_ranger = "drow",
    storm_spirit = "storm",
    ember_spirit = "ember",
    earth_spirit = "earth spirit",
    void_spirit = "void spirit",
    shadow_shaman = "shaman",
    bloodseeker = "bs",
    spirit_breaker = "bara",
    night_stalker = "ns",
    necrolyte = "necro",
    treant = "treant",
    centaur = "centaur",
    crystal_maiden = "cm",
    phantom_assassin = "pa",
    witch_doctor = "wd",
    templar_assassin = "ta",
    lone_druid = "ld",
    troll_warlord = "troll",
    ogre_magi = "ogre",
    naga_siren = "naga",
    winter_wyvern = "wyvern",
    skywrath_mage = "sky",
    dark_willow = "willow",
    monkey_king = "mk",
    legion_commander = "lc",
    death_prophet = "dp",
    primal_beast = "pb",
    marci = "marci",
    tinker = "tinker",
    sand_king = "sk",
    elder_titan = "et",
    keeper_of_the_light = "kotl"
}
--- "npc_dota_hero_crystal_maiden" -> "cm".
function ____exports.Nick(heroName)
    local prefix = "npc_dota_hero_"
    local base = (string.find(heroName, prefix, nil, true) or 0) - 1 == 0 and __TS__StringSubstring(heroName, #prefix) or heroName
    local known = NICKS[base]
    if known ~= nil then
        return known
    end
    local parts = __TS__StringSplit(base, "_")
    if #parts == 1 then
        return base
    end
    local out = ""
    for ____, p in ipairs(parts) do
        if #p > 0 then
            out = out .. __TS__StringSubstring(p, 0, 1)
        end
    end
    return out
end
--- Index of the first nickname a message names as a whole word, or -1.
function ____exports.FindAddressed(msg, nicks)
    local w = ____exports.Words(msg)
    local joined = (" " .. table.concat(w, " ")) .. " "
    do
        local i = 0
        while i < #nicks do
            do
                local __continue58
                repeat
                    local n = nicks[i + 1]
                    if #n < 2 then
                        __continue58 = true
                        break
                    end
                    if (string.find(joined, (" " .. n) .. " ", nil, true) or 0) - 1 >= 0 then
                        return i
                    end
                    __continue58 = true
                until true
                if not __continue58 then
                    break
                end
            end
            i = i + 1
        end
    end
    return -1
end
--- Replaces {name} with vars[name]; an unknown name is left as is.
function ____exports.Fill(template, vars)
    local out = ""
    local i = 0
    while i < #template do
        do
            local __continue62
            repeat
                local c = __TS__StringSubstring(template, i, i + 1)
                if c == "{" then
                    local close = (string.find(
                        template,
                        "}",
                        math.max(i + 1, 1),
                        true
                    ) or 0) - 1
                    if close > i then
                        local key = __TS__StringSubstring(template, i + 1, close)
                        local v = vars[key]
                        out = out .. (v ~= nil and v or __TS__StringSubstring(template, i, close + 1))
                        i = close + 1
                        __continue62 = true
                        break
                    end
                end
                out = out .. c
                i = i + 1
                __continue62 = true
            until true
            if not __continue62 then
                break
            end
        end
    end
    return out
end
--- True when a template only uses names that vars has (so no "{t}" reaches chat).
function ____exports.CanFill(template, vars)
    local i = (string.find(template, "{", nil, true) or 0) - 1
    while i >= 0 do
        local close = (string.find(
            template,
            "}",
            math.max(i + 1, 1),
            true
        ) or 0) - 1
        if close < 0 then
            return true
        end
        if vars[__TS__StringSubstring(template, i + 1, close)] == nil then
            return false
        end
        i = (string.find(
            template,
            "{",
            math.max(close + 1, 1),
            true
        ) or 0) - 1
    end
    return true
end
--- A line is one or more chat messages sent in a quick burst, split by "|".
function ____exports.Bursts(line)
    local out = {}
    for ____, p in ipairs(__TS__StringSplit(line, "|")) do
        local t = Trim(p)
        if #t > 0 then
            out[#out + 1] = t
        end
    end
    return out
end
--- Typing style: caps when tilted, an occasional swapped-letter typo in a longer word.
function ____exports.Style(text, o, rand)
    local out = text
    if o.typo > 0 and rand() < o.typo then
        local words = __TS__StringSplit(out, " ")
        local longIdx = {}
        do
            local i = 0
            while i < #words do
                if #words[i + 1] >= 5 and (string.find(words[i + 1], "{", nil, true) or 0) - 1 < 0 then
                    longIdx[#longIdx + 1] = i
                end
                i = i + 1
            end
        end
        if #longIdx > 0 then
            local wi = longIdx[math.min(
                #longIdx - 1,
                math.floor(rand() * #longIdx)
            ) + 1]
            local w = words[wi + 1]
            local p = 1 + math.min(
                #w - 3,
                math.floor(rand() * (#w - 2))
            )
            words[wi + 1] = ((__TS__StringSubstring(w, 0, p) .. __TS__StringSubstring(w, p + 1, p + 2)) .. __TS__StringSubstring(w, p, p + 1)) .. __TS__StringSubstring(w, p + 2)
            out = table.concat(words, " ")
        end
    end
    if o.caps then
        out = string.upper(out)
    end
    return out
end
--- Picks a line from a pool, skipping lines said recently and lines whose placeholders cannot be filled.
-- Returns undefined when nothing fits.
function ____exports.Choose(pool, recent, vars, rand)
    local fresh = {}
    local fillable = {}
    for ____, line in ipairs(pool) do
        do
            local __continue80
            repeat
                if not ____exports.CanFill(line, vars) then
                    __continue80 = true
                    break
                end
                fillable[#fillable + 1] = line
                if __TS__ArrayIndexOf(recent, line) < 0 then
                    fresh[#fresh + 1] = line
                end
                __continue80 = true
            until true
            if not __continue80 then
                break
            end
        end
    end
    local from = #fresh > 0 and fresh or fillable
    if #from == 0 then
        return nil
    end
    return from[math.min(
        #from - 1,
        math.floor(rand() * #from)
    ) + 1]
end
return ____exports
