---
title: How the 7.42 update is verified before the lobby
label: wayfinder:grilling
status: closed
assignee: orchestrator
blocked-by: [06-update-the-headless-dota-install-to-742.md, 08-what-ships-tonight-and-what-waits.md]
---

## Question

What proves the deployment works: static checks, headless smoke games (which heroes, how many, what the logs must and must not show), and what is left for the human lobby?

## Resolution

Decided on the agent's recommendation (user waived HITL for this map), 2026-11-20. Headless is on 7.42 (build 6986) since [Update the headless Dota install to 7.42](06-update-the-headless-dota-install-to-742.md).

1. **Static, per commit:** `npm run build` then `npm run check`. Plus a name gate run once before the merge: `grep` over tracked `bots/` and `typescript/bots/` finds no removed item or ability name outside comments, and every `item_*` in every `sRoleItemsBuyList` and fallback build exists in `research/data/items-7.42.md`. The gate is a throwaway script in the scratchpad, not committed tooling.
2. **Headless smoke, Gate 1:** the four lineups of [What the current code does on 7.42, headless](15-what-current-code-does-on-742-headless.md) (40 touched heroes), played from the `patch-7-42` worktree, flags `none`, `--until=35`, four games at once. Swap pairs 5-8 of `measurement-lineups.md` in the worktree only, uncommitted. **Pass:** `smokecheck` PASS (no runtime error beyond the usual `error in error handling` lines), no `未能购买物品` line, no `aba_skill` ability-list `[WARN]` for a touched hero, every hero reaches its level with no unspent skill points. (Corrected twice: headless games load neither Buff nor FretBots, but the engine still gives bots 7.42 neutrals, so pass also needs some 7.42-only neutral, e.g. Balmhook, Brick, Vile Phial, Safety Bubble or Red Ledger, in `ITEM` lines by 16:00. Hero-file errors are swallowed (see ticket 15), so a hero passes only if its fixed abilities appear in `CAST` lines and its inventory keeps changing past 30:00.) Buff's neutral tables are also checked offline: a throwaway script loads `Buff/NeutralItems.lua`'s tables and confirms every name exists in `research/data/items-7.42.md`; same for `FretBots/SettingsNeutralItemTable.lua`. Each Gate 1 failure is fixed and the failing game replayed; at most two fix rounds before the item is reported to the user instead.
3. **Headless smoke, Gate 2:** the same four games after the Gate 2 commits. **Pass:** Gate 1 still passes, and every reworked base-kit ability that got logic appears in `CAST` lines at least once in its game.
4. **Before and after:** the observed failures in ticket 15's games are the checklist; each must be gone after the patch, or be explained (e.g. an ability the bot never had a reason to cast).
5. **No eval batch.** The patch changes both teams alike, so a gold or win comparison measures nothing. The 10-game cap holds: at most four smoke games at once.
6. **Left for the human lobby** (FretBots and Buff are not loaded headless): neutrals given through the FretBots/Buff path appear at 0/15/30/50 minutes, the console shows no errors from `FretBots/` or `Buff/`, and the bots buy and use their items. A short checklist goes into the deployment spec for the user.
