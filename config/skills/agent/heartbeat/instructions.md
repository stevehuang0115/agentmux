# Agent Heartbeat Skill

Perform a lightweight health check to confirm that you are responsive.

## When to Use

Run this skill when the system asks you to perform a heartbeat check. This updates your heartbeat timestamp so the monitoring system knows you are alive and responsive.

## Usage

```bash
bash config/skills/agent/heartbeat/execute.sh
```

No parameters required.

## Output

Returns a JSON object with:
- `status`: "ok" if the health endpoint responded
- `timestamp`: UTC timestamp of the check
- `session`: your session name
- `health`: response from the health endpoint
