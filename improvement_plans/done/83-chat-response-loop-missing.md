# Task 83: Implement Chat Response Loop (Orchestrator → User)

## Status: Open
## Priority: Critical
## Date: 2026-02-01

## Summary
The chat system only supports one-way communication (User → Orchestrator). There is no mechanism for the orchestrator or agents to send responses back to the chat UI. Users send messages but never see replies.

## Current Behavior
1. User sends message via Chat UI
2. Message is forwarded to orchestrator terminal
3. Orchestrator processes and may assign tasks to agents
4. Agents complete tasks
5. **DEAD END** - No response appears in Chat UI

## Evidence
Chat UI shows:
- 1 message from "You" sent 9 minutes ago
- No response from orchestrator
- No task completion report from Support Agent

Meanwhile, terminal output (via API) shows orchestrator and agent both completed their work.

## Missing Components

### 1. Response Detection
Need to detect when Claude Code outputs a response meant for the user. Options:
- Parse terminal output for `[RESPONSE]...[/RESPONSE]` markers
- Detect specific output patterns indicating task completion
- Use structured output format from Claude Code

### 2. Response Routing
Need to route detected responses back to chat:
- Orchestrator responses → Chat with conversation context
- Agent task results → Orchestrator → Chat

### 3. Chat Message Creation
Need to create chat messages from agent/orchestrator:
- `POST /api/chat/messages` with `from.type: 'orchestrator'` or `from.type: 'agent'`
- Include conversation ID to maintain context

## Proposed Architecture

```
User → Chat UI → Backend → Orchestrator Terminal
                    ↑              ↓
                    ↑       (Response Detection)
                    ↑              ↓
               Chat UI ← Backend ← Parsed Response
```

### Implementation Options

**Option A: Terminal Output Polling**
- Backend polls orchestrator terminal for new output
- Parse for response markers
- Create chat messages when responses detected

**Option B: Explicit MCP Tool**
- Add `send_chat_response` MCP tool
- Orchestrator calls tool to send responses
- Backend creates chat message directly

**Option C: WebSocket Bridge**
- Stream terminal output via WebSocket
- Frontend parses and displays responses
- Less structured but shows real-time output

## Files to Create/Modify
- `backend/src/services/chat/response-detector.service.ts` - Parse terminal for responses
- `backend/src/services/chat/chat.service.ts` - Add `createAgentMessage()` method
- `mcp-server/src/tools/send-chat-response.ts` - MCP tool for sending responses
- `config/orchestrator_tasks/prompts/orchestrator-prompt.md` - Add instructions to use response markers

## Acceptance Criteria
1. User sends chat message
2. Orchestrator receives and processes
3. Orchestrator's response appears in Chat UI
4. When agent completes task, summary appears in Chat UI
5. All messages maintain conversation context

## Testing
1. Send "Hello" to orchestrator
2. Expect response like "Hello! I'm the orchestrator..." in Chat UI
3. Send task assignment request
4. Expect task confirmation in Chat UI
5. When task completes, expect results summary in Chat UI
