# Reply Slack

Send a message to a Slack channel or thread via the AgentMux backend API. This bypasses terminal output parsing and delivers the message directly to Slack, avoiding PTY line-wrapping and ANSI artifacts.

## Usage

```bash
# Legacy JSON argument (kept for backwards compatibility)
bash config/skills/orchestrator/reply-slack/execute.sh '{"channelId":"C0123","text":"Task completed successfully!"}'

# Recommended multi-line usage with stdin
cat <<'EOF' | bash config/skills/orchestrator/reply-slack/execute.sh --channel C0123 --conversation "$CHAT_CONVERSATION"
Deploy complete ✅

Tests are green and artifacts published.
EOF
```

With thread reply (any style):

```bash
bash config/skills/orchestrator/reply-slack/execute.sh '{"channelId":"C0123","text":"Update: tests passing","threadTs":"1707430000.001234"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `channelId` / `--channel` | Yes | Slack channel ID to send the message to |
| `text` / `--text` / stdin | Yes | Message text (supports Slack Markdown). You can pipe multi-line text via stdin with `--channel` |
| `threadTs` / `--thread` | No | Thread timestamp for threaded replies |
| `conversationId` / `--conversation` | No | Conversation ID from the `[CHAT:...]` prefix so the queue can resolve instantly (falls back to the active conversation if omitted) |

## Output

JSON confirmation with the Slack message timestamp on success.

> **Heads up:** After a successful API call the script automatically emits a `[NOTIFY]` block so the backend logs the reply and unblocks any pending Slack messages. If you pass `--conversation`, that ID is embedded in the header. Otherwise TerminalGateway will associate the notify block with the active conversation.
