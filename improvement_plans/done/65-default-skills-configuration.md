# Task 65: Default Skills Configuration

## Overview

Create default built-in skills that ship with AgentMux so the Skills tab shows useful options out of the box.

## Problem

- Skills tab shows "No skills configured yet."
- Skills API returns empty array `[]`
- Users have no starting point for skill-based workflows

## Implementation

### 1. Create Default Skills Directory Structure

```
config/skills/
├── development/
│   ├── code-review/
│   │   ├── skill.json
│   │   └── instructions.md
│   ├── testing/
│   │   ├── skill.json
│   │   └── instructions.md
│   └── documentation/
│       ├── skill.json
│       └── instructions.md
├── automation/
│   ├── file-operations/
│   │   ├── skill.json
│   │   └── instructions.md
│   └── git-operations/
│       ├── skill.json
│       └── instructions.md
└── integration/
    ├── github/
    │   ├── skill.json
    │   └── instructions.md
    └── api-calls/
        ├── skill.json
        └── instructions.md
```

### 2. Example Skill Definitions

**`config/skills/development/code-review/skill.json`**

```json
{
  "id": "code-review",
  "name": "code-review",
  "displayName": "Code Review",
  "description": "Review code for quality, security, and best practices",
  "category": "development",
  "promptFile": "instructions.md",
  "tags": ["code", "review", "quality"],
  "triggers": ["review", "code review", "check code"],
  "assignableRoles": ["developer", "qa-engineer"],
  "isBuiltin": true,
  "version": "1.0.0"
}
```

**`config/skills/development/code-review/instructions.md`**

```markdown
# Code Review Skill

You are performing a code review. Analyze the provided code for:

## Quality Checks
- Code readability and clarity
- Proper naming conventions
- Function/method complexity
- DRY (Don't Repeat Yourself) violations

## Security Checks
- Input validation
- SQL injection vulnerabilities
- XSS vulnerabilities
- Sensitive data exposure

## Best Practices
- Error handling
- Logging
- Type safety (for TypeScript)
- Documentation/comments

## Output Format

Provide your review as:
1. **Summary**: Brief overview of code quality
2. **Issues Found**: List of problems with severity (Critical/High/Medium/Low)
3. **Suggestions**: Improvement recommendations
4. **Positive Notes**: What's done well
```

**`config/skills/automation/file-operations/skill.json`**

```json
{
  "id": "file-operations",
  "name": "file-operations",
  "displayName": "File Operations",
  "description": "Read, write, and manipulate files in the project",
  "category": "automation",
  "promptFile": "instructions.md",
  "tags": ["files", "filesystem", "read", "write"],
  "triggers": ["file", "read file", "write file", "create file"],
  "assignableRoles": ["developer", "orchestrator"],
  "isBuiltin": true,
  "version": "1.0.0"
}
```

**`config/skills/integration/github/skill.json`**

```json
{
  "id": "github-integration",
  "name": "github-integration",
  "displayName": "GitHub Integration",
  "description": "Interact with GitHub repositories, issues, and pull requests",
  "category": "integration",
  "promptFile": "instructions.md",
  "tags": ["github", "git", "pr", "issues"],
  "triggers": ["github", "pull request", "PR", "issue"],
  "assignableRoles": ["developer", "orchestrator"],
  "execution": {
    "type": "mcp-tool",
    "mcpTool": {
      "toolName": "gh_cli",
      "defaultParams": {}
    }
  },
  "isBuiltin": true,
  "version": "1.0.0"
}
```

### 3. Update Skill Service to Load Defaults

Ensure `backend/src/services/skill/skill.service.ts` loads from `config/skills/`:

```typescript
private async loadBuiltinSkills(): Promise<Skill[]> {
  const skillsDir = path.join(process.cwd(), 'config', 'skills');
  const skills: Skill[] = [];

  if (!fs.existsSync(skillsDir)) {
    console.warn('No built-in skills directory found at:', skillsDir);
    return skills;
  }

  // Recursively find all skill.json files
  const categories = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const category of categories) {
    const categoryPath = path.join(skillsDir, category);
    const skillDirs = fs.readdirSync(categoryPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const skillDir of skillDirs) {
      const skillJsonPath = path.join(categoryPath, skillDir, 'skill.json');
      if (fs.existsSync(skillJsonPath)) {
        try {
          const skillData = JSON.parse(fs.readFileSync(skillJsonPath, 'utf-8'));
          skillData.isBuiltin = true;
          skillData.promptFile = path.join(categoryPath, skillDir, skillData.promptFile);
          skills.push(skillData);
        } catch (error) {
          console.error(`Failed to load skill from ${skillJsonPath}:`, error);
        }
      }
    }
  }

  return skills;
}
```

## Files to Create

| File | Action |
|------|--------|
| `config/skills/development/code-review/skill.json` | Create |
| `config/skills/development/code-review/instructions.md` | Create |
| `config/skills/development/testing/skill.json` | Create |
| `config/skills/development/testing/instructions.md` | Create |
| `config/skills/development/documentation/skill.json` | Create |
| `config/skills/development/documentation/instructions.md` | Create |
| `config/skills/automation/file-operations/skill.json` | Create |
| `config/skills/automation/file-operations/instructions.md` | Create |
| `config/skills/automation/git-operations/skill.json` | Create |
| `config/skills/automation/git-operations/instructions.md` | Create |
| `config/skills/integration/github/skill.json` | Create |
| `config/skills/integration/github/instructions.md` | Create |

## Acceptance Criteria

- [ ] `config/skills/` directory exists with default skills
- [ ] At least 6 default skills across 3 categories
- [ ] Skill Service loads skills from directory
- [ ] `GET /api/skills` returns default skills
- [ ] Skills tab displays default skills
- [ ] Each skill has proper metadata and instructions
- [ ] Skills are marked as `isBuiltin: true`

## Dependencies

- Task 29: Skill Service

## Priority

**High** - Improves first-time user experience
