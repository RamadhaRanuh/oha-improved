#!/bin/bash
# Runs a batch of headless games, at most <parallel> at once (docs/specs/learned-fight-decisions.md, step 2).
# Started by `npm run batch -- start`; not meant to be run by hand.
# Usage: batch.sh <batch dir> <parallel> <timescale> <output dir>
#
# <batch dir> holds base/ (a copy of the repo's bots folder), cfg/g<n>/ (that game's general.lua and utils.lua
# from match-setup.js --out) and games.txt (the game numbers). Each game gets its own bots folder, mounted over
# the game's bots path in a private mount namespace, so games with different settings run side by side.
# Each finished game's console log is copied to <output dir>/console.g<n>.log; progress goes to
# <output dir>/status.log and memory use to <output dir>/mem.log.
B=$1; P=${2:-8}; TS=${3:-8}; OUT=$4
BOTS=/opt/dota2/game/dota/scripts/vscripts/bots
HERE=$(cd "$(dirname "$0")" && pwd)
log() { echo "$(date +%T) $*" >> "$OUT/status.log"; }

log "batch start: parallel=$P timescale=$TS games=$(tr '\n' ' ' < "$B/games.txt")"
( while [ ! -f "$B/DONE" ]; do
    echo "$(date +%T) used_mb=$(free -m | awk '/Mem:/{print $3}') games=$(ps -C dota2 -o pid= | wc -l) cpu=$(ps -C dota2 -o pcpu= | awk '{s+=$1} END {print int(s)}')" >> "$OUT/mem.log"
    sleep 15
  done ) &

for g in $(cat "$B/games.txt"); do
  while [ "$(jobs -rp | wc -l)" -gt "$P" ]; do sleep 5; done   # +1 for the memory sampler
  G=$B/g$g; rm -rf "$G"; mkdir -p "$G"
  cp -r "$B/base" "$G/bots" && cp -r "$B/cfg/g$g/." "$G/bots/"
  # Claim a free port across every running batch (mkdir is atomic); two servers on one port crash at startup.
  mkdir -p /tmp/oha-ports
  PORT=27201
  until mkdir "/tmp/oha-ports/$PORT" 2>/dev/null; do PORT=$((PORT + 1)); done
  (
    unshare -m bash -c "mount --bind '$G/bots' '$BOTS' && exec bash '$HERE/game.sh' '$G/run' $TS $PORT" > "$G/result.txt" 2>&1
    rmdir "/tmp/oha-ports/$PORT"
    cp "$G/run/console.log" "$OUT/console.g$g.log" 2>/dev/null
    rm -rf "$G/bots"
    log "g$g done: $(grep -ao '"winner":"[a-z]*"' "$G/run/console.log" | head -1) $(grep -a 'real seconds' "$G/result.txt")"
  ) &
  log "g$g started (port $PORT)"
  sleep 3
done
touch "$B/QUEUED"
while [ "$(jobs -rp | wc -l)" -gt 1 ]; do sleep 5; done
touch "$B/DONE"
log "batch done"
