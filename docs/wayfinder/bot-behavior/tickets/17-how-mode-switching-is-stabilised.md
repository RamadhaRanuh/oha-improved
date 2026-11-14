---
title: How mode switching is stabilised
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [07-record-the-baselines-weaknesses-per-system.md]
---

## Question

How are desires put on one scale, and how is mode thrash prevented?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **A tier table:** `SURVIVE` 0.96, `FORCED` 0.90, `HIGH` 0.75, `MODERATE` 0.50, `LOW` 0.25. New code uses only these, or values between adjacent tiers.
- **Under the `arbiter` flag,** every `GetDesire()` passes through `Arbiter.Finalize`. Legacy values above 1 are compressed into 0.95..0.99 in their original order, and the active mode gets a 0.06 incumbent bonus.
- **A debug thrash counter** gives the baseline rate in Phase 0.
- **Measurement:** the arbiter is screened alone, then confirmed together with laning in stage 1.
- Full design: [spec](../../../specs/smarter-bot-behaviour.md) section 3.2.
