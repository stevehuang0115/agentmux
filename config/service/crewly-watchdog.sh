#!/bin/bash
# Crewly watchdog (macOS) — run once a minute by the com.crewly.watchdog
# LaunchAgent. Installed to ~/.crewly/crewly-watchdog.sh by `crewly service install`.
#
# Problem it solves: the supervisor (~/.crewly/crewly-start.command) lives in a
# Terminal.app session on purpose (TCC: Terminal's Full Disk Access propagates
# to its children, a LaunchAgent child's does not). When that Terminal session
# goes away, the supervisor and the backend die with it and nothing brings them
# back. launchd survives that, so it only *re-opens the .command in Terminal*;
# the backend itself still runs under Terminal's permissions.
#
# It relaunches only when ALL of these hold:
#   - the backend is not healthy (no listener on the port; a listener whose
#     /health fails twice in a row is left alone: a relaunch would be refused
#     because the port is busy)
#   - no supervisor (`crewly-start.command`) process is running
#   - the owner did not stop Crewly on purpose: no <home>/run/shutdown-requested
#     (written by `crewly stop`, `crewly service stop` and the dashboard shut
#     down) and no <home>/run/watchdog-paused (`crewly service pause`)
#   - fewer than MAX_RELAUNCHES relaunches happened in the last WINDOW_SECS;
#     past the limit it stops relaunching and notifies the owner once (Slack,
#     through the backend, only if the backend is reachable).
#
# Log: <home>/logs/watchdog.log (capped, one rotated copy). Only state changes
# are logged, so a healthy Mac writes nothing.
#
# Environment (all optional; the overrides exist for tests):
#   CREWLY_HOME, CREWLY_WEB_PORT / WEB_PORT (also read from service.env),
#   CREWLY_WATCHDOG_MAX_RELAUNCHES (3), CREWLY_WATCHDOG_WINDOW_SECS (900),
#   CREWLY_WATCHDOG_LOG_MAX_BYTES (524288), CREWLY_WATCHDOG_PROBE_GAP_SECS (5),
#   CREWLY_WATCHDOG_NOW (epoch seconds), CREWLY_WATCHDOG_COMMAND_FILE.

set -u

CREWLY_HOME="${CREWLY_HOME:-$HOME/.crewly}"
RUN_DIR="$CREWLY_HOME/run"
LOG_FILE="$CREWLY_HOME/logs/watchdog.log"
COMMAND_FILE="${CREWLY_WATCHDOG_COMMAND_FILE:-$CREWLY_HOME/crewly-start.command}"
ENV_FILE="$CREWLY_HOME/service.env"

STOP_MARKER="$RUN_DIR/shutdown-requested"
PAUSE_FLAG="$RUN_DIR/watchdog-paused"
RELAUNCH_LOG="$RUN_DIR/watchdog-relaunches"
NOTIFIED_FLAG="$RUN_DIR/watchdog-notified"
LAST_STATE="$RUN_DIR/watchdog-state"

MAX_RELAUNCHES="${CREWLY_WATCHDOG_MAX_RELAUNCHES:-3}"
WINDOW_SECS="${CREWLY_WATCHDOG_WINDOW_SECS:-900}"
LOG_MAX_BYTES="${CREWLY_WATCHDOG_LOG_MAX_BYTES:-524288}"
PROBE_GAP_SECS="${CREWLY_WATCHDOG_PROBE_GAP_SECS:-5}"
NOW="${CREWLY_WATCHDOG_NOW:-$(date +%s)}"

mkdir -p "$RUN_DIR" "$(dirname "$LOG_FILE")" 2>/dev/null

# --- logging -----------------------------------------------------------------

if [ -f "$LOG_FILE" ]; then
  LOG_SIZE=$(wc -c < "$LOG_FILE" 2>/dev/null | tr -d ' ')
  if [ "${LOG_SIZE:-0}" -gt "$LOG_MAX_BYTES" ]; then
    mv -f "$LOG_FILE" "$LOG_FILE.1" 2>/dev/null
  fi
fi

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >> "$LOG_FILE" 2>/dev/null
}

# Log `message` only when the outcome differs from the previous run's, so a
# steady state (healthy, stopped on purpose, ...) does not write every minute.
note() {
  local state="$1"; shift
  if [ "$(cat "$LAST_STATE" 2>/dev/null)" != "$state" ]; then
    log "$*"
    printf '%s' "$state" > "$LAST_STATE" 2>/dev/null
  fi
}

# --- configuration -----------------------------------------------------------

# Value of KEY in service.env (KEY=VALUE or export KEY=VALUE; quotes stripped).
env_file_value() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$ENV_FILE" 2>/dev/null | tail -1 \
    | sed -E "s/^[^=]*=//; s/^[[:space:]]*[\"']?//; s/[\"']?[[:space:]]*\$//"
}

PORT="${CREWLY_WEB_PORT:-${WEB_PORT:-}}"
[ -n "$PORT" ] || PORT="$(env_file_value CREWLY_WEB_PORT)"
[ -n "$PORT" ] || PORT="$(env_file_value WEB_PORT)"
case "$PORT" in ''|*[!0-9]*) PORT=8787 ;; esac
BASE_URL="http://127.0.0.1:$PORT"

has_listener() {
  [ -n "$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null)" ]
}

is_healthy() {
  curl -fsS -m 5 -o /dev/null "$BASE_URL/health" 2>/dev/null
}

# --- decisions ---------------------------------------------------------------

# 1. Deliberate stops win over everything.
if [ -f "$PAUSE_FLAG" ]; then
  note paused "Paused (remove $PAUSE_FLAG or run \`crewly service resume\`) — not watching."
  exit 0
fi
if [ -f "$STOP_MARKER" ]; then
  note stopped "Crewly was stopped on purpose ($STOP_MARKER) — not relaunching."
  exit 0
fi

# 2. Healthy: reset the give-up state and stay quiet.
if has_listener; then
  if is_healthy; then
    healthy=1
  else
    sleep "$PROBE_GAP_SECS"
    if is_healthy; then healthy=1; else healthy=0; fi
  fi
  if [ "$healthy" = 1 ]; then
    rm -f "$NOTIFIED_FLAG"
    note healthy "Backend healthy on port $PORT."
    exit 0
  fi
  note unhealthy "Listener on port $PORT but /health failed twice — not relaunching (the supervisor would refuse: port busy)."
  exit 0
fi

# 3. Nothing listens. A live supervisor is already restarting it (5 s loop) or
#    is mid-boot; do not open a second one.
if pgrep -f 'crewly-start\.command' >/dev/null 2>&1; then
  note supervisor "No listener on port $PORT but the supervisor is running — waiting."
  exit 0
fi

if [ ! -f "$COMMAND_FILE" ]; then
  note missing "No listener on port $PORT and $COMMAND_FILE does not exist — run \`crewly service install\`."
  exit 0
fi

# 4. Rate limit: keep only relaunches inside the window.
RECENT=""
COUNT=0
if [ -f "$RELAUNCH_LOG" ]; then
  while read -r ts; do
    case "$ts" in ''|*[!0-9]*) continue ;; esac
    if [ $((NOW - ts)) -lt "$WINDOW_SECS" ]; then
      RECENT="$RECENT$ts
"
      COUNT=$((COUNT + 1))
    fi
  done < "$RELAUNCH_LOG"
fi
printf '%s' "$RECENT" > "$RELAUNCH_LOG" 2>/dev/null

if [ "$COUNT" -ge "$MAX_RELAUNCHES" ]; then
  note limit "Gave up: $COUNT relaunches in the last $((WINDOW_SECS / 60)) min and Crewly is still down. Not relaunching until the window clears."
  if [ ! -f "$NOTIFIED_FLAG" ]; then
    AUTH_HEADER=""
    TOKEN="${CREWLY_API_TOKEN:-$(env_file_value CREWLY_API_TOKEN)}"
    [ -z "$TOKEN" ] || AUTH_HEADER="Authorization: Bearer $TOKEN"
    BODY="{\"type\":\"alert\",\"urgency\":\"normal\",\"title\":\"Crewly keeps going down\",\"message\":\"The watchdog relaunched Crewly $COUNT times in $((WINDOW_SECS / 60)) minutes and it is still down. It has stopped retrying; open Terminal on the Mac and run: crewly service status\"}"
    if curl -fsS -m 5 -o /dev/null -X POST -H 'Content-Type: application/json' ${AUTH_HEADER:+-H "$AUTH_HEADER"} -d "$BODY" "$BASE_URL/api/slack/notify" 2>/dev/null; then
      printf '%s' "$NOW" > "$NOTIFIED_FLAG"
      log "Owner notified."
    else
      log "Owner notice not delivered (backend unreachable); will retry."
    fi
  fi
  exit 0
fi

# 5. Relaunch through Terminal so TCC still comes from Terminal.
printf '%s\n' "$NOW" >> "$RELAUNCH_LOG"
if open -a Terminal "$COMMAND_FILE" >/dev/null 2>&1; then
  note "relaunched-$NOW" "Crewly down (no listener on port $PORT, no supervisor) — opened $COMMAND_FILE in Terminal ($((COUNT + 1))/$MAX_RELAUNCHES in window)."
else
  note "openfail-$NOW" "Crewly down but \`open -a Terminal\` failed (no GUI session?) ($((COUNT + 1))/$MAX_RELAUNCHES in window)."
fi
exit 0
