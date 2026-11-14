---
title: How the nine override heroes are protected
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [08-whether-attack-and-laning-are-taken-over-for-every-hero.md]
---

## Question

How do changes to the generic layer avoid regressing the nine heroes that already use `override_generic`?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **With flags off,** they run exactly the baseline (the override files and the shim).
- **With flags on,** they run the same modules as everyone else, with their special cases kept as general hooks. Lone Druid's bear joins engagements as a non-hero unit that never initiates.
- **Every confirm run includes at least three of the nine.** Screens include Io and Lone Druid at least once per stage from stage 2.
- **The `BuggyHeroesDueToValveTooLazy` table is kept** for the flag-off path and is not extended.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 11.2.
