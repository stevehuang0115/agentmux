# Unsubscribe from Event

Cancel an event subscription.

## Usage

```bash
bash config/skills/orchestrator/unsubscribe-event/execute.sh '{"subscriptionId":"sub-abc123"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `subscriptionId` | Yes | The subscription ID to cancel |

## Output

JSON confirmation of cancellation.
