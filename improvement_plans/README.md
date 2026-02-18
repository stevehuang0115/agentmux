# Crewly Improvement Plans

This directory contains structured improvement tickets for the Crewly codebase, organized by priority milestones.

## Overview

| Milestone | Priority | Tickets | Focus Area |
|-----------|----------|---------|------------|
| [milestone-1-critical-fixes](./milestone-1-critical-fixes/) | Critical | 5 | Type safety, testing frameworks, hardcoded values |
| [milestone-2-high-priority](./milestone-2-high-priority/) | High | 6 | Dead code removal, skipped tests, code duplication |
| [milestone-3-medium-priority](./milestone-3-medium-priority/) | Medium | 5 | Refactoring, logging, cleanup |

## Milestone 1: Critical Fixes

These issues should be addressed immediately as they impact code quality and correctness.

| Ticket | Description | Effort |
|--------|-------------|--------|
| [001-fix-mixed-testing-frameworks](./milestone-1-critical-fixes/open/001-fix-mixed-testing-frameworks.md) | Fix Jest/Vitest mixing in frontend tests | Small |
| [002-fix-mcp-server-any-types](./milestone-1-critical-fixes/open/002-fix-mcp-server-any-types.md) | Replace 25+ `any` types in MCP server | Medium |
| [003-fix-frontend-any-types](./milestone-1-critical-fixes/open/003-fix-frontend-any-types.md) | Fix `any` types in frontend services | Small |
| [004-replace-hardcoded-values](./milestone-1-critical-fixes/open/004-replace-hardcoded-values.md) | Replace hardcoded ports/timeouts with constants | Medium |
| [005-fix-weak-test-assertions](./milestone-1-critical-fixes/open/005-fix-weak-test-assertions.md) | Fix `expect(true).toBe(true)` placeholders | Small |

## Milestone 2: High Priority

Important improvements that enhance maintainability and reduce technical debt.

| Ticket | Description | Effort |
|--------|-------------|--------|
| [001-delete-frontend-prototype](./milestone-2-high-priority/open/001-delete-frontend-prototype.md) | Remove unused frontend_prototype directory (~5000 lines) | Small |
| [002-delete-unused-frontend-components](./milestone-2-high-priority/open/002-delete-unused-frontend-components.md) | Remove 7 unused component files | Small |
| [003-fix-skipped-tests](./milestone-2-high-priority/open/003-fix-skipped-tests.md) | Enable/fix 12 skipped tests | Medium |
| [004-extract-duplicate-avatar-component](./milestone-2-high-priority/open/004-extract-duplicate-avatar-component.md) | Create reusable MemberAvatar component | Small |
| [005-consolidate-cli-constants](./milestone-2-high-priority/open/005-consolidate-cli-constants.md) | Remove duplicate constants in CLI | Small |
| [006-fix-empty-catch-blocks](./milestone-2-high-priority/open/006-fix-empty-catch-blocks.md) | Add proper error handling to empty catches | Small |

## Milestone 3: Medium Priority

Code quality improvements and optimization.

| Ticket | Description | Effort |
|--------|-------------|--------|
| [001-refactor-giant-mcp-functions](./milestone-3-medium-priority/open/001-refactor-giant-mcp-functions.md) | Break down 200+ line functions | Large |
| [002-replace-console-logs-with-logger](./milestone-3-medium-priority/open/002-replace-console-logs-with-logger.md) | Replace 80+ console.logs with LoggerService | Medium |
| [003-remove-deprecated-workflow-code](./milestone-3-medium-priority/open/003-remove-deprecated-workflow-code.md) | Remove deprecated workflow endpoints | Small |
| [004-remove-unused-exports](./milestone-3-medium-priority/open/004-remove-unused-exports.md) | Clean up unused exports and imports | Small |
| [005-optimize-dynamic-imports](./milestone-3-medium-priority/open/005-optimize-dynamic-imports.md) | Convert dynamic to static imports | Small |

## Workflow

### For Each Milestone

1. **Create feature branch**
   ```bash
   git checkout -b improvement/milestone-X-description
   ```

2. **Complete tasks**
   - Work through each ticket in order
   - Move completed tickets from `open/` to `closed/`

3. **Code review + improve (3x)**
   - Self-review the changes
   - Run linting and type checks
   - Improve code quality

4. **Commit and merge**
   ```bash
   git add .
   git commit -m "feat: complete milestone-X improvements"
   ```

### Ticket Structure

Each ticket contains:
- **Problem Description**: What's wrong and why it matters
- **Files Affected**: List of files to modify
- **Detailed Instructions**: Step-by-step implementation guide with code snippets
- **Evaluation Criteria**: How to verify the fix is complete
- **Unit Tests**: Tests to add/modify
- **Rollback Plan**: How to undo if needed

### Moving Tickets

When a ticket is completed:

```bash
# Create closed directory if needed
mkdir -p improvement_plans/milestone-X/closed

# Move the completed ticket
mv improvement_plans/milestone-X/open/001-ticket-name.md \
   improvement_plans/milestone-X/closed/001-ticket-name.md
```

## Estimated Impact

| Metric | Before | After |
|--------|--------|-------|
| Dead code (lines) | ~6,500 | 0 |
| `any` types | 30+ | 0 |
| Skipped tests | 12 | 0 |
| Placeholder assertions | 3 | 0 |
| Console.log statements | 80+ | 0 (using Logger) |
| Hardcoded values | 15+ | 0 |

## Prerequisites

Before starting any milestone:

```bash
# Ensure clean working state
git status

# Install dependencies
npm install

# Verify current build works
npm run build

# Run existing tests
npm test
```

## Notes

- Each ticket is self-contained with all necessary information
- Dependencies between tickets are noted in the "Dependencies" section
- Always run the full test suite after completing each ticket
- Create atomic commits for easy rollback if needed
