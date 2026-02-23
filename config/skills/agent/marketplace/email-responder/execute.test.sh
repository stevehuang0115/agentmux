#!/bin/bash
# Tests for email-responder execute.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXECUTE="$SCRIPT_DIR/execute.sh"
PASS=0
FAIL=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (expected '$expected', got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== email-responder tests ==="

# Test 1: Auto-detect complaint
echo "Test 1: Auto-detect complaint intent"
OUTPUT=$(bash "$EXECUTE" '{"from":"user@test.com","subject":"Broken feature","body":"This is broken and I cannot use it. Very frustrated."}')
assert_eq "intent is complaint" "complaint" "$(echo "$OUTPUT" | jq -r '.intent')"
assert_eq "tone is apologetic" "apologetic" "$(echo "$OUTPUT" | jq -r '.tone')"
assert_eq "has reply subject" "Re: Broken feature" "$(echo "$OUTPUT" | jq -r '.subject')"

# Test 2: Auto-detect question
echo "Test 2: Auto-detect question intent"
OUTPUT=$(bash "$EXECUTE" '{"from":"user@test.com","subject":"Pricing info","body":"How much does the enterprise plan cost? What features are included?"}')
assert_eq "intent is question" "question" "$(echo "$OUTPUT" | jq -r '.intent')"

# Test 3: Auto-detect request
echo "Test 3: Auto-detect request intent"
OUTPUT=$(bash "$EXECUTE" '{"from":"user@test.com","subject":"Access needed","body":"Please provide me access to the admin dashboard. I need it for my role."}')
assert_eq "intent is request" "request" "$(echo "$OUTPUT" | jq -r '.intent')"

# Test 4: Auto-detect feedback
echo "Test 4: Auto-detect positive feedback"
OUTPUT=$(bash "$EXECUTE" '{"from":"fan@test.com","subject":"Great product","body":"I love this tool! It is amazing and so helpful for our team. Thank you!"}')
assert_eq "intent is feedback" "feedback" "$(echo "$OUTPUT" | jq -r '.intent')"

# Test 5: Custom tone override
echo "Test 5: Custom tone override"
OUTPUT=$(bash "$EXECUTE" '{"from":"user@test.com","subject":"Question","body":"What is your refund policy?","tone":"formal"}')
assert_eq "tone is formal" "formal" "$(echo "$OUTPUT" | jq -r '.tone')"

# Test 6: Custom sender name
echo "Test 6: Custom sender name"
OUTPUT=$(bash "$EXECUTE" '{"from":"user@test.com","subject":"Help","body":"How do I reset my password?","senderName":"Alice"}')
DRAFT=$(echo "$OUTPUT" | jq -r '.draft')
if echo "$DRAFT" | grep -q "Alice"; then
  echo "  PASS: sender name in draft"
  PASS=$((PASS + 1))
else
  echo "  FAIL: sender name not in draft"
  FAIL=$((FAIL + 1))
fi

# Test 7: Has suggested actions
echo "Test 7: Has suggested actions"
OUTPUT=$(bash "$EXECUTE" '{"from":"user@test.com","subject":"Issue","body":"There is a problem with the billing system."}')
ACTIONS_COUNT=$(echo "$OUTPUT" | jq '.suggestedActions | length')
if [ "$ACTIONS_COUNT" -gt 0 ] 2>/dev/null; then
  echo "  PASS: has suggested actions"
  PASS=$((PASS + 1))
else
  echo "  FAIL: no suggested actions"
  FAIL=$((FAIL + 1))
fi

# Test 8: Missing required params
echo "Test 8: Missing required params"
if bash "$EXECUTE" '{"from":"user@test.com"}' 2>/dev/null; then
  echo "  FAIL: should error on missing subject/body"
  FAIL=$((FAIL + 1))
else
  echo "  PASS: errors on missing params"
  PASS=$((PASS + 1))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
