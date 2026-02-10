# Stop Agent

Stops a specific agent within a team.

## Usage

```bash
bash config/skills/orchestrator/stop-agent/execute.sh '{"teamId":"team-uuid","memberId":"member-uuid"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `teamId` | Yes | The team's UUID |
| `memberId` | Yes | The member's UUID within the team |

## Output

JSON confirmation with agent shutdown status.
