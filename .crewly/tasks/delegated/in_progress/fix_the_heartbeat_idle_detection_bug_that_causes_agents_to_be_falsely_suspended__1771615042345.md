# Fix the heartbeat/idle detection bug that causes agents to be falsely suspended while actively working.

PROBLEM:
1. Heartbeat prompt ('Please run your heartbeat skill now') still appears in agent terminals, interrupting their workflow
2. Agents get suspended/terminated while they are actively working on tasks
3. The idle detection doesn't properly check if an agent has a real task running

REQUIREMENTS:
1. IdleDetection should check workingStatus — if 'in_progress', the agent is NOT idle regardless of other signals
2. Only consider an agent truly idle if: terminal log diff shows no change for 5+ minutes AND no API activity AND workingStatus is not 'in_progress'
3. PtyActivityTracker should not depend on WebSocket connections — it should hook into session creation directly
4. The heartbeat prompt should NEVER be injected into an agent's terminal if the agent is actively working

RELEVANT FILES (in backend/src/services/agent/):
- idle-detection.service.ts
- pty-activity-tracker.service.ts
- agent-heartbeat.service.ts
- agent-heartbeat-monitor.service.ts
- agent-suspend.service.ts

ALSO CHECK:
- backend/src/services/monitoring/activity-monitor.service.ts

IMPORTANT:
- Do NOT commit to git
- Write tests for any changes
- Use report-status skill when done: bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-20T19:17:22.345Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-dev-sam-217bfbbf
- **Assigned at**: 2026-02-20T19:17:22.345Z
- **Status**: In Progress

## Task Description

Fix the heartbeat/idle detection bug that causes agents to be falsely suspended while actively working.

PROBLEM:
1. Heartbeat prompt ('Please run your heartbeat skill now') still appears in agent terminals, interrupting their workflow
2. Agents get suspended/terminated while they are actively working on tasks
3. The idle detection doesn't properly check if an agent has a real task running

REQUIREMENTS:
1. IdleDetection should check workingStatus — if 'in_progress', the agent is NOT idle regardless of other signals
2. Only consider an agent truly idle if: terminal log diff shows no change for 5+ minutes AND no API activity AND workingStatus is not 'in_progress'
3. PtyActivityTracker should not depend on WebSocket connections — it should hook into session creation directly
4. The heartbeat prompt should NEVER be injected into an agent's terminal if the agent is actively working

RELEVANT FILES (in backend/src/services/agent/):
- idle-detection.service.ts
- pty-activity-tracker.service.ts
- agent-heartbeat.service.ts
- agent-heartbeat-monitor.service.ts
- agent-suspend.service.ts

ALSO CHECK:
- backend/src/services/monitoring/activity-monitor.service.ts

IMPORTANT:
- Do NOT commit to git
- Write tests for any changes
- Use report-status skill when done: bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'
