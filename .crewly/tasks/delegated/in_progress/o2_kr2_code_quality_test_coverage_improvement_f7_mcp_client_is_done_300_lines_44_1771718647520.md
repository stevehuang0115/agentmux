# O2-KR2: Code Quality — Test Coverage Improvement

F7 MCP Client is done (300 lines + 44 tests). Excellent pace! Now let's tackle O2-KR2: code quality baseline.

The OKR target is 80%+ test coverage. Current state has gaps in frontend and CLI tests.

Deliverables:
1. **Assess current coverage**: Run `npx jest --coverage` (or a subset) to see where we stand
2. **Prioritize the biggest gaps** — focus on files with 0% or low coverage that are critical paths:
   - CLI commands (especially `onboard.ts` which was just modified with templates)
   - Backend controllers that lack tests
   - Any new files created recently (runtime-adapter, mcp-client already have tests)
3. **Write tests** for the top 3-5 uncovered critical files
4. **Run build + tests** to verify everything passes

Don't try to hit 80% in one task — focus on the highest-impact files first. We'll iterate.

After completing, report status with the coverage numbers.

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-22T00:04:07.520Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-core-sam-217bfbbf
- **Assigned at**: 2026-02-22T00:04:07.520Z
- **Status**: In Progress

## Task Description

O2-KR2: Code Quality — Test Coverage Improvement

F7 MCP Client is done (300 lines + 44 tests). Excellent pace! Now let's tackle O2-KR2: code quality baseline.

The OKR target is 80%+ test coverage. Current state has gaps in frontend and CLI tests.

Deliverables:
1. **Assess current coverage**: Run `npx jest --coverage` (or a subset) to see where we stand
2. **Prioritize the biggest gaps** — focus on files with 0% or low coverage that are critical paths:
   - CLI commands (especially `onboard.ts` which was just modified with templates)
   - Backend controllers that lack tests
   - Any new files created recently (runtime-adapter, mcp-client already have tests)
3. **Write tests** for the top 3-5 uncovered critical files
4. **Run build + tests** to verify everything passes

Don't try to hit 80% in one task — focus on the highest-impact files first. We'll iterate.

After completing, report status with the coverage numbers.
