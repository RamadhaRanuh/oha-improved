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

local function __TS__CountVarargs(...)
    return select("#", ...)
end

local function __TS__ArraySplice(self, ...)
    local args = {...}
    local len = #self
    local actualArgumentCount = __TS__CountVarargs(...)
    local start = args[1]
    local deleteCount = args[2]
    if start < 0 then
        start = len + start
        if start < 0 then
            start = 0
        end
    elseif start > len then
        start = len
    end
    local itemCount = actualArgumentCount - 2
    if itemCount < 0 then
        itemCount = 0
    end
    local actualDeleteCount
    if actualArgumentCount == 0 then
        actualDeleteCount = 0
    elseif actualArgumentCount == 1 then
        actualDeleteCount = len - start
    else
        actualDeleteCount = deleteCount or 0
        if actualDeleteCount < 0 then
            actualDeleteCount = 0
        end
        if actualDeleteCount > len - start then
            actualDeleteCount = len - start
        end
    end
    local out = {}
    for k = 1, actualDeleteCount do
        local from = start + k
        if self[from] ~= nil then
            out[k] = self[from]
        end
    end
    if itemCount < actualDeleteCount then
        for k = start + 1, len - actualDeleteCount do
            local from = k + actualDeleteCount
            local to = k + itemCount
            if self[from] then
                self[to] = self[from]
            else
                self[to] = nil
            end
        end
        for k = len - actualDeleteCount + itemCount + 1, len do
            self[k] = nil
        end
    elseif itemCount > actualDeleteCount then
        for k = len - actualDeleteCount, start + 1, -1 do
            local from = k + actualDeleteCount
            local to = k + itemCount
            if self[from] then
                self[to] = self[from]
            else
                self[to] = nil
            end
        end
    end
    local j = start + 1
    for i = 3, actualArgumentCount do
        self[j] = args[i]
        j = j + 1
    end
    for k = #self, len - actualDeleteCount + itemCount + 1, -1 do
        self[k] = nil
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

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
    end
    return result
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

local function __TS__StringStartsWith(self, searchString, position)
    if position == nil or position < 0 then
        position = 0
    end
    return string.sub(self, position + 1, #searchString + position) == searchString
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

local function __TS__ObjectKeys(obj)
    local result = {}
    local len = 0
    for key in pairs(obj) do
        len = len + 1
        result[len] = key
    end
    return result
end
-- End of Lua Library inline imports
local ____exports = {}
local Utils = require(GetScriptDirectory().."/FunLib/utils")
local ____dota = require(GetScriptDirectory().."/ts_libs/dota/index")
local BotMode = ____dota.BotMode
local POS_PERIOD = 2
local ITEM_PERIOD = 1
local CAST_PERIOD = 0.2
local ITEM_SLOTS = 17
local ABILITY_SLOTS = 24
local CAST_RANGE = 1200
local states = {}
local function Short(bot)
    return __TS__StringReplace(
        bot:GetUnitName(),
        "npc_dota_hero_",
        ""
    )
end
local function Items(bot)
    local out = {}
    do
        local i = 0
        while i < ITEM_SLOTS do
            local it = bot:GetItemInSlot(i)
            if it ~= nil and it ~= nil then
                out[#out + 1] = it:GetName()
            end
            i = i + 1
        end
    end
    return __TS__ArraySort(out)
end
local function Minus(a, b)
    local left = {unpack(b)}
    local out = {}
    for ____, x in ipairs(a) do
        local i = __TS__ArrayIndexOf(left, x)
        if i >= 0 then
            __TS__ArraySplice(left, i, 1)
        else
            out[#out + 1] = x
        end
    end
    return out
end
local function Head(bot, tag, now)
    return (((((tag .. " team=") .. tostring(GetTeam())) .. " hero=") .. Short(bot)) .. " t=") .. __TS__NumberToFixed(now, 1)
end
local function Pos(bot, now)
    local l = bot:GetLocation()
    local hp = bot:GetHealth() / math.max(
        1,
        bot:GetMaxHealth()
    )
    local mp = bot:GetMana() / math.max(
        1,
        bot:GetMaxMana()
    )
    print((((((((((((((Head(bot, "POS", now) .. " x=") .. tostring(math.floor(l.x))) .. " y=") .. tostring(math.floor(l.y))) .. " hp=") .. __TS__NumberToFixed(hp, 2)) .. " mp=") .. __TS__NumberToFixed(mp, 2)) .. " lvl=") .. tostring(bot:GetLevel())) .. " mode=") .. tostring(bot:GetActiveMode())) .. " nw=") .. tostring(bot:GetNetWorth()))
end
local function CheckItems(bot, s, now)
    local cur = Items(bot)
    if s.items ~= nil then
        local gained = Minus(cur, s.items)
        local lost = Minus(s.items, cur)
        if #gained > 0 or #lost > 0 then
            local ____print_2 = print
            local ____Head_result_1 = Head(bot, "ITEM", now)
            local ____array_0 = __TS__SparseArrayNew(unpack(__TS__ArrayMap(
                gained,
                function(____, x) return "+" .. x end
            )))
            __TS__SparseArrayPush(
                ____array_0,
                unpack(__TS__ArrayMap(
                    lost,
                    function(____, x) return "-" .. x end
                ))
            )
            ____print_2((____Head_result_1 .. " ") .. table.concat(
                {__TS__SparseArraySpread(____array_0)},
                " "
            ))
        end
    end
    s.items = cur
end
local function Cooldowns(bot)
    local out = {}
    do
        local i = 0
        while i < ABILITY_SLOTS do
            do
                local __continue19
                repeat
                    local ab = bot:GetAbilityInSlot(i)
                    if ab == nil or ab == nil then
                        __continue19 = true
                        break
                    end
                    local name = ab:GetName()
                    if __TS__StringStartsWith(name, "special_bonus") or ab:GetLevel() < 1 then
                        __continue19 = true
                        break
                    end
                    out[#out + 1] = {
                        name = name,
                        cd = ab:GetCooldownTimeRemaining(),
                        lvl = ab:GetLevel()
                    }
                    __continue19 = true
                until true
                if not __continue19 then
                    break
                end
            end
            i = i + 1
        end
    end
    do
        local i = 0
        while i < ITEM_SLOTS do
            do
                local __continue22
                repeat
                    if i >= 6 and i <= 14 then
                        __continue22 = true
                        break
                    end
                    local it = bot:GetItemInSlot(i)
                    if it == nil or it == nil then
                        __continue22 = true
                        break
                    end
                    out[#out + 1] = {
                        name = it:GetName(),
                        cd = it:GetCooldownTimeRemaining(),
                        lvl = 0
                    }
                    __continue22 = true
                until true
                if not __continue22 then
                    break
                end
            end
            i = i + 1
        end
    end
    return out
end
local function CheckCasts(bot, s, now)
    local mp = bot:GetMana() / math.max(
        1,
        bot:GetMaxMana()
    )
    local e = -1
    local a = -1
    local seen = {}
    for ____, c in ipairs(Cooldowns(bot)) do
        seen[c.name] = true
        local ready = c.cd <= 0
        if not ready and s.ready[c.name] == true then
            if e < 0 then
                e = #bot:GetNearbyHeroes(CAST_RANGE, true, BotMode.None)
                a = #bot:GetNearbyHeroes(CAST_RANGE, false, BotMode.None) - 1
            end
            print(((((((((((Head(bot, "CAST", now) .. " ability=") .. c.name) .. (c.lvl > 0 and " lvl=" .. tostring(c.lvl) or "")) .. " cd=") .. __TS__NumberToFixed(c.cd, 1)) .. " mp=") .. __TS__NumberToFixed(mp, 2)) .. " e=") .. tostring(e)) .. " a=") .. tostring(a))
        end
        s.ready[c.name] = ready
    end
    for ____, k in ipairs(__TS__ObjectKeys(s.ready)) do
        if not seen[k] then
            __TS__Delete(s.ready, k)
        end
    end
end
--- Returns true (SafeCall reads nil as an error).
function ____exports.Tick(bot)
    if not Utils.DebugMode or not bot:IsHero() or bot:IsIllusion() then
        return true
    end
    local id = bot:GetPlayerID()
    local s = states[id]
    if s == nil then
        s = {
            pos = -999,
            item = -999,
            cast = -999,
            items = nil,
            ready = {}
        }
        states[id] = s
    end
    local now = DotaTime()
    if now - s.item >= ITEM_PERIOD then
        s.item = now
        CheckItems(bot, s, now)
    end
    if not bot:IsAlive() then
        return true
    end
    if now - s.pos >= POS_PERIOD then
        s.pos = now
        Pos(bot, now)
    end
    if now - s.cast >= CAST_PERIOD then
        s.cast = now
        CheckCasts(bot, s, now)
    end
    return true
end
return ____exports
