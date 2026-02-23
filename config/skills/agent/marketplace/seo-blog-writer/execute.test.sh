#!/bin/bash
# Tests for seo-blog-writer execute.sh
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

echo "=== seo-blog-writer tests ==="

# Test 1: Basic outline generation
echo "Test 1: Basic outline generation"
OUTPUT=$(bash "$EXECUTE" '{"topic":"AI Agents Guide","keywords":"AI agents,automation"}')
assert_eq "has title" "AI Agents Guide" "$(echo "$OUTPUT" | jq -r '.title')"
assert_eq "primary keyword" "AI agents" "$(echo "$OUTPUT" | jq -r '.primaryKeyword')"
assert_eq "target word count" "1500" "$(echo "$OUTPUT" | jq -r '.targetWordCount')"
assert_gt "outline has sections" "3" "$(echo "$OUTPUT" | jq '.outline | length')"
assert_eq "has seoGuidance" "1-2% for primary keyword" "$(echo "$OUTPUT" | jq -r '.seoGuidance.recommendedKeywordDensity')"
assert_eq "no output file" "null" "$(echo "$OUTPUT" | jq -r '.outputFile')"

# Test 2: Custom word count
echo "Test 2: Custom word count"
OUTPUT=$(bash "$EXECUTE" '{"topic":"Short Guide","keywords":"testing","wordCount":800}')
assert_eq "word count 800" "800" "$(echo "$OUTPUT" | jq -r '.targetWordCount')"

# Test 3: File output
echo "Test 3: File output"
OUTFILE="/tmp/test-seo-outline-$$.md"
OUTPUT=$(bash "$EXECUTE" '{"topic":"Test Blog","keywords":"test keyword","outputPath":"'"$OUTFILE"'"}')
assert_eq "output file path" "$OUTFILE" "$(echo "$OUTPUT" | jq -r '.outputFile')"
if [ -f "$OUTFILE" ]; then
  echo "  PASS: output file exists"
  PASS=$((PASS + 1))
  rm -f "$OUTFILE"
else
  echo "  FAIL: output file not created"
  FAIL=$((FAIL + 1))
fi

# Test 4: Secondary keywords
echo "Test 4: Secondary keywords"
OUTPUT=$(bash "$EXECUTE" '{"topic":"Test","keywords":"primary,secondary one,secondary two"}')
assert_eq "secondary count" "2" "$(echo "$OUTPUT" | jq '.secondaryKeywords | length')"

# Test 5: Missing required params
echo "Test 5: Missing required params"
if bash "$EXECUTE" '{"topic":"test"}' 2>/dev/null; then
  echo "  FAIL: should error on missing keywords"
  FAIL=$((FAIL + 1))
else
  echo "  PASS: errors on missing keywords"
  PASS=$((PASS + 1))
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
