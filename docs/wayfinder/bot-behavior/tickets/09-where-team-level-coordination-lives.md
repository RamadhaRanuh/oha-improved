---
title: Where team-level coordination lives
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [03-what-the-bot-api-lets-a-bot-perceive-and-command.md, 05-whether-new-behaviour-code-is-written-in-typescript-or-lua.md]
---

## Question

Where do team-level decisions (who fights, who farms, which lane is pushed or defended, when to group) get made and stored: a new `team_desires.lua`, a shared team-state module read by every mode, or the current spread across per-bot modes?

Covers: one owner for team state or several, how bots read it, and how it relates to the existing caches in `aba_push`, `aba_defend` and `global_cache`.

Added after the perception inventory: the answer leans on Lua state being shared within a team, which the current code relies on but no source documents, and on whether `TeamThink` is still called by the client. Both need a lobby check; decide here whether that check comes first.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **A new team-state module, `behavior/team_brain.ts`, is the single owner of team decisions:** the focus target and fight state per engagement, group intent (push lane, defend assignments, whether to group), farm allotment and the gank target. Modes read it and do not decide these things themselves.
- **It works whether or not Lua state is shared.** The brain is a pure function of inputs every bot on the team can read: visible units, last-seen info, allied modes, targets and health.
  - It is memoised per team in 0.25 s time buckets based on `DotaTime()`.
  - If state is shared, the first bot to call in a bucket computes it and the others reuse it. If each bot has its own sandbox, each computes the same answer, at about five times the cost.
  - Commitment timers are stored as start times keyed by stable ids (enemy player id, lane), so separate computations converge.
- **No `team_desires.lua` in the first version.** Its vocabulary is fixed (lanes, one roam target, Roshan), and whether `TeamThink` is called is unconfirmed. If P0-6 confirms `TeamThink` and P0-2 confirms shared state, the brain's update may later be driven from `TeamThink`, as a performance change only.
- **Relation to existing caches:** the brain uses `global_cache` for unit lists. `aba_push` and `aba_defend` keep their own caches and lane tactics. From stage 4 they read group intent from the brain instead of each bot computing lane desire alone.
- **The lobby check does not block design.** It runs in Phase 0 (P0-2, P0-6), alongside the measurement checks.
