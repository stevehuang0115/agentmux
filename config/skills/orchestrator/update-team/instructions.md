# Update Team

Update an existing team's name, description, or other properties.

## Usage

```bash
bash config/skills/orchestrator/update-team/execute.sh '{"teamId":"817a1aeb-...","name":"New Name","description":"Updated description"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `teamId` | Yes | The team UUID to update |
| `name` | No | New team name |
| `description` | No | New team description |

## Output

JSON with the updated team data.
