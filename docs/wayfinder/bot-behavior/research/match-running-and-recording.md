# Match running and recording

Research for [How a baseline-vs-new match can be run and recorded](../tickets/01-how-a-baseline-vs-new-match-can-be-run-and-recorded.md). Researched 2026-11-12.

## How to read this file

Every claim carries one of three labels:

- **[Confirmed]**: read directly in a primary source (this repo's code, Valve-shipped files in the local install, first-party API docs, or the source code of a tool that does the thing). File path and line, or a link, is given.
- **[Community]**: stated by a bot-script author or other community source, not verified against a primary source.
- **[Unconfirmed]**: no source found, or sources conflict. Needs an in-game check by the human. These are collected as a checklist in the section "In-game checks needed".

Two source limits to know about:

- The Valve Developer Community page "Dota Bot Scripting" refused automated fetches (HTTP 403) during this research. Statements attributed to it come from the local digest at `~/.claude/skills/dota2-bot-dev/references/architecture.md` and from search-result excerpts, so they are labelled **[Confirmed, indirect]**. The page is <https://developer.valvesoftware.com/wiki/Dota_Bot_Scripting>.
- Liquipedia's console command list and two Steam Workshop threads also refused fetches (403 and 429). Nothing in this file relies on them.

## Summary

- Each team has its own bot-script dropdown in the lobby, so "Local Dev Script" against a Workshop script is plausible but nobody has been found confirming a mixed setup works today. There is only one local dev folder, so "two local folders" is not possible as such.
- The game does not load this repo. It loads `game/dota/scripts/vscripts/bots`, which on this machine is a separate plain copy, not a link to the repo.
- Speed-up is `sv_cheats 1` plus `host_timescale N`. One bot author also sets `host_force_frametime_to_equal_tick_interval 1` first. No source says whether speed-up changes bot behaviour.
- `print` goes to the console, but this codebase silences `print` unless a debug flag is on. Console-to-file needs a launch option. Bot scripts can make HTTP requests to localhost. No file-writing API was found.
- The bot API exposes kills, deaths, assists, level, game time and game state for any player, and net worth for a bot handle. It has no "who won" function. The server-side script VM (what FretBots runs in) can see everything, including the winner.
- A game can be started from a config file without clicking through the lobby UI. A fully unattended start-to-finish loop is only demonstrated by a Linux/macOS tool from 2019.

## 1. Giving Radiant and Dire different scripts

### Where the game loads scripts from

- **[Confirmed, indirect]** Valve: in-development scripts live in `game/dota/scripts/vscripts/bots` inside the Dota 2 install; Workshop scripts are downloaded to their own location. (`architecture.md` section 2, digest of the Valve page.)
- **[Confirmed]** On this machine `game/dota/scripts/vscripts/bots` is an ordinary directory (no link type, no target), with files dated 2026-10-02 to 2026-10-04. The repo lives next to it at `game/dota/scripts/dota2bot-OpenHyperAI`. So the working tree the map calls "baseline" or "new" is **not** what a lobby runs until it is copied or linked into `vscripts/bots`. (Checked with a directory listing on 2026-11-12.)
- **[Confirmed]** Workshop item `3246316298` (Open Hyper AI) is not present under `steamapps/workshop/content/570/` on this machine, so the Workshop version is not currently subscribed or downloaded.
- **[Confirmed]** Upstream's install guide links the Workshop folder to the dev folder with `mklink /d "<...>\vscripts\bots" "<...>\workshop\content\570\3246316298"`, which shows a directory link is an accepted way to fill the dev slot. (<https://github.com/forest0xia/dota2bot-OpenHyperAI/discussions/68>, Appendix, Option 1.)

### Per-team selection in the lobby

- **[Community]** The lobby settings have separate "Radiant Bots" and "Dire Bots" dropdowns, each of which can be set to "Local Dev Script". (`bots/README.md` line 23, which is the ryndrb "Tinkering ABo(u)t" README; also upstream discussion 68, step 5.)
- **[Community]** Server Location must be "Local Host" for custom scripts to run at all. (`README.md` line 5 and line 29; `bots/README.md` line 14 and line 25.)
- **[Community]** The ryndrb README says of setting both dropdowns to Local Dev Script: "It's meant to play itself as it's built that way." (`bots/README.md` line 24.) So the common, known-working setup is the same script on both sides.
- **[Community]** Search results surfaced Steam Workshop comments saying Dire does not always behave like Radiant with custom scripts ("works only for Radiant"). The threads could not be opened to check date or context.
- **[Unconfirmed]** Whether one team on "Local Dev Script" and the other on a subscribed Workshop script both load correctly in the same Local Host lobby. The dropdowns allow it; no source was found that reports doing it.
- **[Unconfirmed]** Whether the two teams run in separate Lua states. This matters for any plan where one script folder behaves differently per team.

### Two local versions at once

- **[Confirmed, indirect]** There is one dev slot (`vscripts/bots`). No source describes a second local slot.
- **[Confirmed]** The bot API has `GetTeam()`, which returns the team the running script belongs to. (<https://docs.moddota.com/lua_bots/>; `docs/BOT_API_REFERENCE.md`.) The Valve-shipped example `vscripts/bots_example/hero_selection.lua` lines 10 and 18 branches on team ("selecting radiant" / "selecting dire").
- **[Confirmed]** Scripts load other files by path with `dofile(GetScriptDirectory() .. "/...")` and `require(GetScriptDirectory() .. "/...")`; the repo does this throughout, for example `bots/mode_attack_generic.lua` line 13.
- Taken together, these make a single dev folder that holds two code trees and picks one by `GetTeam()` technically possible. **[Unconfirmed]** that it works cleanly: `require` caching and globals (this repo overrides several globals in `bots/FunLib/aba_global_overrides.lua`) could leak between the two trees if both teams share one Lua state.

### Console-started games and script choice

- **[Confirmed]** Upstream documents a config that starts a bot game from the console and names the script by Workshop ID: `dota_bot_practice_script 3246316298`, with `dota_bot_practice_gamemode`, `dota_bot_practice_difficulty`, `dota_bot_practice_start 1`, `sv_lan 1`, `map dota`. (<https://github.com/forest0xia/dota2bot-OpenHyperAI/discussions/135>.)
- **[Unconfirmed]** What value of `dota_bot_practice_script` selects the local dev script, and whether that convar can differ per team. The discussion sets a single ID.

## 2. Running a bot-only game fast

- **[Community]** The ryndrb author's own test routine: Bots v Bots, Enable Cheats in the lobby, then in console `sv_cheats 1`, `host_force_frametime_to_equal_tick_interval 1`, `host_timescale 4` (and `host_timescale 0` to pause). (`bots/README.md` lines 36 to 42.)
- **[Confirmed]** Upstream's guide says the console is opened by adding `-console` to the Steam launch options, and that cheats-gated commands need "Enable Cheat" ticked in the lobby and `sv_cheats 1`. (Discussion 68, section 2.)
- **[Confirmed]** A third-party headless runner, dotaservice, passes `+host_timescale <n>` and `+sv_cheats 1` on the command line, and adds `-dedicated` and `-fill_with_bots` for server mode. It forces `host_timescale` back to 1 whenever the game is not in dedicated mode. (<https://github.com/TimZaman/dotaservice/blob/master/dotaservice/dotaservice.py>, lines 106 to 108 and 242 to 273.) Its README lists macOS and Ubuntu only, and it dates from 2018 to 2019, so it shows the flags existed, not that they work on today's Windows client.
- **[Confirmed, indirect]** Valve: mode `Think()` runs every frame while active and `GetDesire()` runs about every 300 ms. (`architecture.md` section 3.)
- **[Unconfirmed]** Whether speed-up changes bot behaviour. No source measures it. The risk is real in principle: logic that runs once per frame gets fewer runs per game-second if the frame rate cannot keep up with the faster clock. The ryndrb author's use of `host_force_frametime_to_equal_tick_interval 1` before speeding up suggests it is there to keep simulation steps fixed, but the README does not say so.
- **[Confirmed]** This repo's bot code does not use `RealTime()` anywhere except an API stub comment (`bots/API/api_global.lua`), so wall-clock timers are not a source of drift here. Timers use `DotaTime()` and `GameTime()`, which follow the game clock.
- **[Unconfirmed]** The highest timescale this machine sustains with ten scripted bots. Local Host uses the player's own computer as the server, and the ryndrb README warns of FPS issues even at normal speed (`bots/README.md` line 35).
- **[Unconfirmed]** Whether `-dedicated` works on the Windows client with bot scripts.

## 3. Recording outcomes

### What `print` does

- **[Confirmed]** Valve's shipped example scripts use plain `print(...)` for output. (`vscripts/bots_example/hero_selection.lua` lines 10 and 18.)
- **[Confirmed]** This codebase replaces the global `print` with a version that returns immediately unless `Utils.DebugMode` is true. (`bots/FunLib/aba_global_overrides.lua` lines 72 to 84.) `DebugMode` is `false`. (`bots/FunLib/utils.lua` line 705; this file is TypeScript-generated, source `typescript/bots/FunLib/utils.ts`.) The original function is kept in a file-local `orig_print` and is not exported.
- **[Confirmed]** FretBots does the same on the server side with its own flag. (`bots/FretBots/Debug.lua` lines 2 and 9 to 22.)
- Consequence: any recording that relies on `print` must either turn the debug flag on (which also releases every other debug print in the codebase) or keep its own reference to the original `print`.

### Getting console output into a file

- **[Confirmed]** dotaservice launches Dota with `-con_logfile scripts/vscripts/bots/console.log -con_timestamp -console` and then reads that file, noting the log can be split into `console.<n>.log`. (`dotaservice.py` lines 59 to 60, 180 to 208, 246 to 248.) This is Linux/macOS, 2018 to 2019.
- **[Community]** `-condebug` is used as a Dota 2 launch option (it appears in a posted Dota 2 command line). For Counter-Strike 2, guides give the output as `game/csgo/console.log`; by analogy Dota's would be `game/dota/console.log`. No source confirms the Dota path.
- **[Confirmed]** There is no `console.log` in `game/dota/` on this machine today, so neither option is currently in use here.
- **[Unconfirmed]** Which of `-condebug` and `-con_logfile` works on the current Windows client, and where the file lands.

### File writing and HTTP from a bot script

- **[Confirmed]** The bot API lists `CreateHTTPRequest(cstring)` ("aimed at localhost") and `CreateRemoteHTTPRequest(cstring)` ("aimed at a remote host"). (<https://docs.moddota.com/lua_bots/>; `docs/BOT_API_REFERENCE.md` lines 934 to 941.)
- **[Confirmed]** This repo already wraps it: `bots/ts_libs/utils/http_utils/http_req.lua` builds a request with `CreateRemoteHTTPRequest(url)`, sets a JSON body with `SetHTTPRequestRawPostBody`, and sends with a callback (lines 34 to 57). Its base URL is `http://127.0.0.1:5000/` (line 59). Callers exist in `bots/FunLib/utils.lua` lines 1395 to 1408 (`QueryCounters`, `InitiStats`).
- **[Unconfirmed]** Whether those HTTP calls still succeed in the current client. The code exists; nothing found shows it running.
- **[Confirmed]** No file-writing function is listed in the bot API (the moddota page lists none), and nothing in `bots/` calls `io.open`.
- **[Unconfirmed]** Whether Lua's `io` and `os` libraries exist in the bot script environment. `package.path` does exist (`aba_global_overrides.lua` line 4 reads it), which hints that the sandbox is not minimal, but that is not evidence for `io`.

### End-of-game data reachable from the bot API

All **[Confirmed]** as listed in <https://docs.moddota.com/lua_bots/> and `docs/BOT_API_REFERENCE.md`:

| Data | Call | Notes |
|---|---|---|
| Kills, deaths, assists | `GetHeroKills(id)`, `GetHeroDeaths(id)`, `GetHeroAssists(id)` | By player ID, any player |
| Level | `GetHeroLevel(id)` | By player ID |
| Game clock | `DotaTime()` | Follows the in-game clock |
| Game phase | `GetGameState()` | Constants include `GAME_STATE_GAME_IN_PROGRESS` and `GAME_STATE_POST_GAME` (`BOT_API_REFERENCE.md` lines 1872 to 1876) |
| Net worth, last hits, denies | `bot:GetNetWorth()`, `bot:GetLastHits()`, `bot:GetDenies()` | Methods on a unit handle |
| Buildings | `GetAncient(team)`, `GetTower(team, n)`, `GetBarracks(team, n)` | Returns a handle |
| Player lists | `GetTeamPlayers(team)`, `IsPlayerBot(id)` | This repo overrides `GetTeamPlayers` (`aba_global_overrides.lua` lines 15 to 70) |

Gaps:

- **[Confirmed]** There is no winner or game-end function in the bot API.
- **[Unconfirmed]** Whether bot scripts still get `Think()` calls once the state is `GAME_STATE_POST_GAME`. If not, a bot script cannot observe the final moment and would have to log periodically and infer the winner from the last record (for example ancient health).
- **[Unconfirmed]** Whether a bot can read the enemy team's net worth. The API is restricted so units in fog cannot be queried (Valve, via `architecture.md` section 1). Enemy kills, deaths and level are by player ID and should not depend on vision.

### End-of-game data from the server-side VM

- **[Confirmed]** Scripts loaded with `script_reload_code` (which needs `sv_cheats 1`) run in the game-rules VM, not the bot sandbox. FretBots is loaded this way: `sv_cheats 1; script_reload_code bots/fretbots`. (Discussion 68, section 2; `bots/FretBots.lua` line 1 uses `GameRules:State_Get()`.)
- **[Confirmed]** In that VM FretBots already gathers a full match record at game end: it registers a listener for `DOTA_GAMERULES_STATE_POST_GAME` (`bots/FretBots/Settings.lua` lines 1113 to 1123), builds per-player kills, deaths, assists, net worth, level and hero, plus `winning_team` and `time_passed` (`bots/FretBots/Utilities.lua` lines 671 to 702), and learns the loser from the destroyed `npc_dota_fort` (`bots/FretBots/GameState.lua` lines 51 to 53).
- **[Confirmed]** It then sends that record by HTTP POST with `CreateHTTPRequest("POST", url)`. (`bots/FretBots/Chat.lua` lines 28 to 59; `Settings.lua` line 1099.) A commented-out line shows a localhost target was used during development (`Chat.lua` line 31).
- So a server-side script can produce exactly the record the measurement needs, and can print it or POST it to a local listener. Two cautions: FretBots itself gives bots bonuses, so it must stay off in measurement games; and its end-of-game POST goes to a remote server and includes Steam IDs (`Utilities.lua` lines 682 and 694).

### The engine's own win line and replays

- **[Confirmed]** dotaservice finds the winner by searching the console log for the engine line `good guys win = <0|1>` (1 is Radiant). (`dotaservice.py` `RE_WIN`, line 67, and lines 210 to 226.)
- **[Unconfirmed]** Whether the current client still prints that line.
- **[Confirmed]** The local install has `game/dota/cfg/lan_server.cfg` containing `tv_dota_auto_record 1` and `tv_enable 1`; dotaservice also passes `+tv_autorecord 1` and collects the resulting demo file. **[Unconfirmed]** whether a Local Host bot lobby writes a replay automatically and where.

## 4. Starting and ending a game unattended

- **[Confirmed]** Start without the lobby UI: `exec <file>.cfg` with the `dota_bot_practice_*` convars and `map dota` starts a game immediately. (Discussion 135.) The same discussion mentions `dota_bot_practice_team` (0 Radiant, 1 Dire, 2 random) "to control the team you want to be", which implies the human is placed on a team in this flow.
- **[Unconfirmed]** Whether that flow can produce a ten-bot game with the human only watching. In a lobby the human can leave both teams empty and tick "fill empty slots with bots" (a Steam comment surfaced in search says this); the config route was not shown doing that.
- **[Confirmed]** Fully unattended start and finish has been done: dotaservice starts a dedicated server with `-dedicated -fill_with_bots +map start gamemode <n> +sv_lan 1`, watches the log for the win line, then closes the process itself. (`dotaservice.py` lines 267 to 273, 210 to 226, 310 onward.) Linux/macOS, 2018 to 2019, and it drove bots through a socket interface, not Workshop-style scripts alone.
- **[Unconfirmed]** What happens on the Windows client after the ancient falls in a Local Host lobby: whether the game returns to the menu by itself or waits on the post-game screen until someone clicks. No source found.
- **[Unconfirmed]** Whether launch options can chain "start game, run to the end, quit" on Windows (for example `+exec` at launch and an external script that kills the process once the result is logged).
- A human limit sits on top of all this: the map states only the human can run Dota lobbies, so "unattended" at best means "start it and walk away", not "an agent runs it".

## In-game checks needed

A checklist for the human. Each is a few minutes in a Local Host lobby with cheats enabled.

1. **Mixed scripts.** Subscribe to the Workshop item, set Radiant Bots to "Local Dev Script" and Dire Bots to the Workshop script (then swap). Do both teams show the expected name suffix and behave as scripted?
2. **Console log to file.** Launch with `-console -condebug`. After a game, is there a `console.log` under `game/dota/`? If not, try `-con_logfile <relative path>`.
3. **Print reaches the log.** With `DebugMode` on (or a one-line test print that bypasses the override), does a bot-script `print` appear in that file? Does it appear for both teams?
4. **Win line.** After a finished game, search the log for `good guys win`.
5. **Post-game thinking.** Print `GetGameState()` once a second from a bot script. Does output continue after the ancient falls, and does it reach `GAME_STATE_POST_GAME`?
6. **Sandbox libraries.** From a bot script, print `tostring(io)`, `tostring(os)`.
7. **Localhost HTTP.** With any listener on `127.0.0.1`, does `CreateHTTPRequest` or `CreateRemoteHTTPRequest` from a bot script deliver a request?
8. **Enemy net worth.** From a Radiant bot, call `GetNetWorth()` on a Dire hero handle that is in fog. Value, nil or error?
9. **Speed.** Ten bots, `sv_cheats 1`, `host_force_frametime_to_equal_tick_interval 1`, then `host_timescale` 2, 4, 8. Note the highest value where the frame rate stays steady, and whether bots visibly misbehave (missed last hits, late spells, standing still).
10. **Speed fidelity.** Same hero line-up at timescale 1 and at the chosen speed, a few games each. Are game length and kill totals in the same range?
11. **End of game.** After the ancient falls with no human on a team, does the client stay on the post-game screen? Does a replay file appear?
12. **Console start.** Does `exec` of a `dota_bot_practice_*` config give ten bots, and what value of `dota_bot_practice_script` means the local dev script?
13. **Server-side script.** Does `script_reload_code bots/<some file>` load a small standalone script in a bot-only lobby, and can it read `PlayerResource` at post-game?

## What this means for the measurement decision

The realistic options, from least to most setup. They can be combined.

1. **Same script on both sides, compared across games.** Run baseline-vs-baseline and new-vs-new sets (or each against Valve's default bots) and compare aggregate stats. Needs nothing unconfirmed except recording. Weakness: it never puts new against baseline directly, so "new beats baseline" is inferred, not observed.
2. **Local Dev Script against the Workshop script.** Gives a true head-to-head if check 1 passes. Weakness: the Workshop version is whatever upstream last published, not necessarily commit `cb814c6`, and it is outside the human's control.
3. **One dev folder holding both trees, chosen by team.** A true head-to-head with an exact baseline. Needs a loader layer at the root of `vscripts/bots` and depends on the teams not sharing Lua state (check 1 and check 3 give hints). This is the most engineering and the most likely to hide subtle cross-contamination.
4. **Sides must be swapped in any head-to-head.** Radiant and Dire are not symmetric, and community reports say custom scripts can behave differently on Dire, so each pairing needs games both ways round.

For recording, in rising order of effort:

- **A. Read it off the screen.** The human notes winner, duration and score from the post-game screen. Zero code, works today, slow.
- **B. Bot-script logging to the console log.** A periodic summary line through an un-silenced `print`, captured with `-condebug` or `-con_logfile`. Depends on checks 2, 3 and 5. Limited to what the bot API sees (no winner function; enemy net worth uncertain).
- **C. Server-side recorder script.** A small standalone script loaded with `script_reload_code`, modelled on what FretBots already does at post-game, printing or POSTing one JSON record per game. Sees everything, including the winner. Needs cheats on (already required for speed-up) and one console command per game. The map says FretBots and Buff are left alone; a separate recorder file would not touch them, but the decision ticket should say whether it counts as acceptable tooling.
- **D. Localhost HTTP collector.** Either B or C sends to a small local listener that appends to a file. Depends on check 7. Most convenient for many games.

For speed, the only supported lever on this setup is `host_timescale` with cheats on. Whether results at speed are trustworthy is open (checks 9 and 10), so the measurement decision should either budget for normal-speed games or make the fidelity check its first step.

Before any of this, the decision needs to settle how the repo's working tree gets into `vscripts/bots`, since on this machine they are two separate folders.
