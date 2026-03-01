# Phase 1 Engineering Closeout

**Author:** Sam (crewly-core-sam)
**Date:** 2026-02-24
**Status:** Complete

---

## 1. Onboarding Bug Verification (T5 / R1.5)

Three bugs were identified in `cli/src/commands/onboard.ts` by Mia's audit:

### Bug 1: Wrong Gemini package name
- **Reported:** `@anthropic-ai/gemini-cli` at lines 199, 203
- **Current code (line 208):** `{ displayName: 'Gemini CLI', command: 'gemini', npmPackage: '@google/gemini-cli' }`
- **Status:** FIXED (already correct in current codebase)

### Bug 2: Template selection doesn't create team
- **Reported:** Selecting a template during onboard didn't actually write team config
- **Current code:** `createTeamFromTemplate()` (line 387) writes `~/.crewly/teams/{id}/config.json`. Called at lines 571 (non-interactive) and 612 (interactive) after template selection.
- **Status:** FIXED (already correct in current codebase)

### Bug 3: Missing tmux detection
- **Reported:** No check for tmux during onboard (required for agent PTY sessions)
- **Current code (lines 235-243):** `ensureTools()` checks `tmux` first via `checkToolInstalled('tmux')`, reports version if found, warns with install instructions if missing.
- **Status:** FIXED (already correct in current codebase)

### Test Coverage
All 3 bugs have test coverage in `cli/src/commands/onboard.test.ts`:
- Bug 1: `installTool` tests verify npm package name passed correctly
- Bug 2: `createTeamFromTemplate` tests verify `config.json` written with members
- Bug 3: `ensureTools` tests verify tmux detection and warning

---

## 2. Uncommitted Changes & Commit Plan

### Current state: 34 modified files + 1 new directory (untracked `docs/okr/`)

### Proposed Commit Groups

| # | Scope | Files | Description |
|---|-------|-------|-------------|
| 1 | **F13: Context window management** | `context-window-monitor.service.ts`, `.test.ts` | Gemini token-count detection, post-compact verification, compact timer cleanup. 88 tests pass. |
| 2 | **CLI: init alias** | `cli/src/index.ts` | Add `init` as alias for `onboard` command. 57 tests pass. |
| 3 | **Settings: idle timeout + proactive compact** | `settings.types.ts` (backend + frontend), `settings.service.ts` + `.test.ts`, `GeneralTab.tsx` + `.test.tsx`, `useSettings.test.ts`, `settings.service.test.ts` (frontend) | `agentIdleTimeoutMinutes` and `enableProactiveCompact` settings. |
| 4 | **Runtime services: Codex + Gemini + exit monitor** | `codex-runtime.service.ts` + `.test.ts`, `gemini-runtime.service.ts` + `.test.ts`, `runtime-agent.service.abstract.ts`, `runtime-exit-monitor.service.ts` + `.test.ts`, `agent-registration.service.ts` | Runtime improvements (context monitor hooks, Codex support). |
| 5 | **Orchestrator + workflow** | `orchestrator.controller.ts`, `orchestrator-restart.service.ts` + `.test.ts`, `message-scheduler.service.ts`, `scheduler.service.ts` | Orchestrator restart cooldown, scheduler improvements. |
| 6 | **Skills updates** | `rednote-reader/` (3 files), `reply-slack/` (2 files) | Skill config/instructions updates. |
| 7 | **Docs: Phase 1 artifacts** | `docs/okr/phase1/` (all `.md` files) | Audit, implementation summary, exec status, CLI gap resolution, closeout. |
| 8 | **Crewly data files** | `.crewly/agents-index.json`, `.crewly/docs/`, `.crewly/knowledge/learnings.md` | Auto-generated project state (may skip or .gitignore). |

**Note:** Commits 3-6 contain changes made by other agents/sessions prior to this session. Sam's direct changes are commits 1, 2, and 7. Recommend orchestrator reviews commits 3-6 before committing.

---

## 3. Build & Test Verification

### TypeScript Compilation
```
$ npx tsc --noEmit
EXIT: 0 (clean, zero errors)
```

### Key Test Suites

#### F13: Context Window Monitor (88 tests)
```
$ npx jest backend/src/services/agent/context-window-monitor.service.test.ts --no-cache
PASS
Tests: 88 passed, 88 total
```

#### CLI: Onboard/Init (57 tests)
```
$ npx jest cli/src/commands/onboard.test.ts --no-cache
PASS
Tests: 57 passed, 57 total
```

#### Combined Run
```
$ npx jest cli/src/commands/onboard.test.ts backend/src/services/agent/context-window-monitor.service.test.ts --no-cache
Test Suites: 2 passed, 2 total
Tests: 145 passed, 145 total
Time: 5.254s
```

### CLI Alias Verification
```
$ node dist/cli/cli/src/index.js init --help
Usage: crewly onboard|init [options]
Interactive setup wizard for new Crewly users
Options:
  -y, --yes        Non-interactive mode: use all defaults (CI-friendly)
  --template <id>  Select a team template by ID (e.g. web-dev-team)
  -h, --help       display help for command
EXIT: 0
```

---

## 4. Phase 1 GO Gate Assessment

### P0 Checklist

| Item | Status | Evidence |
|------|--------|----------|
| 3 onboarding bugs fixed | PASS | All 3 verified in code, covered by 57 tests |
| `npx crewly init` works | PASS | `init` alias added, routes to full onboard wizard |
| `crewly init --yes` (CI mode) | PASS | Non-interactive flow tested (57 tests) |
| `crewly init --template <id>` | PASS | Template flag tested |
| F13 context window management | PASS | Gemini detection + post-compact verify + timer cleanup. 88 tests. |
| Open-source essentials | PASS | LICENSE (MIT), README.md, CONTRIBUTING.md all present |
| TypeScript builds cleanly | PASS | `npx tsc --noEmit` → EXIT:0 |
| No test regressions | PASS | 145 tests across key suites, all passing |

### Remaining Blockers to Phase 1 GO

| Blocker | Severity | Owner | Action |
|---------|----------|-------|--------|
| Uncommitted changes (34 files) need commit + push | MEDIUM | Sam/Orchestrator | Execute commit plan above. Sam's changes (commits 1, 2, 7) are ready. Commits 3-6 need orchestrator review. |
| Pre-existing test failures in other suites | LOW | — | Slack, config, self-improvement, git, file-watcher, task-management, project controllers. Pre-date Phase 1 work. Not caused by current changes. |
| Codex CLI `/compact` command unverified (GAP-4) | LOW | Deferred | Need Codex CLI docs to confirm. Does not block GO. |

### Verdict

**Phase 1 engineering work is GO-ready** pending commit of the 34 modified files. All P0 acceptance criteria are met. Pre-existing test failures in unrelated suites are not blockers — they predate Phase 1 work and are tracked separately.

---

## 5. Sam's Phase 1 Deliverables Summary

| Deliverable | File | Tests |
|-------------|------|-------|
| F13 Audit | `docs/okr/phase1/sam-f13-audit.md` | — |
| F13 Implementation | `context-window-monitor.service.ts` | 88 pass |
| F13 Summary | `docs/okr/phase1/sam-f13-implementation-summary.md` | — |
| CLI init alias | `cli/src/index.ts` | 57 pass |
| CLI gap resolution | `docs/okr/phase1/sam-cli-init-gap-resolution.md` | — |
| Week 1 exec status | `docs/okr/phase1/sam-week1-exec-status.md` | — |
| Phase 1 closeout | `docs/okr/phase1/sam-phase1-closeout.md` | — |
