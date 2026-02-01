# Task 77: Fix Orchestrator Not Responding to Chat Messages

## Priority: Critical

## Problem

When sending messages through the Chat interface to the Orchestrator, no response is received. The Orchestrator appears to be running (status shows "Active") but does not respond to user messages.

### Observed Behavior
- Chat message is sent successfully (appears in chat)
- Orchestrator shows as "Active" in Teams
- No response received after 15+ seconds
- No error messages displayed
- No typing indicator or acknowledgment

### Expected Behavior
- Orchestrator should respond to messages within a few seconds
- Typing indicator should show while processing
- Response should appear in chat thread
- Error message if something goes wrong

## Root Cause Analysis

Possible issues:

### 1. WebSocket Connection Not Established
The chat may not be properly connected to the backend WebSocket.

### 2. Message Not Reaching Orchestrator Session
The backend may not be routing messages to the orchestrator terminal session.

### 3. Orchestrator Not Listening for Input
The orchestrator session may not be in a state where it accepts input.

### 4. Response Not Being Captured
The orchestrator may respond but the output isn't being captured/forwarded.

### 5. Response Format Not Parsed
The orchestrator output may not match expected patterns for extraction.

## Investigation Steps

### 1. Check WebSocket Connection

```typescript
// In browser console:
// Check if WebSocket is connected
console.log(socket.connected);

// Listen for all WebSocket events
socket.onAny((event, ...args) => {
  console.log('Socket event:', event, args);
});
```

### 2. Check Backend Logs

```bash
# View backend server logs
tail -f ~/.agentmux/logs/server.log

# Check for incoming chat messages
grep "chat" ~/.agentmux/logs/server.log
```

### 3. Test Orchestrator Session Directly

```bash
# Check if orchestrator session exists
tmux list-sessions | grep agentmux-orc

# Attach to orchestrator to see its state
tmux attach -t agentmux-orc
```

### 4. Check Chat Gateway

Review `backend/src/websocket/chat.gateway.ts`:
- Is it receiving messages?
- Is it sending to orchestrator session?
- Is it listening for responses?

### 5. Check Chat Service

Review `backend/src/services/chat/chat.service.ts`:
- Message handling logic
- Response extraction
- WebSocket event emission

## Implementation Plan

### 1. Add Debug Logging

```typescript
// In chat.gateway.ts
socket.on('chat:send', async (data) => {
  console.log('Chat gateway received message:', data);

  try {
    const result = await chatService.sendMessage(data);
    console.log('Chat service result:', result);
  } catch (error) {
    console.error('Chat gateway error:', error);
    socket.emit('chat:error', { error: error.message });
  }
});
```

### 2. Fix Message Routing

Ensure messages are properly sent to orchestrator:

```typescript
// In chat.service.ts
async sendMessage(message: ChatMessage): Promise<void> {
  // Get orchestrator session
  const orchestratorSession = sessionManager.getOrchestratorSession();

  if (!orchestratorSession) {
    throw new Error('Orchestrator not running');
  }

  // Send to terminal
  await orchestratorSession.write(message.content + '\n');

  // Emit acknowledgment
  this.emit('chat:sent', { messageId: message.id });
}
```

### 3. Fix Response Capture

Listen for orchestrator output and forward to chat:

```typescript
// In chat.gateway.ts or orchestrator integration
orchestratorSession.onOutput((data) => {
  // Parse orchestrator output
  const response = parseOrchestratorResponse(data);

  if (response) {
    socket.emit('chat:message', {
      from: { type: 'orchestrator', name: 'Orchestrator' },
      content: response,
      timestamp: new Date().toISOString(),
    });
  }
});
```

### 4. Add Connection Status

Show connection status in UI:

```tsx
const Chat: React.FC = () => {
  const { isConnected, orchestratorStatus } = useChatContext();

  return (
    <div>
      {!isConnected && (
        <div className="connection-warning">
          Not connected to server. Reconnecting...
        </div>
      )}
      {orchestratorStatus !== 'active' && (
        <div className="orchestrator-warning">
          Orchestrator is not running. Start it from Teams page.
        </div>
      )}
      {/* ... */}
    </div>
  );
};
```

## Files to Investigate

1. `backend/src/websocket/chat.gateway.ts` - Chat WebSocket handler
2. `backend/src/services/chat/chat.service.ts` - Chat service
3. `frontend/src/contexts/ChatContext.tsx` - Frontend chat state
4. `frontend/src/services/chat.service.ts` - Frontend chat API
5. `backend/src/services/session.service.ts` - Session management
6. `config/teams/prompts/orchestrator-prompt.md` - Orchestrator behavior

## Files to Modify

1. Add proper message routing to orchestrator
2. Add response capture from orchestrator
3. Add error handling and status indicators
4. Fix WebSocket event flow

## Testing Requirements

1. Send message - should appear in chat
2. Orchestrator receives message - check terminal
3. Orchestrator responds - response captured
4. Response appears in chat UI
5. Error shown if orchestrator not running
6. Connection status visible in UI
7. Typing indicator shows while processing

## Acceptance Criteria

- [ ] Messages sent from chat reach orchestrator session
- [ ] Orchestrator responses appear in chat within 5 seconds
- [ ] Error message if orchestrator is not running
- [ ] Connection status indicator in UI
- [ ] Typing/processing indicator while waiting
- [ ] No silent failures - errors always shown
- [ ] End-to-end chat flow works reliably
