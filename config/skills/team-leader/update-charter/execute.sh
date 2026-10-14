#!/bin/bash
# Write or clear your team's charter: the few sentences that say what the team
# owns, what it takes and what it avoids. The orchestrator routes owner
# requests with it.
#   execute.sh '{"teamId":"<id>","charter":"<text, 400 chars max>"}'
#   execute.sh '{"teamId":"<id>","charter":""}'      # clear (falls back to the description)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT=$(read_json_input "${1:-}")
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"teamId\":\"uuid\",\"charter\":\"what the team owns, takes and avoids\"}'"

TEAM_ID=$(printf '%s' "$INPUT" | jq -r '.teamId // empty')
require_param "teamId" "$TEAM_ID"
if ! printf '%s' "$INPUT" | jq -e 'has("charter")' >/dev/null 2>&1; then
  error_exit "charter is required (use an empty string to clear it)"
fi

BODY=$(printf '%s' "$INPUT" | jq -c '{charter: (.charter | tostring)}')
api_call PUT "/teams/${TEAM_ID}/charter" "$BODY"
