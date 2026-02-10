# Cancel Schedule

Cancel a previously scheduled check.

## Usage

```bash
bash config/skills/orchestrator/cancel-schedule/execute.sh '{"scheduleId":"sched-abc123"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `scheduleId` | Yes | The schedule ID to cancel |

## Output

JSON confirmation of cancellation.
