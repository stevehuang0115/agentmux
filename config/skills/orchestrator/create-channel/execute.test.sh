#!/bin/bash
# Tests for create-channel: argument parsing and request body.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0; FAIL=0
assert_eq() { if [ "$2" = "$3" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 — expected '$2', got '$3'"; FAIL=$((FAIL+1)); fi; }
assert_contains() { if [[ "$3" == *"$2"* ]]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 — expected '$2' in: $3"; FAIL=$((FAIL+1)); fi; }

export CREWLY_SKILL_DRY_RUN=1
assert_eq "new channel body" \
  'POST /channels/compose {"name":"ce-growth","members":["Owen","王律师增长团队 Lead"]}' \
  "$(bash "$SCRIPT_DIR/execute.sh" --name ce-growth --members "Owen, 王律师增长团队 Lead")"
assert_eq "purpose is included" \
  'POST /channels/compose {"name":"x","members":["A"],"purpose":"why"}' \
  "$(bash "$SCRIPT_DIR/execute.sh" --name x --members A --purpose why)"
assert_eq "--add targets an existing channel" \
  'POST /channels/compose {"channel":"ce-growth","members":["Owen","Mia"]}' \
  "$(bash "$SCRIPT_DIR/execute.sh" --add ce-growth --members "Owen;Mia")"
assert_eq "empty entries dropped" \
  'POST /channels/compose {"name":"x","members":["A","B"]}' \
  "$(bash "$SCRIPT_DIR/execute.sh" --name x --members ",A,, B ,")"
assert_contains "--help prints usage" "Usage:" "$(bash "$SCRIPT_DIR/execute.sh" --help)"
out=$(bash "$SCRIPT_DIR/execute.sh" --name x 2>&1 || true)
assert_contains "missing members is an error" "required" "$out"
out=$(bash "$SCRIPT_DIR/execute.sh" --members A 2>&1 || true)
assert_contains "missing name/add is an error" "required" "$out"

echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
