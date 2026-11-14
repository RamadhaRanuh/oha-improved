---
title: Performance budget and how it is checked
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [03-what-the-bot-api-lets-a-bot-perceive-and-command.md, 09-where-team-level-coordination-lives.md]
---

## Question

How much per-frame work may new logic add, and how is that checked when the bot API has no reliable wall-clock timer?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **Structural rules instead of a millisecond budget:**
  - no `GetUnitList` per call (use `global_cache` with a TTL of 0.25 s or more);
  - brain updates at most 4 times a second;
  - `Think()` linear in units within 1600, with no hero-by-hero loops;
  - move and attack re-issue throttles;
  - respect `Customize.ThinkLess`.
- **The check** is the human noting frame rate with all flags on against all off in each screen. A drop over 10%, or an unstable timescale, blocks the stage.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 11.1.
