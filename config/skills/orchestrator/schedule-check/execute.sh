#!/bin/bash
# Schedule a future check-in reminder
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"minutes\":5,\"message\":\"Check on agent-joe progress\",\"recurring\":true}'"

MINUTES=$(echo "$INPUT" | jq -r '.minutes // empty')
MESSAGE=$(echo "$INPUT" | jq -r '.message // empty')
TARGET=$(echo "$INPUT" | jq -r '.target // empty')
RECURRING=$(echo "$INPUT" | jq -r '.recurring // false')
MAX_OCCURRENCES=$(echo "$INPUT" | jq -r '.maxOccurrences // empty')
require_param "minutes" "$MINUTES"
require_param "message" "$MESSAGE"

# Default target to the caller's own session (orchestrator sends reminders to itself)
TARGET_SESSION="${TARGET:-${CREWLY_SESSION_NAME:-crewly-orc}}"

# API expects: targetSession, minutes, message
# When recurring, also send isRecurring, intervalMinutes, and optional maxOccurrences
if [ "$RECURRING" = "true" ]; then
  BODY=$(jq -n --arg target "$TARGET_SESSION" --arg minutes "$MINUTES" --arg message "$MESSAGE" \
    '{targetSession: $target, minutes: ($minutes | tonumber), intervalMinutes: ($minutes | tonumber), message: $message, isRecurring: true}')
  # Add maxOccurrences if provided
  if [ -n "$MAX_OCCURRENCES" ]; then
    BODY=$(echo "$BODY" | jq --arg max "$MAX_OCCURRENCES" '. + {maxOccurrences: ($max | tonumber)}')
  fi
else
  BODY=$(jq -n --arg target "$TARGET_SESSION" --arg minutes "$MINUTES" --arg message "$MESSAGE" \
    '{targetSession: $target, minutes: ($minutes | tonumber), message: $message}')
fi

api_call POST "/schedule" "$BODY"
