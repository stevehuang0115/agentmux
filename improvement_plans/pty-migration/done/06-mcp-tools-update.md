# Task: Update MCP Server Tools for PTY Backend

## Priority: High
## Estimate: 2 days
## Dependencies: 04-refactor-services

## Description
Update all MCP tools to work with the new ISessionBackend. Since MCP server runs in a separate process, it communicates with the backend via HTTP API.

## Files to Modify
- `mcp-server/src/server.ts`
- `backend/src/controllers/monitoring/terminal.controller.ts` (add new endpoints)

## Backend API Updates

### New/Updated Endpoints
```typescript
// terminal.controller.ts

// Send input to session
POST /api/terminal/:sessionName/write
Body: { data: string }

// Check if session exists
GET /api/terminal/:sessionName/exists

// Get session output
GET /api/terminal/:sessionName/output?lines=50

// Kill session
DELETE /api/terminal/:sessionName

// List all sessions
GET /api/terminal/sessions
```

## MCP Tool Updates

### send_message
```typescript
// Before
await tmuxService.sendMessage(to, message);

// After
async function sendMessage(to: string, message: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/terminal/${to}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: message + '\r' }),
  });
  if (!response.ok) {
    throw new Error(`Failed to send message to ${to}`);
  }
}
```

### broadcast
```typescript
// Before
const sessions = await tmuxService.listSessions();

// After
async function broadcast(message: string, excludeSelf?: boolean): Promise<number> {
  const response = await fetch(`${BACKEND_URL}/api/terminal/sessions`);
  const { sessions } = await response.json();

  let sent = 0;
  for (const sessionName of sessions) {
    if (excludeSelf && sessionName === currentSession) continue;
    await sendMessage(sessionName, message);
    sent++;
  }
  return sent;
}
```

### get_agent_logs
```typescript
// Before
const output = await tmuxService.capturePane(sessionName, lines);

// After
async function getAgentLogs(sessionName: string, lines = 50): Promise<string> {
  const response = await fetch(
    `${BACKEND_URL}/api/terminal/${sessionName}/output?lines=${lines}`
  );
  const { output } = await response.json();
  return output;
}
```

### get_agent_status
```typescript
// Before
const exists = await tmuxService.sessionExists(sessionName);

// After
async function sessionExists(sessionName: string): Promise<boolean> {
  const response = await fetch(
    `${BACKEND_URL}/api/terminal/${sessionName}/exists`
  );
  const { exists } = await response.json();
  return exists;
}
```

### terminate_agent
```typescript
// Before
await tmuxService.killSession(sessionName);

// After
async function terminateAgent(sessionName: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/terminal/${sessionName}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to terminate ${sessionName}`);
  }
}
```

## Backend Controller Implementation

```typescript
// terminal.controller.ts
import { getSessionBackend } from '../services/session/index.js';

export class TerminalController {
  // POST /api/terminal/:sessionName/write
  async writeToSession(req: Request, res: Response): Promise<void> {
    const { sessionName } = req.params;
    const { data } = req.body;

    const session = getSessionBackend().getSession(sessionName);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    session.write(data);
    res.json({ success: true });
  }

  // GET /api/terminal/:sessionName/exists
  async sessionExists(req: Request, res: Response): Promise<void> {
    const { sessionName } = req.params;
    const exists = getSessionBackend().sessionExists(sessionName);
    res.json({ exists });
  }

  // GET /api/terminal/:sessionName/output
  async getOutput(req: Request, res: Response): Promise<void> {
    const { sessionName } = req.params;
    const lines = parseInt(req.query.lines as string) || 50;

    const output = getSessionBackend().captureOutput(sessionName, lines);
    res.json({ output });
  }

  // DELETE /api/terminal/:sessionName
  async killSession(req: Request, res: Response): Promise<void> {
    const { sessionName } = req.params;
    await getSessionBackend().killSession(sessionName);
    res.json({ success: true });
  }

  // GET /api/terminal/sessions
  async listSessions(req: Request, res: Response): Promise<void> {
    const sessions = getSessionBackend().listSessions();
    res.json({ sessions });
  }
}
```

## Acceptance Criteria
- [ ] All MCP tools work with PTY backend
- [ ] send_message delivers instantly (no timing delays)
- [ ] get_agent_logs returns real-time buffer
- [ ] terminate_agent properly kills PTY process
- [ ] broadcast sends to all sessions
- [ ] Error handling for missing sessions
