# Code Review Pipeline — Quick Start

## Overview

An AI team that automatically reviews pull requests for code quality, security vulnerabilities, and test coverage. Produces structured, actionable review feedback with a clear verdict.

**Target Users**: SaaS teams, dev agencies, engineering organizations
**Team Size**: 2 agents (Senior Reviewer + Security Auditor)

## Prerequisites

- Crewly installed and running (`npx crewly start`)
- Git repository with PR workflow (GitHub, GitLab, or Bitbucket)

## Quick Start

```bash
# 1. Create the team from template
npx crewly create-team --template code-review-team

# 2. Start the team in your project directory
npx crewly start --project /path/to/your/repo
```

## Required Skills

| Skill | Purpose | Config Required |
|-------|---------|----------------|
| `code-review` | Analyze git diffs for quality, style, complexity | None |
| `test-runner` | Run test suite and verify coverage | None |
| `bug-triage` | Classify and prioritize security findings | None |
| `git-commit-helper` | Analyze commit messages for conventional format | None |

## Optional Skills

| Skill | Purpose |
|-------|---------|
| `send-pdf-to-slack` | Post review summary to Slack channel |
| `daily-standup-report` | Daily PR review activity summary |

## Workflow

```
  New PR Detected
       │
       ▼
  Senior Reviewer                Security Auditor
       │                              │
       ├─ Run code-review skill        │
       ├─ Analyze architecture         │
       ├─ Check naming, patterns       │
       ├─ Review error handling        │
       │                              │
       ├─ Run test-runner skill        │
       ├─ Verify tests pass            │
       ├─ Check coverage threshold     │
       │                              │
       │         Parallel              │
       │──────────────────────────────▶│
       │                              ├─ Scan for OWASP Top 10
       │                              ├─ Check for secrets
       │                              ├─ Review auth/authz
       │                              ├─ Classify findings
       │                              │  (bug-triage skill)
       │                              │
       │◀─────── Security Report ─────┤
       │                              │
       ├─ Consolidate all findings     │
       ├─ Produce final verdict        │
       │  (approve / request changes)  │
       │                              │
       └─ Post review comment ─────────┘
```

## Expected Output Examples

### Code Quality Review (from Senior Reviewer)
```markdown
## Code Review: PR #142 — Add user preferences API

### Summary
**Verdict**: REQUEST CHANGES (2 blockers, 3 suggestions)

**Files changed**: 6 | **Lines**: +284 / -12
**Tests**: 14 passing, 0 failing | **Coverage**: 87% (+3%)

### Findings

#### Blockers
1. **Missing input validation** — `preferences.controller.ts:45`
   The `updatePreferences` handler accepts raw body without validation.
   Any malformed JSON crashes the service with unhandled TypeError.
   **Fix**: Add Zod schema validation before processing.

2. **N+1 query in getAll** — `preferences.service.ts:78`
   Loading preferences with `Promise.all(users.map(u => getPrefs(u.id)))`.
   With 1000 users this fires 1000 queries.
   **Fix**: Batch query with `WHERE user_id IN (...)`.

#### Suggestions
1. **Consider extracting preference keys to constants** — `preferences.types.ts:12`
   String literals `'theme'`, `'language'`, `'timezone'` appear 4 times.
   Extract to a `PREFERENCE_KEYS` constant.

2. **Add JSDoc to public methods** — `preferences.service.ts`
   3 public methods missing documentation. Project convention requires JSDoc.

3. **Test edge case: empty preferences object** — `preferences.service.test.ts`
   No test for `updatePreferences({})`. Should return 400 or no-op.

### Test Results
✅ All 14 tests passing
✅ Coverage: 87% (above 80% threshold)
⚠️ Missing edge case test (see suggestion #3)
```

### Security Assessment (from Security Auditor)
```markdown
## Security Assessment: PR #142

### Risk Rating: MEDIUM (1 high, 1 low finding)

### Findings

| # | Severity | Category | Location | Description |
|---|----------|----------|----------|-------------|
| 1 | HIGH | Injection | `preferences.controller.ts:45` | No input validation — potential NoSQL injection if using MongoDB, or payload manipulation with any DB. Aligns with OWASP A03:2021 (Injection). |
| 2 | LOW | Information Disclosure | `preferences.controller.ts:67` | Error response includes full stack trace in non-production. Recommend stripping in all environments. |

### Remediation
1. **[HIGH] Add input validation**: Use Zod or Joi to validate request body schema before processing. Whitelist allowed preference keys.
2. **[LOW] Strip stack traces**: Use error middleware that omits stack traces regardless of NODE_ENV.

### Checks Passed
- ✅ No hardcoded secrets or API keys
- ✅ Authentication middleware present on all routes
- ✅ No use of `eval()` or dynamic code execution
- ✅ Dependencies have no known CVEs (checked via `npm audit`)

### Recommendation: BLOCK until HIGH finding is resolved
```

### Final Verdict (from Senior Reviewer)
```markdown
## Final Review: PR #142 — Add user preferences API

**Verdict**: ❌ REQUEST CHANGES

### Consolidated Findings
- 🔴 2 Blockers (1 code quality + 1 security HIGH)
- 🟡 3 Suggestions
- 🟢 Tests passing, coverage above threshold

### Required Before Merge
1. Add input validation with Zod schema (blocks both code quality + security findings)
2. Fix N+1 query in `getAll`

### Nice to Have
3. Extract preference key constants
4. Add JSDoc to public methods
5. Add empty-object edge case test

### What's Good
- Clean API design following RESTful conventions
- Good test coverage (87%)
- Proper error handling in happy path
- Consistent with existing codebase patterns
```

## Customization

- **Add linting**: Include quality gates for ESLint/Prettier checks
- **Adjust thresholds**: Modify coverage requirements in Senior Reviewer's prompt
- **Add CI integration**: Trigger review on GitHub webhook events
- **Scale**: Add a third agent for performance review (benchmarks, load testing)
- **Customize rules**: Edit Security Auditor's prompt to focus on your tech stack's specific vulnerabilities
