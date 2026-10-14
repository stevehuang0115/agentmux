#!/bin/bash
# =============================================================================
# share-file — put a LARGE file you made (an HD video, an archive) on a private
# link for the OWNER, who watches it in the page and downloads it on the phone.
# The reverse of request-file (crewly-services apps/SPEC.md section 20).
#
# The backend (POST /api/apps/shares) asks Cloud for a presigned upload URL;
# this script then streams the file straight to object storage with curl -T
# (from disk, never buffered), and confirms with /complete.
#
# Usage:
#   bash execute.sh --path <file> [--name <name>] [--note <text>] [--content-type <type>]
#   bash execute.sh --status [<shareId>]
#   bash execute.sh --cancel <shareId>
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_common/lib.sh"

# Progress lines (one per 10%) are printed for uploads at least this big.
PROGRESS_MIN_BYTES="${SHARE_FILE_PROGRESS_MIN_BYTES:-52428800}"

print_usage() {
  cat <<'EOF_USAGE'
Usage:
  bash execute.sh --path <file> [--name <name>] [--note <text>] [--content-type <type>]
  bash execute.sh --status [<shareId>]
  bash execute.sh --cancel <shareId>

Options:
  --path          Regular file inside your project directory, up to 4 GB (required)
  --name          Name the owner sees and saves it under (default: the file's name)
  --note          One line for the owner (what it is, e.g. "the HD cut, 1.2 GB")
  --content-type  MIME type (default: from the extension)
  --status        List your shared files (with their links), or show one
  --cancel        Take a shared file down (deletes the uploaded file)
  --help | -h     Show this help
EOF_USAGE
}

fail_from() {
  printf '%s' "$1" | jq -c '{success: false, status: (.status // 0), reason: (.details.error // .error // "unknown"), message: (.details.message // .details // "")}' 2>/dev/null \
    || jq -cn --arg r "$1" '{success: false, reason: $r}'
  exit 1
}

call() {
  local out
  out=$(api_call "$@" 2>&1) || { fail_from "$(printf '%s\n' "$out" | tail -n 1)"; }
  printf '%s\n' "$out" | tail -n 1
}

content_type_for() {
  case "$(printf '%s' "${1##*.}" | tr '[:upper:]' '[:lower:]')" in
    mp4|m4v) echo video/mp4 ;;
    mov) echo video/quicktime ;;
    webm) echo video/webm ;;
    mkv) echo video/x-matroska ;;
    mp3) echo audio/mpeg ;;
    wav) echo audio/wav ;;
    m4a) echo audio/mp4 ;;
    png) echo image/png ;;
    jpg|jpeg) echo image/jpeg ;;
    gif) echo image/gif ;;
    webp) echo image/webp ;;
    pdf) echo application/pdf ;;
    zip) echo application/zip ;;
    json) echo application/json ;;
    csv) echo text/csv ;;
    txt|md|log) echo text/plain ;;
    *) echo application/octet-stream ;;
  esac
}

# Regular, non-symlink file inside the project directory, never under Crewly's
# home. Prints the real path, then the size in bytes.
check_file() {
  command -v node >/dev/null 2>&1 || error_exit "node is required"
  CF_PATH="$1" CF_PROJECT="${CREWLY_PROJECT_PATH:-$PWD}" node <<'NODE'
const fs = require('fs'); const path = require('path'); const os = require('os');
const fail = (m) => { process.stderr.write(JSON.stringify({ error: m }) + '\n'); process.exit(1); };
const real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
const within = (c, p) => c === p || c.startsWith(p.endsWith(path.sep) ? p : p + path.sep);
const given = process.env.CF_PATH;
const abs = path.resolve(given);
let st;
try { st = fs.lstatSync(abs); } catch { fail(`file not found: ${given}`); }
if (st.isSymbolicLink()) fail(`${given} is a symbolic link; pass the real file`);
if (!st.isFile()) fail(`${given} is not a regular file`);
if (st.size === 0) fail(`${given} is empty`);
const r = real(abs); const project = real(process.env.CF_PROJECT || process.cwd());
if (!project) fail('cannot resolve the project directory');
const homes = [path.join(os.homedir(), '.crewly'), process.env.CREWLY_HOME].filter(Boolean).map((p) => real(p) || path.resolve(p));
if (homes.some((h) => within(r, h))) fail(`${given} is inside Crewly's home directory`);
if (!within(r, project)) fail(`${given} is outside your project directory (${project}); copy it there first`);
process.stdout.write(r + '\n' + st.size + '\n');
NODE
}

# Stream the file to the presigned URL (curl -T reads from disk). Prints the HTTP
# status. Big files report progress (one stderr line per 10%) so the run is not silent.
upload() {
  local file="$1" size="$2" url="$3"; shift 3
  if [ "$size" -ge "$PROGRESS_MIN_BYTES" ]; then
    echo "uploading $(( size / 1048576 )) MB..." >&2
    curl --progress-bar -S -o /dev/null -w '%{http_code}' --connect-timeout 30 --retry 3 --retry-delay 3 -X PUT -T "$file" "$@" "$url" \
      2> >(tr '\r' '\n' | awk 'BEGIN{last=0} match($0,/[0-9]+\.[0-9]%/){p=int(substr($0,RSTART)+0); if(p>=last+10){last=p-(p%10); printf "uploaded %d%%\n", last > "/dev/stderr"; fflush("/dev/stderr")}}') \
      || printf '000'
  else
    curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 30 --retry 3 --retry-delay 3 -X PUT -T "$file" "$@" "$url" 2>/dev/null || printf '000'
  fi
}

FILE=""; NAME=""; NOTE=""; CTYPE=""; CANCEL=""; STATUS=0; STATUS_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)         [ $# -ge 2 ] || error_exit "--path requires a value"; FILE="$2"; shift 2 ;;
    --name)         [ $# -ge 2 ] || error_exit "--name requires a value"; NAME="$2"; shift 2 ;;
    --note)         [ $# -ge 2 ] || error_exit "--note requires a value"; NOTE="$2"; shift 2 ;;
    --content-type) [ $# -ge 2 ] || error_exit "--content-type requires a value"; CTYPE="$2"; shift 2 ;;
    --cancel)       [ $# -ge 2 ] || error_exit "--cancel requires a share id"; CANCEL="$2"; shift 2 ;;
    --status)       STATUS=1; shift
                    if [ $# -ge 1 ] && [[ "$1" =~ ^sf_ ]]; then STATUS_ID="$1"; shift; fi ;;
    --help|-h)      print_usage; exit 0 ;;
    *) unknown_arg_exit "$1" ;;
  esac
done

ID_RE='^sf_[A-Za-z0-9_-]{22}$'

if [ -n "$CANCEL" ]; then
  [[ "$CANCEL" =~ $ID_RE ]] || error_exit "--cancel needs a share id like sf_…"
  RESULT=$(call DELETE "/apps/shares/${CANCEL}") || { printf '%s\n' "$RESULT"; exit 1; }
  jq -cn --arg id "$CANCEL" '{success: true, shareId: $id, cancelled: true}'
  exit 0
fi

if [ "$STATUS" = "1" ]; then
  if [ -n "$STATUS_ID" ]; then
    [[ "$STATUS_ID" =~ $ID_RE ]] || error_exit "--status needs a share id like sf_…"
    RESULT=$(call GET "/apps/shares/${STATUS_ID}") || { printf '%s\n' "$RESULT"; exit 1; }
    printf '%s' "$RESULT" | jq -c '{success: true} + (.data | {shareId, status, goneReason, fileName, sizeBytes, url, expiresAt})'
  else
    RESULT=$(call GET "/apps/shares") || { printf '%s\n' "$RESULT"; exit 1; }
    printf '%s' "$RESULT" | jq -c '{success: true, shares: [.data.shares[]? | {shareId, status, fileName, sizeBytes, url, expiresAt}]}'
  fi
  exit 0
fi

[ -n "$FILE" ] || error_exit "--path is required"
INFO=$(check_file "$FILE") || { printf '%s\n' "$INFO" >&2; exit 1; }
REAL=$(printf '%s\n' "$INFO" | sed -n 1p)
SIZE=$(printf '%s\n' "$INFO" | sed -n 2p)
[ -n "$NAME" ] || NAME="$(basename "$REAL")"
[ -n "$CTYPE" ] || CTYPE="$(content_type_for "$REAL")"

BODY=$(jq -cn --arg n "$NAME" --argjson s "$SIZE" --arg c "$CTYPE" --arg note "$NOTE" \
  '{fileName: $n, sizeBytes: $s, contentType: $c} + (if $note != "" then {note: $note} else {} end)')
CREATED=$(call POST "/apps/shares" "$BODY") || { printf '%s\n' "$CREATED"; exit 1; }
ID=$(printf '%s' "$CREATED" | jq -r '.data.shareId // empty')
URL=$(printf '%s' "$CREATED" | jq -r '.data.upload.url // empty')
LINK=$(printf '%s' "$CREATED" | jq -r '.data.url // empty')
[ -n "$ID" ] && [ -n "$URL" ] || error_exit "Cloud answered without an upload URL"

# Headers the presigned URL was signed with. The signed URL itself is never printed or logged.
HDRS=()
while IFS= read -r line; do HDRS+=(-H "$line"); done < <(printf '%s' "$CREATED" | jq -r '.data.upload.headers // {} | to_entries[] | "\(.key): \(.value)"')

cancel_quietly() { api_call DELETE "/apps/shares/${ID}" >/dev/null 2>&1 || true; }

CODE=$(upload "$REAL" "$SIZE" "$URL" ${HDRS[@]+"${HDRS[@]}"})
if [ "$CODE" != "200" ]; then
  cancel_quietly
  jq -cn --arg c "$CODE" '{success: false, reason: "upload_failed", message: ("The upload to temporary storage failed (HTTP " + $c + "). Nothing was kept; try again.")}'
  exit 1
fi

DONE=$(api_call POST "/apps/shares/${ID}/complete" 2>&1) || { cancel_quietly; fail_from "$(printf '%s\n' "$DONE" | tail -n 1)"; }
EXPIRES=$(printf '%s\n' "$DONE" | tail -n 1 | jq -r '.data.expiresAt // empty')
[ -n "$LINK" ] || LINK=$(printf '%s\n' "$DONE" | tail -n 1 | jq -r '.data.url // empty')

jq -cn --arg id "$ID" --arg link "$LINK" --arg n "$NAME" --argjson s "$SIZE" --arg e "$EXPIRES" \
  '{success: true, shareId: $id, url: $link, fileName: $n, sizeBytes: $s, expiresAt: $e,
    instruction: "Post the url to the owner where you are talking to them, in your own words: what the file is, that they can open it on their phone, watch it right in the page and download it, and that it stays available for 7 days. One short message; do not paste this JSON. The link is private to their Crewly account. Withdraw it with: bash <skills>/core/share-file/execute.sh --cancel \($id)"}'
