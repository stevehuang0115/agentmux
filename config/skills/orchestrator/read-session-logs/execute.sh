#!/bin/bash
# Read persistent session log file (ANSI-stripped, survives restarts)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"sessionName\":\"crewly-orc\",\"lines\":200}'"

SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')
LINES=$(echo "$INPUT" | jq -r '.lines // "100"')
require_param "sessionName" "$SESSION_NAME"

api_call GET "/sessions/${SESSION_NAME}/logs?lines=${LINES}"
