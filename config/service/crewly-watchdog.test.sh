#!/bin/bash
# Tests for crewly-watchdog.sh — run with: bash crewly-watchdog.test.sh
# Stubs lsof/curl/pgrep/open on PATH; everything lives in a temp dir. Exit 0 on pass.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/crewly-watchdog.sh"
PASS=0; FAIL=0
check() {
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $1"; echo "  want: $3"; echo "  got:  $2"; fi
}

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
STUBS="$ROOT/bin"; mkdir -p "$STUBS"
export STUB_DIR="$ROOT/stub"

cat > "$STUBS/lsof" <<'S'
#!/bin/bash
[ -f "$STUB_DIR/listener" ] && echo 4242
exit 0
S
cat > "$STUBS/pgrep" <<'S'
#!/bin/bash
[ -f "$STUB_DIR/supervisor" ] && { echo 777; exit 0; }
exit 1
S
cat > "$STUBS/open" <<'S'
#!/bin/bash
echo "$*" >> "$STUB_DIR/open.log"
[ -f "$STUB_DIR/open_fail" ] && exit 1
exit 0
S
cat > "$STUBS/curl" <<'S'
#!/bin/bash
echo "$*" >> "$STUB_DIR/curl.log"
case "$*" in
  */api/slack/notify*)
    [ -f "$STUB_DIR/notify_fail" ] && exit 7
    echo "$*" >> "$STUB_DIR/notify.log"; exit 0 ;;
  */health*)
    if [ -f "$STUB_DIR/health_fail_first" ]; then
      n=$(cat "$STUB_DIR/health_fail_first")
      if [ "$n" -gt 0 ]; then echo $((n-1)) > "$STUB_DIR/health_fail_first"; exit 22; fi
    fi
    [ -f "$STUB_DIR/health_ok" ] && exit 0
    exit 22 ;;
esac
exit 0
S
chmod +x "$STUBS"/*

# Fresh sandbox per case: temp home with a .command file and no flags.
setup() {
  rm -rf "$ROOT/home" "$STUB_DIR"
  mkdir -p "$ROOT/home" "$STUB_DIR"
  : > "$ROOT/home/crewly-start.command"
  export CREWLY_HOME="$ROOT/home"
  export CREWLY_WATCHDOG_PROBE_GAP_SECS=0
  export CREWLY_WATCHDOG_NOW=1000000
  unset CREWLY_WEB_PORT WEB_PORT CREWLY_API_TOKEN CREWLY_WATCHDOG_MAX_RELAUNCHES CREWLY_WATCHDOG_WINDOW_SECS CREWLY_WATCHDOG_LOG_MAX_BYTES
}
run() { PATH="$STUBS:$PATH" bash "$SCRIPT"; }
opens() { [ -f "$STUB_DIR/open.log" ] && wc -l < "$STUB_DIR/open.log" | tr -d ' ' || echo 0; }
notifies() { [ -f "$STUB_DIR/notify.log" ] && wc -l < "$STUB_DIR/notify.log" | tr -d ' ' || echo 0; }
logf() { cat "$CREWLY_HOME/logs/watchdog.log" 2>/dev/null; }

# 1. healthy -> nothing, quiet after first line
setup; touch "$STUB_DIR/listener" "$STUB_DIR/health_ok"
run; run
check "healthy: no relaunch" "$(opens)" "0"
check "healthy: logs once" "$(logf | wc -l | tr -d ' ')" "1"

# 2. down, nothing else -> relaunch through Terminal
setup
run
check "down: relaunched" "$(opens)" "1"
check "down: through Terminal with .command" "$(cat "$STUB_DIR/open.log")" "-a Terminal $ROOT/home/crewly-start.command"
check "down: logged" "$(logf | grep -c 'opened')" "1"

# 3. stop marker respected
setup; mkdir -p "$CREWLY_HOME/run"; touch "$CREWLY_HOME/run/shutdown-requested"
run
check "stop marker: no relaunch" "$(opens)" "0"
check "stop marker: logged" "$(logf | grep -c 'stopped on purpose')" "1"

# 4. paused flag respected
setup; mkdir -p "$CREWLY_HOME/run"; touch "$CREWLY_HOME/run/watchdog-paused"
run
check "paused: no relaunch" "$(opens)" "0"

# 5. supervisor already running
setup; touch "$STUB_DIR/supervisor"
run
check "supervisor running: no relaunch" "$(opens)" "0"

# 6. .command missing
setup; rm "$CREWLY_HOME/crewly-start.command"
run
check "no .command: no relaunch" "$(opens)" "0"

# 7. listener but /health fails twice -> left alone
setup; touch "$STUB_DIR/listener"
run
check "hung listener: no relaunch" "$(opens)" "0"
check "hung listener: probed twice" "$(grep -c '/health' "$STUB_DIR/curl.log")" "2"

# 8. flaky /health: first probe fails, second passes -> healthy
setup; touch "$STUB_DIR/listener" "$STUB_DIR/health_ok"; echo 1 > "$STUB_DIR/health_fail_first"
run
check "flaky health: no relaunch" "$(opens)" "0"
check "flaky health: healthy" "$(logf | grep -c 'healthy')" "1"

# 9. rate limit: 3 in window -> no relaunch, notify once
setup; mkdir -p "$CREWLY_HOME/run"
printf '999900\n999910\n999920\n' > "$CREWLY_HOME/run/watchdog-relaunches"
run; run
check "limit: no relaunch" "$(opens)" "0"
check "limit: owner notified exactly once" "$(notifies)" "1"
check "limit: gave up logged" "$(logf | grep -c 'Gave up')" "1"

# 10. old relaunches age out of the window
setup; mkdir -p "$CREWLY_HOME/run"
printf '100\n200\n300\n' > "$CREWLY_HOME/run/watchdog-relaunches"
run
check "aged-out relaunches: relaunch allowed" "$(opens)" "1"
check "aged-out relaunches: pruned to the new one" "$(grep -c . "$CREWLY_HOME/run/watchdog-relaunches")" "1"

# 11. three relaunches over three ticks, the fourth is blocked
setup
for t in 1000000 1000060 1000120 1000180; do CREWLY_WATCHDOG_NOW=$t run; done
check "4 ticks down: 3 relaunches" "$(opens)" "3"
check "4 ticks down: notified" "$(notifies)" "1"

# 12. notify unreachable -> retried next run
setup; mkdir -p "$CREWLY_HOME/run"; touch "$STUB_DIR/notify_fail"
printf '999900\n999910\n999920\n' > "$CREWLY_HOME/run/watchdog-relaunches"
run; rm "$STUB_DIR/notify_fail"; run
check "notify retry: delivered on second try" "$(notifies)" "1"

# 13. recovery re-arms the notice
setup; mkdir -p "$CREWLY_HOME/run"
printf '999900\n999910\n999920\n' > "$CREWLY_HOME/run/watchdog-relaunches"
run
touch "$STUB_DIR/listener" "$STUB_DIR/health_ok"; run
rm "$STUB_DIR/listener" "$STUB_DIR/health_ok"; run
check "recovery: notified again after healthy" "$(notifies)" "2"

# 14. port and token from service.env
setup; touch "$STUB_DIR/listener" "$STUB_DIR/health_ok"
printf 'WEB_PORT=9999\nexport CREWLY_API_TOKEN="tok123"\n' > "$CREWLY_HOME/service.env"
run
check "service.env port" "$(grep -c '127.0.0.1:9999/health' "$STUB_DIR/curl.log")" "1"
rm "$STUB_DIR/listener"; mkdir -p "$CREWLY_HOME/run"
printf '999900\n999910\n999920\n' > "$CREWLY_HOME/run/watchdog-relaunches"
run
check "service.env token sent" "$(grep -c 'Authorization: Bearer tok123' "$STUB_DIR/notify.log")" "1"

# 15. env port wins over service.env
setup; touch "$STUB_DIR/listener" "$STUB_DIR/health_ok"; printf 'WEB_PORT=9999\n' > "$CREWLY_HOME/service.env"
CREWLY_WEB_PORT=8123 run
check "env port wins" "$(grep -c '127.0.0.1:8123/health' "$STUB_DIR/curl.log")" "1"

# 16. open failure is logged
setup; touch "$STUB_DIR/open_fail"
run
check "open failure logged" "$(logf | grep -c 'failed')" "1"

# 17. log is capped
setup; mkdir -p "$CREWLY_HOME/logs"
head -c 2000 /dev/zero | tr '\0' 'x' > "$CREWLY_HOME/logs/watchdog.log"
CREWLY_WATCHDOG_LOG_MAX_BYTES=1000 run
check "log rotated" "$(test -f "$CREWLY_HOME/logs/watchdog.log.1" && echo yes)" "yes"
check "fresh log small" "$(test "$(wc -c < "$CREWLY_HOME/logs/watchdog.log" | tr -d ' ')" -lt 1000 && echo yes)" "yes"

echo "watchdog tests: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
