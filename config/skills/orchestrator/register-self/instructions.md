# Register Self

Registers the orchestrator as active with the AgentMux backend. Call this immediately on startup.

## Usage

```bash
bash config/skills/orchestrator/register-self/execute.sh '{"role":"orchestrator","sessionName":"agentmux-orc"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `role` | Yes | Your role, typically `"orchestrator"` |
| `sessionName` | Yes | Your PTY session name (use `{{SESSION_ID}}`) |
| `claudeSessionId` | No | Claude session ID for resume support |

## Output

JSON confirmation of registration status.
