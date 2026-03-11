#!/bin/bash
# Cancel all scheduled checks with optional filters
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT="${1:-}"

# Build query string from optional filters
QUERY=""
if [ -n "$INPUT" ]; then
  SESSION=$(echo "$INPUT" | jq -r '.session // empty')
  OLDER_THAN=$(echo "$INPUT" | jq -r '.olderThanMinutes // empty')

  PARAMS=""
  [ -n "$SESSION" ] && PARAMS="session=${SESSION}"
  if [ -n "$OLDER_THAN" ]; then
    [ -n "$PARAMS" ] && PARAMS="${PARAMS}&"
    PARAMS="${PARAMS}olderThanMinutes=${OLDER_THAN}"
  fi
  [ -n "$PARAMS" ] && QUERY="?${PARAMS}"
fi

api_call DELETE "/schedule${QUERY}"
