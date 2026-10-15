#!/bin/bash
# =============================================================================
# host-api — read or change data in the portal an [EXTERNAL MESSAGE] came
# from, AS THAT PERSON. The portal answers with their own permissions: you
# see what they could see in the portal, nothing more.
#
# Start with `GET /` to read the portal's list of operations.
#
# Backed by POST /api/external/host-api. specs/2026-10-15-embedded-agent.md.
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

print_usage() {
  cat <<'EOF_USAGE'
Usage:
  bash execute.sh --conversation ext-7f2c0a1b2c3d GET /                    # what this portal offers
  bash execute.sh --conversation ext-7f2c0a1b2c3d GET "/my-classes?from=2026-10-15"
  bash execute.sh --conversation ext-7f2c0a1b2c3d POST /tickets --body '{"title":"Projector broken","body":"Room 2"}'

Options:
  --conversation  The conversation id from the [EXTERNAL MESSAGE] header
  METHOD PATH     GET, POST, PUT, PATCH or DELETE, and a path starting with /
  --body          JSON body (POST / PUT / PATCH)
  --help | -h     Show this help
EOF_USAGE
}

CONV=""; METHOD=""; HPATH=""; BODY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --conversation) [ $# -ge 2 ] || error_exit "--conversation requires a value"; CONV="$2"; shift 2 ;;
    --body)         [ $# -ge 2 ] || error_exit "--body requires a value"; BODY="$2"; shift 2 ;;
    --help|-h)      print_usage; exit 0 ;;
    --*)            unknown_arg_exit "$1" ;;
    *)
      if [ -z "$METHOD" ]; then METHOD="$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')"
      elif [ -z "$HPATH" ]; then HPATH="$1"
      else error_exit "unexpected argument: $1"; fi
      shift ;;
  esac
done

[ -n "$CONV" ] || error_exit "--conversation is required (from the [EXTERNAL MESSAGE] header)"
[[ "$CONV" =~ ^ext-[0-9a-f]{12}$ ]] || error_exit "--conversation must look like ext-7f2c0a1b2c3d"
case "$METHOD" in GET|POST|PUT|PATCH|DELETE) ;; *) error_exit "METHOD must be GET, POST, PUT, PATCH or DELETE" ;; esac
[[ "$HPATH" == /* ]] || error_exit "PATH must start with /"
if [ -n "$BODY" ]; then
  printf '%s' "$BODY" | jq -e . >/dev/null 2>&1 || error_exit "--body must be JSON"
  REQ=$(jq -cn --arg c "$CONV" --arg m "$METHOD" --arg p "$HPATH" --argjson b "$BODY" '{conversation: $c, method: $m, path: $p, body: $b}')
else
  REQ=$(jq -cn --arg c "$CONV" --arg m "$METHOD" --arg p "$HPATH" '{conversation: $c, method: $m, path: $p}')
fi

OUT=$(api_call POST /external/host-api "$REQ" 2>&1) || {
  LAST=$(printf '%s\n' "$OUT" | tail -n 1)
  printf '%s' "$LAST" | jq -c '{success: false, status: (.status // 0), reason: (.details.error // .error // "unknown"), message: (.details.message // "")}' 2>/dev/null \
    || jq -n --arg r "$LAST" '{success: false, reason: $r}'
  exit 1
}
# The portal's answer: JSON bodies are inlined, anything else is a string.
printf '%s\n' "$OUT" | tail -n 1 | jq -c '.data | {success: (.status < 400), status, truncated,
  body: (.body as $b | try ($b | fromjson) catch $b)}'
