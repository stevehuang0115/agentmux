# Read System Logs

Read recent entries from the Crewly server log file (`~/.crewly/logs/crewly-YYYY-MM-DD.log`).

## Parameters

| Parameter | Type   | Default | Description                                       |
|-----------|--------|---------|---------------------------------------------------|
| `lines`   | number | 100     | Number of recent log lines to return               |
| `level`   | string | (all)   | Filter by log level: `error`, `warn`, `info`, `debug` |

## Usage

```bash
# Get last 100 log entries (all levels)
bash config/skills/orchestrator/read-system-logs/execute.sh '{"lines":100}'

# Get only error-level entries
bash config/skills/orchestrator/read-system-logs/execute.sh '{"lines":200,"level":"error"}'
```

## Response

Returns a JSON array of log entries, each with `level`, `message`, `timestamp`, and optional metadata fields.

## When to Use

- After detecting agent misbehavior to check for server-side errors
- During self-evolution triage to gather evidence
- When debugging system issues (crashes, timeouts, delivery failures)
