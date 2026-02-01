# Task 66: Chat-Orchestrator Connection

## Overview

Connect the Chat UI to the orchestrator so that messages sent in the dashboard get responses from the orchestrator.

## Problem

- Chat UI sends messages successfully (message appears in UI)
- Orchestrator does not receive or respond to messages
- WebSocket events may not be properly bridged to orchestrator

## Current Flow (Broken)

```
User → Chat UI → WebSocket → ??? → Orchestrator
                           ↑
                     (broken link)
```

## Expected Flow

```
User → Chat UI → WebSocket → Chat Service → Orchestrator Terminal → Response
                                                    ↓
User ← Chat UI ← WebSocket ← Chat Service ← Orchestrator Terminal ←
```

## Implementation

### 1. Verify WebSocket Chat Events

Check `backend/src/websocket/terminal.gateway.ts` handles chat messages:

```typescript
socket.on('chat_message', async (data: { conversationId: string; content: string }) => {
  try {
    // Save message to chat service
    const chatService = getChatService();
    const message = await chatService.saveMessage({
      conversationId: data.conversationId,
      from: { type: 'user', name: 'User' },
      content: data.content,
      contentType: 'text',
    });

    // Forward to orchestrator
    await forwardToOrchestrator(data.content, data.conversationId);

    // Acknowledge receipt
    socket.emit('chat_message_sent', { messageId: message.id });
  } catch (error) {
    socket.emit('chat_error', { error: 'Failed to send message' });
  }
});
```

### 2. Forward Messages to Orchestrator

```typescript
async function forwardToOrchestrator(content: string, conversationId: string): Promise<void> {
  const orchestratorSession = getOrchestratorSession();

  if (!orchestratorSession || orchestratorSession.status !== 'active') {
    // Try to start orchestrator or return error
    throw new Error('Orchestrator is not running');
  }

  // Write to orchestrator's terminal (stdin)
  orchestratorSession.terminal.write(content + '\n');

  // Set up listener for response
  orchestratorSession.terminal.onData((data: string) => {
    // Parse response markers
    const chatResponse = extractChatResponse(data);
    if (chatResponse) {
      // Save and broadcast response
      const chatService = getChatService();
      chatService.saveMessage({
        conversationId,
        from: { type: 'orchestrator', name: 'Orchestrator' },
        content: chatResponse,
        contentType: 'text',
      });

      // Emit to all connected clients
      io.emit('chat_message', {
        conversationId,
        from: { type: 'orchestrator' },
        content: chatResponse,
      });
    }
  });
}
```

### 3. Extract Chat Responses from Terminal Output

```typescript
/**
 * Extract chat response from terminal output
 * Looks for [CHAT_RESPONSE]...[/CHAT_RESPONSE] markers
 */
function extractChatResponse(output: string): string | null {
  // Check for explicit markers
  const markerMatch = output.match(/\[CHAT_RESPONSE\]([\s\S]*?)\[\/CHAT_RESPONSE\]/);
  if (markerMatch) {
    return markerMatch[1].trim();
  }

  // Check for markdown code block format
  const codeBlockMatch = output.match(/```response\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Check for quote-style response
  const quoteMatch = output.match(/^>\s*(.+)$/m);
  if (quoteMatch) {
    return quoteMatch[1].trim();
  }

  return null;
}
```

### 4. Update Frontend Chat Context

Ensure `frontend/src/contexts/ChatContext.tsx` listens for responses:

```typescript
useEffect(() => {
  const socket = getSocket();

  // Listen for orchestrator responses
  socket.on('chat_message', (message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  });

  // Listen for errors
  socket.on('chat_error', (error: { error: string }) => {
    setError(error.error);
  });

  return () => {
    socket.off('chat_message');
    socket.off('chat_error');
  };
}, []);
```

### 5. Add Auto-Start Orchestrator Option

If orchestrator is not running, offer to start it:

```typescript
// In ChatPanel
const sendMessage = async (content: string) => {
  try {
    await chatService.sendMessage(conversationId, content);
  } catch (error) {
    if (error.message === 'Orchestrator is not running') {
      // Show prompt to start orchestrator
      setShowOrchestratorPrompt(true);
    }
  }
};
```

## Files to Modify

| File | Action |
|------|--------|
| `backend/src/websocket/terminal.gateway.ts` | Add chat message handling |
| `backend/src/services/chat/chat.service.ts` | Add orchestrator forwarding |
| `frontend/src/contexts/ChatContext.tsx` | Listen for responses |
| `frontend/src/components/Chat/ChatPanel.tsx` | Handle orchestrator status |

## Testing

1. Start orchestrator manually via CLI or API
2. Send message in Chat UI
3. Verify message reaches orchestrator terminal
4. Verify response is captured and displayed

```bash
# Manual test
curl -X POST http://localhost:8787/api/chat/send \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "test", "content": "Hello"}'
```

## Acceptance Criteria

- [ ] Chat messages reach orchestrator
- [ ] Orchestrator responses appear in Chat UI
- [ ] Response markers are properly parsed
- [ ] WebSocket connection is stable
- [ ] Error handling for orchestrator not running
- [ ] Typing indicator shows while waiting for response

## Dependencies

- Task 31: Chat Types & Service
- Task 32: Chat Controller & WebSocket
- Task 63: Orchestrator Setup Endpoint

## Priority

**Critical** - Core chat functionality
