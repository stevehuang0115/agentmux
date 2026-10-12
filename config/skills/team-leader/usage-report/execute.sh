#!/bin/bash
# Usage report: where the owner's time and the agents' tokens went.
#
# Usage:
#   execute.sh [--since 7d] [--until 2026-10-11] [--by category|team|project|agent|ticket]
#              [--categories "book,self-media" | "media:linkedin,substack;book:chapter"]
#              [--limit 10] [--text]
#   execute.sh '{"since":"7d","by":"category"}'
#
# --text prints only the short summary (good to read out or post to Slack).
# Read-only: it changes nothing.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

SINCE=""
UNTIL=""
BY=""
CATEGORIES=""
LIMIT=""
TEXT="false"
INPUT_JSON=""

if [[ $# -gt 0 && ${1:0:1} == '{' ]]; then
  INPUT_JSON="$1"
  shift || true
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --since)      SINCE="$2";      shift 2 ;;
    --until)      UNTIL="$2";      shift 2 ;;
    --by)         BY="$2";         shift 2 ;;
    --categories) CATEGORIES="$2"; shift 2 ;;
    --limit)      LIMIT="$2";      shift 2 ;;
    --text)       TEXT="true";     shift ;;
    --help|-h)
      echo "Usage: execute.sh [--since 7d] [--until DATE] [--by category|team|project|agent|ticket] [--categories NAMES_OR_DEFS] [--limit N] [--text]"
      exit 0 ;;
    *) shift ;;
  esac
done

if [[ -n "$INPUT_JSON" ]]; then
  [[ -z "$SINCE" ]]      && SINCE=$(echo "$INPUT_JSON" | jq -r '.since // empty' 2>/dev/null || true)
  [[ -z "$UNTIL" ]]      && UNTIL=$(echo "$INPUT_JSON" | jq -r '.until // empty' 2>/dev/null || true)
  [[ -z "$BY" ]]         && BY=$(echo "$INPUT_JSON" | jq -r '.by // empty' 2>/dev/null || true)
  [[ -z "$CATEGORIES" ]] && CATEGORIES=$(echo "$INPUT_JSON" | jq -r '.categories // empty | if type == "array" then tojson else . end' 2>/dev/null || true)
  [[ -z "$LIMIT" ]]      && LIMIT=$(echo "$INPUT_JSON" | jq -r '.limit // empty' 2>/dev/null || true)
  if [[ "$TEXT" != "true" ]]; then TEXT=$(echo "$INPUT_JSON" | jq -r '.text // false' 2>/dev/null || echo false); fi
fi

QUERY=$(jq -rn \
  --arg since "${SINCE:-7d}" --arg until "$UNTIL" --arg by "${BY:-category}" \
  --arg categories "$CATEGORIES" --arg limit "$LIMIT" \
  '[ "since=" + ($since|@uri), "by=" + ($by|@uri),
     (if $until != "" then "until=" + ($until|@uri) else empty end),
     (if $categories != "" then "categories=" + ($categories|@uri) else empty end),
     (if $limit != "" then "limit=" + ($limit|@uri) else empty end) ] | join("&")')

if ! RESP=$(api_call_full GET "/usage-ledger/report?${QUERY}"); then
  error_exit "Could not fetch the usage report"
fi

if [[ "$TEXT" == "true" ]]; then
  printf '%s' "$RESP" | jq -r '.data.summary // .error // "No report"'
  exit 0
fi

# Compact: the full body has every token kind for every group.
printf '%s' "$RESP" | jq '
  if .success then
    { summary: .data.summary,
      window: .data.window,
      by: .data.by,
      categories: .data.categories,
      totals: { ownerMinutes: .data.totals.ownerMinutes, agentBusyMinutes: .data.totals.agentBusyMinutes,
                tokens: .data.totals.tokens.budget, rawTokens: .data.totals.tokens.total,
                costUsd: .data.totals.costUsd, tickets: .data.totals.ticketCount },
      groups: [ .data.groups[] | { key, ownerMinutes, agentBusyMinutes, tokens: .tokens.budget, rawTokens: .tokens.total,
                costUsd, tickets: .ticketCount,
                topTickets: [ .topTickets[] | { ticketId, title, ownerMinutes, agentBusyMinutes, tokens, costUsd } ] } ],
      notes: .data.notes }
  else . end'
