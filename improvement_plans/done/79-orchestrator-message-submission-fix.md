# Task 79: Fix Message Submission to Non-Orchestrator Agents

## Status: Open
## Priority: Critical
## Date: 2026-02-01

## Summary
When the orchestrator sends messages to other agents (e.g., Support Agent), the messages are pasted into the terminal but the Enter key is not properly sent to submit the input. This requires manual intervention to trigger message processing.

## Root Cause Analysis
The issue occurs in the message delivery flow when the orchestrator uses the MCP endpoint to send messages to other agents:

1. **Orchestrator to Backend**: Works correctly - message is delivered
2. **Backend sendMessageToAgent()**: The code at `backend/src/services/agent/agent-registration.service.ts` line 1289 appears to send Enter, but verification shows the message remains in the input buffer
3. **Session sendMessage()**: The code at `backend/src/services/session/session-command-helper.ts` line 99-120 writes the message then `\r` (Enter), but Enter is not being received by Claude Code

## Evidence from Testing

### Terminal Output Before Manual Fix:
```
❯ Please immediately run: register_agent_status with parameters {"role":
  "support", "sessionName": "support-team-support-agent-c492272e"}
  [TASK:ef3d1763-c6aa-46c8-b173-970cbd0118d3] Please visit
  https://visa.careerengine.us and check what people are commenting...
────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle)
```

The `❯` prompt shows with message text, indicating Claude Code received the paste but is waiting for Enter to submit.

### After Manual Enter via API:
```bash
curl -s -X POST "http://localhost:8787/api/sessions/support-team-support-agent-c492272e/write" \
  -H "Content-Type: application/json" -d '{"data": "\r"}'
```
The agent immediately started processing and completed its task successfully.

## Proposed Solution
Investigate and fix the timing between message paste and Enter key submission:

1. **Option A**: Increase `MESSAGE_DELAY` in `SESSION_COMMAND_DELAYS` (currently 100ms) to allow more time for paste to complete before Enter
2. **Option B**: Add explicit verification that Enter was received before returning success
3. **Option C**: Send Enter key separately after a longer delay for multi-line messages

## Files to Modify
- `backend/src/services/session/session-command-helper.ts` - sendMessage function
- `backend/src/constants.ts` - SESSION_COMMAND_DELAYS values
- `backend/src/services/agent/agent-registration.service.ts` - sendMessageWithRetry verification logic

## Testing
1. Start orchestrator and Support Team
2. Send chat message to orchestrator to assign task
3. Verify Support Agent receives AND processes the message without manual intervention
4. Check terminal shows Claude Code responding (not waiting at prompt)

## Related Issues
- The orchestrator itself works correctly when receiving messages via chat API
- Only downstream agent communication is affected
