# Task 90: Better UX When Orchestrator is Inactive

## Problem
When the orchestrator is not active:
1. **Chat page** allows sending messages but they never get responses
2. **Slack** responds with confusing "taking longer than expected" timeout message

## User Request
1. If orchestrator is inactive, Chat page should not allow chatting (or show clear message)
2. Slack should respond with a clear message explaining the orchestrator is inactive

## Current Behavior

### Chat Page
- User can type and send messages
- Messages appear in chat but no response ever comes
- No indication that orchestrator is offline

### Slack Bridge
- User sends message
- Bridge tries to send to orchestrator
- After 30s timeout, responds: "The orchestrator is taking longer than expected. Please try again."
- This message is misleading - orchestrator isn't slow, it's not running at all

## Proposed Improvements

### 1. Chat Page - Prevent Chat When Orchestrator Inactive

**Frontend Changes:**
- Before allowing message send, check orchestrator status via `/api/teams`
- If `orchestrator.agentStatus !== 'active'`, show:
  - Disabled input field
  - Banner: "Orchestrator is not running. Start it from the Dashboard to begin chatting."
  - Link/button to start orchestrator

**Files to modify:**
- `frontend/src/pages/Chat.tsx`
- `frontend/src/components/Chat/ChatInput.tsx`
- `frontend/src/services/chat.service.ts` - Add orchestrator status check

### 2. Chat Service - Check Before Sending

**Backend Changes:**
- In `ChatService.sendMessage()`, check orchestrator status first
- Return error if orchestrator inactive: `{ success: false, error: 'orchestrator_inactive' }`

**Files to modify:**
- `backend/src/services/chat/chat.service.ts`

### 3. Slack Bridge - Clear Error Message

**Backend Changes:**
- In `SlackOrchestratorBridge.sendToOrchestrator()`, check orchestrator status first
- If inactive, immediately respond: "The orchestrator is currently offline. Please start it from the AgentMux dashboard at http://localhost:8788"

**Files to modify:**
- `backend/src/services/slack/slack-orchestrator-bridge.ts`

## Implementation

### Step 1: Add orchestrator status check helper
```typescript
// backend/src/services/orchestrator/orchestrator-status.service.ts
export async function isOrchestratorActive(): Promise<boolean> {
  const storageService = getStorageService();
  const teams = await storageService.getTeams();
  const orchestratorTeam = teams.find(t => t.id === 'orchestrator');
  const orchestrator = orchestratorTeam?.members?.[0];
  return orchestrator?.agentStatus === 'active';
}
```

### Step 2: Update Slack Bridge
```typescript
// In SlackOrchestratorBridge.sendToOrchestrator()
if (!await isOrchestratorActive()) {
  return 'The orchestrator is currently offline. Please start it from the AgentMux dashboard to enable chat functionality.';
}
```

### Step 3: Update Chat Service
```typescript
// In ChatService.sendMessage()
if (!await isOrchestratorActive()) {
  throw new Error('Orchestrator is not active. Please start the orchestrator first.');
}
```

### Step 4: Update Chat UI
```tsx
// In Chat.tsx
const [orchestratorActive, setOrchestratorActive] = useState(false);

useEffect(() => {
  checkOrchestratorStatus();
}, []);

if (!orchestratorActive) {
  return <OrchestratorOfflineBanner />;
}
```

## Testing
1. Stop orchestrator (or ensure it's inactive)
2. Try to send message from Chat page → Should see "Orchestrator offline" message
3. Try to send message from Slack → Should receive clear "offline" response
4. Start orchestrator
5. Verify Chat page enables input
6. Verify Slack messages get processed

---
*Created: 2026-02-01*
*Status: Open*
*Priority: High*
*Requested by: User*
