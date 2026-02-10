# Delegate Task

Sends a structured task assignment to an agent.

## Usage

```bash
bash config/skills/orchestrator/delegate-task/execute.sh '{"to":"agent-joe","task":"Implement the login form","priority":"high","context":"Use React hooks"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `to` | Yes | Target agent's PTY session name |
| `task` | Yes | Task description |
| `priority` | No | Task priority: `low`, `normal`, `high` (default: `normal`) |
| `context` | No | Additional context for the task |

## Output

JSON confirmation of task delivery.
