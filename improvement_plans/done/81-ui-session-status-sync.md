# Task 81: Fix UI Session Status Synchronization

## Status: Open
## Priority: Medium
## Date: 2026-02-01

## Summary
The frontend UI does not properly reflect the actual session status of running agents. The Teams page shows agents as "Stopped/Inactive" even when they are actively running and completing tasks.

## Evidence

### Backend Shows Active:
```bash
curl -s "http://localhost:8787/api/sessions" | jq '.sessions'
# Returns:
# [
#   {"sessionName": "support-team-support-agent-c492272e", "status": "active", ...}
# ]
```

### UI Shows Stopped:
The Teams page displays "Support Agent" with:
- Status badge: "Stopped"
- Session: "Inactive"

### Agent Actually Working:
Terminal output shows agent actively fetching data and completing tasks:
```
⏺ Fetch(https://visa.careerengine.us/api/community/discussions)
  ⎿  Received 4.3KB (200 OK)
```

## Root Cause
The frontend is either:
1. Not receiving WebSocket updates about session status changes
2. Using stale data from initial load
3. Not polling for updated status

## Impact
- User confusion about agent states
- Cannot see when agents complete tasks
- Start/Stop buttons may not work correctly due to state mismatch

## Proposed Solution
1. Implement WebSocket event listeners for session status changes
2. Add polling mechanism as fallback
3. Update UI optimistically when starting/stopping teams

## Files to Modify
- `frontend/src/pages/TeamDetail.tsx` - Status display
- `frontend/src/hooks/useTeamStatus.ts` - Status polling/WebSocket
- `frontend/src/services/websocket.service.ts` - Status event handling
- `backend/src/websocket/terminal.gateway.ts` - Emit status change events

## Testing
1. Start a team via API
2. Verify UI updates to show "Started/Active"
3. Stop a team via API
4. Verify UI updates to show "Stopped/Inactive"
5. During agent execution, verify "Working" status is displayed
