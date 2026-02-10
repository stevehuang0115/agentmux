# Stop Team

Stops all agents in a team.

## Usage

```bash
bash config/skills/orchestrator/stop-team/execute.sh '{"teamId":"abc-123-uuid"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `teamId` | Yes | The team's UUID |

## Output

JSON confirmation with team shutdown status.
