# Get SOPs

Query standard operating procedures (SOPs) relevant to your current context or task. SOPs contain team-defined guidelines, workflows, and best practices.

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `context` | Yes | Description of what you need SOPs for (e.g., `"deploying to production"`) |
| `category` | No | Filter by SOP category (e.g., `"deployment"`, `"testing"`, `"code-review"`) |
| `role` | No | Filter by role relevance (e.g., `"developer"`, `"qa"`) |

## Example

```bash
bash config/skills/agent/get-sops/execute.sh '{"context":"deploying a new backend service","category":"deployment","role":"developer"}'
```

## Output

JSON with matching SOPs including their titles, content, and applicability metadata.
