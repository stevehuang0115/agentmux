#!/bin/bash
# Rank the teams (and the member to ask) that should own a request.
#   execute.sh "<what the owner asked for>"
#   execute.sh '{"request":"<text>","limit":3}'
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT=$(read_json_input "${1:-}")
[ -z "$INPUT" ] && error_exit "Usage: execute.sh \"<request text>\"  (or '{\"request\":\"...\",\"limit\":3}')"

REQUEST="$INPUT"
LIMIT=""
if printf '%s' "$INPUT" | jq -e 'type == "object"' >/dev/null 2>&1; then
  REQUEST=$(printf '%s' "$INPUT" | jq -r '.request // .q // empty')
  LIMIT=$(printf '%s' "$INPUT" | jq -r '.limit // empty')
fi
[ -z "$REQUEST" ] && error_exit "request is required: the owner's words, as they wrote them"

QUERY=$(jq -rn --arg q "$REQUEST" '$q | @uri')
URL="/team-roster/find?q=${QUERY}"
[ -n "$LIMIT" ] && URL="${URL}&limit=${LIMIT}"

RAW=$(api_call GET "$URL")
printf '%s' "$RAW" | jq -r '
  if .success != true then (.error // "lookup failed")
  elif (.data | length) == 0 then "No team matches this request. Ask the owner which team should take it, or run team-roster and decide."
  else
    (.data | to_entries | map(
      "\(.key + 1). \(.value.team) — hand to \(.value.handTo)"
      + (if .value.likelyDoer then " (likely doer: \(.value.likelyDoer))" else "" end)
      + " · score \(.value.score) · matched: \(.value.matched | join(", "))"
      + (if .value.paused then " · PAUSED (owner): do not hand it work" else "" end)
      + (if .value.charterSource == "derived" then " · charter derived" else "" end)
    ) | join("\n"))
    + (if .data[0].ambiguous and (.data | length) > 1 then "\n\nTop two are close: only now ask the owner which one." else "\n\nClear winner: hand it over and tell the owner whom in one line." end)
  end'
