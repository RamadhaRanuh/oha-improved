---
title: Whether attack and laning are taken over for every hero
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: [02-what-valves-default-attack-and-laning-do.md, 03-what-the-bot-api-lets-a-bot-perceive-and-command.md]
---

## Question

Should the custom attack mode and laning `Think()` be extended from the nine override heroes to all heroes, replacing Valve's defaults, or should the defaults stay and be steered only through desires and targets?

Covers: full takeover versus partial, whether the existing `override_generic` files are the starting point or are replaced, and what default behaviour would be lost.

Added after the research: the six options are laid out in `research/default-attack-and-laning.md`. Hard limits to design within: no aggro API, no enemy cooldowns, no orb-walk or backswing-cancel command, and a scripted attack mode must call `bot:SetTarget()` itself.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **Option 5: staged takeover behind per-team feature flags,** laning first, then attack. Once a flag is on, it applies to every hero.
- **Laning:** with flag `laning` on, every hero runs one scripted laning `Think()` (`behavior/laning.ts`). It replaces both the shim's `Think()` and the override's, which also removes the fall-through defect. With the flag off, the shim and the override run as in the baseline, defect included, so the baseline stays exact.
- **Attack:** with flag `fight` on, every hero runs a scripted attack mode (`behavior/fight.ts`). Its target is the team brain's focus target, published with `bot:SetTarget()`.
  - Team roam's hero-targeting branches are switched off under this flag, so a hero target has exactly one owner. Those branches are: help a targeted core, help an ally, and hero targets from `CarryFindTarget`/`SupportFindTarget`.
  - Team roam keeps creeps, couriers and special units.
- **The `override_generic` files are not the starting point.** They stay as the flag-off path for the nine heroes. Their useful parts become general hooks in the new modules, for all heroes: the Marci/Muerta ultimate windows, the Pugna/Razor/Helm/Wraith King escapes, the untargetable-state skip list and fog chase.
- **What is lost when on:** whatever Valve's default attack and laning `Think()` do internally. That is unknown, and Phase 0 observes it. Rune pickup, items and other modes are untouched. Creep and tower aggro handling must be re-implemented explicitly; the laning design does that.
- **Rejected:** full takeover through `bot_generic.lua` (option 6), as out of proportion.
