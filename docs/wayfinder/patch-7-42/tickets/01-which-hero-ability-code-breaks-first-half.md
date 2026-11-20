---
title: Which hero ability code breaks in 7.42 (Anti-Mage to Batrider in the notes)
label: wayfinder:research
status: closed
assignee: agent-01
blocked-by: []
---

## Question

For every hero in `research/data/patchnotes-7.42.md` lines 925-1712 (hero order as in the notes), compare the 7.42 notes and the slot diff (`heroes-pre-7.42.md` vs `heroes-7.42.md`) with `bots/BotLib/hero_<name>.lua`, `FunLib/spell_list.lua`, `FunLib/spell_prob_list.lua` (TS source `typescript/bots/FunLib/spell_prob_list.ts`) and `FunLib/rubick_hero/`. Per hero: what breaks (removed or renamed names, slot shifts that move `sAbilityList` indices and skill builds, targeting or cast-type changes, new abilities with no cast logic, castable things that became passive or the reverse), the fix needed, and severity: **error** (Lua error or nil call), **stall** (skill build or purchase stuck), **misfire** (wrong cast), **missing** (new ability unused). Also list talent replacements where the current `tTalentTreeList` pick now names a different talent, without fixing them. Number-only changes: ignore.

## Resolution

Range is Anti-Mage..Batrider (63 heroes; Chen at line 1713 belongs to ticket 02). No hero in this half fails to load or stalls its skill build; only 4 heroes shifted slots (Juggernaut, Beastmaster, Dazzle, Weaver) and no build indexes the shifted slot differently.
- misfire: Weaver (Scepter ally Time Lapse is now `weaver_time_lapse_ally`, unit target; current ally branch is dead). Soft: Leshrac Nihilism rework (cast type same, logic could be retuned).
- missing: Beastmaster `beastmaster_summon_thunderhide` (Scepter, no target), Dazzle `dazzle_through_the_realm` (Shard, no target), Juggernaut Scepter now on Blade Fury (Swift Slash removed; `abilityD`/ConsiderD is dead code).
- cleanup / verify: Nature's Prophet Curse now passive (dead cast, guarded); Pugna Life Drain may no longer channel (KV ambiguous).
- 18 heroes have talent picks that now name a different talent (listed, no fix).

Findings: [research/hero-abilities-first-half.md](../research/hero-abilities-first-half.md)
