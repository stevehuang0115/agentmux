#!/bin/bash
# Register the orchestrator with the AgentMux backend
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"role\":\"orchestrator\",\"sessionName\":\"agentmux-orc\"}'"

ROLE=$(echo "$INPUT" | jq -r '.role // empty')
SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')
require_param "role" "$ROLE"
require_param "sessionName" "$SESSION_NAME"

# Optional: claudeSessionId for resume support
CLAUDE_SESSION_ID=$(echo "$INPUT" | jq -r '.claudeSessionId // empty')

BODY=$(jq -n \
  --arg role "$ROLE" \
  --arg sessionName "$SESSION_NAME" \
  --arg claudeSessionId "$CLAUDE_SESSION_ID" \
  '{role: $role, sessionName: $sessionName} + (if $claudeSessionId != "" then {claudeSessionId: $claudeSessionId} else {} end)')

api_call POST "/teams/members/register" "$BODY"
