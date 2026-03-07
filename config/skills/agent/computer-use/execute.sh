#!/usr/bin/env bash
# =============================================================================
# Agent Browser — Universal Desktop Control
# Main entry point with subcommands for app discovery, AppleScript,
# Accessibility API, and Playwright CDP integration.
#
# Usage:
#   bash execute.sh <subcommand> [--options...]
#
# Subcommands:
#   list-apps                 List all controllable GUI apps
#   app-info   --app NAME     Get detailed app info
#   ui-tree    --app NAME     Read UI element tree (Accessibility)
#   click      --app NAME     Click element or coordinates
#   type       --text TEXT    Type text in focused field
#   get-text   --app NAME     Extract all text from app
#   scroll     --app NAME     Scroll within app
#   focus      --app NAME     Bring app to foreground
#   screenshot [--app NAME]   Screenshot app or full screen
#   applescript --code CODE   Run custom AppleScript
#   applescript --preset NAME Run preset AppleScript
#   check-access              Check Accessibility permission
#   chrome-connect [--port N] Connect to Chrome CDP
#   chrome-tabs    [--port N] List Chrome tabs
#   chrome-eval    --code JS  Evaluate JS in Chrome tab
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"
LOG_DIR="${HOME}/.crewly/logs"
LOG_FILE="${LOG_DIR}/computer-use.log"

# Source lib files
source "${LIB_DIR}/discover.sh"
source "${LIB_DIR}/applescript.sh"
source "${LIB_DIR}/accessibility.sh"
source "${LIB_DIR}/screenshot.sh"
source "${LIB_DIR}/playwright.sh"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# -----------------------------------------------------------------------------
# Logging — all actions are logged for audit trail
# -----------------------------------------------------------------------------
log_action() {
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[$timestamp] $*" >> "$LOG_FILE"
}

# -----------------------------------------------------------------------------
# Argument parsing
# -----------------------------------------------------------------------------
SUBCOMMAND="${1:-}"
shift 2>/dev/null || true

# Parse named arguments
APP_NAME=""
ELEMENT=""
TEXT=""
CODE=""
PRESET=""
OUTPUT=""
DEPTH=""
DIRECTION=""
AMOUNT=""
PORT=""
TAB=""
X_COORD=""
Y_COORD=""
MENU=""
ITEM=""
FILE_PATH=""

while [ $# -gt 0 ]; do
  case "$1" in
    --app)      shift; APP_NAME="${1:-}" ;;
    --element)  shift; ELEMENT="${1:-}" ;;
    --text)     shift; TEXT="${1:-}" ;;
    --code)     shift; CODE="${1:-}" ;;
    --preset)   shift; PRESET="${1:-}" ;;
    --output)   shift; OUTPUT="${1:-}" ;;
    --depth)    shift; DEPTH="${1:-}" ;;
    --direction) shift; DIRECTION="${1:-}" ;;
    --amount)   shift; AMOUNT="${1:-}" ;;
    --port)     shift; PORT="${1:-}" ;;
    --tab)      shift; TAB="${1:-}" ;;
    --x)        shift; X_COORD="${1:-}" ;;
    --y)        shift; Y_COORD="${1:-}" ;;
    --menu)     shift; MENU="${1:-}" ;;
    --item)     shift; ITEM="${1:-}" ;;
    --path)     shift; FILE_PATH="${1:-}" ;;
    *)          ;; # Ignore unknown args
  esac
  shift 2>/dev/null || true
done

# Require a subcommand
if [ -z "$SUBCOMMAND" ]; then
  cat <<'USAGE'
Usage: bash execute.sh <subcommand> [--options...]

Subcommands:
  list-apps                          List all controllable GUI apps
  app-info      --app NAME           Get detailed app info
  ui-tree       --app NAME [--depth] Read UI element tree
  click         --app NAME --element ROLE:NAME  Click by element
  click         --app NAME --x N --y N          Click by coordinates
  type          --text TEXT          Type text in focused field
  get-text      --app NAME           Extract all text from app
  scroll        --app NAME [--direction up|down] [--amount N]
  focus         --app NAME           Bring app to foreground
  screenshot    [--app NAME] [--output PATH]
  applescript   --code 'CODE'        Run custom AppleScript
  applescript   --preset NAME --app NAME [--menu M --item I] [--path P]
  check-access                       Check Accessibility permission
  chrome-connect [--port N]          Connect to Chrome CDP
  chrome-tabs    [--port N]          List Chrome tabs
  chrome-eval    [--port N] [--tab N] --code 'JS'  Evaluate JS in tab
USAGE
  exit 1
fi

# -----------------------------------------------------------------------------
# Dispatch
# -----------------------------------------------------------------------------
case "$SUBCOMMAND" in
  list-apps)
    log_action "list-apps"
    list_apps
    ;;

  app-info)
    [ -z "$APP_NAME" ] && { echo '{"error":"Missing --app parameter"}' >&2; exit 1; }
    log_action "app-info app=$APP_NAME"
    app_info "$APP_NAME"
    ;;

  ui-tree)
    [ -z "$APP_NAME" ] && { echo '{"error":"Missing --app parameter"}' >&2; exit 1; }
    log_action "ui-tree app=$APP_NAME depth=${DEPTH:-8}"
    ui_tree "$APP_NAME" "${DEPTH:-8}"
    ;;

  click)
    [ -z "$APP_NAME" ] && { echo '{"error":"Missing --app parameter"}' >&2; exit 1; }
    log_action "click app=$APP_NAME element=${ELEMENT:-} x=${X_COORD:-} y=${Y_COORD:-}"
    click_element "$APP_NAME" "$ELEMENT" "$X_COORD" "$Y_COORD"
    ;;

  type)
    [ -z "$TEXT" ] && { echo '{"error":"Missing --text parameter"}' >&2; exit 1; }
    log_action "type chars=${#TEXT}"
    type_text "$TEXT"
    ;;

  get-text)
    [ -z "$APP_NAME" ] && { echo '{"error":"Missing --app parameter"}' >&2; exit 1; }
    log_action "get-text app=$APP_NAME depth=${DEPTH:-25}"
    get_text "$APP_NAME" "${DEPTH:-25}"
    ;;

  scroll)
    log_action "scroll app=${APP_NAME:-focused} direction=${DIRECTION:-down} amount=${AMOUNT:-3}"
    scroll_app "${DIRECTION:-down}" "${AMOUNT:-3}" "$APP_NAME"
    ;;

  focus)
    [ -z "$APP_NAME" ] && { echo '{"error":"Missing --app parameter"}' >&2; exit 1; }
    log_action "focus app=$APP_NAME"
    focus_app "$APP_NAME"
    ;;

  screenshot)
    log_action "screenshot app=${APP_NAME:-full-screen} output=${OUTPUT:-/tmp/screenshot.png}"
    take_screenshot "${OUTPUT:-/tmp/screenshot.png}" "$APP_NAME"
    ;;

  applescript)
    if [ -n "$PRESET" ]; then
      log_action "applescript preset=$PRESET app=${APP_NAME:-} menu=${MENU:-} item=${ITEM:-} path=${FILE_PATH:-}"
      case "$PRESET" in
        activate-app)   run_preset "activate-app" "$APP_NAME" ;;
        get-window-list) run_preset "get-window-list" "$APP_NAME" ;;
        click-menu-item) run_preset "click-menu-item" "$APP_NAME" "$MENU" "$ITEM" ;;
        open-file)       run_preset "open-file" "$FILE_PATH" ;;
        get-clipboard)   run_preset "get-clipboard" ;;
        set-clipboard)   run_preset "set-clipboard" "$TEXT" ;;
        *)              echo '{"error":"Unknown preset: '"$PRESET"'"}' >&2; exit 1 ;;
      esac
    elif [ -n "$CODE" ]; then
      log_action "applescript custom-code"
      run_applescript "$CODE"
    else
      echo '{"error":"Missing --code or --preset parameter"}' >&2
      exit 1
    fi
    ;;

  check-access)
    log_action "check-access"
    do_check_access
    ;;

  chrome-connect)
    log_action "chrome-connect port=${PORT:-9222}"
    chrome_connect "${PORT:-9222}"
    ;;

  chrome-tabs)
    log_action "chrome-tabs port=${PORT:-9222}"
    chrome_tabs "${PORT:-9222}"
    ;;

  chrome-eval)
    [ -z "$CODE" ] && { echo '{"error":"Missing --code parameter"}' >&2; exit 1; }
    log_action "chrome-eval port=${PORT:-9222} tab=${TAB:-0}"
    chrome_eval "${PORT:-9222}" "${TAB:-0}" "$CODE"
    ;;

  *)
    echo "{\"error\":\"Unknown subcommand: $SUBCOMMAND\"}" >&2
    exit 1
    ;;
esac
