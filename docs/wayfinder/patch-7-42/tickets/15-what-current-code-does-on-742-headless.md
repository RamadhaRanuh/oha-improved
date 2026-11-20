---
title: What the current code does on 7.42, headless
label: wayfinder:task
status: closed
assignee: orchestrator
blocked-by: [06-update-the-headless-dota-install-to-742.md]
---

## Question

Play the unpatched code (`smarter-bot-behaviour` HEAD `c3389e8`, flags `none`) on the updated headless 7.42 with the 40 heroes the patch touches most, and record what actually fails: Lua runtime errors per hero file, purchase failures (`未能购买物品`), ability-list warnings from `aba_skill.lua`, skill points left unspent, and abilities that never appear in `CAST` lines. This turns the audits' predictions into observed facts for [How each broken hero ability is handled](11-how-each-broken-hero-is-handled.md) and [How the 7.42 update is verified before the lobby](14-how-the-update-is-verified.md).

Lineups (pairs 5-8 of `docs/specs/measurement-lineups.md` swapped for these four games only, then restored):

| Game | Radiant | Dire |
|---|---|---|
| 17 | juggernaut, leshrac, chaos_knight, undying, dazzle | luna, death_prophet, beastmaster, pugna, chen |
| 21 | morphling, zuus, brewmaster, nyx_assassin, lich | weaver, tinker, doom_bringer, furion, abaddon |
| 25 | meepo, nevermore, sand_king, monkey_king, techies | lone_druid, kunkka, lycan, bounty_hunter, pudge |
| 29 | life_stealer, muerta, broodmother, mirana, oracle | skeleton_king, invoker, mars, rubick, disruptor |

## Resolution

Done 2026-11-20, four games, all `smokecheck` PASS (no logged runtime errors), findings in [research/pre-patch-smoke.md](../research/pre-patch-smoke.md). Confirmed: Overlord stalls Lycan and Beastmaster, Khanda stalls Morphling and Tinker, Meepo never Earthbinds, Chen never casts Holy Persuasion; Beastmaster also stops spending skill points at level 10 because Inner Beast is innate (since before 7.42, missed by both audits). Not confirmed: the Weaver misfire. Two lessons for verification: hero-file errors are swallowed, so judge heroes by casts, levels and inventory change, not by `smokecheck` alone; and the engine gives bots neutral items without Buff or FretBots.
