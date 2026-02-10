# Broadcast

Sends a message to all active agent sessions (excluding the orchestrator itself).

## Usage

```bash
bash config/skills/orchestrator/broadcast/execute.sh '{"message":"Team standup in 5 minutes"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `message` | Yes | The message to broadcast |

## Output

JSON with count of sent/failed deliveries.
