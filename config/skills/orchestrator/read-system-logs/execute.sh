#!/bin/bash
# Read recent Crewly server log entries
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"lines\":100,\"level\":\"error\"}'"

LINES=$(echo "$INPUT" | jq -r '.lines // "100"')
LEVEL=$(echo "$INPUT" | jq -r '.level // empty')

QUERY="lines=${LINES}"
if [ -n "$LEVEL" ]; then
  QUERY="${QUERY}&level=${LEVEL}"
fi

api_call GET "/system/logs?${QUERY}"
