---
title: How push and defend are grouped
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [09-where-team-level-coordination-lives.md]
---

## Question

Who decides when the team groups to push, which lane, how many bots defend, and how do `aba_push` and `aba_defend` take part?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **The brain's group intent** starts a push after a numbers advantage of 2 or more, a won fight (2 or more enemy deaths in 20 s with none of ours), Aegis, or late-game enemy losses. It replaces the 16-minute `StartToPushTime` gate under the flag.
- **It stops the push** when 3 or more enemies are missing past the river, when numbers are even or worse, or after 2 deaths in 10 s.
- **Defenders are assigned by threat:** 1 for a creep wave, 2 for one hero, 3 for two or three heroes, and all for four or more or high ground. The nearest by travel time go, and they gather before engaging.
- **`aba_push` and `aba_defend` keep their lane tactics** and read group and defender intent. Non-members are capped at `LOW`.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 8.
