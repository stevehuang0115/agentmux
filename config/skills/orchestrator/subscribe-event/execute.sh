#!/bin/bash
# Subscribe to agent lifecycle events
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"eventType\":\"agent:idle\",\"filter\":{\"sessionName\":\"agent-joe\"},\"oneShot\":true}'"

EVENT_TYPE=$(echo "$INPUT" | jq -r '.eventType // empty')
require_param "eventType" "$EVENT_TYPE"

# Pass the full input as request body
api_call POST "/events/subscribe" "$INPUT"
