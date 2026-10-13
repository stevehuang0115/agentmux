#!/bin/bash
# Tests for share-file — run with: bash execute.test.sh
# A Python stub plays both the Crewly backend and the object storage.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXEC="$HERE/execute.sh"
PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $1"; echo "  want: $3"; echo "  got:  $2"; fi; }

PORT=18862
STUB_LOG="$(mktemp)"; STORE="$(mktemp)"; export STUB_LOG STORE STUB_PORT="$PORT"
python3 -u <<'PY' >/dev/null 2>&1 &
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os
LOG = os.environ['STUB_LOG']; STORE = os.environ['STORE']; PORT = int(os.environ['STUB_PORT'])
ID = 'sf_AbCdEfGhIjKlMnOpQrStUv'
LINK = 'https://crewlyai.com/portal/files/' + ID
def note(**kw):
    with open(LOG, 'a') as f: f.write(json.dumps(kw) + '\n')
class H(BaseHTTPRequestHandler):
    def send(self, code, obj):
        self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(json.dumps(obj).encode())
    def body(self):
        n = int(self.headers.get('Content-Length') or 0); return self.rfile.read(n)
    def do_POST(self):
        b = self.body()
        if self.path == '/api/apps/shares':
            req = json.loads(b); note(op='create', req=req, session=self.headers.get('X-Agent-Session'))
            if req['fileName'] == 'refuse.bin':
                return self.send(413, {'success': False, 'error': 'too_large', 'message': 'A shared file can be at most 4096 MB.'})
            return self.send(201, {'success': True, 'data': {'shareId': ID, 'status': 'pending', 'url': LINK, 'upload': {'url': f'http://127.0.0.1:{PORT}/store/obj?X-Amz-Signature=SECRETSIG', 'method': 'PUT', 'headers': {'Content-Type': req['contentType'], 'x-amz-server-side-encryption': 'AES256'}}}})
        if self.path == f'/api/apps/shares/{ID}/complete':
            note(op='complete'); return self.send(200, {'success': True, 'data': {'shareId': ID, 'status': 'ready', 'url': LINK, 'expiresAt': '2026-10-20T00:00:00.000Z'}})
        self.send(404, {'success': False})
    def do_GET(self):
        note(op='get', path=self.path)
        if self.path == f'/api/apps/shares/{ID}':
            return self.send(200, {'success': True, 'data': {'shareId': ID, 'status': 'ready', 'fileName': 'daily.mp4', 'sizeBytes': 3000000, 'url': LINK, 'expiresAt': '2026-10-20T00:00:00.000Z', 'download': {'url': 'https://secret.example/x'}}})
        if self.path == '/api/apps/shares':
            return self.send(200, {'success': True, 'data': {'shares': [{'shareId': ID, 'status': 'ready', 'fileName': 'daily.mp4', 'sizeBytes': 3000000, 'url': LINK, 'expiresAt': '2026-10-20T00:00:00.000Z', 'from': {'id': 'dev-ella'}}]}})
        self.send(404, {'success': False})
    def do_DELETE(self):
        note(op='cancel', path=self.path); self.send(200, {'success': True, 'data': {'deleted': True}})
    def do_PUT(self):
        b = self.body()
        note(op='put', bytes=len(b), ctype=self.headers.get('Content-Type'), sse=self.headers.get('x-amz-server-side-encryption'), query=self.path.split('?')[-1])
        self.send_response(500 if os.path.exists(STORE + '.fail') else 200); self.end_headers()
    def log_message(self, *a, **k): pass
HTTPServer(('127.0.0.1', PORT), H).serve_forever()
PY
STUB_PID=$!
disown "$STUB_PID" 2>/dev/null || true
WORK="$(mktemp -d)"
trap 'kill "$STUB_PID" >/dev/null 2>&1; rm -rf "$STUB_LOG" "$STORE" "$STORE.fail" "$WORK"' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null -m 0.2 "http://127.0.0.1:${PORT}/" 2>/dev/null && break; sleep 0.1; done
mkdir -p "$WORK/home/.crewly" "$WORK/proj/out"
ENVS=(CREWLY_API_URL="http://127.0.0.1:${PORT}" CREWLY_SESSION_NAME=dev-ella HOME="$WORK/home" CREWLY_HOME="$WORK/home/.crewly" CREWLY_PROJECT_PATH="$WORK/proj")
run() { env "${ENVS[@]}" bash "$EXEC" "$@" 2>/dev/null; }
run_err() { env "${ENVS[@]}" bash "$EXEC" "$@" 2>&1 >/dev/null; }

: > "$STUB_LOG"  # drop the readiness probe
head -c 3000000 /dev/zero > "$WORK/proj/out/daily.mp4"
OUT=$(run --path "$WORK/proj/out/daily.mp4" --note "the HD cut")
check "result" "$(printf '%s' "$OUT" | jq -c '{success, shareId, url, fileName, sizeBytes, expiresAt}')" '{"success":true,"shareId":"sf_AbCdEfGhIjKlMnOpQrStUv","url":"https://crewlyai.com/portal/files/sf_AbCdEfGhIjKlMnOpQrStUv","fileName":"daily.mp4","sizeBytes":3000000,"expiresAt":"2026-10-20T00:00:00.000Z"}'
check "instruction tells the agent to post the url in its own words" "$(printf '%s' "$OUT" | jq -r '.instruction' | grep -c 'in your own words')" "1"
check "instruction names cancel" "$(printf '%s' "$OUT" | jq -r '.instruction' | grep -c 'share-file/execute.sh --cancel sf_AbCdEfGhIjKlMnOpQrStUv')" "1"
check "output never carries the signed url" "$(printf '%s' "$OUT" | grep -c 'SECRETSIG')" "0"
check "create request" "$(sed -n 1p "$STUB_LOG" | jq -c '{req, session}')" '{"req":{"fileName":"daily.mp4","sizeBytes":3000000,"contentType":"video/mp4","note":"the HD cut"},"session":"dev-ella"}'
check "upload streamed with signed headers" "$(sed -n 2p "$STUB_LOG" | jq -c '{bytes, ctype, sse}')" '{"bytes":3000000,"ctype":"video/mp4","sse":"AES256"}'
check "complete called" "$(sed -n 3p "$STUB_LOG" | jq -r .op)" "complete"

# --name overrides the file name; --content-type overrides the guess
: > "$STUB_LOG"
run --path "$WORK/proj/out/daily.mp4" --name "launch.mov" --content-type video/quicktime >/dev/null
check "name and content type" "$(sed -n 1p "$STUB_LOG" | jq -c '.req | {fileName, contentType}')" '{"fileName":"launch.mov","contentType":"video/quicktime"}'

# Big files report progress on stderr (threshold lowered for the test), and never leak the signed url
: > "$STUB_LOG"
ERR=$(env "${ENVS[@]}" SHARE_FILE_PROGRESS_MIN_BYTES=1 bash "$EXEC" --path "$WORK/proj/out/daily.mp4" 2>&1 >/dev/null)
check "progress announced" "$(printf '%s' "$ERR" | grep -c 'uploading 2 MB')" "1"
check "progress reaches 100%" "$(printf '%s' "$ERR" | grep -c 'uploaded 100%')" "1"
check "progress never prints the signed url" "$(printf '%s' "$ERR" | grep -c 'SECRETSIG')" "0"
check "progress run still uploads the whole file" "$(grep '"op": "put"' "$STUB_LOG" | jq -r .bytes)" "3000000"

: > "$STUB_LOG"
OUT=$(run --path "$WORK/proj/out/daily.mp4" --name "refuse.bin"; true)
check "cloud refusal passed through" "$(printf '%s' "$OUT" | jq -c '{success, reason}')" '{"success":false,"reason":"too_large"}'

: > "$STUB_LOG"; touch "$STORE.fail"
OUT=$(run --path "$WORK/proj/out/daily.mp4"; true)
check "failed upload reports and cancels" "$(printf '%s' "$OUT" | jq -r .reason)" "upload_failed"
check "cancel issued" "$(grep -c '"op": "cancel"' "$STUB_LOG")" "1"
rm -f "$STORE.fail"

# Path safety (same as send-file)
echo secret > "$WORK/outside.txt"; ln -s "$WORK/proj/out/daily.mp4" "$WORK/proj/link.mp4"
echo hidden > "$WORK/home/.crewly/token.txt"
mkdir -p "$WORK/proj/dir"; : > "$WORK/proj/empty.mp4"
check "outside project refused" "$(run_err --path "$WORK/outside.txt" | grep -c 'outside your project directory')" "1"
check "symlink refused" "$(run_err --path "$WORK/proj/link.mp4" | grep -c 'symbolic link')" "1"
check "directory refused" "$(run_err --path "$WORK/proj/dir" | grep -c 'not a regular file')" "1"
check "empty file refused" "$(run_err --path "$WORK/proj/empty.mp4" | grep -c 'is empty')" "1"
check "missing file refused" "$(run_err --path "$WORK/proj/nope" | grep -c 'file not found')" "1"
check "path required" "$(run_err | grep -c -- '--path is required')" "1"
: > "$STUB_LOG"
env "${ENVS[@]}" CREWLY_PROJECT_PATH="$WORK" bash "$EXEC" --path "$WORK/home/.crewly/token.txt" >/dev/null 2>&1
check "Crewly home refused even when it is inside the project" "$(grep -c '"op": "create"' "$STUB_LOG")" "0"

# --status and --cancel
: > "$STUB_LOG"
OUT=$(run --status)
check "status lists shares with links" "$(printf '%s' "$OUT" | jq -c '{success, shares}')" '{"success":true,"shares":[{"shareId":"sf_AbCdEfGhIjKlMnOpQrStUv","status":"ready","fileName":"daily.mp4","sizeBytes":3000000,"url":"https://crewlyai.com/portal/files/sf_AbCdEfGhIjKlMnOpQrStUv","expiresAt":"2026-10-20T00:00:00.000Z"}]}'
OUT=$(run --status sf_AbCdEfGhIjKlMnOpQrStUv)
check "status of one share drops signed urls" "$(printf '%s' "$OUT" | jq -c '{success, shareId, status, fileName}')" '{"success":true,"shareId":"sf_AbCdEfGhIjKlMnOpQrStUv","status":"ready","fileName":"daily.mp4"}'
check "status of one share never prints a download url" "$(printf '%s' "$OUT" | grep -c 'secret.example')" "0"
: > "$STUB_LOG"
run --cancel sf_AbCdEfGhIjKlMnOpQrStUv >/dev/null
check "cancel" "$(jq -r .path "$STUB_LOG")" "/api/apps/shares/sf_AbCdEfGhIjKlMnOpQrStUv"
check "cancel needs a share id" "$(run_err --cancel hf_AbCdEfGhIjKlMnOpQrStUv | grep -c 'share id like sf_')" "1"

echo "share-file: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
