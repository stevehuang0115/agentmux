#!/bin/bash
# Score a completed task's quality for per-agent quality tracking (#174)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

INPUT="${1:-{}}"
TASK_ID=$(echo "$INPUT" | jq -r '.taskId // empty')
QUALITY_SCORE=$(echo "$INPUT" | jq -r '.qualityScore // empty')
SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')

require_param "taskId" "$TASK_ID"
require_param "qualityScore" "$QUALITY_SCORE"

BODY=$(jq -n \
  --arg taskId "$TASK_ID" \
  --argjson qualityScore "$QUALITY_SCORE" \
  --arg scoredBy "${SESSION_NAME:-auditor}" \
  '{taskId: $taskId, qualityScore: $qualityScore, scoredBy: $scoredBy}')

api_call POST "/tasks/score" "$BODY"
