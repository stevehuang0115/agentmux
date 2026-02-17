#!/bin/bash
# Mark a task as complete with a summary of the work done
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"absoluteTaskPath\":\"/path/to/task\",\"sessionName\":\"dev-1\",\"summary\":\"Implemented feature X\"}'"

ABSOLUTE_TASK_PATH=$(echo "$INPUT" | jq -r '.absoluteTaskPath // empty')
SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')
SUMMARY=$(echo "$INPUT" | jq -r '.summary // empty')
SKIP_GATES=$(echo "$INPUT" | jq -r '.skipGates // empty')
require_param "absoluteTaskPath" "$ABSOLUTE_TASK_PATH"
require_param "sessionName" "$SESSION_NAME"
require_param "summary" "$SUMMARY"

BODY=$(jq -n \
  --arg absoluteTaskPath "$ABSOLUTE_TASK_PATH" \
  --arg sessionName "$SESSION_NAME" \
  --arg summary "$SUMMARY" \
  --arg skipGates "$SKIP_GATES" \
  '{absoluteTaskPath: $absoluteTaskPath, sessionName: $sessionName, summary: $summary} +
   (if $skipGates == "true" then {skipGates: true} else {} end)')

api_call POST "/task-management/complete" "$BODY"
