#!/bin/bash
# Tests for social-media-post execute.sh
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

assert_gt() {
  local desc="$1" threshold="$2" actual="$3"
  if [ "$actual" -gt "$threshold" ] 2>/dev/null; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (expected > $threshold, got '$actual')"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== social-media-post tests ==="

# Test 1: All platforms
echo "Test 1: All platforms"
OUTPUT=$(bash "$EXECUTE" '{"topic":"New product launch","platforms":"twitter,linkedin,reddit"}')
assert_eq "has 3 posts" "3" "$(echo "$OUTPUT" | jq '.posts | length')"
assert_eq "topic matches" "New product launch" "$(echo "$OUTPUT" | jq -r '.topic')"
assert_eq "first platform" "twitter" "$(echo "$OUTPUT" | jq -r '.posts[0].platform')"
assert_eq "second platform" "linkedin" "$(echo "$OUTPUT" | jq -r '.posts[1].platform')"
assert_eq "third platform" "reddit" "$(echo "$OUTPUT" | jq -r '.posts[2].platform')"

# Test 2: Single platform
echo "Test 2: Single platform (twitter)"
OUTPUT=$(bash "$EXECUTE" '{"topic":"Test post","platforms":"twitter"}')
assert_eq "has 1 post" "1" "$(echo "$OUTPUT" | jq '.posts | length')"
assert_eq "twitter maxChars" "280" "$(echo "$OUTPUT" | jq '.posts[0].maxChars')"

# Test 3: With hashtags and URL
echo "Test 3: With hashtags and URL"
OUTPUT=$(bash "$EXECUTE" '{"topic":"Test","platforms":"twitter","url":"https://example.com","hashtags":"test,demo"}')
CONTENT=$(echo "$OUTPUT" | jq -r '.posts[0].content')
if echo "$CONTENT" | grep -q "https://example.com"; then
  echo "  PASS: URL included in content"
  PASS=$((PASS + 1))
else
  echo "  FAIL: URL not in content"
  FAIL=$((FAIL + 1))
fi
if echo "$CONTENT" | grep -q "#test"; then
  echo "  PASS: hashtags included"
  PASS=$((PASS + 1))
else
  echo "  FAIL: hashtags not in content"
  FAIL=$((FAIL + 1))
fi

# Test 4: Tone variations
echo "Test 4: Tone variations"
OUTPUT=$(bash "$EXECUTE" '{"topic":"Test","platforms":"twitter","tone":"exciting"}')
assert_eq "tone is exciting" "exciting" "$(echo "$OUTPUT" | jq -r '.tone')"

# Test 5: Reddit has title and subreddit suggestions
echo "Test 5: Reddit structure"
OUTPUT=$(bash "$EXECUTE" '{"topic":"Test project","platforms":"reddit"}')
REDDIT_TITLE=$(echo "$OUTPUT" | jq -r '.posts[0].title')
SUBREDDITS=$(echo "$OUTPUT" | jq '.posts[0].subreddit_suggestions | length')
if [ -n "$REDDIT_TITLE" ] && [ "$REDDIT_TITLE" != "null" ]; then
  echo "  PASS: reddit has title"
  PASS=$((PASS + 1))
else
  echo "  FAIL: reddit missing title"
  FAIL=$((FAIL + 1))
fi
assert_gt "has subreddit suggestions" "0" "$SUBREDDITS"

# Test 6: Missing required params
echo "Test 6: Missing required params"
if bash "$EXECUTE" '{}' 2>/dev/null; then
  echo "  FAIL: should error on missing topic"
  FAIL=$((FAIL + 1))
else
  echo "  PASS: errors on missing topic"
  PASS=$((PASS + 1))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
