#!/bin/bash
# Record a learning or insight for team knowledge sharing
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"agentId\":\"dev-1\",\"agentRole\":\"developer\",\"projectPath\":\"/projects/app\",\"learning\":\"Jest mock resets are needed between tests\"}'"

AGENT_ID=$(echo "$INPUT" | jq -r '.agentId // empty')
AGENT_ROLE=$(echo "$INPUT" | jq -r '.agentRole // empty')
PROJECT_PATH=$(echo "$INPUT" | jq -r '.projectPath // empty')
LEARNING=$(echo "$INPUT" | jq -r '.learning // empty')
require_param "agentId" "$AGENT_ID"
require_param "agentRole" "$AGENT_ROLE"
require_param "projectPath" "$PROJECT_PATH"
require_param "learning" "$LEARNING"

# Build body with required and optional fields
BODY=$(echo "$INPUT" | jq '{
  agentId: .agentId,
  agentRole: .agentRole,
  projectPath: .projectPath,
  learning: .learning
} +
  (if .relatedTask then {relatedTask: .relatedTask} else {} end) +
  (if .relatedFiles then {relatedFiles: .relatedFiles} else {} end)')

api_call POST "/memory/record-learning" "$BODY"
