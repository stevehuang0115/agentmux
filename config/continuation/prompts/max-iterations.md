---
name: max-iterations
description: When agent hits iteration limit
variables:
  - CURRENT_TASK
  - ITERATIONS
  - SUMMARY_OF_ATTEMPTS
  - BLOCKERS
---

# Iteration Limit Reached

You've reached the maximum number of iterations ({{ITERATIONS}}) for this task.

## Current Task
**{{CURRENT_TASK}}**

## What Happened

{{SUMMARY_OF_ATTEMPTS}}

## Current Blockers

{{BLOCKERS}}

## Next Steps

This task requires human intervention. The following has been done:
1. Task status set to BLOCKED
2. Owner notified
3. Your progress has been saved

## Instructions

1. **Record your learnings** - Use `record_learning` to document what you discovered
2. **Document blockers clearly** - Update the task with specific blocker details
3. **Wait for guidance** - The owner will provide direction

---

**Note:** Do not continue attempting this task until you receive new instructions.
