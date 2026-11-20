-- Pub-style player names for bots (Customize.Human_Like_Names), so a lobby reads like a normal pub game:
-- no team tag, no pro player name, no ".OHA" suffix. Drawn per game from real time, because Valve's
-- RandomInt repeats the same sequence every game.
local PubNames = {}

local NAMES = {
	'mid or feed', 'sad boi', 'Kevin', 'pudge god', 'just one more game', 'dont report pls', 'tango merchant',
	'4k soon', 'papa bless', 'RIP my mmr', 'sleepy', 'Mr. Feed', 'lowprio survivor', "my mom's pc", 'pos 6',
	'supp only', 'boomer', 'Yuki', 'Andrei', 'Carlo', 'dotes', 'ggwp', 'Dendi fan', 'no wards no mercy',
	'Invoker main', 'xX_slayer_Xx', 'ancient 2', 'herald forever', 'rat king', 'wanna be pro', 'Jun',
	'blink dagger', 'bkb timing', 'silent', 'Marco', 'ez life', 'no u', 'trust me', 'one more', 'ok boomer',
	'stack pls', 'Shinji', 'tp scroll', 'courier abuser', 'cheese', 'Pikachu', 'muted', 'bottle', 'jungle lord',
	'Sasha', 'Leo', 'eleven', 'nosleep', 'midnight', 'deathball', 'smoke now', 'zzz', 'Tomas', 'lag god',
}

-- n distinct names for `team` (2 or 3). Each team draws from its own half of the list (odd or even
-- entries), so the two teams' bots never share a name.
function PubNames.Pick(n, team)
	local s = (math.floor(RealTime() * 1000) + (team or 0) * 7919) % 2147483646 + 1
	local function nextInt(max)
		s = (s * 16807) % 2147483647
		return (s % max) + 1
	end
	local pool = {}
	for i = 1, #NAMES do
		if i % 2 == (team or 2) % 2 then pool[#pool + 1] = NAMES[i] end
	end
	local out = {}
	for i = 1, math.min(n, #pool) do
		local j = nextInt(#pool)
		out[i] = table.remove(pool, j)
	end
	return out
end

return PubNames
