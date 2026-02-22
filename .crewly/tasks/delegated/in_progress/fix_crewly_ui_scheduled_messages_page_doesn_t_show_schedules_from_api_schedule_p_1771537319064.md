# Fix: Crewly UI 'Scheduled Messages' page doesn't show schedules from /api/schedule.

Problem:
- The orchestrator's schedule-check skill creates recurring schedules via POST /api/schedule (stored in the schedule system)
- The Crewly UI 'Scheduled Messages' page fetches from GET /api/scheduled-messages, which is a DIFFERENT endpoint
- Result: schedules created via schedule-check don't appear in the UI

Confirmed:
- GET /api/schedule returns active schedules (e.g. ID 64c4e30e, 10-min recurring)
- GET /api/scheduled-messages returns empty array []

Fix needed:
- The Scheduled Messages page should also display schedules from /api/schedule, OR
- Consolidate both systems so all scheduled items appear in one place
- Make sure the UI shows: schedule ID, message, interval, recurring status, next fire time, target session

Use report-status skill when done:
bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-19T21:41:59.064Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-dev-sam-217bfbbf
- **Assigned at**: 2026-02-19T21:41:59.064Z
- **Status**: In Progress

## Task Description

Fix: Crewly UI 'Scheduled Messages' page doesn't show schedules from /api/schedule.

Problem:
- The orchestrator's schedule-check skill creates recurring schedules via POST /api/schedule (stored in the schedule system)
- The Crewly UI 'Scheduled Messages' page fetches from GET /api/scheduled-messages, which is a DIFFERENT endpoint
- Result: schedules created via schedule-check don't appear in the UI

Confirmed:
- GET /api/schedule returns active schedules (e.g. ID 64c4e30e, 10-min recurring)
- GET /api/scheduled-messages returns empty array []

Fix needed:
- The Scheduled Messages page should also display schedules from /api/schedule, OR
- Consolidate both systems so all scheduled items appear in one place
- Make sure the UI shows: schedule ID, message, interval, recurring status, next fire time, target session

Use report-status skill when done:
bash config/skills/agent/report-status/execute.sh '{"sessionName":"crewly-dev-sam-217bfbbf","status":"done","summary":"..."}'
