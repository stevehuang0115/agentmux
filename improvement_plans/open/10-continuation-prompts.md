---
id: 10-continuation-prompts
title: Create Continuation Prompt Templates
phase: 2
priority: P0
status: open
estimatedHours: 6
dependencies: [09-continuation-service]
blocks: []
---

# Task: Create Continuation Prompt Templates

## Objective
Create the prompt templates used to continue agent work after they stop or go idle.

## Background
When an agent needs to continue work, we inject a prompt that:
- Reminds them what they were working on
- Provides relevant context
- Gives specific instructions based on their state
- Includes quality gate status

## Deliverables

### 1. Template Directory Structure

```
config/continuation/prompts/
├── continue-work.md           # General continuation
├── retry-error.md             # Retry after error
├── task-assignment.md         # Assign new task
├── quality-gates-failed.md    # When gates fail
└── max-iterations.md          # Hit iteration limit
```

### 2. Continue Work Template

**File:** `config/continuation/prompts/continue-work.md`

```markdown
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

## Your Project Knowledge
<details>
<summary>Click to expand</summary>

{{PROJECT_KNOWLEDGE}}

</details>

## Recent Learnings
{{LEARNINGS}}

---

**Remember:** You have {{MAX_ITERATIONS}} - {{ITERATIONS}} iterations remaining. Use your time wisely.

Now, please continue working on your task.
```

### 3. Retry Error Template

**File:** `config/continuation/prompts/retry-error.md`

```markdown
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

## Known Gotchas
{{#if RELATED_GOTCHAS}}
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
```

### 4. Quality Gates Failed Template

**File:** `config/continuation/prompts/quality-gates-failed.md`

```markdown
---
name: quality-gates-failed
description: When completion attempted but gates failed
variables:
  - CURRENT_TASK
  - FAILED_GATES
  - GATE_OUTPUT
  - ITERATIONS
  - MAX_ITERATIONS
---

# Quality Gates Failed

You tried to complete the task, but some quality gates didn't pass.

## Current Task
**{{CURRENT_TASK}}**

## Failed Gates

{{#each FAILED_GATES}}
### ❌ {{name}}

**Command:** `{{command}}`

**Output:**
```
{{output}}
```

{{/each}}

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
```

### 5. Task Assignment Template

**File:** `config/continuation/prompts/task-assignment.md`

```markdown
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

## Relevant Project Knowledge

{{#if RELATED_PATTERNS}}
### Patterns to Follow
{{RELATED_PATTERNS}}
{{/if}}

{{#if RELATED_GOTCHAS}}
### Gotchas to Watch For
{{RELATED_GOTCHAS}}
{{/if}}

## Instructions

1. **Accept the task** - Call `accept_task` with the task path
2. **Review requirements** - Understand what's needed
3. **Use `recall`** - Check for relevant past knowledge
4. **Plan your approach** - Break down if complex
5. **Implement** - Write code, tests, documentation
6. **Quality check** - Run tests, typecheck, lint
7. **Commit regularly** - At least every 30 minutes
8. **Complete** - Call `complete_task` when done

---

Please start working on this task now.
```

### 6. Max Iterations Template

**File:** `config/continuation/prompts/max-iterations.md`

```markdown
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
```

### 7. Template Loader Service

```typescript
// backend/src/services/continuation/template-loader.service.ts

interface ITemplateLoader {
  loadTemplate(name: string): Promise<string>;
  substituteVariables(template: string, variables: Record<string, any>): string;
}

class TemplateLoader implements ITemplateLoader {
  private readonly templateDir = 'config/continuation/prompts';
  private cache: Map<string, string> = new Map();

  async loadTemplate(name: string): Promise<string> {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    const filePath = path.join(this.templateDir, `${name}.md`);
    const content = await fs.readFile(filePath, 'utf-8');

    // Remove frontmatter
    const templateContent = this.removeFrontmatter(content);

    this.cache.set(name, templateContent);
    return templateContent;
  }

  substituteVariables(template: string, variables: Record<string, any>): string {
    let result = template;

    // Simple variable substitution: {{VAR_NAME}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }

    // Handle conditionals: {{#if VAR}}...{{/if}}
    result = this.processConditionals(result, variables);

    // Handle loops: {{#each VAR}}...{{/each}}
    result = this.processLoops(result, variables);

    return result;
  }
}
```

## Implementation Steps

1. **Create template directory**
   - Add to config/
   - Create all template files

2. **Design template format**
   - Frontmatter for metadata
   - Variable placeholders
   - Conditional blocks
   - Loop blocks

3. **Implement TemplateLoader**
   - Load templates from files
   - Cache for performance
   - Variable substitution

4. **Create all templates**
   - continue-work.md
   - retry-error.md
   - quality-gates-failed.md
   - task-assignment.md
   - max-iterations.md

5. **Integrate with ContinuationService**
   - Use TemplateLoader
   - Pass correct variables

6. **Write tests**
   - Template loading
   - Variable substitution
   - Conditional processing

## Acceptance Criteria

- [ ] All template files created
- [ ] TemplateLoader implemented
- [ ] Variable substitution works
- [ ] Conditionals work
- [ ] Loops work
- [ ] Integration with ContinuationService
- [ ] Templates produce clear, helpful prompts

## Notes

- Templates should be clear and actionable
- Include enough context for agent to continue
- Don't overwhelm with too much information
- Consider token limits
