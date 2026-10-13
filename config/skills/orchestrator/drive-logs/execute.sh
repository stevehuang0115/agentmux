#!/bin/bash
# List or read the Drive mode session logs saved on this machine
# (~/.crewly/drive-logs/<date>-<sessionId>.md + .jsonl).
#   execute.sh                     recent logs, newest first
#   execute.sh --limit 20          more of them
#   execute.sh <id>                one log as markdown (id = <date>-<sessionId> or the session id)
#   execute.sh <id> --jsonl        the same log as JSON lines (one event per line)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

ID=""
LIMIT=""
FORMAT="md"
NEXT_IS_LIMIT=0
for arg in "$@"; do
  if [ "$NEXT_IS_LIMIT" = "1" ]; then LIMIT="$arg"; NEXT_IS_LIMIT=0; continue; fi
  case "$arg" in
    --limit) NEXT_IS_LIMIT=1 ;;
    --jsonl) FORMAT="jsonl" ;;
    \{*)
      ID=$(printf '%s' "$arg" | jq -r '.id // empty' 2>/dev/null || true)
      LIMIT=$(printf '%s' "$arg" | jq -r '.limit // empty' 2>/dev/null || true)
      printf '%s' "$arg" | jq -e '.format == "jsonl"' >/dev/null 2>&1 && FORMAT="jsonl"
      ;;
    -*) ;;
    *) ID="$arg" ;;
  esac
done

if [ -z "$ID" ]; then
  RAW=$(api_call GET "/drive-logs${LIMIT:+?limit=${LIMIT}}")
  printf '%s' "$RAW" | jq -r 'if .success == true then (if (.data | length) == 0 then "No Drive logs on this machine yet." else (.data[] | "\(.id)\t\(.savedAt)\t\(.bytes) bytes\t\(.summary // "")") end) else (.error // "drive logs unavailable") end'
else
  RAW=$(api_call GET "/drive-logs/${ID}?format=${FORMAT}")
  printf '%s' "$RAW" | jq -r 'if .success == true then .data else (.error // "drive log unavailable") end'
fi
