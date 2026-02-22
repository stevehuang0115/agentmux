# Environment Setup Checker

Validate that the development environment is correctly configured. Checks runtime versions (Node.js, Python, Git), installed dependencies, lock files, .env variables, and TypeScript availability.

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `projectPath` | No | Path to the project (defaults to `.`) |

## Checks Performed

1. **Node.js** - Version installed, warns if < 18
2. **npm** - Available
3. **Python** - Available (optional, warns if missing)
4. **Git** - Available
5. **node_modules** - Dependencies installed
6. **package-lock.json** - Lock file present
7. **.env variables** - Compares .env against .env.example
8. **TypeScript** - Compiler available if tsconfig.json exists

## Example

```bash
bash config/skills/agent/env-setup-checker/execute.sh '{"projectPath":"."}'
```

## Output

```json
{
  "passed": 6,
  "failed": 0,
  "warnings": 1,
  "healthy": true,
  "checks": [
    {"name": "Node.js", "status": "pass", "detail": "v20.10.0"},
    {"name": "npm", "status": "pass", "detail": "10.2.3"},
    ...
  ]
}
```
