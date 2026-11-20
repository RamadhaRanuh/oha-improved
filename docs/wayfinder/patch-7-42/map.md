---
title: Patch 7.42 support
label: wayfinder:map
status: closed
---

> **Destination reached 2026-11-20.** The spec is [docs/specs/patch-7-42.md](../../specs/patch-7-42.md). All 15 tickets are closed; grilling tickets were decided on the agent's recommendation (HITL waived by the user). Deployment has not started.

## Destination

An implementation-ready deployment spec, `docs/specs/patch-7-42.md`: every structural change from 7.41b to 7.42 classified, each with a decided fix and the files it touches, plus the landing branch and the verification method. The deployment session applies it without deciding anything.

## Notes

- **Planning only.** Tickets resolve decisions; no bot code is changed inside this map. Deployment is a separate step after the user gets the assessment update (user's instruction, 2026-11-20).
- **No HITL for grilling.** The user waived the human side of grilling tickets for this map ("loop your grilling session without a HITL"). Grilling tickets are decided on the agent's recommendation and say so in their resolution. Task tickets that truly need the human (a Steam login) are the one exception.
- **Skills:** `dota2-bot-dev` (API, names, patch runbook). Grilling tickets: `grilling`, `domain-modeling`. Repo runbook: `docs/PATCH_UPDATE_GUIDE.md`, `docs/ARCHITECTURE.md` section 13 (TypeScript-generated Lua files).
- **Inputs** (fetched 2026-11-20, in `research/data/`): Valve datafeed notes for 7.42 and 7.41b-f, flattened; d2vpkr hero slots at client 6986 (same build as the local client, `steam.inf` Nov 19 2026) and the older snapshot from the skill; d2vpkr items and `neutral_items.txt`.
- **Starting facts:**
  - The repo was last patched for 7.41a (`8d09cb1`). 7.41b-f are number changes plus recipe costs; no renames found.
  - Upstream `origin/main` has no 7.42 work (last commit 2026-04-02). Neither does the fork `improved`.
  - 7.42 adds no hero. Hero slot changes (d2vpkr): Beastmaster, Chaos Knight, Dazzle, Juggernaut, Lycan, Meepo (also now Universal), Nyx Assassin, Undying, Weaver. Reworks keeping their names: Leshrac Nihilism, Nature's Prophet Curse of the Oldgrowth, Chen Zealot and Holy Persuasion, Brewmaster Primal Split (vector-targeted), Pugna, Death Prophet, Abaddon, Lone Druid (new Scepter ability), Morphling Scepter.
  - Items removed: Javelin, Helm of the Overlord, Khanda (`item_angels_demise`). Added: Quarterstaff, Bloodslinger, Caduceus, Ristul's Devotion, Sabatons of Mordiggian (`item_berserkers_sabatons`), Skypiercer, Starforge, Greater Horn of Battle (Tormentor drop).
  - Neutral items: 5 tiers become 4 (0/15/30/50 min), each tier split into pools of 3 with one pick per pool decided at game start; many items cycled in and out.
  - Map: Dire fountain ~300 units closer to its Ancient; mid T1/T2 towers moved; Twin Gates moved to the map rims; Tormentor first spawn 20:00 to 15:00; Roshan respawn shrinks per kill; Glyph has 2 charges.
  - The headless Dota in WSL is on build 6975 (7.41f, Nov 12). Runtime checks need it updated first.
  - Tonight (Friday 2026-11-20) five humans play the improved OHA. The game client is already 7.42.
- **Terms.** *Stall item*: a purchase-list entry the shop no longer sells, which can hold up the rest of a bot's build. *Slot shift*: an ability moving to a different `Ability1..6` slot, which changes the runtime `sAbilityList` indices that skill builds use. *Rework*: an ability that keeps its internal name but changes targeting or function, so the name check passes while the cast logic is wrong.
- **Tracker.** Local markdown; conventions in [README.md](README.md). Nothing is pushed.

## Decisions so far

<!-- one line per closed ticket: [title](link): gist -->

- [Where the 7.42 update lands and ships](tickets/07-where-the-update-lands-and-ships.md): branch `patch-7-42` off `smarter-bot-behaviour` in worktree `../oha-wt/patch742`, patch-only commits per area, merged into the main checkout (which the game's `vscripts/bots` junction serves) after verification; nothing pushed.
- [What the deployment must include tonight and what waits](tickets/08-what-ships-tonight-and-what-waits.md): Gate 1 = errors, stalls, 4-tier neutrals, registry for named new items, guide line; Gate 2 = misfires and cheap base-kit logic if verified in time; Scepter/Shard extras, new items in builds, talents deferred.
- [Which dirty or untracked files the update may touch](tickets/09-which-dirty-or-untracked-files-the-update-may-touch.md): untracked files never; dirty FretBots files only if unavoidable and flagged before the merge; clean Buff and FretBots neutral files yes.
- [Update the headless Dota install to 7.42](tickets/06-update-the-headless-dota-install-to-742.md): done with the cached steamcmd login; WSL `/opt/dota2` is build 6986 like the client; older batches were 7.41f and don't pool with new games.
- [How the 7.42 update is verified before the lobby](tickets/14-how-the-update-is-verified.md): build + check + a one-off name gate; four headless smoke games of 40 touched heroes per gate with explicit pass lines; before/after against ticket 15; no eval batch; FretBots/Buff neutrals left to a lobby checklist.
- [Which hardcoded map positions and timings 7.42 moves](tickets/05-which-map-positions-and-timings-742-moves.md): live hardcodes are the Dire fountain (5 places), Tormentor first spawn and the Roshan respawn bound; towers, camps and runes are read at runtime; Glyph and mid ward spots need probes.
- [Which map position and timing fixes are applied](tickets/13-which-map-and-timing-fixes-are-applied.md): all Gate 2; Dire fountain measured by a one-off probe then hardcoded in all five places; Tormentor 15:00; Roshan bound max(5, 11 - kills); Glyph, ward spots and Buff XP left alone.
- [How neutral items and enchantments reach the bots, and what 7.42's four tiers break](tickets/04-how-neutral-items-reach-bots-and-what-742-breaks.md): only console-started Buff and FretBots give neutrals (not headless); both still give 5 tiers on old timings; `item_desolator_2` no longer exists and would kill Buff's timer at 60:00; only `SettingsDefault.lua` among the dirty files needs an edit.
- [How neutral items are given to bots on 7.42](tickets/12-how-neutral-items-are-given-on-742.md): flat 4-tier lists from the 7.42 pools in both scripts, 7.42 enchantment tiers, each script's old offset kept (Buff 0/17/32/52, FretBots {0,300,1200,3000}); three clean lines of dirty `SettingsDefault.lua` edited with a stash at merge; Brick/Flicker/Witchbane fixes in Gate 2.
- [Which item code stalls or misfires in 7.42](tickets/03-which-item-code-stalls-or-misfires.md): Khanda (12 build entries) and Helm of the Overlord stall purchase queues, since the purchase code never checks results; recipe changes are harmless via `GetItemComponents`; Halberd range and the Beastmaster farm gate are small misfires.
- [How removed items are replaced in hero builds](tickets/10-how-removed-items-are-replaced-in-builds.md): same-slot replacements (Caduceus for Phylactery builds, Daedalus, Ethereal Blade, Vladmir); Caduceus reuses the Force Staff handler; other new items registered but unused; a purchase guard pops invalid or disallowed items.
- [Which hero ability code breaks in 7.42 (Chen to Spirit Bear, including Abaddon, Lycan, Nyx and Undying, in the notes)](tickets/02-which-hero-ability-code-breaks-second-half.md): errors in Meepo (removed Megameepo fetched every tick) and Chen (removed `chen_summon_convert`, broken before 7.42); slot shifts only touch indices 4-5, which no build reads; misfires on Lone Druid's bear leash, Monkey King's Shard jump and Brewmaster's Liquid Courage; new abilities without logic listed.
- [Which hero ability code breaks in 7.42 (Anti-Mage to Batrider in the notes)](tickets/01-which-hero-ability-code-breaks-first-half.md): no errors or stalls; Weaver's Scepter ally cast moved to `weaver_time_lapse_ally` (misfire); Beastmaster Thunderhide and Dazzle Through the Realm unused; Juggernaut Swift Slash and Furion's Curse cast are dead code; 18 talent picks changed meaning.
- [What the current code does on 7.42, headless](tickets/15-what-current-code-does-on-742-headless.md): 4 games, 40 heroes, smokecheck PASS yet Lycan/Beastmaster/Morphling/Tinker item stalls, Meepo never Earthbinds, Chen never persuades, Beastmaster stops skilling at 10 (Inner Beast innate); hero errors are swallowed; the engine gives bots neutrals itself.
- [How each broken hero ability is handled](tickets/11-how-each-broken-hero-is-handled.md): a generic level-up pop for never-upgradable entries; Gate 1 fixes Meepo, Chen, Beastmaster, Juggernaut; Gate 2 adds CK Armageddon, Chen Zealot, bear leash, MK Shard retreat, Liquid Courage, Meepo treads; Scepter/Shard extras and talents deferred.

## Not yet specified

- Talent preferences: 7.42 replaced many talents at the same level. Whether any `tTalentTreeList` now prefers a talent that no longer fits the build is unclear until the hero audits list them.
- Scepter and Shard extras without logic (Thunderhide, Through the Realm, Zombie Bite, Summon Druid, Cinder Dash, Meepo carry and Fling, Chen Anoint) and dominated 7.42 creep abilities.
- Using the new 7.42 items well (Starforge, Skypiercer, Caduceus and the rest) beyond replacing removed items: which heroes should buy them and how their actives are cast.
- Whether ward, mine and rune go-out spots near the reshaped mid river are still passable (probe P2), and what `GetGlyphCooldown()` returns with Glyph charges (probe P5).
- Emulating 7.42's neutral pools (one option per pool per game) so bots draw from the same choices humans see.
- Behaviour that 7.42 mechanics invite (Greater Horn of Battle use, Tormentor at 15:00, Glyph charges, passive XP): whether the bots should change plans, not just keep working.

## Out of scope

- Pre-existing 7.41 problems the smoke games showed (Lone Druid itemization and bear skips, Invoker skill skips): not caused by 7.42.

- Re-balancing builds or behaviour for 7.42 number changes (spell power reduction, bounty rescale): the game API applies numbers; only structural breakage is in scope.
