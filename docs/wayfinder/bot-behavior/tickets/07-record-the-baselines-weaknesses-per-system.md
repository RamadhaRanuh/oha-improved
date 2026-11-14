---
title: Record the baseline's weaknesses per system
label: wayfinder:task
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [04-what-human-like-looks-like-behaviour-by-behaviour.md, 06-how-baseline-vs-new-matches-are-measured.md]
---

## Question

Human-in-the-loop. Run baseline games using the agreed measurement setup and the human-like checklist, and record what the current bots do badly in each system, with enough detail (game time, hero, what happened, what a human would have done) to turn into design questions.

Resolved when the observations are written down and the checklist is scored for the baseline.

Added after the default-attack-and-laning research: while recording, also watch what Valve's default attack and laning do (using `dota_bot_select_debug` and `dota_bot_select_debug_attack`), and check on one of the nine override heroes whether its laning override actions (Tango use, retreat, harass) ever happen or are cancelled by the lane-front move.

## Resolution

Closed 2026-11-13. **Partly done; the in-game part is carried into the spec as Phase 0.**

- **The code-reading part is done.** [assets/baseline-weaknesses-code-audit.md](../assets/baseline-weaknesses-code-audit.md) lists confirmed weaknesses per system, with lines. The biggest:
  - three separate fight brains (Valve default, the nine-hero override, and team roam's target finders);
  - desires above 1 used as priorities (`1.5`, `ABSOLUTE * 1.1`/`1.5`);
  - the laning shim cancelling the override, and team roam's `1.5` last-hit desire competing with laning;
  - no owner for team decisions;
  - fixed-time pushing.
- **The in-game part was not done.** Only the human can run lobbies, and none ran this session. These now make up spec Phase 0, step "baseline observation":
  - watching baseline games and scoring the checklist for the baseline;
  - observing Valve's default attack and laning with `dota_bot_select_debug` and `dota_bot_select_debug_attack`;
  - checking whether the nine override heroes ever use a Tango, retreat or harass while laning.

  Phase 0 must finish before stage 1 is tuned. If the observations contradict the code audit, the stage order is revisited. The designs do not wait on it.
