# Delegate Task

Sends a structured task assignment to an agent. When a `projectPath` is provided, also creates a task MD file in the project's `.crewly/tasks/delegated/in_progress/` directory for tracking.

## Usage

```bash
bash config/skills/orchestrator/delegate-task/execute.sh '{"to":"agent-joe","task":"Implement the login form","priority":"high","context":"Use React hooks","projectPath":"/path/to/project"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `to` | Yes | Target agent's PTY session name |
| `task` | Yes | Task description |
| `priority` | No | Task priority: `low`, `normal`, `high` (default: `normal`) |
| `context` | No | Additional context for the task |
| `projectPath` | No | Project path; when provided, creates a task MD file in `.crewly/tasks/` |

## Output

JSON confirmation of task delivery. When `projectPath` is provided, also returns the created task file path.
