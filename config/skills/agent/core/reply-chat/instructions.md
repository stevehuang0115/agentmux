# Reply Chat Skill

Send a message to the Crewly Chat UI. This is the preferred way for agents to post messages to the Chat UI.

## Usage

```bash
bash config/skills/agent/core/reply-chat/execute.sh '{"content":"Task completed","senderName":"dev-1"}'
```

### Flag-based

```bash
bash config/skills/agent/core/reply-chat/execute.sh \
  --text "Task completed" \
  --sender "dev-1" \
  --conversation "conv-abc123"
```

## Options

| Flag | Short | Description |
|------|-------|-------------|
| `--conversation` | `-C` | Chat conversation ID (optional — defaults to current) |
| `--text` | `-t` | Message text |
| `--sender` | `-s` | Sender name (required) |
| `--sender-type` | | Sender type (default: agent) |
