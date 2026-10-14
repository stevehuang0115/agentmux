#!/bin/bash
# Tests for app-data — run with: bash execute.test.sh
# Python HTTP stub as the backend; asserts the request the skill sends and
# the JSON it prints. Exit 0 on pass.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXEC="$HERE/execute.sh"
PASS=0; FAIL=0
check() {
  local name="$1"; local got="$2"; local want="$3"
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $name"; echo "  want: $want"; echo "  got:  $got"; fi
}

PORT=18842
STUB_LOG="$(mktemp)"; export STUB_LOG; export STUB_PORT="$PORT"
python3 -u <<'PY' >/dev/null 2>&1 &
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, os
LOG = os.environ['STUB_LOG']; PORT = int(os.environ['STUB_PORT'])
DOC = {'id': 'milk', 'data': {'name': 'milk', 'done': False}, 'rev': 2, 'updatedAt': 't', 'updatedBy': {'kind': 'owner', 'id': 'u'}}
class H(BaseHTTPRequestHandler):
    def _reply(self, method, data=None):
        open(LOG, 'w').write(json.dumps({'method': method, 'path': self.path, 'body': data}))
        def send(code, obj):
            self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers()
            self.wfile.write(json.dumps(obj).encode())
        if self.path.endswith('/pretty'):
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
            return self.wfile.write(json.dumps({'success': True, 'data': {'id': 'pretty', 'data': {'text': 'line1\nline2'}, 'rev': 3, 'updatedAt': 't'}}, indent=2).encode())
        if '/field' in self.path:
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query).get('path', [''])[0]
            if q == '/photo':
                return send(200, {'success': True, 'data': {'field': q, 'type': 'string', 'chars': 38, 'value': 'data:image/png;base64,aGVsbG8gd29ybGQ='}})
            if q == '/n':
                return send(200, {'success': True, 'data': {'field': q, 'type': 'number', 'value': 1}})
        if self.path.endswith('/trunc'):
            return send(200, {'success': True, 'data': {'id': 'trunc', 'data': {'photo': 'xx'}, 'rev': 1, 'updatedAt': 't', 'truncated': [{'field': '/photo', 'chars': 70000}], 'truncatedHint': 'cut'}})
        if self.path.endswith('/missing'):
            return send(404, {'success': False, 'error': 'not_found', 'message': 'Document not found.', 'hint': 'No such app, document or version for this account.'})
        if self.path.endswith('/collaborators') and method == 'GET':
            return send(200, {'success': True, 'data': {'collaborators': [{'id': 'e1', 'kind': 'team', 'who': 'Marketing', 'name': 'Marketing', 'instanceId': 'i'}]}})
        if self.path.endswith('/owner'):
            if method == 'PUT':
                return send(200, {'success': True, 'data': {'appId': 'x', 'owner': {'kind': 'channel', 'explicit': True, 'channelId': 'h1', 'name': '#daily-brief', 'instanceId': 'i', 'members': ['a', 'b']}, 'previous': None}})
            return send(200, {'success': True, 'data': {'appId': 'x', 'owner': {'kind': 'agent', 'explicit': False, 'session': 'dev-ella', 'name': 'Ella', 'instanceId': 'i'}}})
        if self.path.endswith('/collaborators/agents'):
            return send(200, {'success': True, 'data': {'collaborators': [{'id': 'e2', 'kind': 'agent', 'who': 'crewly-dev-kai-1', 'name': 'Kai', 'instanceId': 'i'}], 'added': {'session': 'crewly-dev-kai-1', 'name': 'Kai', 'instanceId': 'i', 'machine': 'iriss-air.lan'}}})
        if self.path.endswith('/collaborators/request'):
            return send(200, {'success': True, 'data': {'requested': True, 'decisionId': 'D-1', 'for': 'the Marketing team'}})
        if self.path.endswith('/byagent'):
            return send(200, {'success': True, 'data': {'docs': [{'id': 'a', 'data': {}, 'rev': 1, 'updatedAt': 't', 'updatedBy': {'kind': 'agent', 'id': 'crewly-marketing-ella-1'}}], 'next': None}})
        if (data or {}).get('ifRev') == 1:
            return send(409, {'success': False, 'error': 'conflict', 'message': 'rev mismatch'})
        if method == 'GET' and '?' in self.path or self.path.endswith('/items'):
            if method == 'GET':
                return send(200, {'success': True, 'data': {'docs': [DOC], 'next': None}})
        if method == 'DELETE':
            return send(200, {'success': True, 'data': {'deleted': True}})
        send(200, {'success': True, 'data': DOC})
    def do_GET(self):
        if '/files/' in self.path:
            open(LOG, 'w').write(json.dumps({'method': 'GET', 'path': self.path, 'session': self.headers.get('x-agent-session')}))
            if self.path.endswith('aaaaaaaaaaaaaaaa'):
                body = b'\x89PNG\r\n\x1a\n\x00\x01'
                self.send_response(200); self.send_header('Content-Type', 'image/png'); self.send_header('X-File-Name', 'subs%20shot.png'); self.send_header('Content-Length', str(len(body))); self.end_headers()
                return self.wfile.write(body)
            self.send_response(404); self.send_header('Content-Type', 'application/json'); self.end_headers()
            return self.wfile.write(json.dumps({'success': False, 'error': 'not_found', 'message': 'No such file in this app.'}).encode())
        if self.path.endswith('/withfile'):
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
            return self.wfile.write(json.dumps({'success': True, 'data': {'id': 'withfile', 'data': {'shots': [{'fileId': 'aaaaaaaaaaaaaaaa'}]}, 'rev': 1, 'updatedAt': 't'}}).encode())
        self._reply('GET')
    def do_DELETE(self): self._reply('DELETE')
    def _body(self, m):
        n = int(self.headers.get('content-length', '0')); body = self.rfile.read(n).decode() if n else ''
        self._reply(m, json.loads(body or '{}'))
    def do_POST(self):
        if self.path.endswith('/files'):
            n = int(self.headers.get('content-length', '0')); raw = self.rfile.read(n)
            name = self.headers.get('x-file-name', '')
            open(LOG, 'w').write(json.dumps({'method': 'POST', 'path': self.path, 'ct': self.headers.get('content-type'), 'name': name, 'len': n, 'hex': raw.hex(), 'session': self.headers.get('x-agent-session')}))
            def send(code, obj):
                self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers()
                self.wfile.write(json.dumps(obj).encode())
            if name == 'nourl.png':
                return send(201, {'success': True, 'data': {'fileId': 'f1'}})
            if name == 'refuse.png':
                return send(403, {'success': False, 'error': 'not_your_app', 'message': 'This app is not yours.'})
            return send(201, {'success': True, 'data': {'fileId': 'f1', 'name': name, 'size': n, 'contentType': self.headers.get('content-type'), 'url': 'https://apps.crewlyai.com/_f/tok/f1'}})
        self._body('POST')
    def do_PUT(self): self._body('PUT')
    def do_PATCH(self): self._body('PATCH')
    def log_message(self, *a, **k): pass
HTTPServer(('127.0.0.1', PORT), H).serve_forever()
PY
STUB_PID=$!
disown "$STUB_PID" 2>/dev/null || true
trap 'kill "$STUB_PID" >/dev/null 2>&1; rm -f "$STUB_LOG"' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null -m 0.2 "http://127.0.0.1:${PORT}/" 2>/dev/null && break; sleep 0.1; done

WORK="$(mktemp -d)"; mkdir -p "$WORK/proj" "$WORK/home/.crewly"
trap 'kill "$STUB_PID" >/dev/null 2>&1; rm -rf "$STUB_LOG" "$WORK"' EXIT
ENVS=(CREWLY_API_URL="http://127.0.0.1:${PORT}" CREWLY_SESSION_NAME=dev-ella CREWLY_PROJECT_PATH="$WORK/proj" HOME="$WORK/home" CREWLY_HOME="$WORK/home/.crewly")
run() { env "${ENVS[@]}" bash "$EXEC" "$@" 2>/dev/null; }
run_err() { env "${ENVS[@]}" bash "$EXEC" "$@" 2>&1 >/dev/null; }
A=28au74d9cj

OUT=$(run --app $A --list items --limit 50 --after abc)
check "list: output" "$OUT" '{"success":true,"docs":[{"id":"milk","data":{"name":"milk","done":false},"rev":2,"updatedAt":"t","updatedBy":"owner"}],"next":null}'
check "list: path" "$(jq -r .path "$STUB_LOG")" "/api/apps/$A/data/items?limit=50&after=abc"

OUT=$(run --app $A --get items milk)
check "get" "$OUT" '{"success":true,"id":"milk","data":{"name":"milk","done":false},"rev":2,"updatedAt":"t"}'

# A multi-line (pretty-printed) response body must survive whole (#1122).
OUT=$(run --app $A --get items pretty)
check "get: multi-line body kept whole" "$OUT" '{"success":true,"id":"pretty","data":{"text":"line1\nline2"},"rev":3,"updatedAt":"t"}'
# The missing-session warning goes to stderr and must not break the JSON (#1122).
OUT=$(env "${ENVS[@]}" CREWLY_SESSION_NAME= bash "$EXEC" --app $A --get items pretty 2>/dev/null)
check "get: stderr warning does not pollute stdout" "$(printf '%s' "$OUT" | jq -r .id)" "pretty"
OUT=$(env "${ENVS[@]}" CREWLY_SESSION_NAME= bash "$EXEC" --app $A --get items missing 2>/dev/null; true)
check "error with warning: reason still parsed" "$(printf '%s' "$OUT" | jq -r .reason)" "not_found"

OUT=$(run --app $A --get items missing; true)
check "get missing → not_found" "$(printf '%s' "$OUT" | jq -c '{success, status, reason}')" '{"success":false,"status":404,"reason":"not_found"}'

run --app $A --set items milk --data '{"done":true}' >/dev/null
check "set: request" "$(jq -c '{method, path, body}' "$STUB_LOG")" "{\"method\":\"PUT\",\"path\":\"/api/apps/$A/data/items/milk\",\"body\":{\"data\":{\"done\":true}}}"

OUT=$(run --app $A --update items milk --data '{"done":true}' --if-rev 2)
check "update: output" "$OUT" '{"success":true,"id":"milk","rev":2}'
check "update: request" "$(jq -c '{method, body}' "$STUB_LOG")" '{"method":"PATCH","body":{"data":{"done":true},"ifRev":2}}'

OUT=$(run --app $A --update items milk --data '{"done":true}' --if-rev 1; true)
check "update conflict" "$(printf '%s' "$OUT" | jq -r .reason)" "conflict"

run --app $A --add items --data '{"name":"eggs"}' >/dev/null
check "add: request" "$(jq -c '{method, path, body}' "$STUB_LOG")" "{\"method\":\"POST\",\"path\":\"/api/apps/$A/data/items\",\"body\":{\"data\":{\"name\":\"eggs\"}}}"

OUT=$(run --app $A --delete items milk)
check "delete" "$OUT" '{"success":true,"deleted":true}'

OUT=$(run_err --app $A --set items milk --data '[1]' || true)
check "non-object data refused" "$(printf '%s' "$OUT" | grep -c 'JSON object')" "1"
OUT=$(run_err --list items || true)
check "app required" "$(printf '%s' "$OUT" | grep -c 'app is required')" "1"

# --data-file: a regular, non-symlink file inside the project only.
printf '{"name":"bread"}' > "$WORK/proj/d.json"
run --app $A --add items --data-file "$WORK/proj/d.json" >/dev/null
check "data-file inside the project" "$(jq -c .body "$STUB_LOG")" '{"data":{"name":"bread"}}'
printf '{"x":1}' > "$WORK/outside.json"
OUT=$(run_err --app $A --add items --data-file "$WORK/outside.json" || true)
check "data-file outside the project refused" "$(printf '%s' "$OUT" | grep -c 'outside your project directory')" "1"
ln -s "$WORK/outside.json" "$WORK/proj/link.json"
OUT=$(run_err --app $A --add items --data-file "$WORK/proj/link.json" || true)
check "symlinked data-file refused" "$(printf '%s' "$OUT" | grep -c 'symbolic link')" "1"
printf '{"token":"t"}' > "$WORK/home/.crewly/c.json"
OUT=$(env "${ENVS[@]}" CREWLY_PROJECT_PATH="$WORK/home" bash "$EXEC" --app $A --add items --data-file "$WORK/home/.crewly/c.json" 2>&1 >/dev/null || true)
check "data-file in Crewly home refused" "$(printf '%s' "$OUT" | grep -c "inside Crewly's home")" "1"
OUT=$(run_err --app $A --get items .. || true)
check "doc id .. refused" "$(printf '%s' "$OUT" | grep -c 'cannot be')" "1"

# A write by an agent shows who (the session); an owner write does not carry an id.
OUT=$(run --app $A --list byagent)
check "list: agent write shows its session" "$(printf '%s' "$OUT" | jq -c '.docs[0] | {updatedBy, by}')" '{"updatedBy":"agent","by":"crewly-marketing-ella-1"}'

# Asking for access: POST .../collaborators/request with the scope and reason only.
OUT=$(run --app $A --request-access --scope agent --reason "write the briefing")
check "request-access: path" "$(jq -r '.method + " " + .path' "$STUB_LOG")" "POST /api/apps/$A/collaborators/request"
check "request-access: body" "$(jq -c .body "$STUB_LOG")" '{"scope":"agent","reason":"write the briefing"}'
check "request-access: output says requested" "$(printf '%s' "$OUT" | jq -c '{success, requested, for}')" '{"success":true,"requested":true,"for":"the Marketing team"}'
OUT=$(run_err --app $A --request-access --scope everyone || true)
check "request-access: bad scope refused" "$(printf '%s' "$OUT" | grep -c 'team or agent')" "1"
OUT=$(run --app $A --collaborators)
check "collaborators: output" "$OUT" '{"success":true,"collaborators":[{"id":"e1","kind":"team","name":"Marketing","who":"Marketing"}]}'

# App owner (crewly-services apps/SPEC.md §15).
OUT=$(run --app $A --owner)
check "owner: shows the default owner" "$OUT" '{"success":true,"owner":{"kind":"agent","name":"Ella","default":true}}'
check "owner: GET path" "$(jq -r '.method + " " + .path' "$STUB_LOG")" "GET /api/apps/$A/owner"
OUT=$(run --app $A --set-owner 'channel:#daily-brief')
check "set-owner: request" "$(jq -c '{method, path, body}' "$STUB_LOG")" "{\"method\":\"PUT\",\"path\":\"/api/apps/$A/owner\",\"body\":{\"owner\":\"channel:#daily-brief\"}}"
check "set-owner: output" "$OUT" '{"success":true,"owner":{"kind":"channel","name":"#daily-brief","default":false,"members":["a","b"]}}'
OUT=$(run --app $A --add-collaborator Kai)
check "add-collaborator: request" "$(jq -c '{method, path, body}' "$STUB_LOG")" "{\"method\":\"POST\",\"path\":\"/api/apps/$A/collaborators/agents\",\"body\":{\"agent\":\"Kai\"}}"
check "add-collaborator: output" "$(printf '%s' "$OUT" | jq -c '.collaborators[0].name')" '"Kai"'
check "add-collaborator: output says which machine" "$(printf '%s' "$OUT" | jq -c '.added.machine')" '"iriss-air.lan"'
OUT=$(run --app $A --add-collaborator Rex@iriss-air)
check "add-collaborator: name@machine passed as typed" "$(jq -c .body "$STUB_LOG")" '{"agent":"Rex@iriss-air"}'
OUT=$(run_err --app $A --set-owner || true)
check "set-owner needs a value" "$(printf '%s' "$OUT" | grep -c 'requires an owner')" "1"
# --set still means a data write.
run --app $A --set items milk --data '{"done":true}' >/dev/null
check "--set is still a data write" "$(jq -r '.method + " " + .path' "$STUB_LOG")" "PUT /api/apps/$A/data/items/milk"

# --upload: raw bytes, content type from the extension, name URI-encoded; same project-dir guard as --data-file.
printf '\x89PNG\r\n\x1a\n\x00\x01' > "$WORK/proj/pic one.png"
OUT=$(run --app $A --upload "$WORK/proj/pic one.png")
check "upload: output has the url" "$(printf '%s' "$OUT" | jq -c '{success, fileId, name, size, contentType, url}')" '{"success":true,"fileId":"f1","name":"pic%20one.png","size":10,"contentType":"image/png","url":"https://apps.crewlyai.com/_f/tok/f1"}'
check "upload: request" "$(jq -c '{method, path, ct, name, len, hex, session}' "$STUB_LOG")" "{\"method\":\"POST\",\"path\":\"/api/apps/$A/files\",\"ct\":\"image/png\",\"name\":\"pic%20one.png\",\"len\":10,\"hex\":\"89504e470d0a1a0a0001\",\"session\":\"dev-ella\"}"
OUT=$(run --app $A --upload "$WORK/proj/pic one.png" --name "shot 1.png")
check "upload: --name overrides" "$(jq -r .name "$STUB_LOG")" "shot%201.png"
printf '{"a":1}' > "$WORK/proj/data.json"
run --app $A --upload "$WORK/proj/data.json" >/dev/null
check "upload: json is sent as octet-stream" "$(jq -r .ct "$STUB_LOG")" "application/octet-stream"
# A normal call after an upload is JSON again (the upload env does not leak).
run --app $A --add items --data '{"n":1}' >/dev/null
check "upload does not leak into the next call" "$(jq -c .body "$STUB_LOG")" '{"data":{"n":1}}'
printf 'x' > "$WORK/outside.png"
OUT=$(run_err --app $A --upload "$WORK/outside.png" || true)
check "upload: outside the project refused" "$(printf '%s' "$OUT" | grep -c 'outside your project directory')" "1"
ln -s "$WORK/proj/pic one.png" "$WORK/proj/link.png"
OUT=$(run_err --app $A --upload "$WORK/proj/link.png" || true)
check "upload: symlink refused" "$(printf '%s' "$OUT" | grep -c 'symbolic link')" "1"
OUT=$(run_err --app $A --upload "$WORK/proj/nope.png" || true)
check "upload: missing file" "$(printf '%s' "$OUT" | grep -c 'file not found')" "1"
: > "$WORK/proj/empty.png"
OUT=$(run_err --app $A --upload "$WORK/proj/empty.png" || true)
check "upload: empty file refused" "$(printf '%s' "$OUT" | grep -c 'is empty')" "1"
printf '\x89PNG' > "$WORK/proj/refuse.png"
OUT=$(run --app $A --upload "$WORK/proj/refuse.png"; true)
check "upload: Cloud refusal passed through, not a fake success" "$(printf '%s' "$OUT" | jq -c '{success, status, reason}')" '{"success":false,"status":403,"reason":"not_your_app"}'
printf '\x89PNG' > "$WORK/proj/nourl.png"
OUT=$(run_err --app $A --upload "$WORK/proj/nourl.png" || true)
check "upload: 2xx without a url fails, not success with nulls" "$(printf '%s' "$OUT" | grep -c 'without a url')" "1"
OUT=$(run_err --app $A --upload || true)
check "upload needs a path" "$(printf '%s' "$OUT" | grep -c 'requires a file path')" "1"

# --get / --list carry the truncation flag through (#1145).
OUT=$(run --app $A --get items trunc)
check "get: truncation flag passed through" "$(printf '%s' "$OUT" | jq -c '.truncated')" '[{"field":"/photo","chars":70000}]'

# --get-field --out writes the full value to a file and prints no content (#1145).
OUT=$(run --app $A --get-field items milk --field /photo --out "$WORK/proj/photo.txt")
check "get-field: path" "$(jq -r .path "$STUB_LOG")" "/api/apps/$A/data/items/milk/field?path=%2Fphoto"
check "get-field: file holds the raw value" "$(cat "$WORK/proj/photo.txt")" 'data:image/png;base64,aGVsbG8gd29ybGQ='
check "get-field: prints a receipt, not the value" "$(printf '%s' "$OUT" | jq -c '{success, bytes, chars}')" '{"success":true,"bytes":38,"chars":38}'
run --app $A --get-field items milk --field /photo --out "$WORK/proj/photo.bin" --decode >/dev/null
check "get-field --decode: data URL decoded to bytes" "$(cat "$WORK/proj/photo.bin")" 'hello world'
OUT=$(run_err --app $A --get-field items milk --field /photo --out "$WORK/outside-photo.txt" || true)
check "get-field: --out outside the project refused" "$(printf '%s' "$OUT" | grep -c 'inside your project')" "1"
ln -s "$WORK/outside.json" "$WORK/proj/out-link.txt"
OUT=$(run_err --app $A --get-field items milk --field /photo --out "$WORK/proj/out-link.txt" || true)
check "get-field: symlink --out refused" "$(printf '%s' "$OUT" | grep -c 'symbolic link')" "1"
OUT=$(run_err --app $A --get-field items milk --field /n --out "$WORK/proj/n.txt" || true)
check "get-field: non-string field refused" "$(printf '%s' "$OUT" | grep -c 'not a string')" "1"
OUT=$(run_err --app $A --get-field items milk --out "$WORK/proj/x.txt" || true)
check "get-field: --field required" "$(printf '%s' "$OUT" | grep -c -- '--field is required')" "1"

# --download: bytes saved into <project>/inbox/app-files/<app>/<name>, receipt printed, same path guard.
OUT=$(run --app $A --download aaaaaaaaaaaaaaaa)
check "download: receipt" "$(printf '%s' "$OUT" | jq -c '{success, name, size, contentType}')" '{"success":true,"name":"subs shot.png","size":10,"contentType":"image/png"}'
check "download: request" "$(jq -c '{method, path, session}' "$STUB_LOG")" "{\"method\":\"GET\",\"path\":\"/api/apps/$A/files/aaaaaaaaaaaaaaaa\",\"session\":\"dev-ella\"}"
DLP="$(printf '%s' "$OUT" | jq -r .path)"
check "download: default location" "${DLP#$(cd "$WORK/proj" && pwd -P)/}" "inbox/app-files/$A/subs shot.png"
check "download: bytes intact" "$(xxd -p "$DLP" | tr -d '\n')" "89504e470d0a1a0a0001"
check "download: no temp files left" "$(ls -A "$WORK/proj/inbox/app-files/$A" | wc -l | tr -d ' ')" "1"
OUT=$(run --app $A --download "https://apps.crewlyai.com/_f/sometoken/aaaaaaaaaaaaaaaa?x=1" --out "$WORK/proj/mine.png")
check "download: url + --out" "$(printf '%s' "$OUT" | jq -r '.path | split("/") | last')" "mine.png"
OUT=$(run --app $A --download bbbbbbbbbbbbbbbb; true)
check "download: Cloud 404 passed through" "$(printf '%s' "$OUT" | jq -c '{success, status, reason}')" '{"success":false,"status":404,"reason":"not_found"}'
check "download: failed download leaves no file" "$(ls -A "$WORK/proj/inbox/app-files/$A" | wc -l | tr -d ' ')" "1"
OUT=$(run_err --app $A --download "not-an-id" || true)
check "download: bad id refused" "$(printf '%s' "$OUT" | grep -c '16-character')" "1"
OUT=$(run_err --app $A --download aaaaaaaaaaaaaaaa --out "$WORK/outside-dl.png" || true)
check "download: --out outside the project refused" "$(printf '%s' "$OUT" | grep -c 'inside your project')" "1"
OUT=$(run_err --app $A --download aaaaaaaaaaaaaaaa --out "$WORK/home/.crewly/x.png" || true)
check "download: --out under ~/.crewly refused" "$(printf '%s' "$OUT" | grep -c "inside")" "1"
OUT=$(run --app $A --get items withfile)
check "get: file reference gets the --download hint" "$(printf '%s' "$OUT" | jq -r '.fileHint | test("--download")')" "true"

echo "app-data: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
