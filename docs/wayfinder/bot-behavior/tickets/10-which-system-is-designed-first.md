---
title: Which system is designed first
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [07-record-the-baselines-weaknesses-per-system.md, 08-whether-attack-and-laning-are-taken-over-for-every-hero.md]
---

## Question

Given the recorded baseline weaknesses and the takeover decision, in what order are the systems designed and built?

Covers: the ranking rule (biggest win-rate effect, most visible bot-like behaviour, or lowest risk first), which systems depend on others, and where the first version of the spec stops.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **Ranking rule:** expected win-rate effect divided by risk, subject to dependencies. Human feel breaks ties.
- **Order:**
  - **Stage 0:** foundations. Feature flags, the recorder, the team-brain skeleton and the desire tiers, then the Phase 0 checks and baseline observation.
  - **Stage 1:** laning.
  - **Stage 2:** fight (focus target, team commit and disengage, scripted attack mode).
  - **Stage 3:** retreat, coupled to fight state.
  - **Stage 4:** push and defend grouping through the brain.
  - **Stage 5:** farm allotment.
  - **Stage 6:** roam and gank.
  - **Stage 7:** the human-feel layer, under its own flag.

  Mode arbitration (incumbent bonus and desire tiers) lands in stage 0. Each later stage maps its mode onto the tiers.
- **Why this order:**
  - Laning is self-contained, has a known defect and shapes the whole game.
  - Fight has the biggest effect, but needs the brain and arbitration first.
  - Retreat only makes sense once fight commitment exists.
  - Grouping, farm and gank all read the brain and matter later in the game.
- **Where the first version of the spec stops:** it holds decisions for every stage. The first implementation milestone ends after stage 2's confirm run. Stages 3 to 7 are specified to the same level, but their initial numbers are expected to change after the stage 2 results.
