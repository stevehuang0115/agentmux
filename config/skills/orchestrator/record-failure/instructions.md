# Record Failure

Record a failed approach or pitfall so the team can avoid repeating it.

## Usage

```bash
bash config/skills/orchestrator/record-failure/execute.sh '{"description":"Deploying database migrations during peak hours caused 5min downtime","projectPath":"/path/to/project","teamMemberId":"crewly-orc","context":"production deploy on 2026-02-10"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `description` | Yes | What failed and why it did not work |
| `projectPath` | No | Path to the project where this failed |
| `teamMemberId` | No | Your session name |
| `context` | No | Additional context about when/where this failed |

## Output

JSON confirmation with the stored failure entry.
