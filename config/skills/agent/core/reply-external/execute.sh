#!/bin/bash
# =============================================================================
# reply-external — answer a person outside the team who wrote to you through
# an embedded panel (an [EXTERNAL MESSAGE] in your session). This is the ONLY
# way your words reach them: terminal text, chat posts and teammate messages
# never do.
#
# Every reply passes a guard first. A blocked reply is not sent; the output
# says why ("reasons"), and you write it again.
#
# Backed by POST /api/external/replies. specs/2026-10-15-embedded-agent.md.
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

print_usage() {
  cat <<'EOF_USAGE'
Usage:
  bash execute.sh --conversation ext-7f2c0a1b2c3d "Your Thursday class is at 3pm in room 2."
  bash execute.sh --conversation ext-7f2c0a1b2c3d --text "…"

Options:
  --conversation  The conversation id from the [EXTERNAL MESSAGE] header (ext- + 12 hex)
  --text          The reply (or pass it as the last argument); at most 8000 characters
  --help | -h     Show this help
EOF_USAGE
}

CONV=""; TEXT=""; HAS_TEXT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --conversation) [ $# -ge 2 ] || error_exit "--conversation requires a value"; CONV="$2"; shift 2 ;;
    --text)         [ $# -ge 2 ] || error_exit "--text requires a value"; TEXT="$2"; HAS_TEXT=1; shift 2 ;;
    --help|-h)      print_usage; exit 0 ;;
    --*)            unknown_arg_exit "$1" ;;
    *)              [ "$HAS_TEXT" = 0 ] || error_exit "give the reply once"; TEXT="$1"; HAS_TEXT=1; shift ;;
  esac
done

[ -n "$CONV" ] || error_exit "--conversation is required (from the [EXTERNAL MESSAGE] header)"
[[ "$CONV" =~ ^ext-[0-9a-f]{12}$ ]] || error_exit "--conversation must look like ext-7f2c0a1b2c3d"
[ "$HAS_TEXT" = 1 ] && [ -n "${TEXT//[[:space:]]/}" ] || error_exit "the reply is empty"
[ "$(printf '%s' "$TEXT" | jq -Rs 'length')" -le 8000 ] || error_exit "the reply is at most 8000 characters"

OUT=$(api_call POST /external/replies "$(jq -cn --arg c "$CONV" --arg t "$TEXT" '{conversation: $c, text: $t}')" 2>&1) || {
  LAST=$(printf '%s\n' "$OUT" | tail -n 1)
  printf '%s' "$LAST" | jq -c '{success: false, status: (.status // 0), reason: (.details.error // .error // "unknown"),
      reasons: (.details.reasons // []), message: (.details.message // "")}
    + (if .details.error == "reply_blocked" then {next: "Not sent. Rewrite the reply without what the message names, then call reply-external again."} else {} end)' 2>/dev/null \
    || jq -n --arg r "$LAST" '{success: false, reason: $r}'
  exit 1
}
printf '%s\n' "$OUT" | tail -n 1 | jq -c '{success: true, sent: (.data.sent // true), conversation: "'"$CONV"'"}'
