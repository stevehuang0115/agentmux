#!/usr/bin/env bash
# =============================================================================
# Chrome Live Attach — One-click attach to user's running Chrome browser
#
# Auto-discovers Chrome processes with CDP (Chrome DevTools Protocol) enabled,
# or offers to enable CDP on the user's existing Chrome session.
#
# Modes:
#   discover  — Scan for Chrome instances (default)
#   attach    — Connect to a specific CDP port
#   launch    — Launch Chrome with CDP on user's default profile
#
# Usage:
#   execute.sh '{"mode":"discover"}'
#   execute.sh '{"mode":"attach","port":9222}'
#   execute.sh '{"mode":"launch","port":9222}'
#
# @see https://github.com/stevehuang0115/crewly/issues/175
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_common/lib.sh"

# Parse input
INPUT="${1:-{}}"
MODE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('mode','discover'))" 2>/dev/null || echo "discover")
PORT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('port',9222))" 2>/dev/null || echo "9222")

# ── Helper functions ────────────────────────────────────────

log()  { echo "[chrome-attach] $*" >&2; }

check_cdp() {
  local port="$1"
  curl -sf --max-time 2 "http://127.0.0.1:${port}/json/version" 2>/dev/null
}

get_ws_url() {
  local port="$1"
  curl -sf --max-time 2 "http://127.0.0.1:${port}/json/version" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('webSocketDebuggerUrl',''))" 2>/dev/null || true
}

is_chrome_running() {
  pgrep -f "Google Chrome" >/dev/null 2>&1
}

find_chrome_binary() {
  local candidates=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "google-chrome"
    "google-chrome-stable"
  )
  for c in "${candidates[@]}"; do
    if command -v "$c" &>/dev/null || [ -x "$c" ]; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

get_default_profile() {
  case "$(uname)" in
    Darwin) echo "$HOME/Library/Application Support/Google/Chrome" ;;
    Linux)  echo "$HOME/.config/google-chrome" ;;
    *)      echo "$HOME/.config/google-chrome" ;;
  esac
}

# ── Mode: Discover ─────────────────────────────────────────

discover_chrome() {
  local found_instances="[]"
  local chrome_running="false"

  if is_chrome_running; then
    chrome_running="true"
  fi

  # Scan common CDP ports
  for p in 9222 9229 9223 9224; do
    local version_json
    version_json=$(check_cdp "$p" 2>/dev/null) || continue

    local ws_url browser_version
    ws_url=$(echo "$version_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('webSocketDebuggerUrl',''))" 2>/dev/null || echo "")
    browser_version=$(echo "$version_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('Browser','unknown'))" 2>/dev/null || echo "unknown")

    found_instances=$(echo "$found_instances" | python3 -c "
import sys, json
instances = json.load(sys.stdin)
instances.append({
  'port': $p,
  'wsUrl': '$ws_url',
  'httpEndpoint': 'http://127.0.0.1:$p',
  'version': '$browser_version',
  'isPrimary': $p == 9222
})
json.dump(instances, sys.stdout)
" 2>/dev/null || echo "$found_instances")
  done

  local count
  count=$(echo "$found_instances" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  local suggestion=""
  if [ "$count" = "0" ] && [ "$chrome_running" = "true" ]; then
    suggestion="Chrome is running but without CDP. Restart Chrome with: open -a 'Google Chrome' --args --remote-debugging-port=9222"
  elif [ "$count" = "0" ]; then
    suggestion="No Chrome detected. Use mode=launch to start Chrome with CDP."
  fi

  cat <<EOF
{
  "success": true,
  "mode": "discover",
  "found": $([ "$count" != "0" ] && echo "true" || echo "false"),
  "chromeRunning": $chrome_running,
  "instances": $found_instances,
  "suggestion": $([ -n "$suggestion" ] && echo "\"$suggestion\"" || echo "null")
}
EOF
}

# ── Mode: Attach ───────────────────────────────────────────

attach_chrome() {
  local port="$1"

  local version_json
  version_json=$(check_cdp "$port" 2>/dev/null) || {
    cat <<EOF
{
  "success": false,
  "mode": "attach",
  "error": "No CDP endpoint found on port $port",
  "suggestion": "Start Chrome with: open -a 'Google Chrome' --args --remote-debugging-port=$port"
}
EOF
    return 1
  }

  local ws_url browser_version
  ws_url=$(echo "$version_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('webSocketDebuggerUrl',''))" 2>/dev/null || echo "")
  browser_version=$(echo "$version_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('Browser','unknown'))" 2>/dev/null || echo "unknown")

  # Get list of open tabs/pages
  local pages_json
  pages_json=$(curl -sf --max-time 2 "http://127.0.0.1:${port}/json" 2>/dev/null || echo "[]")
  local page_count
  page_count=$(echo "$pages_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  cat <<EOF
{
  "success": true,
  "mode": "attach",
  "connected": true,
  "port": $port,
  "wsUrl": "$ws_url",
  "httpEndpoint": "http://127.0.0.1:$port",
  "version": "$browser_version",
  "openPages": $page_count,
  "message": "Successfully attached to Chrome ($browser_version) on port $port with $page_count open pages"
}
EOF
}

# ── Mode: Launch ───────────────────────────────────────────

launch_chrome() {
  local port="$1"

  # Check if CDP is already available
  if check_cdp "$port" >/dev/null 2>&1; then
    log "CDP already available on port $port, attaching..."
    attach_chrome "$port"
    return
  fi

  # Find Chrome binary
  local chrome_bin
  chrome_bin=$(find_chrome_binary 2>/dev/null) || {
    cat <<EOF
{
  "success": false,
  "mode": "launch",
  "error": "Chrome not found. Install Google Chrome."
}
EOF
    return 1
  }

  # Use the user's default Chrome profile for Live Attach (preserves logins)
  local profile_dir
  profile_dir=$(get_default_profile)

  if ! is_chrome_running; then
    # Chrome not running — launch with CDP on user's profile
    log "Launching Chrome with CDP on port $port (user profile)..."
    "$chrome_bin" \
      --remote-debugging-port="$port" \
      --no-first-run \
      --no-default-browser-check \
      --disable-background-timer-throttling \
      --disable-backgrounding-occluded-windows \
      --disable-renderer-backgrounding \
      &>/dev/null &

    # Wait for CDP to become available
    for _ in $(seq 1 20); do
      if check_cdp "$port" >/dev/null 2>&1; then
        log "Chrome launched with CDP on port $port"
        attach_chrome "$port"
        return
      fi
      sleep 0.5
    done

    cat <<EOF
{
  "success": false,
  "mode": "launch",
  "error": "Chrome launched but CDP did not become available within 10 seconds"
}
EOF
    return 1
  fi

  # Chrome IS running without CDP — use alt profile to avoid conflict
  local alt_profile="${HOME}/.crewly/chrome-attach-profile"
  mkdir -p "$alt_profile"

  log "Chrome is running without CDP. Launching alt instance on port $port..."
  "$chrome_bin" \
    --remote-debugging-port="$port" \
    --user-data-dir="$alt_profile" \
    --no-first-run \
    --no-default-browser-check \
    &>/dev/null &

  for _ in $(seq 1 20); do
    if check_cdp "$port" >/dev/null 2>&1; then
      log "Alt Chrome launched with CDP on port $port"
      attach_chrome "$port"
      return
    fi
    sleep 0.5
  done

  cat <<EOF
{
  "success": false,
  "mode": "launch",
  "error": "Failed to launch Chrome with CDP. Try closing Chrome and retrying.",
  "suggestion": "Close all Chrome windows, then retry, or run: open -a 'Google Chrome' --args --remote-debugging-port=$port"
}
EOF
}

# ── Main ───────────────────────────────────────────────────

case "$MODE" in
  discover)
    discover_chrome
    ;;
  attach)
    attach_chrome "$PORT"
    ;;
  launch)
    launch_chrome "$PORT"
    ;;
  *)
    echo '{"success": false, "error": "Unknown mode. Use: discover, attach, or launch"}'
    exit 1
    ;;
esac
