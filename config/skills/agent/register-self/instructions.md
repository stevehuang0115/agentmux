# Register Self

Register this agent as active with the AgentMux backend. This must be the first skill you run on startup.

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `role` | Yes | Agent role (e.g., "developer", "qa", "tpm") |
| `sessionName` | Yes | Your session name (from your identity) |
| `teamMemberId` | No | Your team member ID |
| `claudeSessionId` | No | Claude session ID for resume support |

## Example

```bash
bash config/skills/agent/register-self/execute.sh '{"role":"developer","sessionName":"dev-1"}'
```
