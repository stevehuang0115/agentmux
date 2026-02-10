# Assign Task

Assign a task to an agent via the task management system.

## Usage

```bash
bash config/skills/orchestrator/assign-task/execute.sh '{"taskId":"task-123","assignee":"agent-joe"}'
```

## Parameters

Pass the full JSON body as expected by `POST /api/task-management/assign`.

## Output

JSON confirmation of task assignment.
