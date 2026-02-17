#!/bin/bash
# Send a message to a Slack channel or thread via the backend API
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

print_usage() {
  cat <<'EOF_USAGE'
Usage:
  # Legacy JSON argument
  bash execute.sh '{"channelId":"C0123","text":"Hello"}'

  # Flag-based invocation with multi-line text from stdin
  cat message.txt | bash execute.sh --channel C0123

  # Upload an image with optional comment
  bash execute.sh --channel C0123 --image /path/to/screenshot.png --text "Here's the result"

Options:
  --channel | -c   Slack channel ID (required unless JSON provided)
  --text    | -t   Message text (optional when piping stdin)
  --text-file     Read message text from the specified file path
  --thread  | -r   Slack thread timestamp for replies
  --image   | -i   Path to image file to upload (uses /api/slack/upload-image)
  --json    | -j   Raw JSON payload (same as legacy usage)
  --help    | -h   Show this help
EOF_USAGE
}

INPUT_JSON=""
CHANNEL_ID=""
TEXT=""
THREAD_TS=""
IMAGE_PATH=""

# Detect legacy JSON argument as the first parameter
if [[ $# -gt 0 && ${1:0:1} == '{' ]]; then
  INPUT_JSON="$1"
  shift || true
fi

CONVERSATION_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --channel|-c)
      CHANNEL_ID="$2"
      shift 2
      ;;
    --text|-t)
      TEXT="$2"
      shift 2
      ;;
    --text-file)
      TEXT="$(cat "$2")"
      shift 2
      ;;
    --thread|-r)
      THREAD_TS="$2"
      shift 2
      ;;
    --image|-i)
      IMAGE_PATH="$2"
      shift 2
      ;;
    --conversation|-C)
      CONVERSATION_ID="$2"
      shift 2
      ;;
    --json|-j)
      INPUT_JSON="$2"
      shift 2
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      if [[ -z "$INPUT_JSON" && ${1:0:1} == '{' ]]; then
        INPUT_JSON="$1"
        shift
      else
        error_exit "Unknown argument: $1"
      fi
      ;;
  esac
done

# If nothing provided yet, but stdin has data, read it
if [ -z "$INPUT_JSON" ] && [ -z "$TEXT" ] && [ ! -t 0 ]; then
  STDIN_DATA="$(cat)"
  if [[ ${STDIN_DATA:0:1} == '{' ]]; then
    INPUT_JSON="$STDIN_DATA"
  else
    TEXT="$STDIN_DATA"
  fi
fi

if [ -n "$INPUT_JSON" ]; then
  CHANNEL_ID=${CHANNEL_ID:-$(echo "$INPUT_JSON" | jq -r '.channelId // empty')}
  TEXT=${TEXT:-$(echo "$INPUT_JSON" | jq -r '.text // empty')}
  THREAD_TS=${THREAD_TS:-$(echo "$INPUT_JSON" | jq -r '.threadTs // empty')}
  CONVERSATION_ID=${CONVERSATION_ID:-$(echo "$INPUT_JSON" | jq -r '.conversationId // empty')}
fi

require_param "channelId" "$CHANNEL_ID"

# When uploading an image, text is optional (serves as initial_comment)
if [ -z "$IMAGE_PATH" ] && [ -z "$TEXT" ]; then
  error_exit "Slack message text is required. Pass --text, --text-file, pipe stdin, or include it in the JSON payload."
fi

if [ -n "$IMAGE_PATH" ]; then
  # Image upload mode — use /api/slack/upload-image
  BODY=$(jq -n \
    --arg channelId "$CHANNEL_ID" \
    --arg filePath "$IMAGE_PATH" \
    --arg initialComment "${TEXT:-}" \
    --arg threadTs "${THREAD_TS:-}" \
    '{channelId: $channelId, filePath: $filePath} +
     (if $initialComment != "" then {initialComment: $initialComment} else {} end) +
     (if $threadTs != "" then {threadTs: $threadTs} else {} end)')

  api_call POST "/slack/upload-image" "$BODY"
else
  # Text-only mode — use /api/slack/send
  if [ -n "$THREAD_TS" ]; then
    BODY=$(jq -n --arg channelId "$CHANNEL_ID" --arg text "$TEXT" --arg threadTs "$THREAD_TS" \
      '{channelId: $channelId, text: $text, threadTs: $threadTs}')
  else
    BODY=$(jq -n --arg channelId "$CHANNEL_ID" --arg text "$TEXT" \
      '{channelId: $channelId, text: $text}')
  fi

  api_call POST "/slack/send" "$BODY"
fi

# Emit a [NOTIFY] block so the chat service/logs capture this reply and
# unblock any pending Slack queue items. conversationId is optional –
# TerminalGateway will fall back to the active conversation when omitted.
{
  echo "[NOTIFY]"
  echo "type: slack_reply"
  echo "title: Slack Reply"
  if [ -n "$CONVERSATION_ID" ]; then
    echo "conversationId: $CONVERSATION_ID"
  fi
  echo "channelId: $CHANNEL_ID"
  if [ -n "$THREAD_TS" ]; then
    echo "threadTs: $THREAD_TS"
  fi
  echo "---"
  if [ -n "$IMAGE_PATH" ]; then
    printf 'Image uploaded: %s\n' "$IMAGE_PATH"
    if [ -n "$TEXT" ]; then
      printf '%s\n' "$TEXT"
    fi
  else
    printf '%s\n' "$TEXT"
  fi
  echo "[/NOTIFY]"
} >&2
