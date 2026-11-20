---
title: Which dirty or untracked files the update may touch
label: wayfinder:grilling
status: closed
assignee: orchestrator
blocked-by: []
---

## Question

`bots/FretBots/{AwardBonus,BonusTimers,Settings,SettingsDefault}.lua` have uncommitted user edits, and several October files are untracked (`bots/Buff/script/`, `FunLib/aba_spell_list.lua`, `aba_modifiers.lua` and others). The runbook says update both neutral files (Buff and FretBots). Which of these may the deployment edit and commit?

## Resolution

Decided on the agent's recommendation (user waived HITL for this map), 2026-11-20.

- **Facts.** Tracked code loads none of the October untracked files except through other untracked files (grep 2026-11-20; `FretBots/BonusTimers.lua`, itself dirty, names one; the neutral audit confirms the Buff side). The worktree from [Where the 7.42 update lands and ships](07-where-the-update-lands-and-ships.md) holds only committed files, so headless games there run without them.
- **Untracked files:** never edited, never committed by this update.
- **Dirty FretBots files** (`AwardBonus`, `BonusTimers`, `Settings`, `SettingsDefault`): not edited, unless the neutral audit shows a 7.42 change that only they can carry. In that case the change is made in the worktree on the committed version, and the user is told before the merge, because merging into the main checkout then needs their edits stashed and re-applied.
- **Clean tracked FretBots and Buff files** (`FretBots/NeutralItems.lua`, `SettingsNeutralItemTable.lua`, `neutrals_data.lua`, `Buff/NeutralItems.lua`): may be edited, as the runbook says both neutral paths are updated together.
