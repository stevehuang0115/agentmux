# Send Message

Sends a text message to an agent's terminal session.

## Usage

```bash
bash config/skills/orchestrator/send-message/execute.sh '{"sessionName":"agent-joe","message":"Please review the PR"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `sessionName` | Yes | The target agent's PTY session name |
| `message` | Yes | The message text to send |

## Output

JSON confirmation of delivery.
