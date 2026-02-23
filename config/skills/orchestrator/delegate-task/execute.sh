#!/bin/bash
# Delegate a task to an agent with a structured task template
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"to\":\"agent-session\",\"task\":\"implement feature X\",\"priority\":\"high\",\"projectPath\":\"/path/to/project\"}'"

TO=$(echo "$INPUT" | jq -r '.to // empty')
TASK=$(echo "$INPUT" | jq -r '.task // empty')
PRIORITY=$(echo "$INPUT" | jq -r '.priority // "normal"')
CONTEXT=$(echo "$INPUT" | jq -r '.context // empty')
PROJECT_PATH=$(echo "$INPUT" | jq -r '.projectPath // empty')
require_param "to" "$TO"
require_param "task" "$TASK"

# Build a structured task message
TASK_MESSAGE="[TASK] Priority: ${PRIORITY}\n\n${TASK}"
[ -n "$CONTEXT" ] && TASK_MESSAGE="${TASK_MESSAGE}\n\nContext: ${CONTEXT}"
TASK_MESSAGE="${TASK_MESSAGE}\n\nWhen done, report back using: bash config/skills/agent/core/report-status/execute.sh '{\"sessionName\":\"${TO}\",\"status\":\"done\",\"summary\":\"<brief summary>\"}'"

BODY=$(jq -n --arg message "$TASK_MESSAGE" '{message: $message}')

api_call POST "/terminal/${TO}/deliver" "$BODY"

# Create task file in project's .crewly/tasks/ directory
if [ -n "$PROJECT_PATH" ]; then
  CREATE_BODY=$(jq -n \
    --arg projectPath "$PROJECT_PATH" \
    --arg task "$TASK" \
    --arg priority "$PRIORITY" \
    --arg sessionName "$TO" \
    --arg milestone "delegated" \
    '{projectPath: $projectPath, task: $task, priority: $priority, sessionName: $sessionName, milestone: $milestone}')
  api_call POST "/task-management/create" "$CREATE_BODY" || true
fi
