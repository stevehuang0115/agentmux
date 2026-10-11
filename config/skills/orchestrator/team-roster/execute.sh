#!/bin/bash
# Print the team roster: per team its charter, members with roles and
# specialties, projects, Slack channel, what it is working on now and what it
# finished in the last 7 days. Built by the harness from live records.
#   execute.sh            markdown
#   execute.sh --json     structured data
#   execute.sh --fresh    rebuild now instead of using the 60-second cache
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

FORMAT="md"
FRESH=""
for arg in "$@"; do
  case "$arg" in
    --json) FORMAT="json" ;;
    --fresh) FRESH="&fresh=1" ;;
    \{*) printf '%s' "$arg" | jq -e '.format == "json"' >/dev/null 2>&1 && FORMAT="json" ;;
  esac
done

RAW=$(api_call GET "/team-roster?format=${FORMAT}${FRESH}")
if [ "$FORMAT" = "json" ]; then
  printf '%s\n' "$RAW"
else
  printf '%s' "$RAW" | jq -r 'if .success == true then .data else (.error // "roster unavailable") end'
fi
