#!/bin/bash
# Decompose a high-level objective into worker-level WorkItems.
#
# V3-only as of spec 2026-05-06-task-management-v1-deprecation.md. Each
# sub-task becomes a V3 WorkItem in the task-pool via `POST /task-pool/add`.
# The legacy v1 `/task-management/create` endpoint that wrote `.md` files
# is gone.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

# `--request-id <id|TKT-123>` links every sub-task to the ticket they are for
# (the [TICKET:TKT-123 <id>] line of the message being worked on). Also
# accepted as `"requestId"` in the JSON.
REQUEST_ID=""
DRY_RUN=0
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --request-id|-R) REQUEST_ID="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) POSITIONAL+=("$1"); shift ;;
  esac
done
set -- "${POSITIONAL[@]+"${POSITIONAL[@]}"}"

INPUT=$(read_json_input "${1:-}")
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"objective\":\"Build auth module\",\"projectPath\":\"/path/to/project\",\"requestId\":\"<ticket id, optional>\",\"tasks\":[{\"title\":\"...\",\"description\":\"...\",\"requiredRole\":\"developer\",\"acceptanceCriteria\":\"...\",\"priority\":\"high\"}]}' [--request-id <id>] [--dry-run]  (optional per task: \"blockedBy\":[<index or title>, ...])"

OBJECTIVE=$(printf '%s' "$INPUT" | jq -r '.objective // empty')
PROJECT_PATH=$(printf '%s' "$INPUT" | jq -r '.projectPath // empty')
TASKS=$(printf '%s' "$INPUT" | jq -c '.tasks // empty')
MILESTONE=$(printf '%s' "$INPUT" | jq -r '.milestone // "delegated"')
[ -z "$REQUEST_ID" ] && REQUEST_ID=$(printf '%s' "$INPUT" | jq -r '.requestId // empty')
require_param "objective" "$OBJECTIVE"
require_param "tasks" "$TASKS"

# Validate tasks array is non-empty
TASK_COUNT=$(echo "$TASKS" | jq 'length')
if [ "$TASK_COUNT" = "0" ]; then
  error_exit "tasks array must contain at least one task"
fi

# Blocking edges: tasks[].blockedBy lists tasks of this same call (0-based
# index or exact title). Resolve to indexes, reject unknown/ambiguous
# references and cycles (a self-reference is a cycle) BEFORE creating anything, and derive a creation order
# in which every blocker comes first.
PLAN=$(printf '%s' "$TASKS" | jq -c '
  . as $t
  | [ to_entries[] | (.value.blockedBy // []) | map(
        if type == "number" then (if . >= 0 and . < ($t | length) and . == floor then . else null end)
        elif type == "string" then (. as $s | [$t | to_entries[] | select(.value.title == $s) | .key] | if length == 1 then .[0] else null end)
        else null end) ] as $deps
  | ([ $deps | to_entries[] | select(.value | any(. == null)) | .key ]) as $bad
  | { deps: $deps, bad: $bad }
  | . as $p
  | ($p.deps | length) as $n
  | ({ done: [], rem: [range(0; $n)], stuck: false }
     | until((.rem | length) == 0 or .stuck;
         . as $s
         | [ $s.rem[] | . as $i | select($p.deps[$i] | all(. as $d | any($s.done[]; . == $d))) ] as $ready
         | if ($ready | length) == 0 then .stuck = true else (.done += $ready | .rem -= $ready) end)) as $o
  | { deps: $p.deps, bad: $p.bad, order: $o.done, cyclic: $o.rem }')
BAD=$(printf '%s' "$PLAN" | jq -c '.bad')
CYCLIC=$(printf '%s' "$PLAN" | jq -c '.cyclic')
if [ "$BAD" != "[]" ]; then
  error_exit "blockedBy has an unknown, ambiguous or invalid reference in task index(es) ${BAD}; nothing created"
fi
if [ "$CYCLIC" != "[]" ]; then
  error_exit "blockedBy forms a cycle among task index(es) ${CYCLIC}; nothing created"
fi

if [ "$DRY_RUN" = "1" ]; then
  printf '%s' "$TASKS" | jq -c --argjson plan "$PLAN" --arg objective "$OBJECTIVE" '
    . as $t
    | { dryRun: true, objective: $objective, tasks: [ $plan.order[] | . as $i | {
          index: $i, title: $t[$i].title,
          blockedBy: [ $plan.deps[$i][] | $t[.].title ],
          delivers: ($t[$i].description // "") } ] }'
  exit 0
fi

CREATED_TASKS="[]"
ERRORS="[]"
# index -> WorkItem id, for resolving blockedBy into dependsOn
declare -a CREATED_ID_BY_INDEX=()

# Create each sub-task via the task-pool API, blockers first
for i in $(printf '%s' "$PLAN" | jq -r '.order[]'); do
  TASK_TITLE=$(echo "$TASKS" | jq -r ".[$i].title // empty")
  TASK_DESC=$(echo "$TASKS" | jq -r ".[$i].description // empty")
  TASK_ROLE=$(echo "$TASKS" | jq -r ".[$i].requiredRole // \"developer\"")
  TASK_CRITERIA=$(echo "$TASKS" | jq -r ".[$i].acceptanceCriteria // empty")
  TASK_PRIORITY=$(echo "$TASKS" | jq -r ".[$i].priority // \"normal\"")

  if [ -z "$TASK_TITLE" ] || [ -z "$TASK_DESC" ]; then
    ERRORS=$(echo "$ERRORS" | jq --arg idx "$i" --arg msg "Task $i missing title or description" '. + [$msg]')
    continue
  fi

  # Resolve blockers to WorkItem ids; a blocker that failed to create blocks this task too.
  DEPENDS_ON="[]"
  DEP_FAILED=0
  for d in $(printf '%s' "$PLAN" | jq -r ".deps[$i][]"); do
    if [ -n "${CREATED_ID_BY_INDEX[$d]:-}" ]; then
      DEPENDS_ON=$(echo "$DEPENDS_ON" | jq --arg id "${CREATED_ID_BY_INDEX[$d]}" '. + [$id]')
    else
      DEP_FAILED=1
    fi
  done
  if [ "$DEP_FAILED" = "1" ]; then
    ERRORS=$(echo "$ERRORS" | jq --arg msg "Skipped (a blocker was not created): ${TASK_TITLE}" '. + [$msg]')
    continue
  fi

  # Compose the brief markdown for the WorkItem.
  BRIEF="${TASK_DESC}"
  [ -n "$TASK_CRITERIA" ] && BRIEF="${BRIEF}

## Acceptance Criteria
${TASK_CRITERIA}"
  BRIEF="${BRIEF}

## Context
Parent objective: ${OBJECTIVE}
Required role: ${TASK_ROLE}"


  # Minimal CreateWorkItemInput — no client-side `id`/`status`.
  #
  # A body carrying `id` and `status` but no `createdAt` fails the endpoint's
  # `isLegacyFullShape` check, so it silently takes the MINIMAL path and the
  # server generates its own uuid anyway. The old client id was never
  # referenced after creation, so there is nothing to preserve: commit to the
  # minimal shape rather than sending two-thirds of the legacy one.
  WORK_ITEM=$(jq -n \
    --arg title "$TASK_TITLE" \
    --arg brief "$BRIEF" \
    --arg projectPath "$PROJECT_PATH" \
    --arg milestone "$MILESTONE" \
    --arg role "$TASK_ROLE" \
    --arg priority "$TASK_PRIORITY" \
    --arg requestId "$REQUEST_ID" \
    --argjson dependsOn "$DEPENDS_ON" \
    '{
      title: $title,
      type: "delegate",
      owner: "system",
      briefMarkdown: $brief,
      metadata: { projectPath: $projectPath, milestone: $milestone, requiredRole: $role, priority: $priority }
    } + (if $requestId != "" then {requestId: $requestId} else {} end) + (if ($dependsOn | length) > 0 then {dependsOn: $dependsOn} else {} end)')

  # No envelope: addItem reads req.body directly as the CreateWorkItemInput.
  CREATE_BODY="$WORK_ITEM"
  CREATE_RESULT=$(api_call POST "/task-pool/add" "$CREATE_BODY" 2>/dev/null || echo '{"error":"Failed to create WorkItem"}')
  CREATED_ID=$(echo "$CREATE_RESULT" | jq -r '.data.id // .workItem.id // empty' 2>/dev/null || true)

  if [ -n "$CREATED_ID" ]; then
    CREATED_ID_BY_INDEX[$i]="$CREATED_ID"
    CREATED_TASKS=$(echo "$CREATED_TASKS" | jq \
      --arg title "$TASK_TITLE" \
      --arg role "$TASK_ROLE" \
      --arg id "$CREATED_ID" \
      --arg priority "$TASK_PRIORITY" \
      --argjson dependsOn "$DEPENDS_ON" \
      '. + [{title: $title, requiredRole: $role, workItemId: $id, priority: $priority} + (if ($dependsOn | length) > 0 then {dependsOn: $dependsOn} else {} end)]')
  else
    ERRORS=$(echo "$ERRORS" | jq --arg msg "Failed to create WorkItem: ${TASK_TITLE}" '. + [$msg]')
  fi
done

# Output result
CREATED_COUNT=$(echo "$CREATED_TASKS" | jq 'length')
ERROR_COUNT=$(echo "$ERRORS" | jq 'length')

jq -n \
  --arg objective "$OBJECTIVE" \
  --argjson tasks "$CREATED_TASKS" \
  --argjson errors "$ERRORS" \
  --arg totalCreated "$CREATED_COUNT" \
  --arg totalErrors "$ERROR_COUNT" \
  '{
    success: (($totalErrors | tonumber) == 0),
    objective: $objective,
    tasksCreated: ($totalCreated | tonumber),
    tasks: $tasks,
    errors: $errors
  }'
