---
title: How a baseline-vs-new match can be run and recorded
label: wayfinder:research
status: closed
assignee: research subagent (charting session 2026-11-12)
blocked-by: []
---

## Question

What does Dota 2 allow for running one bot script against another in a local lobby, and for capturing the result without watching the whole game?

Find out, from primary sources:

- Whether Radiant and Dire can each be given a different bot script in a custom lobby (for example a local dev script against a Workshop script, or two local folders), and how.
- How fast a bot-only game can be run (`host_timescale`, `sv_cheats`, dedicated-server or `-console` launch options) and whether speed-up changes bot behaviour.
- How a script can record outcomes: what `print` writes to, `-condebug` and `console.log`, whether bot scripts can write files or make HTTP requests, and what end-of-game data (winner, duration, kills, net worth) is reachable from the bot API.
- Whether a game can be started and ended unattended.

Findings go in `research/match-running-and-recording.md`.

## Resolution

Closed 2026-11-12. Full findings: [research/match-running-and-recording.md](../research/match-running-and-recording.md).

- **The game does not load this repo.** It loads `game/dota/scripts/vscripts/bots`, which on this machine is a separate copy with its own `.git` (last changed early October 2026). Verified by listing the folder.
- **Per-team scripts:** the lobby has separate Radiant and Dire bot-script dropdowns (community sources). Local dev script against the Workshop script is plausible but unconfirmed. There is only one local dev slot, so two local versions need one folder that branches on `GetTeam()`.
- **Speed:** `sv_cheats 1` plus `host_timescale N`. No source says whether speed-up changes bot behaviour.
- **Recording:** this codebase silences `print` unless `Utils.DebugMode` is true. The bot API has localhost HTTP and no file-write API. It exposes kills, deaths, assists, level, net worth and game time, but no winner. The server-side scripts see everything; FretBots already builds a match record with the winner at post-game.
- **Unattended runs:** a `dota_bot_practice_*` config can start a game from the console. Full automation is only demonstrated by a 2019 Linux/macOS project.
- **Not confirmed:** 13 items need an in-game check by the human; the list is at the end of the findings file. The Valve wiki, Liquipedia and Steam threads refused automated fetches, so Valve claims are cited indirectly.
