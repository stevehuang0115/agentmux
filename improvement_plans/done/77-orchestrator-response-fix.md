# Task 77: Fix Orchestrator Not Responding to Chat Messages

## Priority: CRITICAL

## Problem Statement
The orchestrator does not respond to messages sent via the Chat interface. Messages are sent and displayed in the chat, but no responses come back from the orchestrator.

## Root Cause Analysis (Discovered during testing)

### Findings:
1. **Orchestrator session is running**: Health check confirms `"running": true, "status": "active"`
2. **Claude Code is running**: Terminal output shows Claude Code v2.1.29 is active in the orchestrator session
3. **Messages are being forwarded**: API response shows `"orchestrator":{"forwarded":true}`
4. **THE BUG**: Messages are being **displayed** in the terminal but **NOT sent to Claude Code's stdin**

### Evidence from terminal output:
```
❯ [CHAT:91c88d9f-cd13-4904-b7bb-07ac07af68e5] Test message from API

────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle)
```

The message appears as terminal output, but Claude Code is still waiting at the input prompt (`❯`). The message was echoed/displayed but never actually sent to the Claude Code process as user input.

### Technical Details:
- Location: `backend/src/services/agent/agent-registration.service.ts` - `sendMessageToAgent()` method
- The method likely writes to the terminal display (pty) but doesn't properly send input to the underlying process
- Need to investigate how tmux panes/windows receive input vs display output

## Solution Requirements

1. **Fix message forwarding**: Ensure messages sent via `sendMessageToAgent()` are delivered to Claude Code's stdin, not just displayed
2. **Verify input method**: Check if using `tmux send-keys` properly or if there's a pty input issue
3. **Response capture**: Implement mechanism to capture Claude Code's response and forward back to chat
4. **Add response markers**: Consider adding response markers for the orchestrator to use (e.g., `[CHAT_RESPONSE]...[/CHAT_RESPONSE]`)

## Additional Notes

### Orchestrator Setup
- Orchestrator cannot be started from the UI Team page
- Shows error: "Orchestrator is managed at system level. Use /orchestrator/setup endpoint instead."
- Must call: `POST /api/orchestrator/setup` to initialize the orchestrator

### Current Flow (Broken)
1. User sends message in Chat UI
2. Frontend calls `POST /api/chat/send`
3. Backend saves message and calls `forwardToOrchestrator()`
4. `agentRegistrationService.sendMessageToAgent()` is called
5. Message appears in terminal display BUT NOT sent to Claude Code input
6. Claude Code never receives the message, never responds
7. User sees no response in chat

### Expected Flow (After Fix)
1. User sends message in Chat UI
2. Frontend calls `POST /api/chat/send`
3. Backend saves message and calls `forwardToOrchestrator()`
4. Message is properly sent to Claude Code's stdin via tmux
5. Claude Code processes message and generates response
6. Response is captured (via output parsing or markers)
7. Response is sent back to chat via WebSocket
8. User sees orchestrator's response in chat

## Files to Investigate/Modify
- `backend/src/services/agent/agent-registration.service.ts`
- `backend/src/services/terminal/terminal-manager.service.ts`
- `backend/src/websocket/terminal.gateway.ts`
- `backend/src/controllers/chat/chat.controller.ts`

## Testing Steps
1. Start the application
2. Setup orchestrator: `curl -X POST http://localhost:8787/api/orchestrator/setup`
3. Go to Chat page
4. Send a message
5. Verify message appears in orchestrator terminal as actual INPUT (not just display)
6. Verify Claude Code processes and responds
7. Verify response appears in chat UI
