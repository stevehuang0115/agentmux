#!/bin/bash
# The owner's report categories ("self-media", "book", ...).
#
# Usage:
#   execute.sh list
#   execute.sh set --name self-media --description "Xiaohongshu, Substack, LinkedIn, videos" \
#                  [--keywords a,b,c] [--teams "Marketing,Media"] [--projects "Site,Newsletter"]
#   execute.sh remove --name self-media
#   execute.sh clear
#   execute.sh '{"command":"set","name":"book","keywords":["chapter","manuscript"]}'
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

COMMAND=""
NAME=""
DESCRIPTION=""
KEYWORDS=""
TEAMS=""
PROJECTS=""
INPUT_JSON=""

if [[ $# -gt 0 && ${1:0:1} == '{' ]]; then
  INPUT_JSON="$1"
  shift || true
elif [[ $# -gt 0 && ${1:0:2} != '--' ]]; then
  COMMAND="$1"
  shift || true
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)        NAME="$2";        shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --keywords)    KEYWORDS="$2";    shift 2 ;;
    --teams)       TEAMS="$2";       shift 2 ;;
    --projects)    PROJECTS="$2";    shift 2 ;;
    --help|-h)
      echo "Usage: execute.sh list | set --name N [--description D] [--keywords a,b] [--teams a,b] [--projects a,b] | remove --name N | clear"
      exit 0 ;;
    *) shift ;;
  esac
done

if [[ -n "$INPUT_JSON" ]]; then
  [[ -z "$COMMAND" ]]     && COMMAND=$(echo "$INPUT_JSON" | jq -r '.command // empty' 2>/dev/null || true)
  [[ -z "$NAME" ]]        && NAME=$(echo "$INPUT_JSON" | jq -r '.name // empty' 2>/dev/null || true)
  [[ -z "$DESCRIPTION" ]] && DESCRIPTION=$(echo "$INPUT_JSON" | jq -r '.description // empty' 2>/dev/null || true)
  [[ -z "$KEYWORDS" ]]    && KEYWORDS=$(echo "$INPUT_JSON" | jq -r '.keywords // empty | if type == "array" then join(",") else . end' 2>/dev/null || true)
  [[ -z "$TEAMS" ]]       && TEAMS=$(echo "$INPUT_JSON" | jq -r '.teams // empty | if type == "array" then join(",") else . end' 2>/dev/null || true)
  [[ -z "$PROJECTS" ]]    && PROJECTS=$(echo "$INPUT_JSON" | jq -r '.projects // empty | if type == "array" then join(",") else . end' 2>/dev/null || true)
fi

require_param "command (list|set|remove|clear)" "$COMMAND"

case "$COMMAND" in
  list)
    api_call GET "/usage-ledger/categories"
    ;;
  set)
    require_param "name" "$NAME"
    BODY=$(jq -n --arg name "$NAME" --arg description "$DESCRIPTION" --arg keywords "$KEYWORDS" --arg teams "$TEAMS" --arg projects "$PROJECTS" '
      def list($s): $s | split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(length > 0));
      { name: $name }
      + (if $description != "" then { description: $description } else {} end)
      + (if $keywords != "" then { keywords: list($keywords) } else {} end)
      + (if $teams != "" then { teams: list($teams) } else {} end)
      + (if $projects != "" then { projects: list($projects) } else {} end)')
    api_call POST "/usage-ledger/categories" "$BODY"
    ;;
  remove)
    require_param "name" "$NAME"
    api_call DELETE "/usage-ledger/categories/$(jq -rn --arg n "$NAME" '$n|@uri')"
    ;;
  clear)
    api_call PUT "/usage-ledger/categories" '{"categories":[]}'
    ;;
  *)
    error_exit "Unknown command: $COMMAND (use list, set, remove or clear)"
    ;;
esac
