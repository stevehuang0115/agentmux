# Remember

Store knowledge in your persistent memory for future reference.

## Usage

```bash
bash config/skills/orchestrator/remember/execute.sh '{"content":"TypeScript strict mode is required","category":"pattern","scope":"project","teamMemberId":"crewly-orc","projectPath":"/path/to/project"}'
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `content` | Yes | The knowledge to store |
| `category` | Yes | Category: `pattern`, `decision`, `gotcha`, `fact`, `preference`, `relationship` |
| `scope` | No | Scope: `agent` or `project` (default: `agent`) |
| `title` | No | Optional title for the knowledge |
| `teamMemberId` | No | Your session name |
| `projectPath` | No | Current project path |

## Output

JSON with the stored knowledge entry ID.
