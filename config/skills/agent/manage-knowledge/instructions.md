# Manage Knowledge

Create or update company knowledge documents. These are markdown files stored in the Crewly knowledge system, accessible to all team members via the UI.

Use this skill to document SOPs, architecture decisions, team norms, onboarding guides, runbooks, and other company knowledge that should be shared across the team.

**Note:** Agents can create and update documents but cannot delete them. Deletion is a user-only action via the UI.

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `action` | Yes | `create` or `update` |
| `title` | Yes (create) | Document title |
| `content` | Yes (create) | Markdown content |
| `category` | No | Category: `SOPs`, `Team Norms`, `Architecture`, `Onboarding`, `Runbooks`, `General` (default: `General`) |
| `scope` | No | `global` (company-wide) or `project` (project-specific). Default: `global` |
| `projectPath` | Conditional | Required when scope is `project` |
| `tags` | No | Array of tags for search/filtering |
| `createdBy` | No | Your session name (default: `agent`) |
| `id` | Yes (update) | Document ID to update |
| `updatedBy` | No | Your session name for updates (default: `agent`) |

## Examples

### Create a global SOP

```bash
bash config/skills/agent/manage-knowledge/execute.sh '{"action":"create","title":"PR Review Process","content":"# PR Review Process\n\n1. All PRs require at least one approval\n2. Run tests locally before requesting review\n3. Keep PRs under 400 lines when possible","category":"SOPs","scope":"global","tags":["process","code-review"],"createdBy":"dev-1"}'
```

### Create a project-specific architecture doc

```bash
bash config/skills/agent/manage-knowledge/execute.sh '{"action":"create","title":"API Design Patterns","content":"# API Design Patterns\n\nWe use RESTful conventions with Express.js...","category":"Architecture","scope":"project","projectPath":"/path/to/project","tags":["api","backend"],"createdBy":"dev-1"}'
```

### Update an existing document

```bash
bash config/skills/agent/manage-knowledge/execute.sh '{"action":"update","id":"abc-123-uuid","content":"# Updated Content\n\nNew information added...","scope":"global","updatedBy":"dev-1"}'
```

## Output

JSON response with `success: true` and the document ID on creation, or `success: true` on update.
