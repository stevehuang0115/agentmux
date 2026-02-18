# Start Team

Starts all agents in a team.

## Usage

```bash
bash config/skills/orchestrator/start-team/execute.sh '{"teamId":"abc-123-uuid"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `teamId` | Yes | The team's UUID |
| `projectId` | No | Project UUID to assign before starting (uses team's current project if omitted) |

## Output

JSON confirmation with team startup status.
