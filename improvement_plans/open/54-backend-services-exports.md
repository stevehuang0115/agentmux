# Task 54: Backend Services Index Exports

## Overview

Update the main services index to export Slack and Orchestrator services for proper module access.

## Problem

The `backend/src/services/index.ts` file does not export the newly created Slack and Orchestrator services, making them inaccessible through the standard import path.

## Current State

```typescript
// backend/src/services/index.ts - Missing exports
export * from './settings/index.js';
export * from './chat/index.js';
export * from './skill/index.js';
// Missing: Slack services
// Missing: Orchestrator services
```

## Implementation

### Update `backend/src/services/index.ts`

```typescript
/**
 * Services Module
 *
 * Exports all backend services.
 *
 * @module services
 */

// Existing exports
export * from './settings/index.js';
export * from './chat/index.js';
export * from './skill/index.js';

// Slack services
export * from './slack/index.js';

// Orchestrator services
export * from './orchestrator/index.js';
```

### Verify Index Files Exist

Ensure these barrel exports exist:

**`backend/src/services/slack/index.ts`**
```typescript
export { SlackService, getSlackService, resetSlackService } from './slack.service.js';
export { SlackOrchestratorBridge, getSlackOrchestratorBridge, resetSlackOrchestratorBridge } from './slack-orchestrator-bridge.js';
export { initializeSlack } from './slack-initializer.js';
export type { SlackConfig, SlackMessage, SlackChannel } from '../../types/slack.types.js';
```

**`backend/src/services/orchestrator/index.ts`**
```typescript
export { StatePersistenceService, getStatePersistenceService, resetStatePersistenceService } from './state-persistence.service.js';
export { SafeRestartService, getSafeRestartService, resetSafeRestartService } from './safe-restart.service.js';
export { SelfImprovementService, getSelfImprovementService, resetSelfImprovementService } from './self-improvement.service.js';
export { ImprovementMarkerService, getImprovementMarkerService, resetImprovementMarkerService } from './improvement-marker.service.js';
export { ImprovementStartupService, getImprovementStartupService, resetImprovementStartupService } from './improvement-startup.service.js';
```

## Files to Modify

| File | Action |
|------|--------|
| `backend/src/services/index.ts` | Add Slack and Orchestrator exports |
| `backend/src/services/slack/index.ts` | Verify exists with proper exports |
| `backend/src/services/orchestrator/index.ts` | Verify exists with proper exports |

## Acceptance Criteria

- [ ] `backend/src/services/index.ts` exports Slack services
- [ ] `backend/src/services/index.ts` exports Orchestrator services
- [ ] Can import `SlackService` from `'../services/index.js'`
- [ ] Can import `SelfImprovementService` from `'../services/index.js'`
- [ ] TypeScript compilation passes
- [ ] All existing tests continue to pass

## Dependencies

- Task 44: Slack Service (must be complete)
- Task 48-53: Orchestrator services (must be complete)

## Priority

**Critical** - Blocks proper service access patterns
