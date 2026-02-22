# Fix: scheduled checks (schedule-check) do not persist across orchestrator session restarts. When the orchestrator restarts, all previously scheduled recurring checks are lost. Investigate how schedule-check works in the backend (look at the monitoring/activity-monitor service and related code), and implement persistence so that scheduled checks survive orchestrator session restarts. Also look into why the scheduled checks don't appear on the frontend Scheduled Messages page — they should be visible there. The relevant frontend page is at frontend/src/pages/ScheduledCheckins.tsx. Make sure to write tests for any changes.

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-20T05:22:11.370Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-dev-sam-217bfbbf
- **Assigned at**: 2026-02-20T05:22:11.370Z
- **Status**: In Progress

## Task Description

Fix: scheduled checks (schedule-check) do not persist across orchestrator session restarts. When the orchestrator restarts, all previously scheduled recurring checks are lost. Investigate how schedule-check works in the backend (look at the monitoring/activity-monitor service and related code), and implement persistence so that scheduled checks survive orchestrator session restarts. Also look into why the scheduled checks don't appear on the frontend Scheduled Messages page — they should be visible there. The relevant frontend page is at frontend/src/pages/ScheduledCheckins.tsx. Make sure to write tests for any changes.
