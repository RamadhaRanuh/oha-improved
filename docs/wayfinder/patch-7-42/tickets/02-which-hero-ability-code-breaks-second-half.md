---
title: Which hero ability code breaks in 7.42 (Chen to Spirit Bear, including Abaddon, Lycan, Nyx and Undying, in the notes)
label: wayfinder:research
status: closed
assignee: agent-02
blocked-by: []
---

## Question

Same question as [the first half](01-which-hero-ability-code-breaks-first-half.md), for `research/data/patchnotes-7.42.md` lines 1713-2529 (Chen onward, including Lone Druid's Spirit Bear entry at the end, listed under an unnamed hero id 1961).

## Resolution

There are two Lua errors. Meepo's code still fetches the removed `meepo_megameepo`/`_fling`, so `ConsiderMegaMeepo` indexes nil every tick and Earthbind never casts. Chen's code calls `chen_summon_convert`, which is gone; this was already broken before 7.42, so Holy Persuasion and Divine Favor never cast. Fix Chen by switching to the reworked `chen_zealot` (no-target resurrect).
Misfires: the Lone Druid bear still treats Scepter as "no leash", but the leash is now 1300. Monkey King's Shard Boundless Strike lands on the chaser when he retreats. Brewmaster's Liquid Courage is cast with OnLocation on a unit (pre-existing). Meepo is now Universal, which moves his treads to STR (minor).
New abilities nobody casts: Chaos Knight Armageddon (point), Undying Zombie Bite (unit), Brewmaster fire brewling's Cinder Dash (`brewmaster_fire_pull`, unit + vector), Meepo's Shard Divided We Stand carry and `meepo_fling_release`, the bear's `lone_druid_spirit_bear_summon_druid` (no-target), and Chen's Zealot, anoint and Holy Persuasion self-recall.
No stall: every slot shift in this half (Chaos Knight, Undying, Lycan, Nyx, Meepo, bear) only moves indices 4/5, which no build uses. Twenty talent picks now name a different talent; they are listed without fixes.
Findings: [research/hero-abilities-second-half.md](../research/hero-abilities-second-half.md)
