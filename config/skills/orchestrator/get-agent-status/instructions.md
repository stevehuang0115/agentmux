# Get Agent Status

Returns the current status of a specific agent.

## Usage

```bash
bash config/skills/orchestrator/get-agent-status/execute.sh '{"sessionName":"agent-joe"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `sessionName` | Yes | The agent's PTY session name |

## Output

JSON object with the agent's status, role, working status, and team membership.
