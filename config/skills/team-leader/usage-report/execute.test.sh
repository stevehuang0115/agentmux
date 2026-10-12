#!/bin/bash
# Tests for usage-report — run with: bash execute.test.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0; FAIL=0
check() { local name="$1"; local got="$2"; local want="$3"; if [ "$got" = "$want" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $name"; echo "  want: $want"; echo "  got:  $got"; fi; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/skills/team-leader/usage-report" "$TMP/skills/team-leader/_common"
cp "$HERE/execute.sh" "$TMP/skills/team-leader/usage-report/execute.sh"
REAL_LIB="$(cd "$HERE/../../_common" && pwd)/lib.sh"
REPORT='{"success":true,"data":{"summary":"Usage, last 7 days: 3 tickets","window":{},"by":"category","categories":null,
 "totals":{"ownerMinutes":6,"agentBusyMinutes":30,"tokens":{"budget":5000,"total":9000},"costUsd":1.5,"ticketCount":3},
 "groups":[{"key":"book","ownerMinutes":6,"agentBusyMinutes":30,"tokens":{"budget":5000,"total":9000},"costUsd":1.5,"ticketCount":3,
   "topTickets":[{"ticketId":"TKT-1","title":"Chapter","ownerMinutes":6,"agentBusyMinutes":30,"tokens":5000,"costUsd":1.5,"inferred":false}]}],"notes":[]}}'
cat > "$TMP/skills/team-leader/_common/lib.sh" <<'STUB'
source "$REAL_LIB"
api_call() { echo "$1 $2" > "$CALL_LOG"; printf '%s' "$REPORT"; }
STUB
export REAL_LIB REPORT CALL_LOG="$TMP/call"

run() { CODE=0; OUT=$(env -u CREWLY_SESSION_NAME bash "$TMP/skills/team-leader/usage-report/execute.sh" "$@" 2>"$TMP/err") || CODE=$?; }

run
check "default window and grouping" "$(cat "$CALL_LOG")" "GET /usage-ledger/report?since=7d&by=category"
check "compact groups" "$(printf '%s' "$OUT" | jq -c '.groups[0] | [.key, .tokens, .topTickets[0].ticketId]')" '["book",5000,"TKT-1"]'
check "totals flattened" "$(printf '%s' "$OUT" | jq -c '.totals.tickets')" "3"

run --since 30d --by team --limit 5 --categories "media:linkedin,substack;book"
check "flags in the query, encoded" "$(cat "$CALL_LOG")" "GET /usage-ledger/report?since=30d&by=team&categories=media%3Alinkedin%2Csubstack%3Bbook&limit=5"

run '{"since":"2w","by":"project"}'
check "JSON input" "$(cat "$CALL_LOG")" "GET /usage-ledger/report?since=2w&by=project"

run --text
check "--text prints the summary only" "$OUT" "Usage, last 7 days: 3 tickets"

echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
