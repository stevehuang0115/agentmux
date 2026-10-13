#!/bin/bash
# =============================================================================
# request-file — ask the owner for a (large) file through a Crewly Cloud upload
# link (crewly-services apps/SPEC.md section 19).
#
# The backend (POST /api/apps/upload-requests) asks Cloud for a request; the
# owner opens the link on their phone and uploads in chunks; the machine's
# upload watcher tells the agent when the file is ready (receive-file).
#
# Usage:
#   bash execute.sh --purpose <text> [--agent-name <name>] [--max-files <n>]
#   bash execute.sh --status <requestId>
#   bash execute.sh --cancel <requestId>
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

print_usage() {
  cat <<'EOF_USAGE'
Usage:
  bash execute.sh --purpose <text> [--agent-name <name>] [--max-files <n>]
  bash execute.sh --status <requestId>
  bash execute.sh --cancel <requestId>

Options:
  --purpose     What you need the file for, in your words (required, up to 300 characters; the owner sees it)
  --agent-name  The name the owner sees (default: your session name)
  --max-files   How many files the link accepts, 1 to 10 (default 10)
  --status      Show a request: state, limits, files uploaded so far
  --cancel      Withdraw a link you no longer need
  --help | -h   Show this help
EOF_USAGE
}

fail_from() {
  printf '%s' "$1" | jq -c '{success: false, status: (.status // 0), reason: (.details.error // .error // "unknown"), message: (.details.message // .details // "")}' 2>/dev/null \
    || jq -cn --arg r "$1" '{success: false, reason: $r}'
  exit 1
}

call() {
  local out
  out=$(api_call "$@" 2>&1) || { fail_from "$(printf '%s\n' "$out" | tail -n 1)"; }
  printf '%s\n' "$out" | tail -n 1
}

PURPOSE=""; AGENT_NAME=""; MAX_FILES=""; STATUS=""; CANCEL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --purpose)    [ $# -ge 2 ] || error_exit "--purpose requires a value"; PURPOSE="$2"; shift 2 ;;
    --agent-name) [ $# -ge 2 ] || error_exit "--agent-name requires a value"; AGENT_NAME="$2"; shift 2 ;;
    --max-files)  [ $# -ge 2 ] || error_exit "--max-files requires a value"; MAX_FILES="$2"; shift 2 ;;
    --status)     [ $# -ge 2 ] || error_exit "--status requires a request id"; STATUS="$2"; shift 2 ;;
    --cancel)     [ $# -ge 2 ] || error_exit "--cancel requires a request id"; CANCEL="$2"; shift 2 ;;
    --help|-h)    print_usage; exit 0 ;;
    *) unknown_arg_exit "$1" ;;
  esac
done

ID_RE='^ur_[A-Za-z0-9_-]{22}$'

if [ -n "$STATUS" ]; then
  [[ "$STATUS" =~ $ID_RE ]] || error_exit "--status needs a request id like ur_…"
  RESULT=$(call GET "/apps/upload-requests/${STATUS}") || { printf '%s\n' "$RESULT"; exit 1; }
  printf '%s' "$RESULT" | jq -c '{success: true} + (.data | {requestId, status, purpose, expiresAt, files})'
  exit 0
fi

if [ -n "$CANCEL" ]; then
  [[ "$CANCEL" =~ $ID_RE ]] || error_exit "--cancel needs a request id like ur_…"
  RESULT=$(call DELETE "/apps/upload-requests/${CANCEL}") || { printf '%s\n' "$RESULT"; exit 1; }
  jq -cn --arg id "$CANCEL" '{success: true, requestId: $id, cancelled: true}'
  exit 0
fi

[ -n "$PURPOSE" ] || error_exit "--purpose is required: say what you need the file for"
if [ -n "$MAX_FILES" ]; then
  [[ "$MAX_FILES" =~ ^[0-9]+$ ]] && [ "$MAX_FILES" -ge 1 ] && [ "$MAX_FILES" -le 10 ] || error_exit "--max-files must be 1 to 10"
fi

BODY=$(jq -cn --arg p "$PURPOSE" --arg n "$AGENT_NAME" --arg m "$MAX_FILES" \
  '{purpose: $p} + (if $n != "" then {agentName: $n} else {} end) + (if $m != "" then {maxFiles: ($m | tonumber)} else {} end)')
CREATED=$(call POST "/apps/upload-requests" "$BODY") || { printf '%s\n' "$CREATED"; exit 1; }
URL=$(printf '%s' "$CREATED" | jq -r '.data.url // empty')
[ -n "$URL" ] || error_exit "Cloud answered without an upload link"

printf '%s' "$CREATED" | jq -c '{success: true} + (.data | {requestId, url, expiresAt, limits, upgradeHint})
  + {instruction: "Post the link to the owner in your own words (what you need and why; open it on the phone, pick the file from the camera roll). You will get a message with the receive-file command when the upload is done. Do not ask the owner to compress the file or use Drive."}'
