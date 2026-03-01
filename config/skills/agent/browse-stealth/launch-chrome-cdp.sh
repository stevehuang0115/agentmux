#!/usr/bin/env bash
# Launch Chrome with CDP (Chrome DevTools Protocol) enabled.
#
# Strategy (NEVER kills user's Chrome):
#   1. If CDP is already listening on the target port → reuse it
#   2. If Chrome is running WITHOUT CDP → try Chrome Canary or Chromium as alt browser
#   3. If no Chrome is running → launch Chrome with CDP on the stealth profile
#   4. If all else fails → print error with instructions
#
# CRITICAL: We NEVER pkill/killall the user's Chrome. That destroys their tabs.
set -euo pipefail

CDP_PORT="${1:-9222}"
PROFILE_DIR="${HOME}/.crewly/chrome-stealth-profile"

# ── Helper ──────────────────────────────────────────────────────
log()  { echo "[chrome-cdp] $*" >&2; }
die()  { log "ERROR: $1"; exit 1; }

# ── Detect Chrome binaries ────────────────────────────────────
find_primary_chrome() {
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

find_alt_chrome() {
  # Alternative browsers that can run alongside the primary Chrome
  local candidates=(
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
    "chromium-browser"
    "chromium"
  )
  for c in "${candidates[@]}"; do
    if command -v "$c" &>/dev/null || [ -x "$c" ]; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

# ── Check if CDP is already listening ───────────────────────────
check_cdp_alive() {
  curl -sf "http://127.0.0.1:${CDP_PORT}/json/version" >/dev/null 2>&1
}

get_ws_url() {
  curl -sf "http://127.0.0.1:${CDP_PORT}/json/version" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['webSocketDebuggerUrl'])" 2>/dev/null || true
}

# ── Check if any Chrome process is running ──────────────────────
is_chrome_running() {
  pgrep -f "Google Chrome" >/dev/null 2>&1
}

# ── Launch a browser with CDP ───────────────────────────────────
launch_with_cdp() {
  local browser_bin="$1"
  local profile="$2"

  mkdir -p "${profile}"

  log "Launching $(basename "$browser_bin") with CDP on port ${CDP_PORT}..."
  "$browser_bin" \
    --remote-debugging-port="${CDP_PORT}" \
    --user-data-dir="${profile}" \
    --no-first-run \
    --no-default-browser-check \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    &>/dev/null &

  local pid=$!
  log "Browser PID: ${pid}"

  # Wait for CDP to become available (up to 15 seconds)
  for _ in $(seq 1 30); do
    if check_cdp_alive; then
      local ws_url
      ws_url=$(get_ws_url)
      if [ -n "${ws_url}" ]; then
        log "CDP ready on port ${CDP_PORT}"
        echo "${ws_url}"
        return 0
      fi
    fi
    sleep 0.5
  done

  return 1
}

# ── Main ────────────────────────────────────────────────────────

# 1. If CDP is already listening, reuse it
if check_cdp_alive; then
  WS_URL=$(get_ws_url)
  log "Chrome CDP already running on port ${CDP_PORT}"
  echo "${WS_URL}"
  exit 0
fi

# 2. If Chrome is NOT running, launch it with CDP
if ! is_chrome_running; then
  CHROME_BIN=$(find_primary_chrome) || die "Chrome not found. Install Google Chrome."
  launch_with_cdp "$CHROME_BIN" "${PROFILE_DIR}" && exit 0
  die "Failed to launch Chrome with CDP"
fi

# 3. Chrome IS running but WITHOUT CDP — try an alternative browser
log "Chrome is running but without CDP. Trying alternative browser..."

ALT_CHROME=$(find_alt_chrome 2>/dev/null) || true

if [ -n "$ALT_CHROME" ]; then
  ALT_PROFILE="${HOME}/.crewly/chrome-alt-stealth-profile"
  launch_with_cdp "$ALT_CHROME" "$ALT_PROFILE" && exit 0
  die "Failed to launch alternative browser with CDP"
fi

# 4. No alternative browser available — give user instructions
die "Chrome is already running without CDP, and no alternative browser (Chrome Canary, Chromium) is installed.

To fix this, either:
  a) Close Chrome and retry (browse-stealth will relaunch it with CDP)
  b) Install Chrome Canary: https://www.google.com/chrome/canary/
  c) Install Chromium: brew install chromium
  d) Restart Chrome with: open -a 'Google Chrome' --args --remote-debugging-port=${CDP_PORT}"
