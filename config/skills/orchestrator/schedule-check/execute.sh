#!/bin/bash
# Schedule a future check-in reminder
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"minutes\":5,\"message\":\"Check on agent-joe progress\"}'"

MINUTES=$(echo "$INPUT" | jq -r '.minutes // empty')
MESSAGE=$(echo "$INPUT" | jq -r '.message // empty')
require_param "minutes" "$MINUTES"
require_param "message" "$MESSAGE"

BODY=$(jq -n --arg minutes "$MINUTES" --arg message "$MESSAGE" \
  '{delayMinutes: ($minutes | tonumber), message: $message}')

api_call POST "/schedule" "$BODY"
