# Create Team

Creates a new agent team with optional members.

## Usage

```bash
bash config/skills/orchestrator/create-team/execute.sh '{"name":"Alpha","description":"Frontend team","members":[{"name":"dev1","role":"developer"}]}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | Yes | Team name |
| `description` | No | Team description |
| `members` | No | Array of `{name, role}` objects |

## Output

JSON with the created team details including team ID.
