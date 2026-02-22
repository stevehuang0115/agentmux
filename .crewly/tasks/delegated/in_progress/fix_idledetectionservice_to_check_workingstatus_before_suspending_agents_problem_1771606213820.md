# Fix IdleDetectionService to check workingStatus before suspending agents.

Problem: IdleDetectionService.performCheck() in backend/src/services/agent/idle-detection.service.ts only checks PtyActivityTracker.isIdleFor() but does NOT check the agent's workingStatus. An agent with workingStatus 'in_progress' could be falsely suspended.

Fix needed in idle-detection.service.ts performCheck() method:
1. Import ActivityMonitorService from '../monitoring/activity-monitor.service.js'
2. Before the isIdleFor check (around line 154), add a workingStatus check:
   - Call ActivityMonitorService.getInstance().getWorkingStatusForSession(member.sessionName)
   - If workingStatus is 'in_progress', skip suspension (continue to next member)
3. Update the JSDoc comment at top of class to reflect the new check: idle = PTY idle + workingStatus not in_progress
4. Update the existing test file idle-detection.service.test.ts with a new test case verifying that agents with workingStatus 'in_progress' are NOT suspended even when PTY is idle
5. Run the tests to make sure they pass: npx jest backend/src/services/agent/idle-detection.service.test.ts
6. Run npm run build to verify compilation
7. Use report-status skill when done

IMPORTANT: This is a small, focused change. Do NOT refactor other files. Only modify idle-detection.service.ts and idle-detection.service.test.ts.

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-20T16:50:13.820Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-dev-sam-217bfbbf
- **Assigned at**: 2026-02-20T16:50:13.820Z
- **Status**: In Progress

## Task Description

Fix IdleDetectionService to check workingStatus before suspending agents.

Problem: IdleDetectionService.performCheck() in backend/src/services/agent/idle-detection.service.ts only checks PtyActivityTracker.isIdleFor() but does NOT check the agent's workingStatus. An agent with workingStatus 'in_progress' could be falsely suspended.

Fix needed in idle-detection.service.ts performCheck() method:
1. Import ActivityMonitorService from '../monitoring/activity-monitor.service.js'
2. Before the isIdleFor check (around line 154), add a workingStatus check:
   - Call ActivityMonitorService.getInstance().getWorkingStatusForSession(member.sessionName)
   - If workingStatus is 'in_progress', skip suspension (continue to next member)
3. Update the JSDoc comment at top of class to reflect the new check: idle = PTY idle + workingStatus not in_progress
4. Update the existing test file idle-detection.service.test.ts with a new test case verifying that agents with workingStatus 'in_progress' are NOT suspended even when PTY is idle
5. Run the tests to make sure they pass: npx jest backend/src/services/agent/idle-detection.service.test.ts
6. Run npm run build to verify compilation
7. Use report-status skill when done

IMPORTANT: This is a small, focused change. Do NOT refactor other files. Only modify idle-detection.service.ts and idle-detection.service.test.ts.
