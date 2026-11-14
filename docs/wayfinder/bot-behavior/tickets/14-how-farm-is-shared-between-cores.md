---
title: How farm is shared between cores
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [09-where-team-level-coordination-lives.md]
---

## Question

How is farm divided between bots, and when is farming a far area too dangerous?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **The brain allots one area per core every 10 s,** in position order. Areas are lanes with meeting waves and four jungle areas; enemy jungle is eligible only when it is safe. The score is value minus danger minus distance.
- **Supports** take no lane area while a core is alive. **Danger** rises when enemies were seen nearby, or when 3 or more have been missing for 6 s past the river; farm desire is capped at `LOW` in a dangerous area.
- **A human** counts as holding their current lane.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 9.
