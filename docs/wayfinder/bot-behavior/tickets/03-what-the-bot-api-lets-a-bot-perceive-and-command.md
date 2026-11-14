---
title: What the bot API lets a bot perceive and command
label: wayfinder:research
status: closed
assignee: research subagent (charting session 2026-11-12)
blocked-by: []
---

## Question

Which signals and commands does the bot API offer for fights, lanes and creeps, and where are the hard limits?

Build an inventory, checked against the `dota2-bot-dev` skill references, `docs/BOT_API_REFERENCE.md` and `bots/API/`:

- Perception: enemy position and last-seen data, incoming projectiles, attack targets and animation timing, creep and tower aggro, lane front, potential-location values, hero power estimates, cooldown and mana visibility for enemies versus allies, vision and fog limits.
- Commands: what a mode can order (move, attack, attack-move, queueing), and what cannot be done (for example orb-walk timing, cancelling backswing).
- Team channels: ways bots on one team can share state (globals, `team_desires`, pings, chat), and what is shared between bots' Lua environments.
- Which of these this codebase already wraps in `jmz_func.lua`, `utils` or `global_cache`, and which API calls are known to be broken or expensive.

Findings go in `research/perception-and-command-inventory.md`.

## Resolution

Closed 2026-11-12. Full findings: [research/perception-and-command-inventory.md](../research/perception-and-command-inventory.md).

- **Fog:** outside vision a bot has only `GetHeroLastSeenInfo`, `GetUnitPotentialValue`, scoreboard facts, visible teleports and the lane-front point.
- **Enemies:** enemy cooldowns are unreadable, `IsIllusion()` is always false on enemies, and `GetOffensivePower()` is teammates-only. The engine's damage estimate assumes enemy abilities are all ready.
- **Aggro:** there is no aggro API. The lane front is one point per team per lane.
- **Radius:** `GetNearby*` is capped at 1600; wider searches mean `GetUnitList` loops (171 call sites, almost uncached).
- **Commands:** move, attack unit, attack-move, cast and clear, in replace/push/queue forms. There is no stop, hold, orb-walk or backswing cancel, and no code here attempts orb-walking.
- **Team channels:** bots coordinate through shared module tables, fields on unit handles, `SetTarget`, pings and chat. That Lua state is shared within a team is relied on by the code but inferred, not documented.
- **Patches in effect:** `aba_global_overrides.lua` changes about 30 API calls. `GetHealth()` returns 666 in fog; `GetLocation()` and `GetNearbyHeroes()` can return nil.
- **`bots/API/*.lua` is untracked and not required anywhere**, so its overrides are not in effect.
- **`docs/BOT_API_REFERENCE.md` contradicts the primary sources in about a dozen places** (tabulated in the findings). Prefer the `dota2-bot-dev` skill references.
- **Not confirmed (need a lobby):** team Lua-state sharing, `GetDesire()` frequency, whether `TeamThink` is still called, `GetLaneFrontAmount` behaviour for Dire and in fog, `GetAttackPoint` units and backswing cancelling, callback payloads, and a claimed 0.65 attack-desire cap. The Valve wiki refused fetches and is cited second-hand.
