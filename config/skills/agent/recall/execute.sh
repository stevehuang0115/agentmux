#!/bin/bash
# Retrieve stored memories relevant to a given context
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"agentId\":\"dev-1\",\"context\":\"authentication patterns\"}'"

AGENT_ID=$(echo "$INPUT" | jq -r '.agentId // empty')
CONTEXT=$(echo "$INPUT" | jq -r '.context // empty')
require_param "agentId" "$AGENT_ID"
require_param "context" "$CONTEXT"

# Build body with required and optional fields
BODY=$(echo "$INPUT" | jq '{
  agentId: .agentId,
  context: .context
} +
  (if .scope then {scope: .scope} else {} end) +
  (if .limit then {limit: (.limit | tonumber)} else {} end) +
  (if .projectPath then {projectPath: .projectPath} else {} end)')

api_call POST "/memory/recall" "$BODY"
