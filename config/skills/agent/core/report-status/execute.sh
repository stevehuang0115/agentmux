#!/bin/bash
# Report task status to the orchestrator
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"sessionName\":\"dev-1\",\"status\":\"done\",\"summary\":\"Finished implementing auth module\",\"taskPath\":\"/path/to/task.md\"}'"

SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')
STATUS=$(echo "$INPUT" | jq -r '.status // empty')
SUMMARY=$(echo "$INPUT" | jq -r '.summary // empty')
TASK_PATH=$(echo "$INPUT" | jq -r '.taskPath // empty')
require_param "sessionName" "$SESSION_NAME"
require_param "status" "$STATUS"
require_param "summary" "$SUMMARY"

# Build the message the orchestrator will receive
STATUS_UPPER=$(echo "$STATUS" | tr '[:lower:]' '[:upper:]')
MESSAGE="[${STATUS_UPPER}] Agent ${SESSION_NAME}: ${SUMMARY}"

# Send the status message to the orchestrator session via the chat API
BODY=$(jq -n --arg content "$MESSAGE" --arg senderName "$SESSION_NAME" \
  '{content: $content, senderName: $senderName, senderType: "agent"}')

api_call POST "/chat/agent-response" "$BODY"

# If task is done and taskPath provided, move task file to done folder
if [ "$STATUS" = "done" ] && [ -n "$TASK_PATH" ]; then
  COMPLETE_BODY=$(jq -n \
    --arg taskPath "$TASK_PATH" \
    --arg sessionName "$SESSION_NAME" \
    '{taskPath: $taskPath, sessionName: $sessionName}')
  api_call POST "/task-management/complete" "$COMPLETE_BODY" || true
fi
