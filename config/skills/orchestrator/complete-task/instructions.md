# Complete Task

Mark a task as complete in the task management system.

## Usage

```bash
bash config/skills/orchestrator/complete-task/execute.sh '{"taskId":"task-123","result":"success"}'
```

## Parameters

Pass the full JSON body as expected by `POST /api/task-management/complete`.

## Output

JSON confirmation of task completion.
