---
title: Update the headless Dota install to 7.42
label: wayfinder:task
status: closed
assignee: orchestrator
blocked-by: []
---

## Question

The WSL install (`/opt/dota2`) is build 6975; the client is 6986. Update it with steamcmd so headless games run 7.42. Try AFK with a cached login first; if steamcmd needs a password or Steam Guard code, hand the human a one-line checklist. Record the resulting build number.

## Resolution

Done AFK, 2026-11-20. `steamcmd +force_install_dir /opt/dota2 +login <cached account> +app_update 570` used the cached Steam login (no password or Guard prompt), downloaded 5.9 GB and verified. `/opt/dota2/game/dota/steam.inf` now reads `ClientVersion=6986`, `VersionDate=Nov 19 2026`, the same build as the Windows client and d2vpkr. `/root/.steam/sdk64/steamclient.so` is still in place. Any batch results from before today were played on 7.41f (6975) and do not pool with games from now on.
