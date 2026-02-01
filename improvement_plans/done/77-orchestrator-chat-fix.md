# Task 77: Fix Orchestrator Not Processing Chat Messages

## Priority: CRITICAL

## Problem Statement
The orchestrator does not process messages sent via the Chat interface. Messages are forwarded to Claude Code but not submitted/executed.

## Root Cause Analysis

### Findings from Testing:
1. **Orchestrator session is running**: Health check shows `"running": true, "status": "active"`
2. **Claude Code is running**: Terminal shows Claude Code v2.1.29 is active
3. **Messages ARE being forwarded**: API response shows `"orchestrator":{"forwarded":true}`
4. **Messages ARE being pasted**: Terminal shows `[Pasted text #1 +37 lines]`
5. **THE BUG**: Message is pasted but NOT SUBMITTED - Claude Code is still waiting at the `❯` prompt

### Terminal Evidence:
```
❯ [Pasted text #1 +37 lines][CHAT:6e629a9f-a696-422e-8150-282221431fcd] Please
  assign a task to Support Agent: Visit visa.careerengine.us and check what
  people are commenting on the community page.

────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle)
```

The message was pasted, but Claude Code is STILL showing the input prompt (`❯`), waiting for submission.

## Root Cause
The `sendMessageToAgent` function pastes the message text but does NOT send an Enter/Return key to submit it. Claude Code receives the text as pasted input but waits for the user to press Enter to execute.

## Solution Required
After pasting the message, send an Enter key to submit it:

```typescript
// In sendMessageToAgent or equivalent
await sendKeys(sessionName, messageText);
await sendKeys(sessionName, '\n');  // or 'Enter' key
```

Or use tmux send-keys with Enter:
```bash
tmux send-keys -t sessionName "message text" Enter
```

## Files to Modify
- `backend/src/services/agent/agent-registration.service.ts` - `sendMessageToAgent()` method
- Check how tmux send-keys is being called

## Impact
This blocks ALL orchestrator interaction:
- Cannot assign tasks via chat
- Cannot manage projects conversationally
- Core orchestrator functionality is broken

## Testing After Fix
1. Setup orchestrator: `curl -X POST http://localhost:8787/api/orchestrator/setup`
2. Go to Chat page
3. Send: "Hello, please respond"
4. Verify Claude Code receives AND processes the message
5. Verify response appears in chat UI
