#!/bin/bash
# Tests for feedback-analyzer execute.sh
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

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (expected to contain '$needle')"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== feedback-analyzer tests ==="

# Test 1: Mixed sentiment (positive + negative)
echo "Test 1: Mixed sentiment"
OUTPUT=$(bash "$EXECUTE" '{"feedback":"The dashboard is great but it is really slow when loading data.","source":"survey"}')
assert_eq "sentiment is mixed" "mixed" "$(echo "$OUTPUT" | jq -r '.sentiment')"
assert_eq "source is survey" "survey" "$(echo "$OUTPUT" | jq -r '.source')"
assert_eq "actionable" "true" "$(echo "$OUTPUT" | jq -r '.actionable')"

# Test 2: Positive sentiment
echo "Test 2: Positive sentiment"
OUTPUT=$(bash "$EXECUTE" '{"feedback":"I love this tool! It is amazing and so helpful.","source":"review"}')
assert_eq "sentiment is positive" "positive" "$(echo "$OUTPUT" | jq -r '.sentiment')"
assert_contains "has praise topic" "praise" "$(echo "$OUTPUT" | jq -r '.topics[]')"

# Test 3: Negative sentiment with bug report
echo "Test 3: Negative bug report"
OUTPUT=$(bash "$EXECUTE" '{"feedback":"The app keeps crashing when I open settings. Terrible experience.","source":"support-ticket"}')
assert_eq "sentiment is negative" "negative" "$(echo "$OUTPUT" | jq -r '.sentiment')"
assert_eq "priority is high" "high" "$(echo "$OUTPUT" | jq -r '.priority')"
assert_contains "has bug-report topic" "bug-report" "$(echo "$OUTPUT" | jq -r '.topics[]')"
assert_eq "category is bug-report" "bug-report" "$(echo "$OUTPUT" | jq -r '.category')"

# Test 4: Feature request
echo "Test 4: Feature request detection"
OUTPUT=$(bash "$EXECUTE" '{"feedback":"Would be nice to have dark mode. Please add it.","source":"email"}')
assert_contains "has feature-request topic" "feature-request" "$(echo "$OUTPUT" | jq -r '.topics[]')"
assert_eq "actionable" "true" "$(echo "$OUTPUT" | jq -r '.actionable')"

# Test 5: Performance complaint
echo "Test 5: Performance detection"
OUTPUT=$(bash "$EXECUTE" '{"feedback":"Everything is so slow. Loading takes forever.","source":"survey"}')
assert_contains "has performance topic" "performance" "$(echo "$OUTPUT" | jq -r '.topics[]')"

# Test 6: Neutral / general feedback
echo "Test 6: Neutral feedback"
OUTPUT=$(bash "$EXECUTE" '{"feedback":"I used the product today for my project.","source":"survey"}')
assert_eq "sentiment is neutral" "neutral" "$(echo "$OUTPUT" | jq -r '.sentiment')"

# Test 7: Customer name tracking
echo "Test 7: Customer name"
OUTPUT=$(bash "$EXECUTE" '{"feedback":"It works fine.","customerName":"Alice"}')
assert_eq "customer name" "Alice" "$(echo "$OUTPUT" | jq -r '.customerName')"

# Test 8: Default anonymous
echo "Test 8: Default anonymous customer"
OUTPUT=$(bash "$EXECUTE" '{"feedback":"Good product."}')
assert_eq "default anonymous" "Anonymous" "$(echo "$OUTPUT" | jq -r '.customerName')"
assert_eq "default source" "unknown" "$(echo "$OUTPUT" | jq -r '.source')"

# Test 9: Suggested actions present
echo "Test 9: Has suggested actions"
OUTPUT=$(bash "$EXECUTE" '{"feedback":"The app crashes and loading is slow. Please add search feature."}')
ACTIONS=$(echo "$OUTPUT" | jq '.suggestedActions | length')
if [ "$ACTIONS" -gt 0 ] 2>/dev/null; then
  echo "  PASS: has suggested actions ($ACTIONS)"
  PASS=$((PASS + 1))
else
  echo "  FAIL: no suggested actions"
  FAIL=$((FAIL + 1))
fi

# Test 10: Missing required params
echo "Test 10: Missing required params"
if bash "$EXECUTE" '{}' 2>/dev/null; then
  echo "  FAIL: should error on missing feedback"
  FAIL=$((FAIL + 1))
else
  echo "  PASS: errors on missing feedback"
  PASS=$((PASS + 1))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
