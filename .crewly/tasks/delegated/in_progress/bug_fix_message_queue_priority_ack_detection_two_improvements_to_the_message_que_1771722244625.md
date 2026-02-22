# Bug Fix: Message Queue Priority + ACK Detection

Two improvements to the message queue system. These fix a real user-reported bug where Slack messages went unanswered because (1) system events blocked user messages and (2) context exhaustion wasn't detected.

## Fix 1: Priority Queue — User messages jump ahead of system events

File: `backend/src/services/messaging/message-queue.service.ts`

Modify `dequeue()` to prioritize user messages (source: 'slack' or 'web_chat') over system events (source: 'system_event'):

```typescript
dequeue(): QueuedMessage | null {
  if (this.queue.length === 0) return null;
  // Prioritize user messages over system events
  const userIdx = this.queue.findIndex(
    m => m.source === 'slack' || m.source === 'web_chat'
  );
  const idx = userIdx >= 0 ? userIdx : 0;
  const [message] = this.queue.splice(idx, 1);
  message.status = 'processing';
  message.processingStartedAt = new Date().toISOString();
  this.currentMessage = message;
  this.emit('processing', message);
  this.emitStatusUpdate();
  this.schedulePersist();
  return message;
}
```

## Fix 2: ACK Detection — Early timeout when orchestrator can't respond

File: `backend/src/services/messaging/queue-processor.service.ts`

In `waitForResponse()`, add an early ACK check using `PtyActivityTrackerService`:
- After message delivery, start a 15-second ACK timer
- At 15 seconds, check if the orchestrator terminal has had ANY output since delivery
- If zero output → context is likely exhausted → resolve immediately with actionable error message instead of waiting the full 120 seconds
- If there IS output → the orchestrator is thinking, let the full 120s timeout continue

File: `backend/src/constants.ts`
- Add `ACK_TIMEOUT: 15000` to `MESSAGE_QUEUE_CONSTANTS`

File: `backend/src/types/messaging.types.ts`
- Add `deliveredAt?: string` to `QueuedMessage` interface
- Add `deliveredAt` to `PersistedMessage` interface
- Update `toPersistedMessage()` to include deliveredAt

## Tests

Write tests in the existing test files (co-located):
- `message-queue.service.test.ts` — test that dequeue() returns user messages before system events
- `queue-processor.service.test.ts` — test ACK timeout behavior

## Verify
- Run `npm run build` (or `npx tsc -p backend/tsconfig.json --noEmit`)
- Run the relevant test files

After completing, report status.

## Task Information
- **Priority**: high
- **Milestone**: delegated
- **Created at**: 2026-02-22T01:04:04.625Z
- **Status**: In Progress

## Assignment Information
- **Assigned to**: crewly-core-sam-217bfbbf
- **Assigned at**: 2026-02-22T01:04:04.625Z
- **Status**: In Progress

## Task Description

Bug Fix: Message Queue Priority + ACK Detection

Two improvements to the message queue system. These fix a real user-reported bug where Slack messages went unanswered because (1) system events blocked user messages and (2) context exhaustion wasn't detected.

## Fix 1: Priority Queue — User messages jump ahead of system events

File: `backend/src/services/messaging/message-queue.service.ts`

Modify `dequeue()` to prioritize user messages (source: 'slack' or 'web_chat') over system events (source: 'system_event'):

```typescript
dequeue(): QueuedMessage | null {
  if (this.queue.length === 0) return null;
  // Prioritize user messages over system events
  const userIdx = this.queue.findIndex(
    m => m.source === 'slack' || m.source === 'web_chat'
  );
  const idx = userIdx >= 0 ? userIdx : 0;
  const [message] = this.queue.splice(idx, 1);
  message.status = 'processing';
  message.processingStartedAt = new Date().toISOString();
  this.currentMessage = message;
  this.emit('processing', message);
  this.emitStatusUpdate();
  this.schedulePersist();
  return message;
}
```

## Fix 2: ACK Detection — Early timeout when orchestrator can't respond

File: `backend/src/services/messaging/queue-processor.service.ts`

In `waitForResponse()`, add an early ACK check using `PtyActivityTrackerService`:
- After message delivery, start a 15-second ACK timer
- At 15 seconds, check if the orchestrator terminal has had ANY output since delivery
- If zero output → context is likely exhausted → resolve immediately with actionable error message instead of waiting the full 120 seconds
- If there IS output → the orchestrator is thinking, let the full 120s timeout continue

File: `backend/src/constants.ts`
- Add `ACK_TIMEOUT: 15000` to `MESSAGE_QUEUE_CONSTANTS`

File: `backend/src/types/messaging.types.ts`
- Add `deliveredAt?: string` to `QueuedMessage` interface
- Add `deliveredAt` to `PersistedMessage` interface
- Update `toPersistedMessage()` to include deliveredAt

## Tests

Write tests in the existing test files (co-located):
- `message-queue.service.test.ts` — test that dequeue() returns user messages before system events
- `queue-processor.service.test.ts` — test ACK timeout behavior

## Verify
- Run `npm run build` (or `npx tsc -p backend/tsconfig.json --noEmit`)
- Run the relevant test files

After completing, report status.
