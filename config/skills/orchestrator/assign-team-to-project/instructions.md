# Assign Team to Project

Assigns one or more teams to a project. Teams must be assigned to a project before they can be started.

## Usage

```bash
bash config/skills/orchestrator/assign-team-to-project/execute.sh '{"projectId":"project-uuid","teamIds":["team-uuid-1"]}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `projectId` | Yes | UUID of the target project |
| `teamIds` | Yes | Array of team UUIDs to assign to the project |

## Output

JSON confirming the team assignment.
