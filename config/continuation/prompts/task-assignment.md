---
name: task-assignment
description: Assign a new task to the agent
variables:
  - TASK_TITLE
  - TASK_DESCRIPTION
  - TASK_PATH
  - PRIORITY
  - ESTIMATED_HOURS
  - ACCEPTANCE_CRITERIA
  - RELATED_PATTERNS
  - RELATED_GOTCHAS
---

# New Task Assignment

You have been assigned a new task.

## Task Details

**Title:** {{TASK_TITLE}}
**Priority:** {{PRIORITY}}
**Estimated:** {{ESTIMATED_HOURS}} hours
**Path:** {{TASK_PATH}}

## Description

{{TASK_DESCRIPTION}}

## Acceptance Criteria

{{ACCEPTANCE_CRITERIA}}

{{#if RELATED_PATTERNS}}
## Relevant Patterns
These patterns from the project knowledge are relevant:

{{RELATED_PATTERNS}}
{{/if}}

{{#if RELATED_GOTCHAS}}
## Gotchas to Watch For
These known issues might affect your work:

{{RELATED_GOTCHAS}}
{{/if}}

## Instructions

1. **Review requirements** - Understand what's needed
2. **Use `recall`** - Check for relevant past knowledge
3. **Plan your approach** - Break down if complex
4. **Implement** - Write code, tests, documentation
5. **Quality check** - Run tests, typecheck, lint
6. **Commit regularly** - At least every 30 minutes
7. **Complete** - Call `complete_task` when done

---

Please start working on this task now.
