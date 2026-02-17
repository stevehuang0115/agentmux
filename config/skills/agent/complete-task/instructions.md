# Complete Task

Mark a task as complete with a summary of the work done. Optionally skip quality gates if they have already been verified separately.

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `absoluteTaskPath` | Yes | Absolute filesystem path to the task file |
| `sessionName` | Yes | Your agent session name |
| `summary` | Yes | Summary of the work completed |
| `skipGates` | No | Set to `true` to skip quality gate checks |

## Example

```bash
bash config/skills/agent/complete-task/execute.sh '{"absoluteTaskPath":"/projects/app/tasks/implement-login.md","sessionName":"dev-1","summary":"Implemented login form with validation and tests"}'
```

## Output

JSON confirmation of task completion status.
