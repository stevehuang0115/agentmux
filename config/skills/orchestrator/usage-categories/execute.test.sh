#!/bin/bash
# Tests for usage-categories — run with: bash execute.test.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0; FAIL=0
check() { local name="$1"; local got="$2"; local want="$3"; if [ "$got" = "$want" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $name"; echo "  want: $want"; echo "  got:  $got"; fi; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/skills/orchestrator/usage-categories" "$TMP/skills/orchestrator/_common"
cp "$HERE/execute.sh" "$TMP/skills/orchestrator/usage-categories/execute.sh"
REAL_LIB="$(cd "$HERE/../../_common" && pwd)/lib.sh"
cat > "$TMP/skills/orchestrator/_common/lib.sh" <<'STUB'
source "$REAL_LIB"
api_call() { printf '%s|%s|%s' "$1" "$2" "${3:-}" > "$CALL_LOG"; echo '{"success":true}'; }
STUB
export REAL_LIB CALL_LOG="$TMP/call"

run() { CODE=0; OUT=$(env -u CREWLY_SESSION_NAME bash "$TMP/skills/orchestrator/usage-categories/execute.sh" "$@" 2>"$TMP/err") || CODE=$?; }

run list
check "list" "$(cat "$CALL_LOG")" "GET|/usage-ledger/categories|"

run set --name self-media --description "Xiaohongshu, Substack, LinkedIn" --keywords "videos, shorts" --teams "Marketing"
LOG=$(cat "$CALL_LOG"); M=${LOG%%|*}; REST=${LOG#*|}; P=${REST%%|*}; B=${REST#*|}
check "set uses POST" "$M $P" "POST /usage-ledger/categories"
check "set body" "$(printf '%s' "$B" | jq -c '.')" '{"name":"self-media","description":"Xiaohongshu, Substack, LinkedIn","keywords":["videos","shorts"],"teams":["Marketing"]}'

run '{"command":"set","name":"book","keywords":["chapter","manuscript"]}'
LOG=$(cat "$CALL_LOG"); B=${LOG#*|*|}
check "JSON input set body" "$(printf '%s' "$B" | jq -c '.')" '{"name":"book","keywords":["chapter","manuscript"]}'

run remove --name "Bible study"
check "remove encodes the name" "$(cat "$CALL_LOG")" "DELETE|/usage-ledger/categories/Bible%20study|"

run clear
check "clear" "$(cat "$CALL_LOG")" 'PUT|/usage-ledger/categories|{"categories":[]}'

run set
check "set needs a name" "$CODE" "1"

run frobnicate
check "unknown command" "$CODE" "1"

echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
