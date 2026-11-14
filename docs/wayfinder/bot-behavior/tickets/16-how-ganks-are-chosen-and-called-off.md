---
title: How ganks are chosen and called off
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [09-where-team-level-coordination-lives.md]
---

## Question

Which enemy is ganked, by whom, by what route, and when is a gank abandoned?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **Target:** a visible enemy in a lane with one of our laners, that is low on health or out of position (more than 600 past its lane front and more than 2500 from its tower).
- **Gankers:** position 4, position 5 after laning, or position 2 with a power rune. A ganker commits within 15 s of travel (25 s with TP or twin gate) at a power ratio of 1.5 or more.
- **The route** goes through the river or jungle, at least 900 from the lane front. **Abort** if the target is unseen for 4 s, back near its tower and healthy, or our laner died. Each ganker has a 30 s cooldown.
- **Only `CheckLaneToGank` is replaced.** The rest of `mode_roam_generic.lua` is untouched.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 10.1.
