# Fix the heartbeat/idle detection bug that causes agents to be falsely suspended while actively working.

BACKGROUND:
- Heartbeat prompts ('Please run your heartbeat skill now') are being injected into agent terminals while agents are actively working
- Agents get suspended/terminated while actively receiving tasks (e.g. Mia was suspended mid-task)
- The user wants: only truly idle agents (5+ minutes with NO terminal activity) should receive heartbeat prompts

KNOWN ISSUES (from previous analysis):
1. ActivityMonitor — compares terminal output diff every 2 min (this part works)
2. PtyActivityTracker — only records activity when someone views the UI via WebSocket (BUG - should track independently)
3. IdleDetection — does NOT check workingStatus field (BUG - should skip agents with workingStatus='in_progress')
4. These three systems don't communicate with each other

REQUIRED FIXES:
1. IdleDetection must check workingStatus: if workingStatus='in_progress', the agent is NOT idle regardless of other signals
2. PtyActivityTracker must decouple from WebSocket — hook into PTY session creation directly so it tracks activity even when no one is watching the UI
3. Merge idle signals: terminal diff must show no change for 5+ minutes AND no API activity before considering an agent truly idle
4. Only after confirmed idle 5+ min should heartbeat prompts be sent

FILES TO INVESTIGATE:
- backend/src/services/agent/idle-detection.service.ts
- backend/src/services/agent/pty-activity-tracker.service.ts
- backend/src/services/monitoring/activity-monitor.service.ts
- backend/src/services/agent/agent-heartbeat.service.ts
- backend/src/services/agent/agent-heartbeat-monitor.service.ts

IMPORTANT:
- Do NOT commit to git
- Write tests for all changes (co-located .test.ts files)
- Make sure npm run build passes after changes
- Use report-status skill when done: bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-20T19:39:21.248Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-dev-sam-217bfbbf
- **Assigned at**: 2026-02-20T19:39:21.248Z
- **Status**: In Progress

## Task Description

Fix the heartbeat/idle detection bug that causes agents to be falsely suspended while actively working.

BACKGROUND:
- Heartbeat prompts ('Please run your heartbeat skill now') are being injected into agent terminals while agents are actively working
- Agents get suspended/terminated while actively receiving tasks (e.g. Mia was suspended mid-task)
- The user wants: only truly idle agents (5+ minutes with NO terminal activity) should receive heartbeat prompts

KNOWN ISSUES (from previous analysis):
1. ActivityMonitor — compares terminal output diff every 2 min (this part works)
2. PtyActivityTracker — only records activity when someone views the UI via WebSocket (BUG - should track independently)
3. IdleDetection — does NOT check workingStatus field (BUG - should skip agents with workingStatus='in_progress')
4. These three systems don't communicate with each other

REQUIRED FIXES:
1. IdleDetection must check workingStatus: if workingStatus='in_progress', the agent is NOT idle regardless of other signals
2. PtyActivityTracker must decouple from WebSocket — hook into PTY session creation directly so it tracks activity even when no one is watching the UI
3. Merge idle signals: terminal diff must show no change for 5+ minutes AND no API activity before considering an agent truly idle
4. Only after confirmed idle 5+ min should heartbeat prompts be sent

FILES TO INVESTIGATE:
- backend/src/services/agent/idle-detection.service.ts
- backend/src/services/agent/pty-activity-tracker.service.ts
- backend/src/services/monitoring/activity-monitor.service.ts
- backend/src/services/agent/agent-heartbeat.service.ts
- backend/src/services/agent/agent-heartbeat-monitor.service.ts

IMPORTANT:
- Do NOT commit to git
- Write tests for all changes (co-located .test.ts files)
- Make sure npm run build passes after changes
- Use report-status skill when done: bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'
