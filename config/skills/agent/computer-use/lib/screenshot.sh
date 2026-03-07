#!/usr/bin/env bash
# =============================================================================
# Screenshot Utility — captures screen or specific app windows
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

# -----------------------------------------------------------------------------
# take_screenshot — Capture the screen or a specific app window
# Params: output (file path), appName (optional, for window capture)
# -----------------------------------------------------------------------------
take_screenshot() {
  local output="${1:-/tmp/screenshot.png}"
  local app_name="${2:-}"

  mkdir -p "$(dirname "$output")"

  if [ -n "$app_name" ]; then
    # Get the window ID for the app, then capture that window
    local window_id
    window_id=$(osascript -l JavaScript -e "
      var app = Application('System Events');
      var proc = app.processes.byName('$app_name');
      var wins = proc.windows();
      if (wins.length > 0) {
        // Get the window number via attributes
        try {
          var attrs = wins[0].attributes();
          for (var i = 0; i < attrs.length; i++) {
            if (attrs[i].name() === 'AXWindow') {
              // Fall through to full screen capture with app focus
            }
          }
        } catch(e) {}
      }
      '';
    " 2>/dev/null || echo "")

    # Focus the app first, then capture the frontmost window
    osascript -e "tell application \"$app_name\" to activate" 2>/dev/null || true
    sleep 0.5
    screencapture -x -o -l "$(osascript -e 'tell application "System Events" to get id of first window of first process whose frontmost is true' 2>/dev/null || echo "")" "$output" 2>/dev/null || {
      # Fallback: capture full screen
      screencapture -x "$output" 2>/dev/null
    }
  else
    # Full screen capture
    screencapture -x "$output" 2>/dev/null
  fi

  if [ -f "$output" ]; then
    local size
    size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null || echo "0")
    echo "{\"success\":true,\"action\":\"screenshot\",\"file\":\"$output\",\"size\":$size,\"appName\":\"${app_name:-full-screen}\"}"
  else
    error_exit "Screenshot failed — file not created"
  fi
}
