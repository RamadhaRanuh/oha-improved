#!/bin/bash
# One headless Dota game on the Linux build in WSL (docs/specs/learned-fight-decisions.md, step 0).
# Usage: game.sh <run dir> <timescale> <port>
# Plays the bot scripts mounted at <dota>/game/dota/scripts/vscripts/bots, loads the match recorder when
# the pick phase starts, and stops the server once the MATCHREC line is written (or after 40 real minutes).
# Writes console.log and stdout.log into <run dir>.
R=$1; TS=${2:-8}; PORT=${3:-27015}
mkdir -p "$R"; rm -f "$R"/console.log "$R"/stdout.log "$R"/stdin
cd /opt/dota2/game || exit 1
export LD_LIBRARY_PATH=/opt/dota2/game/bin/linuxsteamrt64:$LD_LIBRARY_PATH
export ENABLE_PATHMATCH=1
ulimit -n 2048
START=$(date +%s)
mkfifo "$R/stdin"
./bin/linuxsteamrt64/dota2 -dedicated -port "$PORT" -insecure -console -dev -nowatchdog -noip +sv_lan 1 +sv_cheats 1 \
   +sv_hibernate_when_empty 0 +dota_surrender_on_disconnect 0 -fill_with_bots +host_timescale "$TS" \
   -con_logfile "$R/console.log" -con_timestamp +map start gamemode 1 < "$R/stdin" > "$R/stdout.log" 2>&1 &
PID=$!
exec 3>"$R/stdin"
for i in $(seq 1 180); do grep -aq "HERO_SELECTION" "$R/console.log" 2>/dev/null && break; sleep 1; done
echo "sv_cheats 1" >&3; echo "script_reload_code bots/tools/match_recorder" >&3
for i in $(seq 1 2400); do
  grep -aq "MATCHREC {" "$R/console.log" 2>/dev/null && break
  kill -0 $PID 2>/dev/null || break
  sleep 1
done
sleep 3; echo "quit" >&3; sleep 5; kill -9 $PID 2>/dev/null
echo "real seconds: $(( $(date +%s) - START ))"
grep -ac "MATCHREC {" "$R/console.log" | sed 's/^/MATCHREC lines: /'
