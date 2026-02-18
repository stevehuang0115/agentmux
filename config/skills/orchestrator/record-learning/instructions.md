# Record Learning

Quickly record a learning or discovery. Simpler than `remember` — good for jotting down learnings.

## Usage

```bash
bash config/skills/orchestrator/record-learning/execute.sh '{"learning":"Always check agent status before delegating","teamMemberId":"crewly-orc"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `learning` | Yes | What you learned |
| `relatedTask` | No | Task this learning relates to |
| `relatedFiles` | No | Array of file paths related to the learning |
| `teamMemberId` | No | Your session name |
| `projectPath` | No | Current project path |

## Output

JSON confirmation with the stored learning entry ID.
