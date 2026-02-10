#!/bin/bash
# Get recent terminal output from an agent's session
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"sessionName\":\"agent-session\",\"lines\":50}'"

SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')
LINES=$(echo "$INPUT" | jq -r '.lines // "50"')
require_param "sessionName" "$SESSION_NAME"

api_call GET "/terminal/${SESSION_NAME}/output?lines=${LINES}"
