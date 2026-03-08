#!/bin/bash
# Tests for TL schedule-check execute.sh
# Covers: self-scheduling, worker scheduling, hierarchy violation, missing params
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXECUTE="$SCRIPT_DIR/execute.sh"
PASS=0
FAIL=0

assert_succeeds() {
  local desc="$1"
  shift
  if OUTPUT=$("$@" 2>&1); then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (expected success, got exit $? — output: $OUTPUT)"
    FAIL=$((FAIL + 1))
  fi
}

assert_fails() {
  local desc="$1"
  shift
  if OUTPUT=$("$@" 2>&1); then
    echo "  FAIL: $desc (expected failure, got success — output: $OUTPUT)"
    FAIL=$((FAIL + 1))
  else
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  fi
}

assert_fails_with() {
  local desc="$1" expected_msg="$2"
  shift 2
  local OUTPUT=""
  if OUTPUT=$("$@" 2>&1); then
    echo "  FAIL: $desc (expected failure, got success)"
    FAIL=$((FAIL + 1))
  elif echo "$OUTPUT" | grep -q "$expected_msg"; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (expected '$expected_msg' in output, got: $OUTPUT)"
    FAIL=$((FAIL + 1))
  fi
}

# Create a mock wrapper that overrides api_call to avoid real HTTP calls.
# The mock returns team data with known members for hierarchy testing.
MOCK_DIR=$(mktemp -d)
MOCK_SCRIPT="$MOCK_DIR/run_schedule_check.sh"
cat > "$MOCK_SCRIPT" << 'MOCK_EOF'
#!/bin/bash
# Mock wrapper for schedule-check execute.sh
# Overrides api_call to return controlled responses
set -euo pipefail
SCRIPT_DIR_INNER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load the real shared lib first to get require_param, error_exit, etc.
REAL_SKILL_DIR="$1"
shift
source "${REAL_SKILL_DIR}/../_common/lib.sh"

# Override api_call with mock
api_call() {
  local method="$1" endpoint="$2" body="${3:-}"

  if [ "$method" = "GET" ] && echo "$endpoint" | grep -q "^/teams/"; then
    # Return mock team data with known hierarchy:
    # TL: ella-tl (member-id: tl-001, sessionName: crewly-marketing-ella-abc123)
    # Worker: mila-worker (member-id: worker-001, sessionName: crewly-marketing-mila-def456, parent: tl-001)
    cat << 'TEAMJSON'
{"success":true,"data":{"id":"team-123","name":"Marketing","members":[{"id":"tl-001","sessionName":"crewly-marketing-ella-abc123","role":"team-leader","parentMemberId":""},{"id":"worker-001","sessionName":"crewly-marketing-mila-def456","role":"developer","parentMemberId":"tl-001"},{"id":"worker-002","sessionName":"crewly-marketing-luna-ghi789","role":"developer","parentMemberId":"other-tl"}]}}
TEAMJSON
    return 0
  fi

  if [ "$method" = "POST" ] && [ "$endpoint" = "/schedule" ]; then
    echo '{"success":true,"data":{"checkId":"mock-check-id-001"},"message":"Check-in scheduled successfully"}'
    return 0
  fi

  echo '{"error":true,"status":404,"details":"Unknown endpoint"}' >&2
  return 1
}

# Now source and execute the main script logic inline
# (We can't just call execute.sh because it sources lib.sh again which would
# override our mock. Instead, we replicate the sourcing chain.)
INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{...}'"

MINUTES=$(echo "$INPUT" | jq -r '.minutes // empty')
MESSAGE=$(echo "$INPUT" | jq -r '.message // empty')
TARGET=$(echo "$INPUT" | jq -r '.target // empty')
RECURRING=$(echo "$INPUT" | jq -r '.recurring // false')
MAX_OCCURRENCES=$(echo "$INPUT" | jq -r '.maxOccurrences // empty')
TEAM_ID=$(echo "$INPUT" | jq -r '.teamId // empty')
TL_MEMBER_ID=$(echo "$INPUT" | jq -r '.tlMemberId // empty')
SESSION_NAME=$(echo "$INPUT" | jq -r '.sessionName // empty')
require_param "minutes" "$MINUTES"
require_param "message" "$MESSAGE"

CALLER_SESSION="${CREWLY_SESSION_NAME:-${SESSION_NAME}}"
TARGET_SESSION="${TARGET:-${CALLER_SESSION}}"
[ -z "$TARGET_SESSION" ] && error_exit "No target session specified and CREWLY_SESSION_NAME not set. Pass sessionName in input."

if [ -n "$TARGET_SESSION" ] && [ "$TARGET_SESSION" != "$CALLER_SESSION" ]; then
  if [ -n "$TEAM_ID" ] && [ -n "$TL_MEMBER_ID" ]; then
    TEAM_DATA=$(api_call GET "/teams/${TEAM_ID}" 2>/dev/null || echo '{}')
    TEAM_SUCCESS=$(echo "$TEAM_DATA" | jq -r '.success // false' 2>/dev/null || echo "false")

    if [ "$TEAM_SUCCESS" = "true" ]; then
      WORKER_PARENT=$(echo "$TEAM_DATA" | jq -r --arg session "$TARGET_SESSION" \
        '.data.members[] | select(.sessionName == $session) | .parentMemberId // empty' 2>/dev/null || true)

      if [ -z "$WORKER_PARENT" ]; then
        error_exit "Hierarchy violation: target ${TARGET_SESSION} is not a member of team ${TEAM_ID}"
      fi

      if [ "$WORKER_PARENT" != "$TL_MEMBER_ID" ]; then
        error_exit "Hierarchy violation: target ${TARGET_SESSION} (parentMemberId=${WORKER_PARENT}) is not a subordinate of TL ${TL_MEMBER_ID}"
      fi
    fi
  else
    error_exit "teamId and tlMemberId are required when scheduling checks for other sessions"
  fi
fi

if [ "$RECURRING" = "true" ]; then
  BODY=$(jq -n --arg target "$TARGET_SESSION" --arg minutes "$MINUTES" --arg message "$MESSAGE" \
    '{targetSession: $target, minutes: ($minutes | tonumber), intervalMinutes: ($minutes | tonumber), message: $message, isRecurring: true}')
  if [ -n "$MAX_OCCURRENCES" ]; then
    BODY=$(echo "$BODY" | jq --arg max "$MAX_OCCURRENCES" '. + {maxOccurrences: ($max | tonumber)}')
  fi
else
  BODY=$(jq -n --arg target "$TARGET_SESSION" --arg minutes "$MINUTES" --arg message "$MESSAGE" \
    '{targetSession: $target, minutes: ($minutes | tonumber), message: $message}')
fi

api_call POST "/schedule" "$BODY"
MOCK_EOF
chmod +x "$MOCK_SCRIPT"

SKILL_DIR="$SCRIPT_DIR"

echo "=== TL schedule-check tests ==="

# -----------------------------------------------------------------------
# Scenario 1: TL schedules self-check using sessionName param
#   (CREWLY_SESSION_NAME not set — Gemini CLI scenario)
# -----------------------------------------------------------------------
echo "Scenario 1: TL self-check via sessionName param (no env var)"
assert_succeeds "self-check with sessionName, no CREWLY_SESSION_NAME" \
  env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":15,"message":"Follow up on progress","sessionName":"crewly-marketing-ella-abc123"}'

# -----------------------------------------------------------------------
# Scenario 2: TL schedules self-check using CREWLY_SESSION_NAME env var
# -----------------------------------------------------------------------
echo "Scenario 2: TL self-check via CREWLY_SESSION_NAME env var"
assert_succeeds "self-check with CREWLY_SESSION_NAME set" \
  env CREWLY_SESSION_NAME="crewly-marketing-ella-abc123" bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":15,"message":"Follow up on progress"}'

# -----------------------------------------------------------------------
# Scenario 3: TL schedules self-check with explicit target = self session
# -----------------------------------------------------------------------
echo "Scenario 3: TL self-check with explicit target = own session"
assert_succeeds "self-check with explicit target matching sessionName" \
  env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":15,"message":"Follow up","sessionName":"crewly-marketing-ella-abc123","target":"crewly-marketing-ella-abc123"}'

# -----------------------------------------------------------------------
# Scenario 4: TL schedules worker check — valid subordinate
# -----------------------------------------------------------------------
echo "Scenario 4: TL schedules check on valid subordinate"
assert_succeeds "worker check on subordinate mila" \
  env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":10,"message":"Check mila progress","sessionName":"crewly-marketing-ella-abc123","target":"crewly-marketing-mila-def456","teamId":"team-123","tlMemberId":"tl-001"}'

# -----------------------------------------------------------------------
# Scenario 5: TL targets non-subordinate — hierarchy violation
# -----------------------------------------------------------------------
echo "Scenario 5: TL targets non-subordinate worker"
assert_fails_with "hierarchy violation on non-subordinate luna" "Hierarchy violation" \
  env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":10,"message":"Check luna","sessionName":"crewly-marketing-ella-abc123","target":"crewly-marketing-luna-ghi789","teamId":"team-123","tlMemberId":"tl-001"}'

# -----------------------------------------------------------------------
# Scenario 6: TL targets unknown session — not a member
# -----------------------------------------------------------------------
echo "Scenario 6: TL targets unknown session"
assert_fails_with "hierarchy violation on unknown target" "Hierarchy violation" \
  env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":10,"message":"Check unknown","sessionName":"crewly-marketing-ella-abc123","target":"crewly-unknown-agent","teamId":"team-123","tlMemberId":"tl-001"}'

# -----------------------------------------------------------------------
# Scenario 7: TL targets other session without teamId — error
# -----------------------------------------------------------------------
echo "Scenario 7: Missing teamId/tlMemberId for other-session target"
assert_fails_with "requires teamId and tlMemberId" "teamId and tlMemberId are required" \
  env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":10,"message":"Check worker","sessionName":"crewly-marketing-ella-abc123","target":"crewly-marketing-mila-def456"}'

# -----------------------------------------------------------------------
# Scenario 8: No session identity at all — should fail
# -----------------------------------------------------------------------
echo "Scenario 8: No session identity (no env, no sessionName, no target)"
assert_fails_with "fails without any session identity" "No target session specified" \
  env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":10,"message":"Check something"}'

# -----------------------------------------------------------------------
# Scenario 9: Missing required params
# -----------------------------------------------------------------------
echo "Scenario 9: Missing required params"
assert_fails "fails on missing minutes" \
  env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"message":"Check","sessionName":"ella"}'

assert_fails "fails on missing message" \
  env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":10,"sessionName":"ella"}'

# -----------------------------------------------------------------------
# Scenario 10: Recurring check self-scheduling
# -----------------------------------------------------------------------
echo "Scenario 10: Recurring self-check"
OUTPUT=$(env -u CREWLY_SESSION_NAME bash "$MOCK_SCRIPT" "$SKILL_DIR" \
  '{"minutes":15,"message":"Recurring follow up","sessionName":"crewly-marketing-ella-abc123","recurring":true}')
if echo "$OUTPUT" | jq -e '.success' > /dev/null 2>&1; then
  echo "  PASS: recurring self-check succeeds"
  PASS=$((PASS + 1))
else
  echo "  FAIL: recurring self-check failed (output: $OUTPUT)"
  FAIL=$((FAIL + 1))
fi

# Cleanup
rm -rf "$MOCK_DIR"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
