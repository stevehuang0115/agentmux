# Get Team Status

Get the current status of all teams and their members. Returns team names, member roles, agent statuses, and working statuses.

## Parameters

No parameters required.

## Example

```bash
bash config/skills/agent/get-team-status/execute.sh '{}'
```

## Output

JSON with team data including each team's members, their roles, agent status (active/inactive), and current working status (idle/in_progress).
