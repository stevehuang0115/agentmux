---
id: 22-scheduler-pty-enhancement
title: Enhance SchedulerService for PTY Compatibility
phase: 5
priority: P2
status: open
estimatedHours: 6
dependencies: [09-continuation-service]
blocks: []
---

# Task: Enhance SchedulerService for PTY Compatibility

## Objective
Review and improve the existing SchedulerService to ensure it works correctly with the PTY session backend.

## Background
AgentMux migrated from tmux to PTY. The SchedulerService sends scheduled messages to agents, and we need to verify it works correctly with PTY sessions.

## Current State Analysis

### SchedulerService Location
`backend/src/services/workflow/scheduler.service.ts`

### Current Functionality
- Schedule one-time check-ins
- Schedule recurring checks
- Send messages to tmux sessions
- Manage scheduled message queue

### Potential Issues with PTY
1. Message sending mechanism may assume tmux
2. Session naming conventions may differ
3. Output injection method may need updating

## Deliverables

### 1. Review Current Implementation

```typescript
// Verify these methods work with PTY

class SchedulerService {
  // Check if this uses tmux-specific commands
  async sendScheduledMessage(sessionName: string, message: string): Promise<void>;

  // Check timer management
  scheduleCheck(params: ScheduleParams): string;

  // Check recurring implementation
  scheduleRecurring(params: RecurringParams): string;
}
```

### 2. Update Message Sending

If tmux-specific, update to use PTY:

```typescript
// Before (if tmux-specific)
async sendScheduledMessage(sessionName: string, message: string): Promise<void> {
  await exec(`tmux send-keys -t ${sessionName} "${message}" Enter`);
}

// After (PTY compatible)
async sendScheduledMessage(sessionName: string, message: string): Promise<void> {
  const session = await this.sessionBackend.getSession(sessionName);
  if (!session) {
    this.logger.warn('Session not found for scheduled message', { sessionName });
    return;
  }

  // Write to PTY session
  await session.write(message + '\n');

  this.logger.info('Scheduled message sent', { sessionName });
}
```

### 3. Enhance Scheduled Message Types

```typescript
// Add continuation-aware scheduling

interface ScheduledMessage {
  id: string;
  sessionName: string;
  message: string;
  scheduledFor: Date;
  type: 'check-in' | 'commit-reminder' | 'progress-check' | 'continuation';
  recurring?: {
    interval: number;  // minutes
    maxOccurrences?: number;
  };
  metadata?: {
    taskId?: string;
    iteration?: number;
  };
}

// Schedule continuation check
async scheduleContinuationCheck(sessionName: string, delayMinutes: number): Promise<string> {
  return this.scheduleCheck({
    sessionName,
    message: '', // Will trigger continuation logic instead of sending message
    type: 'continuation',
    delayMinutes,
    metadata: {
      triggerContinuation: true,
    },
  });
}
```

### 4. Integration with ContinuationService

```typescript
class SchedulerService {
  private continuationService: ContinuationService;

  async executeScheduledMessage(scheduled: ScheduledMessage): Promise<void> {
    if (scheduled.type === 'continuation') {
      // Trigger continuation check instead of sending message
      await this.continuationService.handleScheduledCheck(scheduled.sessionName);
      return;
    }

    // Regular message sending
    await this.sendScheduledMessage(scheduled.sessionName, scheduled.message);
  }
}
```

### 5. Adaptive Scheduling

```typescript
// Adjust check frequency based on agent activity

interface AdaptiveScheduleConfig {
  baseInterval: number;      // minutes
  minInterval: number;       // minimum minutes
  maxInterval: number;       // maximum minutes
  adjustmentFactor: number;  // how much to adjust
}

async scheduleAdaptiveCheckin(sessionName: string, config: AdaptiveScheduleConfig): Promise<void> {
  const activity = await this.activityMonitor.getRecentActivity(sessionName);

  let interval = config.baseInterval;

  if (activity.isHighlyActive) {
    // Agent is busy, check less frequently
    interval = Math.min(interval * config.adjustmentFactor, config.maxInterval);
  } else if (activity.isIdle) {
    // Agent may need help, check more frequently
    interval = Math.max(interval / config.adjustmentFactor, config.minInterval);
  }

  await this.scheduleCheck({
    sessionName,
    type: 'progress-check',
    delayMinutes: interval,
    recurring: { interval },
  });
}
```

### 6. Verify Default Schedules

Ensure these work with PTY:

```typescript
// Default check-in schedule
const DEFAULT_SCHEDULES = {
  initialCheck: 5,           // 5 minutes after start
  progressCheck: 30,         // Every 30 minutes
  commitReminder: 25,        // Every 25 minutes
};

async scheduleDefaultCheckins(sessionName: string): Promise<void> {
  // Initial check
  await this.scheduleCheck({
    sessionName,
    type: 'check-in',
    delayMinutes: DEFAULT_SCHEDULES.initialCheck,
    message: 'SCHEDULED CHECK: Please report your progress.',
  });

  // Recurring progress checks
  await this.scheduleRecurring({
    sessionName,
    type: 'progress-check',
    interval: DEFAULT_SCHEDULES.progressCheck,
    message: 'SCHEDULED CHECK: What is your current status?',
  });

  // Recurring commit reminders
  await this.scheduleRecurring({
    sessionName,
    type: 'commit-reminder',
    interval: DEFAULT_SCHEDULES.commitReminder,
    message: 'COMMIT REMINDER: Please commit your work if you have changes.',
  });
}
```

## Implementation Steps

1. **Review current SchedulerService**
   - Check message sending method
   - Identify tmux-specific code
   - Document current behavior

2. **Update for PTY compatibility**
   - Replace tmux commands with PTY writes
   - Update session handling
   - Test message delivery

3. **Add continuation integration**
   - New schedule type for continuation
   - Connect to ContinuationService
   - Test scheduled continuations

4. **Implement adaptive scheduling**
   - Activity-based interval adjustment
   - Configuration options
   - Testing

5. **Verify default schedules**
   - Test each schedule type
   - Ensure messages delivered
   - Check timing accuracy

6. **Write/update tests**
   - Message delivery tests
   - Timing tests
   - Integration tests

## Acceptance Criteria

- [ ] Message sending works with PTY sessions
- [ ] No tmux-specific code remaining
- [ ] Continuation scheduling works
- [ ] Adaptive scheduling implemented
- [ ] Default schedules verified
- [ ] Tests passing

## Notes

- Maintain backward compatibility if possible
- Log all scheduled operations
- Handle session not found gracefully
- Consider timezone handling
