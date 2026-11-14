---
title: Smarter bot behaviour
label: wayfinder:map
status: closed
---

> **Destination reached 2026-11-13.** The spec is [docs/specs/smarter-bot-behaviour.md](../../specs/smarter-bot-behaviour.md). No tickets remain open. Tickets 04 to 21 were decided on the agent's recommendation, under the human's standing instruction for that session. The in-game half of [Record the baseline's weaknesses per system](tickets/07-record-the-baselines-weaknesses-per-system.md) is carried into the spec as Phase 0.

## Destination

An implementation-ready improvement spec for the generic behaviour layer of the bots: attack/fight, laning, farming, defend, push, retreat, roam/gank and team-level coordination. The spec holds the design decisions per system in priority order, so separate sessions can build it without re-deciding anything. Success is judged two ways: new bots beat the baseline in bot-vs-bot lobbies, and they feel more human to play against.

## Notes

- **Planning only.** Tickets resolve decisions. No behaviour code is written inside this map; implementation happens in separate sessions after the spec exists.
- **Skills every session should consult:** `dota2-bot-dev` (API, constants, architecture references). Grilling tickets also use `grilling` and `domain-modeling`.
- **Repo docs to read first:** `docs/ARCHITECTURE.md` (section 13 lists the TypeScript-generated Lua files). Do not trust `docs/BOT_API_REFERENCE.md` on its own; the perception inventory lists where it contradicts the primary sources.
- **Baseline** means commit `cb814c6` (the last upstream commit, 2026-04-02). The working tree also has uncommitted FretBots edits and untracked files; whether those count as baseline is settled in [How baseline-vs-new matches are measured](tickets/06-how-baseline-vs-new-matches-are-measured.md).
- **Generic behaviour layer** means the `mode_*_generic.lua` files and the `FunLib` modules they call, as opposed to the per-hero files in `BotLib/`.
- **Fair play.** Improvements use the legitimate bot API only. FretBots and Buff server-side scripts are left alone.
- **Upstream.** `origin` is the upstream repo. Work stays mergeable (TypeScript sources updated, existing conventions kept) but is not designed around upstream review. Nothing from this map is pushed.
- **Testing.** Only the human can run Dota lobbies. Any ticket needing in-game evidence is a human-in-the-loop task with a precise checklist.
- **Tracker.** Local markdown; conventions are in [README.md](README.md).

Starting facts, verified in the code on 2026-11-12:

- `bots/mode_attack_generic.lua` is a 20-line shim. Only the nine heroes in `BuggyHeroesDueToValveTooLazy` (`FunLib/utils.lua`) get the custom attack mode in `FunLib/override_generic/mode_attack_generic.lua` (421 lines). Every other hero runs Valve's default attack mode.
- `bots/mode_laning_generic.lua` (271 lines) overrides `GetDesire()` for every hero. Its `Think()` is defined only for the same nine heroes (which also use `FunLib/override_generic/mode_laning_generic.lua`, 260 lines) and for a position-1 bot whose position 5 is a human. Every other hero runs Valve's default laning `Think()`.
- There is no `team_desires.lua`. Team coordination is spread across per-bot modes and `jmz_func.lua` helpers such as `J.IsInTeamFight` and `J.WeAreStronger`.
- Push and defend logic is TypeScript-generated (`aba_push`, `aba_defend`). Farm, retreat, roam and team roam are hand-written Lua.
- A commented-out block in the laning `GetDesire()` tried to stop bots "switching modes too often", which suggests mode thrash is a known problem.

## Decisions so far

<!-- one line per closed ticket: [title](link): gist -->

- [How a baseline-vs-new match can be run and recorded](tickets/01-how-a-baseline-vs-new-match-can-be-run-and-recorded.md): the game loads a separate copy in `vscripts/bots`, not this repo; per-team scripts and speed-up look possible but need in-game checks; results are best recorded server-side or over localhost HTTP, since `print` is silenced and the bot API has no winner call.
- [What Valve's default attack and laning do, and how other scripts replace them](tickets/02-what-valves-default-attack-and-laning-do.md): the defaults are undocumented and must be observed in game; the nine-hero gate is inherited with no stated cause; the laning shim probably cancels its own override every frame; no examined script replaces attack and laning for all heroes inside the mode system; six takeover options are laid out.
- [What the bot API lets a bot perceive and command](tickets/03-what-the-bot-api-lets-a-bot-perceive-and-command.md): no enemy cooldowns, no aggro API, no orb-walk or backswing commands, 1600 radius cap; teams coordinate only through shared Lua tables, unit-handle fields, targets, pings and chat; `docs/BOT_API_REFERENCE.md` is unreliable in about a dozen places; several API behaviours need a lobby check.
- [What human-like looks like, behaviour by behaviour](tickets/04-what-human-like-looks-like-behaviour-by-behaviour.md): a 39-item observable checklist across all systems, scored Yes/Sometimes/No; it is the second success measure.
- [Whether new behaviour code is written in TypeScript or Lua](tickets/05-whether-new-behaviour-code-is-written-in-typescript-or-lua.md): new modules in TypeScript under `FunLib/behavior/`; mode entry files stay thin Lua; no wholesale migration.
- [How baseline-vs-new matches are measured](tickets/06-how-baseline-vs-new-matches-are-measured.md): one tree with per-team feature flags, the game loading the repo through a junction, a standalone server-side recorder, an 8-game screen and a 32-game confirm (22 or more wins), and six Phase 0 lobby checks.
- [Record the baseline's weaknesses per system](tickets/07-record-the-baselines-weaknesses-per-system.md): code audit done (three fight brains, desires above 1, laning shim defect, no team owner); the in-game recording moves to spec Phase 0.
- [Whether attack and laning are taken over for every hero](tickets/08-whether-attack-and-laning-are-taken-over-for-every-hero.md): staged takeover behind flags, laning then attack, for every hero; team roam stops choosing hero targets.
- [Where team-level coordination lives](tickets/09-where-team-level-coordination-lives.md): a deterministic `team_brain.ts` that owns team decisions and works whether or not Lua state is shared; no `team_desires.lua` yet.
- [Which system is designed first](tickets/10-which-system-is-designed-first.md): foundations, laning, fight, retreat, grouping, farm, gank, human feel; milestone 1 ends after fight.
- [How laning works for every hero](tickets/11-how-laning-works-for-every-hero.md): a strict priority list with trade and step-back, wave discipline, and a throttled hold point; laning owns lane creeps.
- [How bots pick targets and commit to fights as a team](tickets/12-how-bots-pick-targets-and-commit-to-fights-as-a-team.md): engagements with a kill-speed ratio and engage/hold/disengage hysteresis, a sticky focus target and an initiator-first entry.
- [How retreat is tied to the team's fight state](tickets/13-how-retreat-is-tied-to-the-teams-fight-state.md): only projected death breaks a committed fight; disengage is collective; retreat paths avoid enemies.
- [How farm is shared between cores](tickets/14-how-farm-is-shared-between-cores.md): the brain allots one area per core every 10 s, with a danger score and supports kept off lanes.
- [How push and defend are grouped](tickets/15-how-push-and-defend-are-grouped.md): event-driven group push replaces the 16-minute gate; defenders are assigned by threat and gather first.
- [How ganks are chosen and called off](tickets/16-how-ganks-are-chosen-and-called-off.md): out-of-position or low targets only, travel-time and power gates, a fog route, abort rules and a cooldown.
- [How mode switching is stabilised](tickets/17-how-mode-switching-is-stabilised.md): one tier scale, legacy values above 1 compressed, and a 0.06 incumbent bonus behind the `arbiter` flag.
- [Human-feel mechanics](tickets/18-human-feel-mechanics.md): a per-bot reaction time and aggression personality, no extra last-hit errors, and deference to human teammates.
- [Performance budget and how it is checked](tickets/19-performance-budget-and-how-it-is-checked.md): structural rules plus a frame-rate comparison in every screen.
- [How the nine override heroes are protected](tickets/20-how-the-nine-override-heroes-are-protected.md): baseline when flags are off, shared modules with hooks when on, and always in the lineups.
- [Shape of the spec and how implementation sessions are scoped](tickets/21-shape-of-the-spec-and-implementation-sessions.md): one spec document, eleven sessions S0a to S8, each with files and a lobby step.

## Not yet specified

Nothing. Every patch graduated into tickets 11 to 21, or was settled by tickets 06 and 09 (the API lobby checks became Phase 0 checks P0-1 to P0-6; the untracked files were ruled out of scope below).

## Out of scope

- Per-hero ability logic in `BotLib/` (128 hero files): a separate, open-ended effort.
- Item builds and item purchase logic.
- Hero picking and banning.
- FretBots and Buff bonus systems.
- Patch upkeep (the codebase was last verified against 7.41a).
- The untracked files in the working tree (`bots/API/`, `aba_synergy.lua`, `FunLib/MinionLib/`, the `Buff/` additions and others): nothing tracked loads them, so they are neither baseline nor part of this effort. Ruled out in [How baseline-vs-new matches are measured](tickets/06-how-baseline-vs-new-matches-are-measured.md).
