# Task: Update WebSocket Gateway for Event-Based Streaming

## Priority: Medium
## Estimate: 2 days
## Dependencies: 04-refactor-services

## Description
Update TerminalGateway to use event-based streaming from PTY instead of polling.

## Files to Modify
- `backend/src/websocket/terminal.gateway.ts`

## Implementation Details

### Before (Polling)
```typescript
// Old: Poll tmux capture-pane every 3 seconds
private startOutputStreaming(sessionName: string): void {
  const interval = setInterval(async () => {
    const output = await this.tmuxService.capturePane(sessionName, 10);
    this.broadcast(sessionName, output);
  }, 3000);
  this.streamingIntervals.set(sessionName, interval);
}
```

### After (Event-Based)
```typescript
import { getSessionBackend } from '../services/session/index.js';

export class TerminalGateway {
  private subscriptions: Map<string, () => void> = new Map();

  subscribeToSession(sessionName: string): void {
    // Avoid duplicate subscriptions
    if (this.subscriptions.has(sessionName)) return;

    const session = getSessionBackend().getSession(sessionName);
    if (!session) {
      this.logger.warn(`Session ${sessionName} not found for subscription`);
      return;
    }

    const unsubscribe = session.onData(data => {
      this.broadcastToRoom(sessionName, {
        type: 'terminal_output',
        sessionName,
        data,
        timestamp: Date.now(),
      });
    });

    this.subscriptions.set(sessionName, unsubscribe);
    this.logger.info(`Subscribed to session ${sessionName} output`);
  }

  unsubscribeFromSession(sessionName: string): void {
    const unsubscribe = this.subscriptions.get(sessionName);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(sessionName);
      this.logger.info(`Unsubscribed from session ${sessionName}`);
    }
  }

  // Called when client connects and wants to see a session
  handleClientJoin(clientId: string, sessionName: string): void {
    // Join the room for this session
    this.joinRoom(clientId, `terminal_${sessionName}`);

    // Start streaming if not already
    this.subscribeToSession(sessionName);

    // Send initial buffer content for session restore
    const backend = getSessionBackend();
    const initialContent = backend.captureOutput(sessionName, 500);
    this.sendToClient(clientId, {
      type: 'terminal_restore',
      sessionName,
      data: initialContent,
    });
  }

  // Called when client disconnects or leaves session view
  handleClientLeave(clientId: string, sessionName: string): void {
    this.leaveRoom(clientId, `terminal_${sessionName}`);

    // If no more clients watching this session, unsubscribe
    const room = this.getRoom(`terminal_${sessionName}`);
    if (room.size === 0) {
      this.unsubscribeFromSession(sessionName);
    }
  }

  // Cleanup on shutdown
  destroy(): void {
    for (const unsubscribe of this.subscriptions.values()) {
      unsubscribe();
    }
    this.subscriptions.clear();
  }
}
```

### WebSocket Message Types
```typescript
interface TerminalOutputMessage {
  type: 'terminal_output';
  sessionName: string;
  data: string;
  timestamp: number;
}

interface TerminalRestoreMessage {
  type: 'terminal_restore';
  sessionName: string;
  data: string;
}

interface TerminalInputMessage {
  type: 'terminal_input';
  sessionName: string;
  data: string;
}
```

### Handle Input from Client
```typescript
handleTerminalInput(sessionName: string, input: string): void {
  const session = getSessionBackend().getSession(sessionName);
  if (session) {
    session.write(input);
  }
}
```

## Benefits
- Real-time character-by-character output
- No polling overhead
- Lower latency
- Initial buffer replay for session restore

## Acceptance Criteria
- [ ] WebSocket streams real-time output
- [ ] Initial content sent on client join
- [ ] Proper cleanup on client disconnect
- [ ] No memory leaks from subscriptions
- [ ] Backward compatible with existing frontend
- [ ] Input from client delivered to PTY
