---
name: quality-gates-failed
description: When completion attempted but gates failed
variables:
  - CURRENT_TASK
  - FAILED_GATES
  - ITERATIONS
  - MAX_ITERATIONS
---

# Quality Gates Failed

You tried to complete the task, but some quality gates didn't pass.

## Current Task
**{{CURRENT_TASK}}**

## Failed Gates

{{FAILED_GATES}}

## Instructions

1. **Review each failed gate** - Understand why it failed
2. **Fix the issues** - Address each failure
3. **Run gates locally** - Verify fixes before completing
4. **Try again** - Call `complete_task` when all gates pass

## Progress
- Iteration: {{ITERATIONS}} of {{MAX_ITERATIONS}}

---

**Note:** You cannot complete the task until ALL required gates pass.
Required gates: typecheck, tests, build

Now, please fix the failing gates and try again.
