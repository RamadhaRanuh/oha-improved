---
title: How bots pick targets and commit to fights as a team
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [08-whether-attack-and-laning-are-taken-over-for-every-hero.md, 09-where-team-level-coordination-lives.md]
---

## Question

How does the team choose one focus target, decide to engage, hold or disengage, decide who initiates, and how does the scripted attack mode act on that?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **The brain groups nearby enemies into engagements** and computes a kill-speed ratio from allied `GetOffensivePower()` and enemy `GetRawOffensivePower()` against summed health. It counts recently missing enemies at 0.75 weight.
- **States** are engage at a ratio of 1.25 or more and disengage at 0.8 or less, with hold between. Engage has a 3 s minimum dwell. A numbers guard blocks engaging while two or more down unless the ratio is 2 or more.
- **Focus** is `sqrt(rawPower) / time-to-kill` with a skip list. A new target must score 1.3 times the current one to take over. A focus chased for 5 s with little damage done is dropped.
- **The initiator** is the ally with the highest `initiator` weight in `HeroRolesMap`. Followers hold up to 1.5 s until the initiator lands or an enemy is disabled.
- **The attack mode for all heroes** returns `FORCED` or `HIGH` from the engagement state, publishes the focus with `SetTarget`, kites basically when ranged, and keeps the override's hero hooks. Team roam's hero-target branches are disabled under the flag.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 6.
