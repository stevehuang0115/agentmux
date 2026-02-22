# Crewly System Bugs

Collected by Orchestrator on 2026-02-20. Last updated: 2026-02-21.

---

## Bug 1: Heartbeat Idle Detection Falsely Suspends Active Agents

**Priority:** HIGH
**Status:** ✅ Fixed (2026-02-21)
**Affected:** All agents

### Problem
The heartbeat/idle detection system incorrectly marks agents as idle and suspends them even when they are actively working. Agents receive terminal prompts like:
```
Please run your heartbeat skill now: bash config/skills/agent/heartbeat/execute.sh
```
This interrupts their workflow. Worse, the system then suspends and terminates agents that don't respond — even agents that are mid-task.

### What Was Fixed
- **Dual idle detection**: Now checks BOTH PTY idle AND API idle (`getApiIdleTimeMs()`). Only truly idle when both signals are stale.
- **No more PTY injection**: Heartbeat checks use server-side `pgrep` process inspection instead of writing to PTY input.
- **3 retries before restart**: `MAX_DEAD_CHECKS_BEFORE_RESTART = 3` — requires 3 consecutive dead checks before triggering restart.
- **IdleDetection checks workingStatus**: `idle-detection.service.ts` now skips agents with `workingStatus === 'in_progress'`.
- **PtyActivityTracker no longer WebSocket-dependent**: `ActivityMonitorService` bridges to `PtyActivityTracker` via polling even when no WebSocket clients are connected.
- **Service responsibilities separated**: IdleDetection handles resource optimization (suspend idle agents), HeartbeatMonitor handles crash recovery (restart dead agents).
- **Cooldown mechanism**: `MAX_RESTARTS_PER_WINDOW: 3`, `COOLDOWN_WINDOW_MS: 3600000` prevents restart loops.

### Files Changed
- `backend/src/services/agent/agent-heartbeat-monitor.service.ts`
- `backend/src/services/agent/idle-detection.service.ts`
- `backend/src/services/agent/pty-activity-tracker.service.ts`
- `backend/src/services/monitoring/activity-monitor.service.ts`

---

## Bug 2: Backend Code Changes Cause Crewly Restart, Killing Agent Sessions

**Priority:** HIGH
**Status:** ✅ Fixed (2026-02-21)
**Affected:** Any agent working on Crewly backend code (especially Sam)

### Problem
When an agent modifies backend TypeScript files, the Crewly server restarts (likely due to a file watcher or auto-rebuild). This kills all active PTY sessions, disconnecting all running agents.

### What Was Fixed
- **Session persistence infrastructure**: `SessionStatePersistence` saves session metadata (including Claude session IDs) to `~/.crewly/session-state.json` before shutdown.
- **Metadata restored on startup**: Startup handler loads persisted session metadata so agents can resume conversations using `--resume` flag when manually restarted.
- **Default dev script changed**: `dev:backend` now uses `npx tsx backend/src/index.ts` (no file watcher). Watch mode moved to `dev:backend:watch`.
- **Auto-restore agent sessions**: `autoRestoreAgentSessionsIfEnabled()` recreates agent PTY sessions on startup using persisted state.
- **Orchestrator auto-start**: Orchestrator session auto-starts on backend restart.

### Files Changed
- `backend/src/index.ts` (shutdown handler, startup auto-restore)
- `backend/src/services/session/pty/pty-session-backend.ts` (`forceDestroyAll()`)
- `backend/src/services/session/session-state-persistence.ts`
- `package.json` (dev scripts)

---

## Bug 3: Agents Don't Auto-Follow Init File Instructions on Startup

**Priority:** MEDIUM
**Status:** ✅ Fixed (2026-02-21)
**Affected:** Some agents (inconsistent)

### Problem
When agents start, they are given a command like:
```
Read the file at /path/to/init.md and follow all instructions in it.
```
Some agents (Joe, Zoe) read the file but then stop and ask "Should I follow these instructions?" instead of executing them. Other agents (Ella) follow them automatically.

### Root Cause
Claude Code's safety behavior treats instructions found in files as potentially untrusted (vs direct user input). The `Read file and follow instructions` pattern triggers this safety check inconsistently.

### What Was Fixed
- **Claude Code agents**: Init prompt is now sent **directly as user input** instead of asking the agent to read a file. This bypasses Claude Code's file-trust security check entirely.
- **Other runtimes** (Gemini CLI): Still use the file-read approach (Gemini CLI has workspace restrictions that require it).
- **File still written**: The init prompt file is still written to `~/.crewly/prompts/` for debugging purposes, but Claude Code agents never need to read it.

### Code Change
`agent-registration.service.ts` line 3340-3342:
```typescript
const messageToSend = isClaudeCode
    ? prompt  // Send full prompt directly as user input
    : `Read the file at ${promptFilePath} and follow all instructions in it.`;
```

### Files Changed
- `backend/src/services/agent/agent-registration.service.ts`

---

## Bug 4: CREWLY_SESSION_NAME Environment Variable Not Set in Agent PTY Sessions

**Priority:** MEDIUM
**Status:** ✅ Fixed (2026-02-21)
**Affected:** All agents

### Problem
Agent PTY sessions do not have the `CREWLY_SESSION_NAME` environment variable set. The shared skill library (`config/skills/_common/lib.sh`) references this variable on line 22. Since skill scripts use `set -u` (nounset), any skill call fails with:
```
line 22: CREWLY_SESSION_NAME: unbound variable
```

### What Was Fixed
- `agent-registration.service.ts` (line 1544-1548) now calls `sessionHelper.setEnvironmentVariable(sessionName, 'CREWLY_SESSION_NAME', sessionName)` after session creation.
- Also sets `CREWLY_ROLE` and `CREWLY_API_URL` in the same flow.
- `lib.sh` uses defensive `${CREWLY_SESSION_NAME:-}` pattern as fallback.
- Covered by unit tests and integration tests.

### Files Changed
- `backend/src/services/agent/agent-registration.service.ts`
- `backend/src/services/session/session-command-helper.ts`

---

## Bug 5: delegate-task and send-message Return 502 Even When Agent Is Active

**Priority:** MEDIUM
**Status:** ✅ Fixed (2026-02-21)
**Affected:** Orchestrator → Agent task delivery

### Problem
The `delegate-task` and `send-message` orchestrator skills return HTTP 502 with error "Failed to deliver message after multiple attempts", even when the target agent session is confirmed active and idle.

### What Was Fixed
- **New reliable endpoint**: `/terminal/:name/deliver` uses `AgentRegistrationService.sendMessageToAgent()` — 3-attempt retry with intelligent recovery.
- **Prompt detection**: Verifies agent is at prompt before sending.
- **Recovery mechanisms**: Ctrl+C on retry for Claude Code, PTY resize + Tab + Enter for Gemini CLI.
- **Progressive verification**: Checks for processing indicators (spinners), prompt detection, stuck message detection at [1s, 2s, 3s] intervals.
- **Skills updated**: Both `delegate-task/execute.sh` and `send-message/execute.sh` now call `/terminal/:name/deliver` instead of `/write`.
- **Fallback**: On final attempt, delivers directly rather than returning 502.

### Files Changed
- `backend/src/controllers/monitoring/terminal.controller.ts` (new `deliverMessage()`)
- `backend/src/services/agent/agent-registration.service.ts` (`sendMessageWithRetry()`)
- `config/skills/orchestrator/delegate-task/execute.sh`
- `config/skills/orchestrator/send-message/execute.sh`

---

## Bug 6: Heartbeat/Idle Lifecycle 架构缺陷 — 需要重构

**Priority:** HIGH
**Status:** ✅ Fixed (2026-02-21) — See Bug 1
**Affected:** All agents
**Date:** 2026-02-21

### 用户期望的 Lifecycle (正确设计)

```
Agent register
  → started → active

Terminal diff 有动静
  → workingStatus = in_progress (active)

Terminal diff 没动静
  → workingStatus = idle

API call / skills call
  → 算 heartbeat（agent 还在 Crewly 掌控中）

Idle > X 分钟 且 没有收到 heartbeat
  → 发一个 heartbeat 请求给 agent

Agent 回应了
  → 还在系统里，继续监控

3 次请求都没回应
  → 重启 agent + 立即 resume 之前的 session
```

### 修复状态（所有子问题已修复）

#### 子问题 6a: Heartbeat 请求只看 PTY，不看 API 活动 — ✅ Fixed
现在用 PTY + API 双信号判断。`getApiIdleTimeMs()` 查询 `AgentHeartbeatService.lastActiveTime`。两者都超时才算真正 idle。

#### 子问题 6b: Heartbeat 请求通过 PTY 输入注入 — ✅ Fixed
不再往 PTY 注入任何东西。改用服务端 `isChildProcessAlive()` 通过 `pgrep` 检查进程存活。

#### 子问题 6c: 重试机制不足 — ✅ Fixed
`MAX_DEAD_CHECKS_BEFORE_RESTART = 3`，需要 3 次连续死亡检测才重启。

#### 子问题 6d: IdleDetection 和 HeartbeatMonitor 冲突 — ✅ Fixed
职责分离：IdleDetection 管资源优化（suspend idle agents），HeartbeatMonitor 管崩溃恢复（restart dead agents）。IdleDetection 现在检查 workingStatus。

---

---

## Bug 7: workingStatus Shows Idle for Actively Working Agents

**Priority:** LOW
**Status:** ❌ Open
**Affected:** All agents
**Date:** 2026-02-21

### Problem
`workingStatus` always shows `idle` for all agents, even when they are actively working (e.g., Sam deploying, Zoe writing reports). The status never transitions to `in_progress`.

### Impact
- IdleDetectionService checks `workingStatus` — if it's always `idle`, agents may be incorrectly suspended while working (though dual PTY+API idle check provides a safety net).
- Dashboard shows misleading status.

### Suspected Cause
The mechanism to set `workingStatus = 'in_progress'` may not be triggered properly. Needs investigation into what triggers the status change.

---

## Bug 8: Session Write API Doesn't Trigger Agent Response

**Priority:** MEDIUM
**Status:** ❌ Open
**Affected:** Orchestrator → Agent communication
**Date:** 2026-02-21

### Problem
`POST /api/sessions/:name/write` writes text to the PTY terminal buffer but does NOT trigger the Claude Code agent to process it as user input. The text appears in the terminal input area (`❯` prompt) but Claude never responds.

In contrast, `POST /api/terminal/:name/deliver` properly delivers messages and the agent responds immediately.

### Observed Behavior
- Sent 3 messages to Zoe via `/sessions/write` — none got a response over ~15 minutes
- Switched to `/terminal/deliver` — Zoe responded within seconds
- The `/sessions/write` text was visible in the terminal buffer but Claude Code treated it as pending (unsubmitted) input

### Root Cause
`/sessions/write` likely writes raw bytes to the PTY without the proper submission sequence that Claude Code expects. The `/terminal/deliver` endpoint uses `sendMessageWithRetry()` which handles prompt detection and proper input submission.

### Workaround
Always use `POST /api/terminal/:name/deliver` for sending messages to agents. Reserve `/sessions/write` only for raw PTY operations (like sending keystrokes or control sequences).

### Files Involved
- `backend/src/controllers/monitoring/terminal.controller.ts` (both endpoints)
- `backend/src/services/agent/agent-registration.service.ts` (`sendMessageWithRetry`)

---

## Bug 9: GEMINI_API_KEY Leaked and Disabled by Google

**Priority:** CRITICAL (Security)
**Status:** ⚠️ Partially Fixed (2026-02-21)
**Affected:** nano-banana-image skill, any Gemini API calls
**Date:** 2026-02-21

### Problem
When Zoe attempted to call `nano-banana-image/generate.sh --pro`, the Gemini API returned:
```
Your API key was reported as leaked. Please use another API key.
```
Google has disabled the key. This blocks all Gemini image generation.

### Root Cause
`package.json` `files` field included `"config/"` which whitelisted the entire config directory for npm packaging. `.npmignore` patterns were ignored because `files` takes precedence. This caused `config/skills/agent/nano-banana-image/.env` and `config/skills/nano-banana-image/.env` (containing the real API key) to be published to npmjs on every `npm publish`. Google/npm security scanners detected and revoked the key.

### Fix Applied
Added negation patterns to `package.json` `files` array:
```json
"!config/**/.env",
"!config/**/.env.*",
"!config/**/*.test.ts"
```
Verified with `npm pack --dry-run` — zero `.env` files in package.

### Still Required
1. Generate a new `GEMINI_API_KEY` at https://aistudio.google.com/apikey
2. Update the key in `.env` files and shell environment
3. Verify old key is fully revoked

---

## Bug 10: Runtime Exit Monitor Orphans In-Progress Tasks

**Priority:** HIGH
**Status:** ❌ Open
**Affected:** All agents
**Date:** 2026-02-21

### Problem
When a Claude Code process exits (e.g., context window exhausted, crash, or natural completion), `RuntimeExitMonitorService` immediately sets the agent status to `inactive` without checking if the agent has in-progress tasks. This orphans those tasks permanently.

### Observed Behavior
- Joe received a Formspree task, his Claude Code process exited (likely context ran out)
- `runtime-exit-monitor.service.ts` detected shell prompt → set status to `inactive`
- Joe's Formspree task remained `in_progress` but with no agent working on it
- Heartbeat monitor skipped Joe because he was already `inactive` (line 246: `if (member.agentStatus !== 'active') continue`)

### Root Cause
`runtime-exit-monitor.service.ts` line 290-296 — `confirmAndReact()` sets status to inactive unconditionally:
```typescript
await storageService.updateAgentStatus(
    sessionName,
    CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE  // No task check!
);
```

### Expected Behavior
Before setting inactive, the service should:
1. Query `TaskTrackingService` for in-progress tasks assigned to this agent
2. If tasks exist → restart agent with `--resume` and re-deliver tasks (like `HeartbeatMonitorService.restartAgent()` does)
3. If no tasks → set to inactive (current behavior)

### Files Involved
- `backend/src/services/agent/runtime-exit-monitor.service.ts` (`confirmAndReact()`)
- `backend/src/services/agent/agent-heartbeat-monitor.service.ts` (has the restart + re-deliver logic that should be reused)

---

## Summary

| # | Bug | Priority | Status |
|---|-----|----------|--------|
| 1 | Heartbeat falsely suspends active agents | HIGH | ✅ Fixed |
| 2 | Backend code changes restart server, kill sessions | HIGH | ✅ Fixed |
| 3 | Agents don't auto-follow init instructions | MEDIUM | ✅ Fixed |
| 4 | CREWLY_SESSION_NAME not set in PTY env | MEDIUM | ✅ Fixed |
| 5 | delegate-task / send-message 502 delivery failure | MEDIUM | ✅ Fixed |
| 6 | Heartbeat lifecycle 架构缺陷 | HIGH | ✅ Fixed |
| 7 | workingStatus always shows idle | LOW | ❌ Open |
| 8 | Session write API doesn't trigger agent response | MEDIUM | ❌ Open |
| 9 | GEMINI_API_KEY leaked and disabled | CRITICAL | ⚠️ Partially Fixed |
| 10 | Runtime exit orphans in-progress tasks | HIGH | ❌ Open |
