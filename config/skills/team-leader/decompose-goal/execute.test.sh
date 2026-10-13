#!/bin/bash
# Tests for decompose-goal (TL) — run with: bash execute.test.sh
# A python HTTP stub plays the backend; asserts the POST /task-pool/add bodies.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXEC="$HERE/execute.sh"
PASS=0; FAIL=0
check() {
  local name="$1"; local got="$2"; local want="$3"
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $name"; echo "  want: $want"; echo "  got:  $got"; fi
}

PORT=18843
STUB_LOG="$(mktemp)"; export STUB_LOG; export STUB_PORT="$PORT"
python3 -u <<'PY' >/dev/null 2>&1 &
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os
LOG = os.environ['STUB_LOG']; PORT = int(os.environ['STUB_PORT'])
N = [0]
class H(BaseHTTPRequestHandler):
    def reply(self, code, obj):
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(json.dumps(obj).encode())
    def do_GET(self):
        return self.reply(200, {'ok': True})
    def do_POST(self):
        n = int(self.headers.get('content-length', '0')); body = json.loads(self.rfile.read(n).decode() or '{}')
        if not self.path.endswith('/task-pool/add'):
            return self.reply(200, {'success': True})
        with open(LOG, 'a') as f: f.write(json.dumps(body) + '\n')
        if body.get('title') == 'Fails':
            return self.reply(500, {'success': False})
        return self.reply(200, {'success': True, 'data': {'id': 'wi-' + body['title']}})
    def log_message(self, *a, **k): pass
HTTPServer(('127.0.0.1', PORT), H).serve_forever()
PY
STUB_PID=$!
disown "$STUB_PID" 2>/dev/null || true
trap 'kill "$STUB_PID" >/dev/null 2>&1; rm -f "$STUB_LOG"' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null -m 0.2 "http://127.0.0.1:${PORT}/" 2>/dev/null && break; sleep 0.1; done

run() { CREWLY_SESSION_NAME=tl-sam CREWLY_API_URL="http://127.0.0.1:${PORT}" bash "$EXEC" "$@" 2>&1; }
posts() { wc -l < "$STUB_LOG" | tr -d ' '; }

# 1. No blockedBy: unchanged behaviour, no dependsOn on the wire.
: > "$STUB_LOG"
OUT=$(run '{"objective":"O","tasks":[{"title":"A","description":"a"},{"title":"B","description":"b"}]}')
check "plain: two created" "$(printf '%s' "$OUT" | jq -r .tasksCreated)" "2"
check "plain: no dependsOn" "$(jq -c 'has("dependsOn")' "$STUB_LOG" | sort -u)" "false"

# 2. Dependency chain (titles and indexes mixed), listed out of order: blockers are created first.
: > "$STUB_LOG"
OUT=$(run '{"objective":"Auth","tasks":[
  {"title":"UI","description":"u","blockedBy":["API"]},
  {"title":"Schema","description":"s"},
  {"title":"API","description":"a","blockedBy":[1]},
  {"title":"E2E","description":"e","blockedBy":["UI","API"]}]}')
check "chain: all created" "$(printf '%s' "$OUT" | jq -r .tasksCreated)" "4"
check "chain: creation order" "$(jq -r .title "$STUB_LOG" | paste -sd, -)" "Schema,API,UI,E2E"
check "chain: API depends on Schema" "$(jq -c 'select(.title=="API") | .dependsOn' "$STUB_LOG")" '["wi-Schema"]'
check "chain: UI depends on API" "$(jq -c 'select(.title=="UI") | .dependsOn' "$STUB_LOG")" '["wi-API"]'
check "chain: E2E depends on API and UI" "$(jq -c 'select(.title=="E2E") | .dependsOn | sort' "$STUB_LOG")" '["wi-API","wi-UI"]'
check "chain: Schema has no dependsOn" "$(jq -c 'select(.title=="Schema") | has("dependsOn")' "$STUB_LOG")" "false"

# 3. Cycle / unknown / self reference: error, nothing created.
: > "$STUB_LOG"
OUT=$(run '{"objective":"O","tasks":[{"title":"A","description":"a","blockedBy":["B"]},{"title":"B","description":"b","blockedBy":["A"]}]}')
check "cycle: error" "$(printf '%s' "$OUT" | grep -c 'cycle')" "1"
check "cycle: nothing created" "$(posts)" "0"
OUT=$(run '{"objective":"O","tasks":[{"title":"A","description":"a","blockedBy":["Nope"]}]}')
check "unknown title: error" "$(printf '%s' "$OUT" | grep -c 'unknown')" "1"
OUT=$(run '{"objective":"O","tasks":[{"title":"A","description":"a","blockedBy":[5]}]}')
check "index out of range: error" "$(printf '%s' "$OUT" | grep -c 'unknown')" "1"
OUT=$(run '{"objective":"O","tasks":[{"title":"A","description":"a","blockedBy":[0]}]}')
check "self reference: error" "$(printf '%s' "$OUT" | grep -c 'cycle')" "1"
check "errors: nothing created" "$(posts)" "0"

# 4. A blocker that fails to create also blocks its dependents from being created.
: > "$STUB_LOG"
OUT=$(run '{"objective":"O","tasks":[{"title":"Fails","description":"f"},{"title":"After","description":"x","blockedBy":["Fails"]}]}')
check "failed blocker: success false" "$(printf '%s' "$OUT" | jq -r .success)" "false"
check "failed blocker: dependent skipped" "$(grep -c '"After"' "$STUB_LOG")" "0"

# 5. --dry-run prints the breakdown, creates nothing.
: > "$STUB_LOG"
OUT=$(run '{"objective":"O","tasks":[{"title":"B","description":"b","blockedBy":["A"]},{"title":"A","description":"a"}]}' --dry-run)
check "dry-run: order" "$(printf '%s' "$OUT" | jq -c '[.tasks[] | .title]')" '["A","B"]'
check "dry-run: blockedBy titles" "$(printf '%s' "$OUT" | jq -c '.tasks[1].blockedBy')" '["A"]'
check "dry-run: nothing created" "$(posts)" "0"

echo "decompose-goal: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
