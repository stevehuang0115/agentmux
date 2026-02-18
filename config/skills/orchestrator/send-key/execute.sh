#!/bin/bash
# Send a key to an agent's terminal session
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-""}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"sessionName\":\"agent-session\",\"key\":\"Enter\"}'"

SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')
KEY=$(echo "$INPUT" | jq -r '.key // empty')
require_param "sessionName" "$SESSION_NAME"
require_param "key" "$KEY"

BODY=$(jq -n --arg key "$KEY" '{key: $key}')

api_call POST "/terminal/${SESSION_NAME}/key" "$BODY"
