---
title: Where the 7.42 update lands and ships
label: wayfinder:grilling
status: closed
assignee: orchestrator
blocked-by: []
---

## Question

Which branch the 7.42 commits go on, how they are kept separable from the behaviour work, and how they reach tonight's human lobby (the Friday release config on `smarter-bot-behaviour`) and, later, upstream `main`.

## Resolution

Decided on the agent's recommendation (user waived HITL for this map), 2026-11-20.

- **Facts.** `vscripts/bots` is a junction to this checkout's `bots/`, so the lobby plays whatever the main checkout has checked out (`smarter-bot-behaviour`). `main` equals upstream `cb814c6` and lacks the build tooling (`npm run check`, the EOL-safe build). The behaviour branch differs from `main` in the patch-relevant files only in `jmz_func.lua` (4 lines) and `ability_item_usage_generic.lua` (21 lines).
- **Branch.** `patch-7-42`, cut from `smarter-bot-behaviour` HEAD, worked in the worktree `../oha-wt/patch742`, so the live checkout stays playable during the work. Remove the worktree's `node_modules` junction before `git worktree remove` (see TESTING.md).
- **Commits.** Patch-only: no behaviour-flag code. One commit per area (items, neutrals, heroes, map, docs), each passing `npm run build` and `npm run check`. TS sources change with their Lua.
- **Ship.** Merge `patch-7-42` into `smarter-bot-behaviour` in the main checkout after the verification decided in [How the 7.42 update is verified before the lobby](14-how-the-update-is-verified.md). The junction then serves it to the lobby. The Friday release config (flags in `bots/Customize/general.lua`) is separate from this map and is not changed by it.
- **Upstream.** Nothing is pushed. Because the commits are patch-only and keep TS in sync, they can later be cherry-picked onto `main` for upstream; that is the user's call.
