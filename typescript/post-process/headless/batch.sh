#!/bin/bash
# Runs a batch of headless games, at most <parallel> at once (docs/specs/learned-fight-decisions.md, step 2).
# Started by `npm run batch -- start`; not meant to be run by hand.
# Usage: batch.sh <batch dir> <parallel> <timescale> <output dir> [stop at game seconds]
#
# <batch dir> holds base/ (a copy of the repo's bots folder), cfg/g<n>/ (that game's general.lua and utils.lua
# from match-setup.js --out) and games.txt (the game numbers). Each game gets its own bots folder, mounted over
# the game's bots path in a private mount namespace, so games with different settings run side by side.
# Each finished game's console log is copied to <output dir>/console.g<n>.log; progress goes to
# <output dir>/status.log and memory use to <output dir>/mem.log.
B=$1; P=${2:-8}; TS=${3:-8}; OUT=$4; STOP=${5:-0}
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
  # Each lock holds its owner's pid. A lock is taken back only when that owner is dead (a game that died
  # with WSL, or one whose release raced); a lock without a pid (an older batch, or a claim being set up)
  # only when no server holds the port and it is 2+ minutes old. rm + mkdir keeps the takeover atomic.
  claim() {
    local L="/tmp/oha-ports/$1" o
    mkdir "$L" 2>/dev/null && return 0
    o=$(cat "$L/pid" 2>/dev/null)
    if [ -n "$o" ]; then kill -0 "$o" 2>/dev/null && return 1
    else { [ -z "$(pgrep -f -- "-port $1( |$)")" ] && [ -n "$(find "$L" -maxdepth 0 -mmin +2)" ]; } || return 1; fi
    rm -rf "$L" && mkdir "$L" 2>/dev/null
  }
  # The pool is 10 ports, so 10 games at once across every batch and smoke game (11 crashed a server and
  # starved Windows). With no port free the game waits for one.
  until claim "$PORT"; do
    PORT=$((PORT + 1))
    if [ "$PORT" -gt 27210 ]; then PORT=27201; sleep 10; fi
  done
  (
    unshare -m bash -c "mount --bind '$G/bots' '$BOTS' && exec bash '$HERE/game.sh' '$G/run' $TS $PORT $STOP" > "$G/result.txt" 2>&1
    [ "$(cat "/tmp/oha-ports/$PORT/pid" 2>/dev/null)" = "$BASHPID" ] && rm -rf "/tmp/oha-ports/$PORT"   # only our own lock
    cp "$G/run/console.log" "$OUT/console.g$g.log" 2>/dev/null
    rm -rf "$G/bots"
    log "g$g done: $(grep -ao '"winner":"[a-z]*"' "$G/run/console.log" | head -1) $(grep -a 'real seconds' "$G/result.txt")"
  ) &
  echo $! > "/tmp/oha-ports/$PORT/pid"
  log "g$g started (port $PORT)"
  sleep 3
done
touch "$B/QUEUED"
while [ "$(jobs -rp | wc -l)" -gt 1 ]; do sleep 5; done
touch "$B/DONE"
log "batch done"
