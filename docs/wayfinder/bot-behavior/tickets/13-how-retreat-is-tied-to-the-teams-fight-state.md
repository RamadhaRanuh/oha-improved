---
title: How retreat is tied to the team's fight state
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [12-how-bots-pick-targets-and-commit-to-fights-as-a-team.md]
---

## Question

When does a bot retreat once fights are team decisions, how does it choose a path, and when does it come back?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **`SURVIVE`** fires on projected death (health after 3 s of incoming damage below 15%), or on health below 20% with an enemy within 900.
- **In an `engage` engagement only `SURVIVE` can trigger retreat.** In `disengage`, every participant retreats at `HIGH` together.
- **Otherwise** the baseline retreat logic runs, compressed onto the tier scale.
- **The path** goes to the tower or fountain with the lowest cost, penalising paths that pass near visible or recently seen enemies, re-planned every 0.5 s. **Re-entry** waits for health of 0.55, or 0.40 while regenerating.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 7.
