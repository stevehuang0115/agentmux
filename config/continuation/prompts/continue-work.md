---
name: continue-work
description: General continuation prompt when agent goes idle
variables:
  - CURRENT_TASK
  - TASK_DESCRIPTION
  - ITERATIONS
  - MAX_ITERATIONS
  - QUALITY_GATES
  - PROJECT_KNOWLEDGE
  - LEARNINGS
  - HINTS
---

# Continue Your Work

You were working on a task but stopped. Let's continue.

## Current Task
**{{CURRENT_TASK}}**

{{TASK_DESCRIPTION}}

## Progress
- Iteration: {{ITERATIONS}} of {{MAX_ITERATIONS}}

## Quality Gates Status
{{QUALITY_GATES}}

## Instructions

1. **Review your progress** - Check what you've done so far
2. **Continue from where you left off** - Don't restart from scratch
3. **Run quality checks** - Ensure tests pass and code compiles
4. **Commit your work** - Make incremental commits
5. **Complete when ready** - Call `complete_task` when ALL quality gates pass

## Hints
{{HINTS}}

{{#if PROJECT_KNOWLEDGE}}
## Your Project Knowledge
<details>
<summary>Click to expand</summary>

{{PROJECT_KNOWLEDGE}}

</details>
{{/if}}

{{#if LEARNINGS}}
## Recent Learnings
{{LEARNINGS}}
{{/if}}

---

**Remember:** You have {{REMAINING_ITERATIONS}} iterations remaining. Use your time wisely.

Now, please continue working on your task.
