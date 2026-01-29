---
id: 17-sop-library
title: Create Default SOP Library
phase: 4
priority: P1
status: open
estimatedHours: 8
dependencies: [15-sop-data-model]
blocks: [18-sop-prompt-integration]
---

# Task: Create Default SOP Library

## Objective
Create a comprehensive library of default SOPs for all agent roles.

## Background
Default SOPs establish baseline behaviors that all agents follow. These should cover common scenarios and best practices.

## Deliverables

### 1. Developer SOPs

#### coding-standards.md

```markdown
---
id: dev-coding-standards
version: 1
role: developer
category: quality
priority: 10
title: Coding Standards
triggers: [code, implement, write, function, class]
---

# Coding Standards

Follow these standards for all code changes.

## Code Style

1. **Use TypeScript** - All new code should be TypeScript
2. **Explicit types** - Define interfaces for all data structures
3. **No `any`** - Use `unknown` with type guards instead
4. **Meaningful names** - Variables and functions should be self-documenting

## File Organization

1. One component/service per file
2. Test files next to source files (`*.test.ts`)
3. Group related files in directories
4. Use barrel exports (`index.ts`)

## Functions

1. **Single responsibility** - One function, one purpose
2. **Small functions** - Aim for <30 lines
3. **Pure functions** - Minimize side effects
4. **Document complex logic** - Add comments for non-obvious code

## Error Handling

1. Always use try/catch for async operations
2. Log errors with context
3. Throw meaningful error messages
4. Don't swallow errors silently
```

#### git-workflow.md

```markdown
---
id: dev-git-workflow
version: 1
role: developer
category: git
priority: 10
title: Git Workflow
triggers: [commit, push, branch, merge, git]
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
```

#### testing-requirements.md

```markdown
---
id: dev-testing-requirements
version: 1
role: developer
category: testing
priority: 9
title: Testing Requirements
triggers: [test, testing, jest, unit, coverage]
---

# Testing Requirements

## What to Test

1. **All public functions** - Every exported function needs tests
2. **Edge cases** - Empty inputs, null values, boundaries
3. **Error paths** - Verify errors are thrown correctly
4. **Integration points** - Test service interactions

## Test Structure

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do X when given Y', () => {
      // Arrange
      const input = ...;

      // Act
      const result = methodName(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

## Test Quality

- Descriptive test names
- One assertion per test (usually)
- No test interdependencies
- Clean up after tests

## Coverage Goals

- Minimum 80% for new code
- 100% for critical paths
```

### 2. PM SOPs

#### task-decomposition.md

```markdown
---
id: pm-task-decomposition
version: 1
role: pm
category: workflow
priority: 10
title: Task Decomposition
triggers: [task, decompose, break down, story, ticket]
---

# Task Decomposition

## When to Decompose

Break down tasks when:
- Estimated time > 4 hours
- Multiple components involved
- Multiple people needed
- Unclear scope

## Decomposition Steps

1. **Identify the goal** - What's the end result?
2. **List deliverables** - What needs to be produced?
3. **Identify dependencies** - What must happen first?
4. **Create subtasks** - One per deliverable
5. **Add acceptance criteria** - How do we know it's done?

## Task Quality

Each task should have:
- Clear title (action verb + object)
- Description with context
- Acceptance criteria (checklist)
- Estimated size (S/M/L)
- Dependencies listed

## Example

**Bad:** "Build user feature"

**Good:**
- "Implement user registration API endpoint"
- "Add user registration form component"
- "Write tests for user registration flow"
- "Add input validation for registration fields"
```

#### progress-tracking.md

```markdown
---
id: pm-progress-tracking
version: 1
role: pm
category: workflow
priority: 8
title: Progress Tracking
triggers: [progress, status, update, tracking, report]
---

# Progress Tracking

## Check-in Frequency

- **Active tasks**: Every 30 minutes
- **Blocked tasks**: Immediately
- **Completed tasks**: On completion

## Status Updates

Use `report_progress` tool with:
- Current progress percentage
- Completed items
- Current work
- Blockers (if any)
- Next steps

## Escalation Triggers

Escalate when:
- Task blocked for > 1 hour
- Requirements unclear
- Multiple attempts failed
- Scope creep detected
- Dependencies missing

## Progress Reports

Include:
1. Overall status (on track / at risk / blocked)
2. Completed items
3. In-progress items
4. Blockers and risks
5. Help needed
```

### 3. QA SOPs

#### testing-procedures.md

```markdown
---
id: qa-testing-procedures
version: 1
role: qa
category: testing
priority: 10
title: Testing Procedures
triggers: [test, verify, validate, qa, quality]
---

# Testing Procedures

## Review Process

1. **Read requirements** - Understand acceptance criteria
2. **Review code** - Check implementation approach
3. **Run automated tests** - Verify tests pass
4. **Manual testing** - Test edge cases
5. **Document findings** - Report issues clearly

## Test Cases

For each feature, verify:
- Happy path works
- Error cases handled
- Edge cases covered
- Performance acceptable
- Security considered

## Bug Reporting

Include:
- Clear title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots/logs
- Environment details

## Quality Gates

Before approving:
- [ ] All acceptance criteria met
- [ ] Tests pass
- [ ] No critical bugs
- [ ] Code reviewed
- [ ] Documentation updated
```

### 4. Common SOPs

#### communication-protocol.md

```markdown
---
id: common-communication
version: 1
role: all
category: communication
priority: 10
title: Communication Protocol
triggers: [message, send, communicate, team, ask]
---

# Communication Protocol

## When to Communicate

- **Starting work** - Notify PM when accepting task
- **Progress updates** - Every 30 minutes or on completion
- **Blockers** - Immediately when blocked
- **Questions** - When unclear about requirements
- **Completion** - When task is ready for review

## Message Format

Keep messages:
- **Concise** - Get to the point
- **Actionable** - Clear what's needed
- **Contextual** - Include relevant details

## Escalation Path

1. First: Try to resolve yourself
2. Then: Ask teammate
3. Then: Ask PM
4. Finally: Escalate to orchestrator

## Tools

- `send_message` - Direct to specific agent
- `report_progress` - Status updates
- `request_review` - Ask for code review
```

#### blocker-handling.md

```markdown
---
id: common-blocker-handling
version: 1
role: all
category: escalation
priority: 9
title: Blocker Handling
triggers: [blocked, stuck, help, issue, problem]
---

# Blocker Handling

## Types of Blockers

1. **Technical** - Code issue, bug, error
2. **Dependency** - Waiting on another task
3. **Clarity** - Unclear requirements
4. **Access** - Missing permissions/resources
5. **External** - Third-party issue

## Resolution Steps

1. **Identify** - What exactly is blocking?
2. **Research** - Can you find a solution?
3. **Document** - Record what you've tried
4. **Ask** - Use `recall` tool for similar issues
5. **Escalate** - If still blocked after 30 min

## When to Escalate

- Blocked for more than 30 minutes
- Multiple failed attempts
- Need external help
- Critical path affected

## Escalation Message

Include:
- What you're trying to do
- What's blocking you
- What you've tried
- What help you need
```

### 5. File Structure

```
config/sops/
├── developer/
│   ├── coding-standards.md
│   ├── git-workflow.md
│   ├── testing-requirements.md
│   └── code-review.md
├── pm/
│   ├── task-decomposition.md
│   ├── progress-tracking.md
│   └── priority-assessment.md
├── qa/
│   ├── testing-procedures.md
│   └── bug-reporting.md
└── common/
    ├── communication-protocol.md
    ├── blocker-handling.md
    └── escalation-criteria.md
```

## Implementation Steps

1. **Create directory structure**
   - Developer SOPs
   - PM SOPs
   - QA SOPs
   - Common SOPs

2. **Write all SOP files**
   - Use standard frontmatter
   - Clear actionable content
   - Include examples

3. **Review and refine**
   - Ensure consistency
   - Check triggers work
   - Verify priorities

4. **Add to build process**
   - Copy to dist/
   - Include in package

## Acceptance Criteria

- [ ] All role directories created
- [ ] At least 3 SOPs per role
- [ ] Common SOPs for all agents
- [ ] Consistent frontmatter format
- [ ] Clear, actionable content
- [ ] Proper triggers defined

## Notes

- Keep SOPs concise
- Focus on actionable guidance
- Include examples where helpful
- Update based on agent feedback
