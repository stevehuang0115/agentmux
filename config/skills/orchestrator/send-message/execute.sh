#!/bin/bash
# Send a message to an agent's terminal session
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"sessionName\":\"agent-session\",\"message\":\"hello\"}'"

SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')
MESSAGE=$(echo "$INPUT" | jq -r '.message // empty')
require_param "sessionName" "$SESSION_NAME"
require_param "message" "$MESSAGE"

# waitTimeout matches EVENT_DELIVERY_CONSTANTS.AGENT_READY_TIMEOUT (120000ms)
BODY=$(jq -n --arg message "$MESSAGE" '{message: $message, waitForReady: true, waitTimeout: 120000}')

api_call POST "/terminal/${SESSION_NAME}/deliver" "$BODY"
