# Get Team Status

Returns the current status of all teams and their member agents.

## Usage

```bash
bash config/skills/orchestrator/get-team-status/execute.sh
```

## Parameters

None required.

## Output

JSON array of teams with members and their statuses (active/inactive, idle/in_progress).

Each team may include a `mission` field (string) describing the team's purpose, plus optional `budget` and `qualityGate` configuration (#173).
