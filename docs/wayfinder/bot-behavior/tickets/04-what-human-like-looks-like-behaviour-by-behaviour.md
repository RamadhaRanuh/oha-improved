---
title: What human-like looks like, behaviour by behaviour
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: []
---

## Question

Which specific, observable behaviours make a bot feel human and sophisticated in each system, and which current behaviours feel most bot-like?

The outcome is a checklist per system (attack/fight, laning, farming, defend, push, retreat, roam/gank, team coordination) where every item can be ticked or not by watching a game. It becomes the second success measure next to win rate, and it tells the baseline recording what to look for.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **The checklist** is in [assets/human-like-checklist.md](../assets/human-like-checklist.md): 39 observable items across attack/fight, laning, farming, defend, push, retreat, roam/gank, team coordination and overall feel. Items marked "(tell)" are bot-like behaviours that should be absent.
- **Scoring:** each item is scored Yes, Sometimes or No for the team under test. It is scored for the baseline in Phase 0, and again after each stage's confirmation run, in at least one human-played game and from replays of bot-only games.
- **The most bot-like current behaviours,** from the code audit: inconsistent focus fire (three separate fight brains), solo bots leaving or entering fights alone (no team commit), waves pushed into the enemy tower, movement jitter at the lane front (moves re-issued every 0.05 to 0.2 s), and fixed-time pushing.
- Reaction delay and game-to-game variety are on the checklist as "overall feel". How they are produced is decided in [Human-feel mechanics](18-human-feel-mechanics.md).
