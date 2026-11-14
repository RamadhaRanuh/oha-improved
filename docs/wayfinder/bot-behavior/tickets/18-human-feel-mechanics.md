---
title: Human-feel mechanics
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [04-what-human-like-looks-like-behaviour-by-behaviour.md]
---

## Question

How are reaction delay, imperfection, variety between games and behaviour with human teammates produced?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **Reaction time:** each bot draws a reaction time of 0.18 to 0.32 s. Reading modules ignore newly seen enemies until it has passed, while the brain stays deterministic.
- **Personality:** a per-bot aggression value of plus or minus 0.1 shifts that bot's engage threshold and its farm desire. Both values are logged with the `MATCHSEED` prefix.
- **No added last-hit errors** beyond Valve's difficulty jitter. **Move throttling** always applies in new code, independent of the flag.
- **With humans:** humans are never the initiator, bots don't take a human core's last hits, and pings are handled as now.
- **Success** is "not worse" on win rate and better on the overall-feel checklist items.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 10.2.
