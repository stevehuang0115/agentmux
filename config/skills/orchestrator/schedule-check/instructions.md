# Schedule Check

Schedule a future check-in reminder that will be delivered to your terminal.

## Usage

```bash
bash config/skills/orchestrator/schedule-check/execute.sh '{"minutes":5,"message":"Check on agent-joe progress"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `minutes` | Yes | Delay in minutes before the check fires |
| `message` | Yes | Reminder message text |
| `target` | No | Target session name (defaults to self) |

## Output

JSON with the scheduled check ID and fire time.
