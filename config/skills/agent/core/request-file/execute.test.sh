#!/bin/bash
# Tests for request-file — run with: bash execute.test.sh
# A Python stub plays the Crewly backend.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXEC="$HERE/execute.sh"
PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $1"; echo "  want: $3"; echo "  got:  $2"; fi; }

PORT=18862
STUB_LOG="$(mktemp)"; export STUB_LOG STUB_PORT="$PORT"
python3 -u <<'PY' >/dev/null 2>&1 &
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os
LOG = os.environ['STUB_LOG']; PORT = int(os.environ['STUB_PORT'])
ID = 'ur_AbCdEfGhIjKlMnOpQrStUv'
def note(**kw):
    with open(LOG, 'a') as f: f.write(json.dumps(kw) + '\n')
class H(BaseHTTPRequestHandler):
    def send(self, code, obj):
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(json.dumps(obj).encode())
    def body(self):
        n = int(self.headers.get('Content-Length') or 0); return self.rfile.read(n)
    def do_POST(self):
        b = self.body()
        if self.path == '/api/apps/upload-requests':
            req = json.loads(b); note(op='create', req=req, session=self.headers.get('X-Agent-Session'))
            if req['purpose'] == 'refuse':
                return self.send(402, {'success': False, 'error': 'quota_exceeded', 'message': 'Too many open links.'})
            return self.send(201, {'success': True, 'data': {'requestId': ID, 'url': 'https://crewlyai.com/portal/upload/' + ID, 'expiresAt': '2026-10-13T00:00:00.000Z', 'limits': {'maxFileBytes': 2147483648, 'maxFiles': 10}}})
        self.send(404, {'success': False})
    def do_GET(self):
        note(op='status', path=self.path)
        self.send(200, {'success': True, 'data': {'requestId': ID, 'status': 'open', 'purpose': 'p', 'expiresAt': 'x', 'files': [], 'limits': {}}})
    def do_DELETE(self):
        note(op='cancel', path=self.path); self.send(200, {'success': True, 'data': {'cancelled': True}})
    def log_message(self, *a, **k): pass
HTTPServer(('127.0.0.1', PORT), H).serve_forever()
PY
STUB_PID=$!
disown "$STUB_PID" 2>/dev/null || true
WORK="$(mktemp -d)"
trap 'kill "$STUB_PID" >/dev/null 2>&1; rm -rf "$STUB_LOG" "$WORK"' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null -m 0.2 "http://127.0.0.1:${PORT}/" 2>/dev/null && break; sleep 0.1; done
mkdir -p "$WORK/home/.crewly"
ENVS=(CREWLY_API_URL="http://127.0.0.1:${PORT}" CREWLY_SESSION_NAME=pia HOME="$WORK/home" CREWLY_HOME="$WORK/home/.crewly")
run() { env "${ENVS[@]}" bash "$EXEC" "$@" 2>/dev/null; }
run_err() { env "${ENVS[@]}" bash "$EXEC" "$@" 2>&1 >/dev/null; }

: > "$STUB_LOG"
OUT=$(run --purpose "the raw footage" --agent-name Pia --max-files 2)
check "result" "$(printf '%s' "$OUT" | jq -c '{success, requestId, url}')" '{"success":true,"requestId":"ur_AbCdEfGhIjKlMnOpQrStUv","url":"https://crewlyai.com/portal/upload/ur_AbCdEfGhIjKlMnOpQrStUv"}'
check "instruction tells the agent not to ask for compression" "$(printf '%s' "$OUT" | jq -r .instruction | grep -c 'compress')" "1"
check "create request" "$(sed -n 1p "$STUB_LOG" | jq -c '{req, session}')" '{"req":{"purpose":"the raw footage","agentName":"Pia","maxFiles":2},"session":"pia"}'

: > "$STUB_LOG"
run --purpose "plain" >/dev/null
check "optional fields are left out" "$(sed -n 1p "$STUB_LOG" | jq -c .req)" '{"purpose":"plain"}'

OUT=$(run --purpose refuse; true)
check "cloud refusal passed through" "$(printf '%s' "$OUT" | jq -c '{success, reason}')" '{"success":false,"reason":"quota_exceeded"}'

: > "$STUB_LOG"
OUT=$(run --status ur_AbCdEfGhIjKlMnOpQrStUv)
check "status" "$(printf '%s' "$OUT" | jq -r .status)" "open"
check "status path" "$(jq -r .path "$STUB_LOG")" "/api/apps/upload-requests/ur_AbCdEfGhIjKlMnOpQrStUv"

: > "$STUB_LOG"
run --cancel ur_AbCdEfGhIjKlMnOpQrStUv >/dev/null
check "cancel path" "$(jq -r .path "$STUB_LOG")" "/api/apps/upload-requests/ur_AbCdEfGhIjKlMnOpQrStUv"

check "purpose required" "$(run_err | grep -c -- '--purpose is required')" "1"
check "bad max-files refused" "$(run_err --purpose x --max-files 99 | grep -c -- '--max-files must be 1 to 10')" "1"
check "bad id refused" "$(run_err --cancel nope | grep -c 'request id like ur_')" "1"

echo "request-file: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
