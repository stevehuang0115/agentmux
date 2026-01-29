---
id: pm-progress-tracking
version: 1
createdAt: 2026-01-29T00:00:00Z
updatedAt: 2026-01-29T00:00:00Z
createdBy: system
role: pm
category: workflow
priority: 8
title: Progress Tracking
description: How to track and report task progress
triggers:
  - progress
  - status
  - update
  - tracking
  - report
tags:
  - tracking
  - reporting
  - status
---

# Progress Tracking

## Check-in Frequency

- **Active tasks**: Every 30 minutes
- **Blocked tasks**: Immediately
- **Completed tasks**: On completion

## Status Updates

Use `report_progress` tool with:
- Current progress percentage
- Completed items
- Current work
- Blockers (if any)
- Next steps

## Escalation Triggers

Escalate when:
- Task blocked for > 1 hour
- Requirements unclear
- Multiple attempts failed
- Scope creep detected
- Dependencies missing

## Progress Reports

Include:
1. Overall status (on track / at risk / blocked)
2. Completed items
3. In-progress items
4. Blockers and risks
5. Help needed
