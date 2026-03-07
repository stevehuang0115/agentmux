#!/usr/bin/env bash
# =============================================================================
# Playwright CDP Integration — Layer 4
# Connect to Chrome via Chrome DevTools Protocol for web app automation.
# Requires Chrome launched with --remote-debugging-port.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

DEFAULT_CDP_PORT=9222

# -----------------------------------------------------------------------------
# chrome_connect — Test CDP connection to Chrome
# Params: port (default 9222)
# -----------------------------------------------------------------------------
chrome_connect() {
  local port="${1:-$DEFAULT_CDP_PORT}"

  # Check if Chrome is reachable via CDP
  local response
  response=$(curl -s --connect-timeout 3 "http://127.0.0.1:${port}/json/version" 2>&1) || {
    echo "{\"success\":false,\"action\":\"chrome-connect\",\"port\":$port,\"error\":\"Cannot connect to Chrome CDP on port $port. Launch Chrome with: open -a 'Google Chrome' --args --remote-debugging-port=$port\"}"
    return 1
  }

  local browser
  browser=$(echo "$response" | jq -r '.Browser // "unknown"' 2>/dev/null || echo "unknown")
  local ws_url
  ws_url=$(echo "$response" | jq -r '.webSocketDebuggerUrl // "unknown"' 2>/dev/null || echo "unknown")

  echo "{\"success\":true,\"action\":\"chrome-connect\",\"port\":$port,\"browser\":\"$browser\",\"wsUrl\":\"$ws_url\"}"
}

# -----------------------------------------------------------------------------
# chrome_tabs — List open Chrome tabs via CDP
# Params: port (default 9222)
# -----------------------------------------------------------------------------
chrome_tabs() {
  local port="${1:-$DEFAULT_CDP_PORT}"

  local response
  response=$(curl -s --connect-timeout 3 "http://127.0.0.1:${port}/json/list" 2>&1) || {
    echo "{\"success\":false,\"action\":\"chrome-tabs\",\"error\":\"Cannot connect to Chrome CDP on port $port\"}"
    return 1
  }

  # Filter to page type only and extract useful fields
  local tabs
  tabs=$(echo "$response" | jq '[.[] | select(.type == "page") | {id: .id, title: .title, url: .url}]' 2>/dev/null || echo "[]")

  local count
  count=$(echo "$tabs" | jq 'length' 2>/dev/null || echo "0")

  echo "{\"success\":true,\"action\":\"chrome-tabs\",\"port\":$port,\"count\":$count,\"tabs\":$tabs}"
}

# -----------------------------------------------------------------------------
# chrome_eval — Run JavaScript in a Chrome tab via CDP
# Params: port, tabIndex, code
# Uses the REST endpoint for simple evaluations.
# -----------------------------------------------------------------------------
chrome_eval() {
  local port="${1:-$DEFAULT_CDP_PORT}"
  local tab_index="${2:-0}"
  local code="$3"

  # Get tab list
  local tabs_response
  tabs_response=$(curl -s --connect-timeout 3 "http://127.0.0.1:${port}/json/list" 2>&1) || {
    echo "{\"success\":false,\"action\":\"chrome-eval\",\"error\":\"Cannot connect to Chrome CDP\"}"
    return 1
  }

  # Get the specific tab's webSocketDebuggerUrl
  local ws_url
  ws_url=$(echo "$tabs_response" | jq -r ".[$tab_index].webSocketDebuggerUrl // empty" 2>/dev/null)

  if [ -z "$ws_url" ]; then
    echo "{\"success\":false,\"action\":\"chrome-eval\",\"error\":\"Tab index $tab_index not found\"}"
    return 1
  fi

  local tab_id
  tab_id=$(echo "$tabs_response" | jq -r ".[$tab_index].id // empty" 2>/dev/null)

  # Use CDP REST API to evaluate: activate tab first, then use the evaluate endpoint
  # Note: For simple evaluations, we use osascript to run JS in Chrome via AppleScript
  local tab_url
  tab_url=$(echo "$tabs_response" | jq -r ".[$tab_index].url // empty" 2>/dev/null)
  local tab_title
  tab_title=$(echo "$tabs_response" | jq -r ".[$tab_index].title // empty" 2>/dev/null)

  # Use the CDP WebSocket via a simple node script if available
  if command -v node &>/dev/null; then
    local result
    result=$(node -e "
      const http = require('http');
      const data = JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: $(echo "$code" | jq -Rs .), returnByValue: true }
      });

      // Use HTTP endpoint to send CDP command
      const ws = require('ws');
      const client = new ws('$ws_url');
      let timeout = setTimeout(() => {
        console.log(JSON.stringify({success: false, error: 'Timeout'}));
        process.exit(1);
      }, 10000);

      client.on('open', () => {
        client.send(data);
      });
      client.on('message', (msg) => {
        clearTimeout(timeout);
        const resp = JSON.parse(msg);
        if (resp.result && resp.result.result) {
          console.log(JSON.stringify({
            success: true,
            action: 'chrome-eval',
            tabId: '$tab_id',
            value: resp.result.result.value,
            type: resp.result.result.type
          }));
        } else if (resp.result && resp.result.exceptionDetails) {
          console.log(JSON.stringify({
            success: false,
            action: 'chrome-eval',
            error: resp.result.exceptionDetails.text || 'Evaluation error'
          }));
        }
        client.close();
      });
      client.on('error', (err) => {
        clearTimeout(timeout);
        console.log(JSON.stringify({success: false, error: err.message}));
        process.exit(1);
      });
    " 2>&1) || {
      # Fallback if ws module not available
      echo "{\"success\":false,\"action\":\"chrome-eval\",\"error\":\"Node.js 'ws' module required. Install: npm install -g ws\"}"
      return 1
    }
    echo "$result"
  else
    echo "{\"success\":false,\"action\":\"chrome-eval\",\"error\":\"Node.js required for chrome-eval. Install Node.js first.\"}"
    return 1
  fi
}
