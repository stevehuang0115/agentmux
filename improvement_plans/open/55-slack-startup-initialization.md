# Task 55: Slack Startup Initialization

## Overview

Initialize Slack service on backend startup to enable real-time communication with the orchestrator via Slack.

## Problem

The Slack service is implemented but not initialized when the backend starts. Users cannot communicate with the orchestrator via Slack until the service is connected.

## Current State

```typescript
// backend/src/index.ts
// Has ImprovementStartupService but NO Slack initialization
```

## Implementation

### Update `backend/src/index.ts`

Add Slack initialization after other services are ready:

```typescript
import { initializeSlack } from './services/slack/index.js';
import { getSettingsService } from './services/settings/index.js';

async function startServer(): Promise<void> {
  // ... existing initialization code ...

  // Initialize Slack if configured
  await initializeSlackService();

  // ... rest of startup ...
}

/**
 * Initialize Slack service if configuration is present
 */
async function initializeSlackService(): Promise<void> {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    // Check if Slack is configured
    if (settings.slack?.enabled && settings.slack?.botToken && settings.slack?.appToken) {
      console.log('Initializing Slack integration...');
      await initializeSlack({
        botToken: settings.slack.botToken,
        appToken: settings.slack.appToken,
        signingSecret: settings.slack.signingSecret,
      });
      console.log('Slack integration initialized successfully');
    } else {
      console.log('Slack integration not configured, skipping initialization');
    }
  } catch (error) {
    console.error('Failed to initialize Slack integration:', error);
    // Don't crash the server if Slack fails to initialize
  }
}
```

### Create Slack Initializer (if not exists)

**`backend/src/services/slack/slack-initializer.ts`**

```typescript
/**
 * Slack Initializer
 *
 * Initializes the Slack service and orchestrator bridge.
 *
 * @module services/slack/slack-initializer
 */

import { getSlackService } from './slack.service.js';
import { getSlackOrchestratorBridge } from './slack-orchestrator-bridge.js';
import type { SlackConfig } from '../../types/slack.types.js';

/**
 * Initialize Slack integration
 *
 * Connects the Slack bot and sets up the orchestrator bridge
 * for bidirectional communication.
 *
 * @param config - Slack configuration with tokens
 * @throws Error if connection fails
 */
export async function initializeSlack(config: SlackConfig): Promise<void> {
  const slackService = getSlackService();
  const bridge = getSlackOrchestratorBridge();

  // Initialize Slack connection
  await slackService.initialize(config);

  // Set up orchestrator bridge
  await bridge.initialize();

  // Register message handlers
  slackService.onMessage(async (message) => {
    await bridge.handleIncomingMessage(message);
  });

  console.log('Slack service connected and bridge initialized');
}
```

### Update Settings Types

Ensure Slack settings are defined in settings types:

```typescript
// backend/src/types/settings.types.ts
interface AgentMuxSettings {
  // ... existing settings ...

  slack?: {
    enabled: boolean;
    botToken?: string;      // xoxb-...
    appToken?: string;      // xapp-...
    signingSecret?: string;
    defaultChannel?: string;
  };
}
```

## Files to Modify

| File | Action |
|------|--------|
| `backend/src/index.ts` | Add Slack initialization call |
| `backend/src/services/slack/slack-initializer.ts` | Create if not exists |
| `backend/src/types/settings.types.ts` | Add Slack config fields |

## Environment Variables

Add to `.env.example`:

```bash
# Slack Integration (optional)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret
```

## Acceptance Criteria

- [ ] Slack initializes on backend startup when configured
- [ ] Slack gracefully skips initialization when not configured
- [ ] Slack initialization failures don't crash the server
- [ ] Connection status logged to console
- [ ] Settings include Slack configuration fields
- [ ] Environment variables documented

## Dependencies

- Task 44: Slack Service
- Task 45: Slack-Orchestrator Bridge
- Task 25: Settings Service

## Priority

**High** - Required for Slack integration to work
