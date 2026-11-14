---
title: How laning works for every hero
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [08-whether-attack-and-laning-are-taken-over-for-every-hero.md, 05-whether-new-behaviour-code-is-written-in-typescript-or-lua.md]
---

## Question

What does the scripted laning `Think()` that every hero runs under the `laning` flag do: priorities, last-hit and deny timing, trading, creep and tower aggro, wave discipline and positioning?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **A strict priority list** in `behavior/laning.ts`: consumables, then danger back-off (2 s incoming damage above 35% of current health), tower-aggro drop, last hit (ranged, then flagbearer, then melee; a support yields to a core within 800), deny, trade with a step-back to release creep aggro, wave discipline (never hit a creep that is not a last hit or deny), then hold position.
- **Laning owns lane creeps during the laning phase.** The shim's `0.9` and team roam's `1.5` last-hit desires are switched off under the flag.
- **Hold point** is our lane front moved back by `max(ownRange, 250, longestEnemyRange)` plus a role offset, shifted 320 sideways when a lane partner is close. **Safe point** is 1200 behind the front. Moves are throttled to stop jitter.
- **The flag-off path keeps the baseline,** fall-through defect included.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 5.
