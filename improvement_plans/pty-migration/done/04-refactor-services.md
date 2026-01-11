# Task: Refactor Services to Use ISessionBackend

## Priority: High
## Estimate: 3-4 days
## Dependencies: 02-pty-session-implementation

## Description
Update all services that currently use TmuxService to use the ISessionBackend abstraction.

## Files to Modify

| File | Changes |
|------|---------|
| `activity-monitor.service.ts` | Replace TmuxService with getSessionBackend() |
| `agent-registration.service.ts` | Use ISessionBackend for session checks |
| `claude-runtime.service.ts` | Use ISession for runtime detection |
| `gemini-runtime.service.ts` | Use ISession for runtime detection |
| `codex-runtime.service.ts` | Use ISession for runtime detection |
| `orchestrator.controller.ts` | Use getSessionBackend() for orchestrator |

## Implementation Pattern

### Before
```typescript
import { TmuxService } from '../agent/tmux.service.js';

const tmuxService = TmuxService.getInstance();
await tmuxService.sendMessage(sessionName, message);
const output = await tmuxService.capturePane(sessionName, 10);
const exists = await tmuxService.sessionExists(sessionName);
```

### After
```typescript
import { getSessionBackend } from '../session/index.js';

const backend = getSessionBackend();
const session = backend.getSession(sessionName);
if (session) {
  session.write(message + '\r');
}
const output = backend.captureOutput(sessionName, 10);
const exists = backend.sessionExists(sessionName);
```

## Key Changes

### Activity Monitor
```typescript
// Before
const output = await this.tmuxService.capturePane(sessionName, 50);

// After
const output = getSessionBackend().captureOutput(sessionName, 50);
```

### Agent Registration
```typescript
// Before
const exists = await this.tmuxService.sessionExists(sessionName);
await this.tmuxService.createSession(sessionName, cwd);

// After
const backend = getSessionBackend();
const exists = backend.sessionExists(sessionName);
await backend.createSession(sessionName, { cwd, command: 'claude', args: [] });
```

### Runtime Services (Claude, Gemini, Codex)
```typescript
// Before
await this.tmuxService.sendKeys(sessionName, '/');
const output = await this.tmuxService.capturePane(sessionName, 10);

// After
const session = getSessionBackend().getSession(sessionName);
if (session) {
  session.write('/');
}
const output = getSessionBackend().captureOutput(sessionName, 10);
```

### Orchestrator Controller
```typescript
// Before
await this.tmuxService.createSession(orchestratorSessionName, projectPath);

// After
await getSessionBackend().createSession(orchestratorSessionName, {
  cwd: projectPath,
  command: 'claude',
  args: [],
  env: {
    TMUX_SESSION_NAME: orchestratorSessionName,
    AGENTMUX_ROLE: 'orchestrator',
  }
});
```

## Testing Updates
- Update all mocks from TmuxService to ISessionBackend
- Ensure mock implementations match new interface
- Add tests for new factory singleton behavior

## Acceptance Criteria
- [ ] No direct TmuxService imports outside session/tmux/ folder
- [ ] All services use ISessionBackend interface
- [ ] Existing functionality preserved
- [ ] All unit tests updated and passing
- [ ] Integration tests pass
