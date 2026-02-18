#!/bin/bash
# Accept and take the next available task from the task queue
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"sessionName\":\"dev-1\"}'"

SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')
require_param "sessionName" "$SESSION_NAME"

TEAM_MEMBER_ID=$(echo "$INPUT" | jq -r '.teamMemberId // empty')

BODY=$(jq -n \
  --arg sessionName "$SESSION_NAME" \
  --arg teamMemberId "$TEAM_MEMBER_ID" \
  '{sessionName: $sessionName} +
   (if $teamMemberId != "" then {teamMemberId: $teamMemberId} else {} end)')

api_call POST "/task-management/take-next" "$BODY"
