---
title: Shape of the spec and how implementation sessions are scoped
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [10-which-system-is-designed-first.md, 11-how-laning-works-for-every-hero.md, 12-how-bots-pick-targets-and-commit-to-fights-as-a-team.md]
---

## Question

Is the spec one document or one per system, where does it live, and how is each implementation session scoped and verified?

Graduated from the map's "Not yet specified" section on 2026-11-13.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **One document,** `docs/specs/smarter-bot-behaviour.md`, outside the wayfinder folder so it outlives the map. It has one section per stage, and links each decision to its ticket.
- **Eleven implementation sessions** (S0a, S0b, S1 to S8), each with named files. Each ends with the build passing, the flag-off paths reviewed as unchanged, and a lobby checklist for the human. Milestone 1 ends after S3's confirm run.
- **Measurement results** go to `docs/specs/results/<stage>.jsonl`. **Lineups** go to `docs/specs/measurement-lineups.md`, written in S0a.
- The spec: [docs/specs/smarter-bot-behaviour.md](../../../specs/smarter-bot-behaviour.md).
