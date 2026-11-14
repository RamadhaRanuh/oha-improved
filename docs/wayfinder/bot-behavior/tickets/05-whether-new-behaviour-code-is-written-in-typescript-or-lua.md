---
title: Whether new behaviour code is written in TypeScript or Lua
label: wayfinder:grilling
status: closed
assignee: Claude (work session 2026-11-13)
blocked-by: []
---

## Question

Should new and rewritten behaviour logic be written in TypeScript (compiled to Lua, as `aba_push` and `aba_defend` are) or in hand-written Lua (as the mode files, `jmz_func.lua` and the `override_generic` files are)?

Covers: which language new modules use, whether existing Lua modes are migrated or left, how `jmz_func.d.ts` is kept in step, and whether the build step is acceptable in the edit-test loop of a local lobby.

## Resolution

Closed 2026-11-13.

> Decided on the agent's recommendation. The human's standing instruction for this session (2026-11-13) was "All grilling session uses your recommendation", so no live exchange took place. The human can reverse this by reopening the ticket.

- **New behaviour modules are written in TypeScript,** under `typescript/bots/FunLib/behavior/`, compiling to `bots/FunLib/behavior/`. They match the direction of `aba_push`, `aba_defend` and `utils`, and the types help when one module (the team brain) is read by every mode.
- **Mode entry files stay hand-written Lua** (`bots/mode_*_generic.lua`) and become thin: when a feature flag is on they delegate to the TypeScript module; when it is off they run the baseline code unchanged.
- **Existing Lua modes are not migrated wholesale.** Logic moves to TypeScript only when this effort rewrites it. Untouched branches of `mode_roam_generic.lua`, `mode_farm_generic.lua` and the other modes stay in Lua.
- **`jmz_func.d.ts` is updated in the same change** as any TypeScript code that calls a `J.*` function it does not yet declare. Lua code does not `require` the new modules, except the mode entry files.
- **The build step is acceptable.** `npm run dev` (tstl watch) recompiles on save. Lobbies load the repo through a directory junction (see [How baseline-vs-new matches are measured](06-how-baseline-vs-new-matches-are-measured.md)), so there is no copy step. Each new generated file is added to the list in section 13 of `docs/ARCHITECTURE.md`.
