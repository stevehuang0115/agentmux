# Read Task

Read the full details of a task file by its absolute path. Returns the task content, metadata, status, and any subtasks.

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `absoluteTaskPath` | Yes | Absolute filesystem path to the task file |

## Example

```bash
bash config/skills/agent/read-task/execute.sh '{"absoluteTaskPath":"/projects/app/tasks/implement-login.md"}'
```

## Output

JSON with full task details including description, acceptance criteria, priority, status, and related files.
