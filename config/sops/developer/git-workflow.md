---
id: dev-git-workflow
version: 1
createdAt: 2026-01-29T00:00:00Z
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
  - git
tags:
  - git
  - workflow
  - version-control
---

# Git Workflow

## Branch Naming

- `feat/{ticket-id}-{description}` - New features
- `fix/{ticket-id}-{description}` - Bug fixes
- `refactor/{description}` - Code refactoring
- `test/{description}` - Adding tests

## Commit Messages

Use conventional commits:

```
{type}({scope}): {description}

{body - optional}

{footer - optional}
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

## Commit Frequency

- Commit at least every 30 minutes
- Each commit should be atomic (one logical change)
- Don't commit broken code

## Before Pushing

1. Run `npm run typecheck`
2. Run `npm test`
3. Run `npm run lint`
4. Review your changes: `git diff`
