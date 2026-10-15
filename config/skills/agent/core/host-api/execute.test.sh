#!/bin/bash
# Tests for host-api — run with: bash execute.test.sh
# Python HTTP stub as the backend; asserts the request and the printed JSON.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXEC="$HERE/execute.sh"
PASS=0; FAIL=0
check() {
  local name="$1"; local got="$2"; local want="$3"
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $name"; echo "  want: $want"; echo "  got:  $got"; fi
}

PORT=18862
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
        if self.path != '/api/external/host-api': return send(200, {'success': True})
        p = (body or {}).get('path', '')
        if p == '/forbidden':
            return send(200, {'success': True, 'data': {'status': 403, 'contentType': 'text/plain', 'body': 'not yours', 'truncated': False}})
        if p == '/other-agent':
            return send(403, {'success': False, 'error': 'not_front_agent', 'message': 'Only the agent this portal talks to.'})
        send(200, {'success': True, 'data': {'status': 200, 'contentType': 'application/json', 'body': '{"classes":[{"id":"c-42"}]}', 'truncated': False}})
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

OUT=$(run --conversation $C get '/my-classes?from=2026-10-15')
check "get: request" "$(reqs)" '{"method":"POST","path":"/api/external/host-api","body":{"conversation":"ext-7f2c0a1b2c3d","method":"GET","path":"/my-classes?from=2026-10-15"}}'
check "get: JSON body inlined" "$OUT" '{"success":true,"status":200,"truncated":false,"body":{"classes":[{"id":"c-42"}]}}'

run --conversation $C POST /tickets --body '{"title":"Projector"}' >/dev/null
check "post: body passed" "$(reqs | jq -c .body.body)" '{"title":"Projector"}'

OUT=$(run --conversation $C GET /forbidden)
check "portal says no: success false, text body" "$OUT" '{"success":false,"status":403,"truncated":false,"body":"not yours"}'

OUT=$(run --conversation $C GET /other-agent; true)
check "not the front agent" "$(printf '%s' "$OUT" | jq -c '{success, status, reason}')" '{"success":false,"status":403,"reason":"not_front_agent"}'

OUT=$(run_err --conversation $C GET my-classes || true)
check "path must start with /" "$(printf '%s' "$OUT" | grep -c 'must start with /')" "1"
OUT=$(run_err --conversation $C TRACE /x || true)
check "bad method refused" "$(printf '%s' "$OUT" | grep -c 'METHOD must be')" "1"
OUT=$(run_err --conversation $C POST /x --body '{nope' || true)
check "bad JSON body refused" "$(printf '%s' "$OUT" | grep -c 'must be JSON')" "1"
OUT=$(run_err GET /me || true)
check "conversation required" "$(printf '%s' "$OUT" | grep -c 'conversation is required')" "1"

echo "host-api: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
