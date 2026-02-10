# Subscribe to Event

Subscribe to agent lifecycle events. Matched events arrive as `[EVENT:subId:eventType]` in your terminal.

## Usage

```bash
bash config/skills/orchestrator/subscribe-event/execute.sh '{"eventType":"agent:idle","filter":{"sessionName":"agent-joe"},"oneShot":true}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `eventType` | Yes | Event type: `agent:idle`, `agent:busy`, `agent:active`, `agent:inactive`, `agent:status_changed` |
| `filter` | No | Filter object, e.g. `{"sessionName":"..."}` |
| `oneShot` | No | If true, auto-unsubscribe after first match |

## Output

JSON with subscription ID for later management.
