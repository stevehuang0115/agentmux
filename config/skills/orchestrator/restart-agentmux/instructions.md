# Restart AgentMux

Gracefully restart the AgentMux backend server. All PTY sessions are saved before shutdown and will be auto-resumed on restart (if the auto-resume setting is enabled).

## Usage

```bash
bash config/skills/orchestrator/restart-agentmux/execute.sh
```

## Parameters

None required.

## Output

JSON confirming the restart was initiated and how many sessions were saved.

## Notes

- The server process exits with code 0 after saving state
- The external process manager (nodemon, systemd, ECS) handles restarting
- Agents will auto-resume their previous sessions on restart if the "Auto-Resume on Restart" setting is enabled
