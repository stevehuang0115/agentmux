# Task 89: Slack and Chat Integration Issues

## Overview
Multiple interconnected issues preventing end-to-end communication via Slack and Chat UI.

## Issue 1: Slack Event Subscriptions Not Configured

### Symptoms
- `messagesReceived: 0` even after sending messages in Slack
- Messages sent FROM bot work, but messages TO bot are not received

### Root Cause
The Slack app has OAuth scopes (`im:read`, `im:history`, `im:write`) but may be missing **Event Subscriptions** for Socket Mode to receive events.

### Fix Required
In Slack App settings (api.slack.com/apps):
1. Go to **Event Subscriptions**
2. Enable Events
3. Under **Subscribe to bot events**, add:
   - `message.im` - Direct messages
   - `app_mention` - @mentions

### Files Affected
- `backend/src/services/slack/slack.service.ts` - Message handler exists
- Slack App configuration (external)

---

## Issue 2: Chat Response Loop Missing

### Symptoms
- User sends message from Chat page
- Message appears in UI as "sent"
- No response from orchestrator ever appears
- `GET /api/chat/conversations` shows `messageCount: 1` (only user message)

### Root Cause
The chat service sends messages to the orchestrator terminal, but there's no mechanism to:
1. Monitor orchestrator terminal for responses
2. Parse/extract responses from terminal output
3. Send responses back to chat UI via WebSocket

### Current Flow
```
User → Chat UI → ChatService.sendMessage() → Orchestrator Terminal
                                                     ↓
                                           (Response never captured)
```

### Required Flow
```
User → Chat UI → ChatService.sendMessage() → Orchestrator Terminal
                         ↑                           ↓
                   WebSocket ← ChatService ← Terminal Output Monitor
```

### Files Affected
- `backend/src/services/chat/chat.service.ts` - Add response monitoring
- `backend/src/websocket/terminal.gateway.ts` - Add chat response events
- Orchestrator prompt - Add response markers

---

## Issue 3: Slack Connection Not Persistent

### Symptoms
- Connection lost on every backend restart
- `[Slack] Not configured - skipping initialization` at startup
- Must manually call `/api/slack/connect` every time

### Root Cause
1. Backend doesn't load `.env` file (no `dotenv` import)
2. Even if loaded, Slack initializer checks env vars at startup but they're empty
3. Tokens entered via Settings UI are not persisted

### Fix Options
A. Add `dotenv.config()` to `backend/src/index.ts`
B. Persist Slack config to `~/.crewly/slack.json` and auto-load

### Files Affected
- `backend/src/index.ts` - Add dotenv loading
- `backend/src/services/slack/slack-initializer.ts` - Auto-initialization
- `backend/src/services/settings/settings.service.ts` - Persist Slack config

---

## Priority
1. **High**: Issue 2 (Chat Response Loop) - Core functionality broken
2. **Medium**: Issue 3 (Slack Persistence) - Requires manual reconnection
3. **Low**: Issue 1 (Slack Events) - External configuration, user can fix

## Testing Plan
1. After fixing Issue 2:
   - Send message from Chat page
   - Verify orchestrator response appears

2. After fixing Issue 3:
   - Restart backend
   - Verify Slack auto-connects

3. After user fixes Issue 1:
   - Send DM to bot in Slack
   - Verify `messagesReceived` increments
   - Verify response sent back to Slack

---
*Created: 2026-02-01*
*Updated: 2026-02-01*
*Status: Partially Complete*
*Priority: Medium*
*Notes: Issue 3 (dotenv loading) fixed in Task 87. Issue 2 (Chat response loop) fixed in Task 83. Issue 1 requires external Slack app configuration by user.*
