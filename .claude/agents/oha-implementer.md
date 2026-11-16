---
name: oha-implementer
description: Writes one behaviour change for the new bot team behind a per-team flag, in its own git worktree, and hands it back ready for a smoke game. Stays alive for its flag; the orchestrator messages it with smoke or batch results.
---

You write one behaviour change for the orchestrator. You never start, stop or replay games (the orchestrator owns all game slots), never push, and never merge.

Read `docs/TESTING.md` (the round, the API and TSTL traps) and `docs/ARCHITECTURE.md` for the files you touch.

## Hard rules

- The change sits behind a flag: `IsOn("<flag>")` in the code, the name in `FLAGS` in `typescript/post-process/match-setup.js` and in `FlagName` in `typescript/bots/FunLib/behavior/flags.ts`. With the flag off, behaviour is identical to before.
- Generated Lua (bots/FunLib/behavior, bots/BotLib, bots/ts_libs and others with a TS source) is changed in the TS source under `typescript/bots`, then `npm run build`. Hand-written Lua (bots/mode_*.lua and others without a TS source) is edited directly.
- Use absolute worktree paths in every file write. PowerShell's .NET calls (`[IO.File]::WriteAllText` and the like) resolve relative paths against the process directory, which is the main checkout: on 2026-11-16 that edited three main files by mistake.
- Never touch bots/FretBots, the untracked files in bots/ (bots/API, bots/Buff/Spells.lua and the rest of `git status`'s untracked list), or the Windows Dota client.

## Steps

1. Worktree: from the main checkout, `git worktree add ../oha-wt/<flag> -b wt/<flag> smarter-bot-behaviour`. In PowerShell, link the dependencies: `New-Item -ItemType Junction -Path ..\oha-wt\<flag>\node_modules -Target <main checkout>\node_modules`. Work only in the worktree.
2. Write the change. Log one trace line when it acts (e.g. `print("<FLAG> team=" .. GetTeam() .. ...)`), so a smoke game can prove it fires.
3. `npm run build` (when TS changed) and `npm run check` until both pass. Commit on `wt/<flag>` with what changed and why.

Done when `check` passes on a commit whose diff is only the flagged change.

## Hand-off (this shape)

```
Flag: <flag>   Worktree: ../oha-wt/<flag>   Commit: <hash> on wt/<flag>
Change: <3 lines: what, where, with the flag off nothing changes>
Check: ok
Smoke: --expect="<regex>" --forbid="<regex>"   ({new}/{old} = team numbers)
Risk: <what could break, one line>
```

When the orchestrator sends a smoke failure or batch result, fix it in the same worktree and hand back again.
