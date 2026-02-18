---
id: 15-sop-data-model
title: Design SOP Data Model and Storage
phase: 4
priority: P1
status: open
estimatedHours: 6
dependencies: [05-memory-prompt-integration]
blocks: [16-sop-service, 17-sop-library]
---

# Task: Design SOP Data Model and Storage

## Objective
Design the data model and storage structure for Standard Operating Procedures (SOPs) that guide agent behavior.

## Background
SOPs provide standardized procedures for agents to follow, ensuring consistent behavior across:
- Coding workflows
- Communication protocols
- Quality checks
- Error handling
- Escalation procedures

## Deliverables

### 1. SOP Data Model

```typescript
// backend/src/types/sop.types.ts

interface SOP {
  // Identity
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;  // 'system' or agentId

  // Classification
  role: SOPRole | 'all';
  category: SOPCategory;
  priority: number;  // Higher = more important

  // Content
  title: string;
  description: string;
  content: string;  // Markdown

  // Activation
  triggers: string[];     // Keywords that activate this SOP
  conditions?: SOPCondition[];  // Optional conditions

  // Metadata
  tags: string[];
  relatedSOPs?: string[];  // IDs of related SOPs
  examples?: SOPExample[];
}

type SOPRole =
  | 'orchestrator'
  | 'pm'
  | 'developer'
  | 'frontend-developer'
  | 'backend-developer'
  | 'qa'
  | 'designer'
  | 'devops';

type SOPCategory =
  | 'workflow'        // How to do things
  | 'quality'         // Quality standards
  | 'communication'   // How to communicate
  | 'escalation'      // When to escalate
  | 'tools'           // How to use tools
  | 'debugging'       // How to debug
  | 'testing'         // Testing procedures
  | 'git'             // Git workflows
  | 'security';       // Security practices

interface SOPCondition {
  type: 'task-type' | 'file-pattern' | 'project-type' | 'custom';
  value: string;
  operator: 'equals' | 'contains' | 'matches';
}

interface SOPExample {
  title: string;
  scenario: string;
  correctApproach: string;
  incorrectApproach?: string;
}
```

### 2. Storage Structure

```
~/.crewly/sops/
├── index.json                    # SOP index for fast lookup
├── system/                       # Built-in SOPs (read-only)
│   ├── developer/
│   │   ├── coding-standards.md
│   │   ├── git-workflow.md
│   │   ├── testing-requirements.md
│   │   └── code-review.md
│   ├── pm/
│   │   ├── task-decomposition.md
│   │   ├── priority-assessment.md
│   │   └── progress-tracking.md
│   ├── qa/
│   │   ├── testing-procedures.md
│   │   └── bug-reporting.md
│   └── common/
│       ├── communication-protocol.md
│       ├── blocker-handling.md
│       └── escalation-criteria.md
└── custom/                       # User/agent created SOPs
    └── {sop-id}.md
```

### 3. SOP File Format

```markdown
---
id: dev-git-workflow
version: 1
createdAt: 2026-01-01T00:00:00Z
updatedAt: 2026-01-29T00:00:00Z
createdBy: system

role: developer
category: git
priority: 10

title: Git Workflow
description: Standard git workflow for developers

triggers:
  - commit
  - push
  - branch
  - merge
  - pull request

conditions:
  - type: task-type
    value: feature
    operator: equals

tags:
  - git
  - workflow
  - version-control

relatedSOPs:
  - dev-code-review
  - dev-testing-requirements
---

# Git Workflow

Follow this workflow for all code changes.

## Before Starting Work

1. **Pull latest changes**
   ```bash
   git pull origin main
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feat/{ticket-id}-{short-description}
   ```

## During Development

1. **Commit frequently** - At least every 30 minutes of work
2. **Use conventional commits**:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `docs:` - Documentation

3. **Include ticket reference**
   ```
   feat(auth): add password reset flow

   - Add reset password endpoint
   - Add email service integration

   Refs: #123
   ```

## Before Marking Complete

1. Ensure all tests pass
2. Run linter and fix issues
3. Squash commits if needed (keep meaningful history)
4. Create PR with clear description

## Examples

### Good Commit
```
feat(api): add user search endpoint

- Implement fuzzy search by name
- Add pagination support
- Include unit tests

Refs: #456
```

### Bad Commit
```
WIP
```
```

### 4. SOP Index Schema

```typescript
// ~/.crewly/sops/index.json

interface SOPIndex {
  version: string;
  lastUpdated: string;
  sops: SOPIndexEntry[];
}

interface SOPIndexEntry {
  id: string;
  path: string;           // Relative path to file
  role: string;
  category: string;
  priority: number;
  triggers: string[];
  title: string;
  isSystem: boolean;      // true = system/, false = custom/
}
```

### 5. SOP Loading Strategy

```typescript
// How SOPs are loaded and matched

interface SOPMatcher {
  // Find SOPs for a given context
  findRelevant(params: {
    role: string;
    taskContext: string;
    taskType?: string;
    filePatterns?: string[];
  }): SOP[];

  // Score SOP relevance
  scoreRelevance(sop: SOPIndexEntry, context: string): number;
}
```

**Matching Algorithm:**
1. Filter by role (exact match or 'all')
2. Filter by conditions if present
3. Score by trigger keyword matches
4. Sort by priority (higher first)
5. Return top N SOPs

### 6. Configuration

```typescript
// config/constants.ts additions

export const SOP_CONSTANTS = {
  // Paths
  SOP_DIR: 'sops',
  SYSTEM_SOP_DIR: 'system',
  CUSTOM_SOP_DIR: 'custom',
  INDEX_FILE: 'index.json',

  // Limits
  MAX_SOPS_IN_PROMPT: 5,
  MAX_SOP_CONTENT_LENGTH: 2000,

  // Matching
  MIN_TRIGGER_MATCH_SCORE: 0.3,
  DEFAULT_PRIORITY: 5,
};
```

## Implementation Steps

1. **Define type interfaces**
   - SOP, SOPRole, SOPCategory
   - SOPIndex, SOPIndexEntry
   - Export from types/

2. **Create directory structure**
   - System SOPs location
   - Custom SOPs location
   - Index file

3. **Design file format**
   - YAML frontmatter
   - Markdown content
   - Examples section

4. **Define matching algorithm**
   - Role filtering
   - Condition checking
   - Trigger scoring
   - Priority sorting

5. **Add constants**
   - Paths, limits, defaults

6. **Document format**
   - How to write SOPs
   - Required fields
   - Best practices

## Acceptance Criteria

- [ ] Type definitions complete
- [ ] Directory structure defined
- [ ] File format specified
- [ ] Index schema defined
- [ ] Matching algorithm designed
- [ ] Constants added

## Notes

- System SOPs should be read-only
- Custom SOPs can be created by agents
- Keep SOP content concise (fits in prompt)
- Consider versioning for updates
