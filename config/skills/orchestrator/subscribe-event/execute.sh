#!/bin/bash
# Subscribe to agent lifecycle events
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"eventType\":\"agent:idle\",\"filter\":{\"sessionName\":\"agent-joe\"},\"oneShot\":true}'"

EVENT_TYPE=$(echo "$INPUT" | jq -r '.eventType // empty')
require_param "eventType" "$EVENT_TYPE"

# Inject subscriberSession from env (set by AgentMux on each tmux session)
# The API requires subscriberSession and filter but the agent doesn't need to provide them
SUBSCRIBER_SESSION="${TMUX_SESSION_NAME:-agentmux-orc}"
BODY=$(echo "$INPUT" | jq --arg ss "$SUBSCRIBER_SESSION" \
  '. + {subscriberSession: $ss} | if .filter == null then .filter = {} else . end')

api_call POST "/events/subscribe" "$BODY"
