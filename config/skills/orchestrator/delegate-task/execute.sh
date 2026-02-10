#!/bin/bash
# Delegate a task to an agent with a structured task template
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"to\":\"agent-session\",\"task\":\"implement feature X\",\"priority\":\"high\"}'"

TO=$(echo "$INPUT" | jq -r '.to // empty')
TASK=$(echo "$INPUT" | jq -r '.task // empty')
PRIORITY=$(echo "$INPUT" | jq -r '.priority // "normal"')
CONTEXT=$(echo "$INPUT" | jq -r '.context // empty')
require_param "to" "$TO"
require_param "task" "$TASK"

# Build a structured task message
TASK_MESSAGE="[TASK] Priority: ${PRIORITY}\n\n${TASK}"
[ -n "$CONTEXT" ] && TASK_MESSAGE="${TASK_MESSAGE}\n\nContext: ${CONTEXT}"

BODY=$(jq -n --arg message "$TASK_MESSAGE" '{message: $message}')

api_call POST "/terminal/${TO}/write" "$BODY"
