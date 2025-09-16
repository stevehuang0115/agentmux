#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Flags: -L <label> | -S <socket_path> | --shadow
# -----------------------------
SOCK_FLAGS=()
USE_SHADOW=0

while [[ $# -gt 0 ]]; do
  case "${1:-}" in
    -L) [[ $# -ge 2 ]] || { echo "❌ -L needs a label" >&2; exit 2; }
        SOCK_FLAGS+=(-L "$2"); shift 2;;
    -S) [[ $# -ge 2 ]] || { echo "❌ -S needs a socket path" >&2; exit 2; }
        SOCK_FLAGS+=(-S "$2"); shift 2;;
    --shadow) USE_SHADOW=1; shift;;
    --) shift; break;;
    -h|--help)
      cat <<'USAGE'
Usage: tmux_robosend.sh [--shadow] [-L label | -S socket_path] <target> [--] <line...>

<target> can be:
  %<pane_id>                 e.g., %5
  <session>                  e.g., agentmux-orc
  <session>:<window>         e.g., agentmux-orc:main
  <session>:<window>.<idx>   e.g., agentmux-orc:main.0

--shadow  Create a hidden (read-only) tmux client if none attached to the target session.
          This helps interactive apps (e.g., gemini-cli) that ignore send-keys without focus.

Examples:
  tmux_robosend.sh --shadow my-sess "help"
  tmux_robosend.sh my-sess:main.0 "echo hello"
  tmux_robosend.sh -L sanity %7 "npm run dev"
USAGE
      exit 0;;
    *) break;;
  esac
done

# -----------------------------
# Required args: target + line
# -----------------------------
if [[ $# -lt 1 ]]; then
  echo "❌ Missing target (session[:window[.pane]] or %paneid). Try -h." >&2
  exit 2
fi
TARGET="$1"; shift
LINE="${*:-echo ROBOSEND_DEFAULT}"

tmuxx() { tmux "${SOCK_FLAGS[@]}" "$@"; }

# -----------------------------
# Resolve a stable pane id (+ session/window for focusing)
# -----------------------------
PANE_ID=""
SESSION=""
WINDOW=""
PANEIDX=""

if [[ "$TARGET" == %* ]]; then
  # Already a pane id
  PANE_ID="$TARGET"
  # Resolve session/window for focus operations
  META="$(tmuxx list-panes -a -F '#{pane_id} #{session_name} #{window_name} #{pane_index}' | awk -v p="$PANE_ID" '$1==p{print $2" "$3" "$4}')"
  if [[ -z "$META" ]]; then
    echo "❌ Pane $PANE_ID not found on server $(tmuxx display -p '#{socket_path}')" >&2
    exit 1
  fi
  SESSION="$(awk '{print $1}' <<<"$META")"
  WINDOW="$(awk '{print $2}' <<<"$META")"
  PANEIDX="$(awk '{print $3}' <<<"$META")"
else
  SESSION="${TARGET%%:*}"
  REST="${TARGET#*:}"
  [[ "$SESSION" == "$REST" ]] && REST=""

  if ! tmuxx has-session -t "$SESSION" 2>/dev/null; then
    echo "❌ Session '$SESSION' not found on server $(tmuxx display -p '#{socket_path}')" >&2
    exit 1
  fi

  if [[ -n "$REST" && "$REST" != "$TARGET" ]]; then
    if [[ "$REST" =~ ^([^\.]+)\.([0-9]+)$ ]]; then
      WINDOW="${BASH_REMATCH[1]}"; PANEIDX="${BASH_REMATCH[2]}"
      PANE_ID="$(tmuxx display -p -t "${SESSION}:${WINDOW}.${PANEIDX}" '#{pane_id}' 2>/dev/null || true)"
      [[ -n "$PANE_ID" ]] || { echo "❌ Pane ${SESSION}:${WINDOW}.${PANEIDX} not found." >&2; exit 1; }
    else
      WINDOW="$REST"
      PANE_ID="$(tmuxx list-panes -t "${SESSION}:${WINDOW}" -F '#{pane_id} #{pane_active}' | awk '$2=="1"{print $1;exit}')"
      [[ -n "$PANE_ID" ]] || { echo "❌ No active pane in ${SESSION}:${WINDOW}." >&2; exit 1; }
    fi
  else
    # Session only -> active pane of active window
    PANE_ID="$(tmuxx list-panes -t "${SESSION}:" -F '#{window_active} #{pane_active} #{pane_id} #{window_name} #{pane_index}' \
      | awk '$1=="1" && $2=="1"{print $3" "$4" "$5;exit}')"
    [[ -n "$PANE_ID" ]] || { echo "❌ Could not resolve active pane in session ${SESSION}." >&2; exit 1; }
    # Split out pane/session/window info
    read -r PANE_ID WINDOW PANEIDX <<<"$PANE_ID"
  fi
fi

# -----------------------------
# Shadow client (if requested and none attached)
# -----------------------------
if [[ "$USE_SHADOW" -eq 1 ]]; then
  # Turn on focus events (helps apps relying on focus in/out)
  tmuxx set -gq focus-events on || true

  # Are there any clients attached to this session?
  CLIENTS="$(tmuxx list-clients -t "$SESSION" -F '#{client_tty}' 2>/dev/null || true)"
  if [[ -z "$CLIENTS" ]]; then
    # Create a background, read-only client attached to the session using a PTY.
    # macOS/BSD 'script' syntax: script [-adkpqr] [file [command ...]]
    script -q /dev/null tmux "${SOCK_FLAGS[@]}" attach-session -r -t "$SESSION" >/dev/null 2>&1 & disown
    # Give tmux a moment to register the client
    sleep 0.15
  fi

  # Ensure the target window/pane is active (so the shadow client focuses it)
  if [[ -n "$WINDOW" ]]; then
    tmuxx select-window -t "${SESSION}:${WINDOW}" || true
  fi
  if [[ -n "$PANE_ID" ]]; then
    tmuxx select-pane -t "$PANE_ID" || true
  fi
fi

# -----------------------------
# Readiness: for shells OR common CLIs (gemini-cli often shows up as node/python)
# -----------------------------
for _ in {1..200}; do
  cmd="$(tmuxx display -p -t "$PANE_ID" '#{pane_current_command}')"
  # Accept typical executables that host CLIs: shells, node, python, etc.
  if [[ "$cmd" =~ ^(bash|zsh|fish|sh|node|python.*|gemini.*)$ ]]; then break; fi
  sleep 0.05
done

# If in copy-mode, normal keys won't reach the app
if [[ "$(tmuxx display -p -t "$PANE_ID" '#{pane_in_mode}')" == "1" ]]; then
  tmuxx send-keys -t "$PANE_ID" -X cancel || true
fi

# -----------------------------
# Send literally, then Enter
# -----------------------------
tmuxx send-keys -t "$PANE_ID" -l -- "$LINE"
tmuxx send-keys -t "$PANE_ID" C-m

# Confirmation
tmuxx display -p -t "$PANE_ID" \
  '✅ sent to #{session_name}:#{window_name}.#{pane_index} (#{pane_id}) on #{socket_path}; cmd=#{pane_current_command}, in_mode=#{pane_in_mode}'

