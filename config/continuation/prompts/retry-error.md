---
name: retry-error
description: Retry prompt when agent hit an error
variables:
  - CURRENT_TASK
  - ERROR_TYPE
  - ERROR_MESSAGE
  - SUGGESTED_FIX
  - ITERATIONS
  - MAX_ITERATIONS
  - RELATED_GOTCHAS
---

# Error Encountered - Let's Fix It

You hit an error while working. Let's address it and continue.

## Current Task
**{{CURRENT_TASK}}**

## Error Details

**Type:** {{ERROR_TYPE}}

```
{{ERROR_MESSAGE}}
```

## Suggested Approach

{{SUGGESTED_FIX}}

{{#if RELATED_GOTCHAS}}
## Known Gotchas
These gotchas from the project knowledge might be relevant:

{{RELATED_GOTCHAS}}
{{/if}}

## Instructions

1. **Read the error carefully** - Understand what went wrong
2. **Check the suggested approach** - It may help
3. **Use `recall` tool** - Search for similar past issues
4. **Fix the issue** - Make the necessary changes
5. **Run tests again** - Verify the fix works
6. **Continue with the task** - Don't get stuck on one error

## Progress
- Iteration: {{ITERATIONS}} of {{MAX_ITERATIONS}}

---

**Tip:** If you're stuck after multiple attempts, consider:
- Breaking the problem into smaller steps
- Checking documentation
- Using `record_learning` to note what you discover

Now, please fix the error and continue.
