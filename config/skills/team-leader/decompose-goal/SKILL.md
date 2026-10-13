---
name: Decompose Goal
description: "Break down a high-level objective from the Orchestrator into specific, actionable sub-tasks for workers. Creates one WorkItem per sub-task in the task pool."
version: 1.0.0
category: management
skillType: claude-skill
assignableRoles:
  - team-leader
triggers:
  - decompose goal
  - break down objective
  - create subtasks
  - split task
tags:
  - goal
  - decomposition
  - planning
  - management
execution:
  type: script
  script:
    file: execute.sh
    interpreter: bash
    timeoutMs: 30000
---

# Decompose Goal

Breaks down a high-level objective from the Orchestrator into specific, actionable sub-tasks for workers. Each sub-task is created as a WorkItem in the task pool. (For the project's own long-lived backlog use the `project-tickets` skill instead.)

## When to Use

- When the Orchestrator sends you a new objective
- When an existing task is too large for a single worker
- When a task needs to be split across multiple roles

## Usage

```bash
bash {{SKILLS_PATH}}/team-leader/decompose-goal/execute.sh '$(cat /tmp/decompose.json)'
```

Where `/tmp/decompose.json` contains:

```json
{
  "objective": "Build user authentication module",
  "projectPath": "/path/to/project",
  "milestone": "m2_auth",
  "tasks": [
    {
      "title": "Implement JWT token service",
      "description": "Create a service that generates and validates JWT tokens for user sessions",
      "requiredRole": "backend-developer",
      "acceptanceCriteria": "- JWT generation works\n- Token validation works\n- Tests pass with 80%+ coverage",
      "priority": "high"
    },
    {
      "title": "Build login form component",
      "description": "Create a React login form with email/password fields and validation",
      "requiredRole": "frontend-developer",
      "acceptanceCriteria": "- Form renders correctly\n- Client-side validation works\n- Accessible (ARIA labels)",
      "priority": "high",
      "blockedBy": ["Implement JWT token service"]
    },
    {
      "title": "Wire login form to the token service",
      "description": "Call the token service from the form and store the session; cover the full path with an end-to-end test",
      "requiredRole": "frontend-developer",
      "acceptanceCriteria": "- A user can log in end to end\n- E2E test passes",
      "blockedBy": [0, 1]
    }
  ]
}
```

## Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `objective` | Yes | The high-level objective being decomposed |
| `projectPath` | No | Project path for task file creation |
| `milestone` | No | Milestone folder name (default: `delegated`) |
| `requestId` (or `--request-id <id>` after the JSON) | No | Ticket this work is for: the id (or `TKT-123`) from the `[TICKET:TKT-123 <id>]` line of the message you are acting on. Omit it and the task is still linked when your current turn has exactly one ticket; applied to every sub-task |
| `tasks` | Yes | Array of sub-task objects |
| `tasks[].title` | Yes | Sub-task title |
| `tasks[].description` | Yes | Detailed task description |
| `tasks[].requiredRole` | No | Role best suited for this task (default: `developer`) |
| `tasks[].acceptanceCriteria` | No | Criteria for task verification |
| `tasks[].priority` | No | Task priority: `low`, `normal`, `high` (default: `normal`) |
| `tasks[].blockedBy` | No | Tasks of this same call that must finish first: 0-based indexes or exact titles. Becomes the WorkItem `dependsOn`; the task stays `blocked` and is not dispatched until every blocker is done. Unknown/ambiguous references and cycles are rejected and nothing is created |
| `--dry-run` | No | Print the breakdown (title / blockedBy / delivers) in creation order and create nothing. Use it to review a large decomposition first |

## Output

```json
{
  "success": true,
  "objective": "Build user authentication module",
  "tasksCreated": 2,
  "tasks": [
    { "title": "Implement JWT token service", "requiredRole": "backend-developer", "workItemId": "abc123", "priority": "high" },
    { "title": "Build login form component", "requiredRole": "frontend-developer", "workItemId": "def456", "priority": "high" }
  ],
  "errors": []
}
```

## Best Practices

1. **Cut vertical slices**: each task is a narrow but COMPLETE path through every layer (schema, API, UI, tests), not a horizontal slice of one layer.
2. **Demoable alone**: a finished slice can be demoed or verified on its own.
3. **Fresh-context size**: size each slice to fit a single fresh context window (the test for "completable by one worker in one session").
4. **Prefactor first**: any prefactoring is its own first task that the slices depend on.
5. **Wide refactors**: expand (add the new path), migrate in batches, contract (remove the old path). Each batch is its own task with `blockedBy` the expand task.
6. **Name the blockers**: put every real prerequisite in `blockedBy`. A task with no blockers can start now; work the frontier (tasks whose blockers are all done).
7. **Include acceptance criteria**: Workers need clear success metrics.
8. **Match roles**: Set `requiredRole` to help with delegation.
9. **Don't over-split**: 2-5 sub-tasks per objective is typical.

## Related Skills

- `delegate-task` — Assign created tasks to specific workers
- `verify-output` — Verify completed task output
- `aggregate-results` — Summarize all task results
