# Remember

Store a memory entry for future recall. Use this to persist important context, decisions, architectural findings, or patterns you discover during work.

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `agentId` | Yes | Your agent ID |
| `content` | Yes | The content to remember |
| `category` | Yes | Memory category (e.g., `"architecture"`, `"decision"`, `"pattern"`, `"bug"`) |
| `scope` | Yes | Memory scope: `"project"`, `"team"`, or `"global"` |
| `projectPath` | No | Associated project path |
| `metadata` | No | Additional metadata object |

## Example

```bash
bash config/skills/agent/remember/execute.sh '{"agentId":"dev-1","content":"Auth module uses JWT with 24h expiry. Refresh tokens stored in httpOnly cookies.","category":"architecture","scope":"project","projectPath":"/projects/app"}'
```

## Output

JSON confirmation that the memory entry was stored.
