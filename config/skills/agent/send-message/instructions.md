# Send Message

Send a direct message to another agent's terminal session. The message is written to the target agent's PTY using the two-step message mode for reliable delivery.

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `to` | Yes | Target agent's PTY session name |
| `message` | Yes | The message text to send |

## Example

```bash
bash config/skills/agent/send-message/execute.sh '{"to":"qa-1","message":"PR #42 is ready for review. I added unit tests for the auth module."}'
```

## Output

JSON confirmation of message delivery.
