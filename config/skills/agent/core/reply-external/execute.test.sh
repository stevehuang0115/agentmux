#!/bin/bash
# Tests for reply-external — run with: bash execute.test.sh
# Python HTTP stub as the backend; asserts the request and the printed JSON.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXEC="$HERE/execute.sh"
PASS=0; FAIL=0
check() {
  local name="$1"; local got="$2"; local want="$3"
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $name"; echo "  want: $want"; echo "  got:  $got"; fi
}

PORT=18861
STUB_LOG="$(mktemp)"; export STUB_LOG; export STUB_PORT="$PORT"
python3 -u <<'PY' >/dev/null 2>&1 &
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os
LOG = os.environ['STUB_LOG']; PORT = int(os.environ['STUB_PORT'])
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('content-length', '0')); body = json.loads(self.rfile.read(n).decode() or 'null')
        with open(LOG, 'a') as f: f.write(json.dumps({'method': 'POST', 'path': self.path, 'body': body}) + '\n')
        def send(code, obj):
            self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers()
            self.wfile.write(json.dumps(obj).encode())
        if self.path != '/api/external/replies': return send(200, {'success': True})
        if 'Wang' in (body or {}).get('text', ''):
            return send(422, {'success': False, 'error': 'reply_blocked', 'message': 'Not sent: mentions another person.', 'reasons': ['other_asker']})
        send(200, {'success': True, 'data': {'sent': True}})
    def log_message(self, *a, **k): pass
HTTPServer(('127.0.0.1', PORT), H).serve_forever()
PY
STUB_PID=$!
disown "$STUB_PID" 2>/dev/null || true
WORK="$(mktemp -d)"; mkdir -p "$WORK/home/.crewly"
trap 'kill "$STUB_PID" >/dev/null 2>&1; rm -rf "$STUB_LOG" "$WORK"' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null -m 0.2 "http://127.0.0.1:${PORT}/" 2>/dev/null && break; sleep 0.1; done

ENVS=(CREWLY_API_URL="http://127.0.0.1:${PORT}" CREWLY_SESSION_NAME=avery-1 HOME="$WORK/home" CREWLY_HOME="$WORK/home/.crewly")
run() { : > "$STUB_LOG"; env "${ENVS[@]}" bash "$EXEC" "$@" 2>/dev/null; }
run_err() { env "${ENVS[@]}" bash "$EXEC" "$@" 2>&1 >/dev/null; }
reqs() { jq -c 'select(.path != "/api/heartbeat") | {method, path, body}' "$STUB_LOG" | paste -sd'|' -; }
C=ext-7f2c0a1b2c3d

OUT=$(run --conversation $C 'Thursday: Robotics 2 at 3pm, "room 2".')
check "reply: request" "$(reqs)" '{"method":"POST","path":"/api/external/replies","body":{"conversation":"ext-7f2c0a1b2c3d","text":"Thursday: Robotics 2 at 3pm, \"room 2\"."}}'
check "reply: output" "$OUT" '{"success":true,"sent":true,"conversation":"ext-7f2c0a1b2c3d"}'

OUT=$(run --conversation $C --text 'hello')
check "--text form" "$(reqs | jq -r .body.text)" "hello"

OUT=$(run --conversation $C 'Wang asked too'; true)
check "blocked: reasons and next step" "$(printf '%s' "$OUT" | jq -c '{success, status, reason, reasons, hasNext: (.next != null)}')" '{"success":false,"status":422,"reason":"reply_blocked","reasons":["other_asker"],"hasNext":true}'

OUT=$(run_err 'hi' || true)
check "conversation required" "$(printf '%s' "$OUT" | grep -c 'conversation is required')" "1"
OUT=$(run_err --conversation ext-123 'hi' || true)
check "bad conversation refused" "$(printf '%s' "$OUT" | grep -c 'must look like')" "1"
OUT=$(run_err --conversation $C '   ' || true)
check "empty refused" "$(printf '%s' "$OUT" | grep -c 'empty')" "1"
OUT=$(run_err --conversation $C "$(printf 'x%.0s' $(seq 1 8001))" || true)
check "over 8000 refused" "$(printf '%s' "$OUT" | grep -c 'at most 8000')" "1"

echo "reply-external: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
