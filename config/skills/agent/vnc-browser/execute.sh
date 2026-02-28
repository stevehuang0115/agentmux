#!/bin/bash
# VNC Remote Browser Access — bridge macOS Screen Sharing to a public URL via noVNC
# Allows remote viewing/control of the Mac desktop (and any browser on it) via a web URL.
#
# Architecture:
#   macOS Screen Sharing (built-in VNC server on port 5900)
#   → websockify (WebSocket bridge + noVNC web server, port 6080)
#   → cloudflared (Quick Tunnel → public HTTPS URL)
#
# Prerequisites: macOS Screen Sharing must be enabled manually in System Settings.
#
# Usage: execute.sh '{"action":"start|stop|status|get-url"}'
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
VNC_PORT=5900
NOVNC_PORT=6080
PID_DIR="${HOME}/.crewly/vnc"
NOVNC_DIR="${HOME}/.crewly/novnc"
CLOUDFLARED_LOG="${PID_DIR}/cloudflared.log"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"action\":\"start|stop|status|get-url\"}'"

ACTION=$(echo "$INPUT" | jq -r '.action // empty')
require_param "action" "$ACTION"

mkdir -p "$PID_DIR"

# ---------------------------------------------------------------------------
# Dependency installation (macOS / Homebrew)
# ---------------------------------------------------------------------------
install_deps() {
  local missing=()

  # websockify — WebSocket-to-TCP bridge (Python)
  if ! command -v websockify &>/dev/null; then
    missing+=("websockify")
    echo '{"status":"installing","dep":"websockify"}' >&2
    pip3 install websockify 2>/dev/null \
      || error_exit "Failed to install websockify. Run: pip3 install websockify"
  fi

  # noVNC — HTML5 VNC client
  if ! [ -d "$NOVNC_DIR" ] || ! [ -f "$NOVNC_DIR/vnc.html" ]; then
    missing+=("novnc")
    echo '{"status":"installing","dep":"novnc"}' >&2
    local novnc_version="1.5.0"
    local novnc_url="https://github.com/novnc/noVNC/archive/refs/tags/v${novnc_version}.tar.gz"
    mkdir -p "$NOVNC_DIR"
    curl -sL "$novnc_url" | tar -xz -C "$NOVNC_DIR" --strip-components=1
    if ! [ -f "$NOVNC_DIR/vnc.html" ]; then
      rm -rf "$NOVNC_DIR"
      error_exit "Failed to download noVNC web client"
    fi
  fi

  # cloudflared — Cloudflare Tunnel for public HTTPS URL
  if ! command -v cloudflared &>/dev/null; then
    missing+=("cloudflared")
    echo '{"status":"installing","dep":"cloudflared"}' >&2
    brew install cloudflare/cloudflare/cloudflared 2>/dev/null \
      || error_exit "Failed to install cloudflared. Run: brew install cloudflare/cloudflare/cloudflared"
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    echo '{"status":"deps_installed","installed":"'"$(IFS=,; echo "${missing[*]}")"'"}' >&2
  fi
}

# ---------------------------------------------------------------------------
# Helper: check if a service is running via its PID file
# ---------------------------------------------------------------------------
is_running() {
  local pid_file="$PID_DIR/${1}.pid"
  [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Helper: check if macOS Screen Sharing VNC is listening on port 5900
# ---------------------------------------------------------------------------
check_screen_sharing() {
  nc -z localhost "$VNC_PORT" 2>/dev/null
}

# ---------------------------------------------------------------------------
# start — Launch websockify + cloudflared (requires Screen Sharing on)
# ---------------------------------------------------------------------------
start_vnc() {
  # Already running?
  if is_running websockify && is_running cloudflared; then
    local url=""
    [ -f "$PID_DIR/tunnel_url.txt" ] && url=$(cat "$PID_DIR/tunnel_url.txt")
    jq -n --arg url "$url" \
      '{success: true, status: "already_running", publicUrl: (if $url != "" then ($url + "/vnc.html?autoconnect=true") else null end), localUrl: ("http://localhost:'"$NOVNC_PORT"'/vnc.html?autoconnect=true")}'
    return 0
  fi

  # Check macOS Screen Sharing is enabled
  if ! check_screen_sharing; then
    error_exit "macOS Screen Sharing is not running (port $VNC_PORT not listening). Enable it: System Settings → General → Sharing → Screen Sharing → ON"
  fi

  # Install missing dependencies
  install_deps

  # 1. Start websockify (WebSocket bridge + noVNC web server)
  #    Bridges noVNC web client (port 6080) to macOS VNC (port 5900)
  websockify --web "$NOVNC_DIR" "$NOVNC_PORT" "localhost:$VNC_PORT" \
    > "$PID_DIR/websockify.log" 2>&1 &
  echo $! > "$PID_DIR/websockify.pid"
  sleep 1

  if ! is_running websockify; then
    error_exit "websockify failed to start. Check $PID_DIR/websockify.log"
  fi

  # 2. Start cloudflared Quick Tunnel (zero-config public URL)
  cloudflared tunnel --url "http://localhost:$NOVNC_PORT" \
    > "$CLOUDFLARED_LOG" 2>&1 &
  echo $! > "$PID_DIR/cloudflared.pid"

  # Wait for cloudflared to print the tunnel URL (up to 30s)
  local url=""
  for _ in $(seq 1 30); do
    url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CLOUDFLARED_LOG" 2>/dev/null | head -1 || true)
    [ -n "$url" ] && break
    sleep 1
  done

  if [ -n "$url" ]; then
    echo "$url" > "$PID_DIR/tunnel_url.txt"
    jq -n --arg url "$url" \
      '{success: true, status: "started", publicUrl: ($url + "/vnc.html?autoconnect=true"), localUrl: ("http://localhost:'"$NOVNC_PORT"'/vnc.html?autoconnect=true"), hint: "Share the publicUrl with the user. They will see the Mac desktop and can interact with the browser."}'
  else
    jq -n \
      '{success: true, status: "started_no_tunnel", publicUrl: null, localUrl: ("http://localhost:'"$NOVNC_PORT"'/vnc.html?autoconnect=true"), hint: "Cloudflared URL not ready yet. Use get-url action to retrieve it later."}'
  fi
}

# ---------------------------------------------------------------------------
# stop — Tear down websockify + cloudflared (does NOT touch Screen Sharing)
# ---------------------------------------------------------------------------
stop_vnc() {
  local stopped=0

  for service in cloudflared websockify; do
    local pid_file="$PID_DIR/${service}.pid"
    if [ -f "$pid_file" ]; then
      local pid
      pid=$(cat "$pid_file")
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        stopped=$((stopped + 1))
      fi
      rm -f "$pid_file"
    fi
  done

  rm -f "$PID_DIR/tunnel_url.txt"

  jq -n --argjson stopped "$stopped" \
    '{success: true, status: "stopped", stoppedServices: $stopped, note: "macOS Screen Sharing was not touched"}'
}

# ---------------------------------------------------------------------------
# status — Check which services are running
# ---------------------------------------------------------------------------
status_vnc() {
  local services='[]'
  local all_running=true

  # Check macOS Screen Sharing (port 5900)
  local screen_sharing=false
  if check_screen_sharing; then
    screen_sharing=true
  else
    all_running=false
  fi
  services=$(echo "$services" | jq \
    --arg name "screen-sharing" \
    --argjson running "$screen_sharing" \
    --arg pid "system" \
    '. + [{name: $name, running: $running, pid: $pid}]')

  # Check managed services
  for service in websockify cloudflared; do
    local pid_file="$PID_DIR/${service}.pid"
    local running=false
    local pid=""

    if [ -f "$pid_file" ]; then
      pid=$(cat "$pid_file")
      if kill -0 "$pid" 2>/dev/null; then
        running=true
      fi
    fi

    [ "$running" = false ] && all_running=false

    services=$(echo "$services" | jq \
      --arg name "$service" \
      --argjson running "$running" \
      --arg pid "$pid" \
      '. + [{name: $name, running: $running, pid: $pid}]')
  done

  local url=""
  [ -f "$PID_DIR/tunnel_url.txt" ] && url=$(cat "$PID_DIR/tunnel_url.txt")

  jq -n \
    --argjson allRunning "$all_running" \
    --argjson services "$services" \
    --arg publicUrl "${url:-}" \
    '{success: true, allRunning: $allRunning, publicUrl: (if $publicUrl != "" then ($publicUrl + "/vnc.html?autoconnect=true") else null end), services: $services}'
}

# ---------------------------------------------------------------------------
# get-url — Retrieve the public tunnel URL
# ---------------------------------------------------------------------------
get_url() {
  # Try saved URL
  if [ -f "$PID_DIR/tunnel_url.txt" ]; then
    local url
    url=$(cat "$PID_DIR/tunnel_url.txt")
    if [ -n "$url" ]; then
      jq -n --arg url "$url" \
        '{success: true, publicUrl: ($url + "/vnc.html?autoconnect=true"), localUrl: ("http://localhost:'"$NOVNC_PORT"'/vnc.html?autoconnect=true")}'
      return 0
    fi
  fi

  # Try parsing from cloudflared log
  if [ -f "$CLOUDFLARED_LOG" ]; then
    local url
    url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CLOUDFLARED_LOG" 2>/dev/null | head -1 || true)
    if [ -n "$url" ]; then
      echo "$url" > "$PID_DIR/tunnel_url.txt"
      jq -n --arg url "$url" \
        '{success: true, publicUrl: ($url + "/vnc.html?autoconnect=true"), localUrl: ("http://localhost:'"$NOVNC_PORT"'/vnc.html?autoconnect=true")}'
      return 0
    fi
  fi

  error_exit "No tunnel URL available. Is VNC started? Try: execute.sh '{\"action\":\"start\"}'"
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
case "$ACTION" in
  start)   start_vnc ;;
  stop)    stop_vnc ;;
  status)  status_vnc ;;
  get-url) get_url ;;
  *)       error_exit "Unknown action: $ACTION. Valid actions: start, stop, status, get-url" ;;
esac
