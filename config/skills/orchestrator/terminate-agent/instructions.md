# Terminate Agent

Terminate an agent's terminal session completely. Use with caution.

## Usage

```bash
bash config/skills/orchestrator/terminate-agent/execute.sh '{"sessionName":"agent-joe"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `sessionName` | Yes | The agent's PTY session name to terminate |

## Output

JSON confirmation of session termination.
