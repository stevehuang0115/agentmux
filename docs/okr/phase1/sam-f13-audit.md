# F13: Context Window Management — Architecture Audit

**Author:** Sam (crewly-core-sam)
**Date:** 2026-02-24
**Status:** Complete

## 1. Architecture Overview

Context window management in Crewly follows a **compact-first, restart-last** strategy across three AI runtimes: Claude Code, Gemini CLI, and Codex CLI.

### Core Components

| File | Role | Confidence |
|------|------|------------|
| `backend/src/services/agent/context-window-monitor.service.ts` | Central monitor — PTY subscription, threshold evaluation, compact triggering, auto-recovery | **High** (1018 LOC, fully read) |
| `backend/src/constants.ts:496-545` | Thresholds, compact commands per runtime, proactive compact config | **High** |
| `backend/src/services/agent/runtime-exit-monitor.service.ts` | Detects CLI exit, triggers restart with task re-delivery | **High** (767 LOC, fully read) |
| `backend/src/services/orchestrator/orchestrator-restart.service.ts` | Orchestrator-specific restart with cooldown | **High** (345 LOC, fully read) |
| `backend/src/services/agent/runtime-agent.service.abstract.ts` | Base class for runtime services | **High** |
| `backend/src/services/agent/gemini-runtime.service.ts` | Gemini CLI init, detection, `/directory add` | **High** |
| `backend/src/services/agent/codex-runtime.service.ts` | Codex CLI init, detection | **High** |
| `backend/src/services/session/pty/pty-session-backend.ts` | PTY backend with cumulative output byte tracking | **High** |
| `backend/src/types/settings.types.ts` | `enableProactiveCompact` setting | **High** |

### Data Flow

```
PTY output → handleData() → extractContextPercent() → updateContextUsage()
                                                            ↓
                                                     evaluateThresholds()
                                                     ↓          ↓          ↓
                                                  yellow      red       critical
                                                  (70%)      (85%)      (95%)
                                                    ↓          ↓          ↓
                                                 warn     compact    compact→recovery
                                                 event    command    (if enabled)
```

Parallel path (proactive):
```
PTY output → cumulativeOutputBytes counter (pty-session-backend.ts)
                        ↓
             performCheck() every 30s reads counter
                        ↓
             if >= 512KB → triggerCompact() + reset counter
```

### Compact Commands per Runtime

| Runtime | Command | Escape prefix | Verified |
|---------|---------|---------------|----------|
| Claude Code | `/compact` | Yes (Esc clears input) | **Yes** — native command |
| Gemini CLI | `/compress` | **No** (Esc defocuses TUI) | **Yes** — native command |
| Codex CLI | `/compact` | Yes | **Low** — assumed, not verified against Codex CLI docs |

## 2. Findings — What Works Well

1. **Compact-first strategy** (`AUTO_RECOVERY_ENABLED: false`) — restart is disabled by default, compact is always tried first.
2. **Proactive compact** — cumulative output byte tracking (512KB threshold) triggers compact before the runtime even reports high context usage.
3. **Per-runtime escape handling** — Gemini CLI correctly skips the Escape prefix that would defocus its TUI.
4. **Cooldown and retry** — `MAX_COMPACT_ATTEMPTS: 3`, `COMPACT_RETRY_COOLDOWN_MS: 60s`, periodic retry in `performCheck()`.
5. **Settings toggle** — `enableProactiveCompact` in GeneralSettings allows users to disable proactive compact.
6. **Comprehensive test coverage** — 1743 lines of tests covering singleton, lifecycle, parsing, thresholds, compaction, recovery, cooldown, stale detection, proactive compact.

## 3. Findings — Gaps and Issues

### GAP-1: Gemini CLI context percentage not detected (Severity: HIGH)

**Problem:** Gemini CLI displays context as token counts (e.g., `"1M context left)"`, `"500K context left)"`) in its status bar, **not** as percentages. The three regex patterns in `CONTEXT_PERCENT_PATTERNS` only match `XX% context`, `context: XX%`, and `XX% ctx` — none match Gemini's format.

**Impact:** Context window monitoring is effectively **blind** for Gemini CLI sessions. Proactive compact (byte-based) still works, but threshold-based warnings/compact at 70%/85%/95% never fire.

**Source:** `context-window-monitor.service.ts:113-117` (patterns), `gemini-runtime.service.ts:163` (Gemini uses `'context left)'` as ready pattern).

**Fix:** Add Gemini-specific patterns that parse token counts and estimate percentage, OR add a new detection path for Gemini that reads the status bar directly.

### GAP-2: No post-compact verification (Severity: MEDIUM)

**Problem:** After `triggerCompact()` sends the command, the only follow-up is a `COMPACT_WAIT_MS` (120s) timeout that clears `compactInProgress`. There is no check that context usage actually decreased.

**Impact:** If compact fails silently (e.g., runtime ignores the command), the service thinks compact worked and doesn't retry until the next threshold crossing.

**Source:** `context-window-monitor.service.ts:636-639`

**Fix:** After `COMPACT_WAIT_MS`, check the latest `contextPercent` — if still above threshold, reset compact tracking to allow immediate retry.

### GAP-3: No pre-compact agent notification (Severity: LOW)

**Problem:** When compact is triggered, the agent is not informed. The agent may be mid-operation when `/compact` arrives. Claude Code handles this gracefully (auto-saves), but Gemini/Codex behavior is less certain.

**Impact:** Potential mid-operation interruption on non-Claude runtimes.

**Fix:** For Gemini CLI, consider sending a brief notification message before `/compress`. For Claude Code and Codex, the slash command is safe at any point.

### GAP-4: Codex CLI `/compact` unverified (Severity: LOW)

**Problem:** `RUNTIME_COMPACT_COMMANDS['codex-cli'] = '/compact'` is set in constants but Codex CLI may not actually support this command.

**Impact:** Compact attempts for Codex sessions may be silently ignored.

**Source:** `constants.ts:544`

**Fix:** Verify against Codex CLI documentation. If not supported, remove the mapping and log a warning.

### GAP-5: compactInProgress not reset on failure paths (Severity: MEDIUM)

**Problem:** `triggerCompact()` sets `compactInProgress = true` and relies on a `setTimeout` to clear it after `COMPACT_WAIT_MS`. If the session is killed or monitoring stops before the timeout fires, `compactInProgress` may remain stale for a re-created session with the same name.

**Impact:** Edge case — mostly mitigated by `stopSessionMonitoring()` clearing state, but the dangling timeout could fire on stale references.

**Source:** `context-window-monitor.service.ts:615-639`

**Fix:** Store timeout references and clear them in `stopSessionMonitoring()`.

## 4. Implementation Plan

### Phase A: Fix Gemini context detection (GAP-1) — HIGH priority
- Add token-count patterns to `CONTEXT_PERCENT_PATTERNS`
- Add Gemini status bar pattern: `(\d+(?:\.\d+)?[KMB]?)\s*(?:tokens?\s+)?context\s+left`
- Estimate percentage from token count (requires knowing max context size per model)
- Alternative simpler approach: add a pattern for Gemini's `context left)` format and trigger compact when detected

### Phase B: Post-compact verification (GAP-2) — MEDIUM priority
- After `COMPACT_WAIT_MS`, check if `contextPercent` dropped below current threshold
- If not, reset `compactAttempts` to allow immediate retry
- Add a `compactSuccessful` flag to state for tracking

### Phase C: Clear dangling compact timeouts (GAP-5) — MEDIUM priority
- Store timeout handle in state
- Clear it in `stopSessionMonitoring()`

## 5. Before/After Behavior Comparison

### Before (current)
| Scenario | Claude Code | Gemini CLI | Codex CLI |
|----------|-------------|------------|-----------|
| Context % detection | Works (regex matches) | **BROKEN** (no matching pattern) | Works if output matches |
| Proactive compact (bytes) | Works (512KB threshold) | Works (512KB threshold) | Works (512KB threshold) |
| Threshold compact (70/85/95%) | Works | **Never triggers** | Works |
| Post-compact verify | None | None | None |
| Dangling timeout cleanup | None | None | None |

### After (planned)
| Scenario | Claude Code | Gemini CLI | Codex CLI |
|----------|-------------|------------|-----------|
| Context % detection | Works | **Fixed** (Gemini patterns added) | Works |
| Proactive compact (bytes) | Works | Works | Works |
| Threshold compact (70/85/95%) | Works | **Fixed** (triggers on Gemini patterns) | Works |
| Post-compact verify | **Added** | **Added** | **Added** |
| Dangling timeout cleanup | **Added** | **Added** | **Added** |

## 6. Rollback Path

All changes are additive — new regex patterns, new verification logic, new cleanup code. Rollback:
1. Revert the commit (single commit for all changes)
2. No schema/data migrations involved
3. No new dependencies
4. Existing behavior preserved for Claude Code and Codex (only Gemini behavior changes)

## 7. Test Plan

1. Add test cases for Gemini token-count pattern matching
2. Add test for post-compact verification logic
3. Add test for compact timeout cleanup on session stop
4. Run full existing test suite to verify no regressions
5. Verify `npm run build` passes
