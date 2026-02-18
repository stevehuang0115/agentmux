# Set Goal

Set a project-level goal to guide team priorities and track progress.

## Usage

```bash
bash config/skills/orchestrator/set-goal/execute.sh '{"goal":"Complete API integration by end of sprint","projectPath":"/path/to/project","setBy":"orchestrator"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `goal` | Yes | The goal description |
| `projectPath` | No | Path to the project this goal applies to |
| `setBy` | No | Who is setting the goal (e.g., "orchestrator") |

## Output

JSON confirmation with the stored goal entry.
