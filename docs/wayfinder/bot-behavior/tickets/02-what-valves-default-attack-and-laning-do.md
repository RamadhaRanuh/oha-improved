---
title: What Valve's default attack and laning do, and how other scripts replace them
label: wayfinder:research
status: closed
assignee: research subagent (charting session 2026-11-12)
blocked-by: []
---

## Question

Most heroes here run Valve's default attack mode and default laning `Think()`. What do those defaults actually do, what are their known weaknesses, and how have other public bot scripts replaced them?

Find out:

- What is documented or reliably observed about the default attack and laning behaviour (target choice, when attack desire rises, last-hitting, harassing, tower aggro, what it ignores).
- Why this repo's nine `BuggyHeroesDueToValveTooLazy` heroes needed overrides, and what the two files in `bots/FunLib/override_generic/` do differently from the default.
- How other well-known public bot scripts structure attack and laning (full mode takeover, per-hero files, team-level state), with links to the code.
- Any known cost of taking over a mode for all heroes (performance, lost default behaviour such as pathing or creep-aggro handling).

Findings go in `research/default-attack-and-laning.md`.

## Resolution

Closed 2026-11-12. Full findings: [research/default-attack-and-laning.md](../research/default-attack-and-laning.md).

- **Valve's defaults are undocumented.** Only the mechanics are documented (fallback to C++, `GetDesire()` about every 300 ms, `Think()` every frame, debug overlays). Target choice, harass and aggro handling can only be learned by watching with `dota_bot_select_debug` and `dota_bot_select_debug_attack`.
- **The nine-hero gate is inherited** from upstream `ryndrb/dota2bot`. No source states why those heroes break, or whether they still do on 7.41a.
- **Likely defect in the laning shim.** `bots/mode_laning_generic.lua:200-214` calls the override's `Think()` without returning, then always issues a lane-front move. The code path is confirmed by reading it; that it cancels the override's Tango use, retreat, tower-aggro drop and harass every frame is inferred, not seen in game.
- **Attack override scoring.** Full-health enemies score 0, so the opening target falls to a weakest-unit fallback. `J.GetBestTeamTarget` and `J.ScoreEnemyTarget` have no callers outside `jmz_func.lua`.
- **Other scripts.** Three of five examined keep Valve's `Think()` and tune desires only; two abandon the mode system for a full takeover. None replaces attack and laning for all heroes inside the mode system.
- **Takeover costs.** One full-takeover script documents losing bounty-rune pickup. A scripted attack mode must call `bot:SetTarget()` itself, because 168 files read the target through `J.GetProperTarget`. Per-frame cost at ten bots is unmeasured.
- The findings end with six takeover options and their trade-offs, without picking one.
- **Not covered:** the Valve wiki refused fetches (cited second-hand); three other bot projects were not read.
