#!/bin/bash
# Move a team to another machine of the owner's account
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

INPUT=$(read_json_input "${1:-}")
[ -z "$INPUT" ] && error_exit "Usage: execute.sh '{\"action\":\"machines|check|start|status|moves\",\"team\":\"CE\",\"to\":\"Air\"}'"

ACTION=$(printf '%s' "$INPUT" | jq -r '.action // empty')
require_param "action" "$ACTION"

case "$ACTION" in
  machines)
    api_call GET "/team-moves/machines"
    ;;
  moves)
    api_call GET "/team-moves"
    ;;
  status)
    MOVE_ID=$(printf '%s' "$INPUT" | jq -r '.moveId // empty')
    require_param "moveId" "$MOVE_ID"
    api_call GET "/team-moves/${MOVE_ID}"
    ;;
  check)
    TEAM=$(printf '%s' "$INPUT" | jq -r '.team // empty')
    require_param "team" "$TEAM"
    BODY=$(jq -n --arg t "$TEAM" '{teamName: $t}')
    api_call POST "/team-moves/check" "$BODY"
    ;;
  start)
    TEAM=$(printf '%s' "$INPUT" | jq -r '.team // empty')
    TO=$(printf '%s' "$INPUT" | jq -r '.to // empty')
    require_param "team" "$TEAM"
    require_param "to" "$TO"
    BODY=$(printf '%s' "$INPUT" | jq -c --arg t "$TEAM" --arg to "$TO" '{teamName: $t, targetName: $to, allowDirty: (.allowDirty // false), skipFlagged: (.skipFlagged // false)}')
    api_call POST "/team-moves" "$BODY"
    ;;
  *)
    error_exit "Unknown action: ${ACTION}. Use machines | check | start | status | moves"
    ;;
esac
