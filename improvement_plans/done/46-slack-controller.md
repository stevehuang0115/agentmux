# Task: Create Slack Controller and Integration

## Overview

Create the REST API controller for Slack integration and integrate all Slack services into the application startup. This enables configuration, status monitoring, and manual control of the Slack bot.

## Priority

**High** - Required to enable and manage Slack integration

## Dependencies

- `43-slack-types.md` - Slack types
- `44-slack-service.md` - Slack service
- `45-slack-orchestrator-bridge.md` - Bridge service

## Files to Create

### 1. Create `backend/src/controllers/slack/slack.controller.ts`

```typescript
/**
 * Slack Controller
 *
 * REST API endpoints for managing Slack integration.
 *
 * @module controllers/slack
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getSlackService } from '../../services/slack/slack.service.js';
import { getSlackOrchestratorBridge } from '../../services/slack/slack-orchestrator-bridge.js';
import { SlackConfig, SlackNotification } from '../../types/slack.types.js';

const router = Router();

/**
 * GET /api/slack/status
 * Get Slack integration status
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slackService = getSlackService();
    const status = slackService.getStatus();

    res.json({
      success: true,
      data: {
        ...status,
        isConfigured: slackService.isConnected(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/slack/connect
 * Initialize Slack connection with configuration
 */
router.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config: SlackConfig = {
      botToken: req.body.botToken || process.env.SLACK_BOT_TOKEN,
      appToken: req.body.appToken || process.env.SLACK_APP_TOKEN,
      signingSecret: req.body.signingSecret || process.env.SLACK_SIGNING_SECRET,
      defaultChannelId: req.body.defaultChannelId || process.env.SLACK_DEFAULT_CHANNEL,
      allowedUserIds: req.body.allowedUserIds ||
        (process.env.SLACK_ALLOWED_USERS?.split(',').filter(Boolean)),
      socketMode: true,
    };

    // Validate required fields
    if (!config.botToken || !config.appToken || !config.signingSecret) {
      return res.status(400).json({
        success: false,
        error: 'Missing required Slack credentials (botToken, appToken, signingSecret)',
      });
    }

    const slackService = getSlackService();
    await slackService.initialize(config);

    // Initialize bridge
    const bridge = getSlackOrchestratorBridge();
    await bridge.initialize();

    res.json({
      success: true,
      message: 'Slack connection established',
      data: slackService.getStatus(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/slack/disconnect
 * Disconnect from Slack
 */
router.post('/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slackService = getSlackService();
    await slackService.disconnect();

    res.json({
      success: true,
      message: 'Slack disconnected',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/slack/send
 * Send a message to Slack (for testing/manual notifications)
 */
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channelId, text, threadTs } = req.body;

    if (!channelId || !text) {
      return res.status(400).json({
        success: false,
        error: 'channelId and text are required',
      });
    }

    const slackService = getSlackService();

    if (!slackService.isConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Slack is not connected',
      });
    }

    const messageTs = await slackService.sendMessage({
      channelId,
      text,
      threadTs,
    });

    res.json({
      success: true,
      data: { messageTs },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/slack/notify
 * Send a notification through the bridge
 */
router.post('/notify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notification: SlackNotification = {
      type: req.body.type || 'alert',
      title: req.body.title,
      message: req.body.message,
      urgency: req.body.urgency || 'normal',
      timestamp: new Date().toISOString(),
      metadata: req.body.metadata,
    };

    if (!notification.title || !notification.message) {
      return res.status(400).json({
        success: false,
        error: 'title and message are required',
      });
    }

    const bridge = getSlackOrchestratorBridge();
    await bridge.sendNotification(notification);

    res.json({
      success: true,
      message: 'Notification sent',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/slack/config
 * Get current Slack configuration (sanitized)
 */
router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: {
        hasToken: !!process.env.SLACK_BOT_TOKEN,
        hasAppToken: !!process.env.SLACK_APP_TOKEN,
        hasSigningSecret: !!process.env.SLACK_SIGNING_SECRET,
        defaultChannel: process.env.SLACK_DEFAULT_CHANNEL || null,
        allowedUsers: process.env.SLACK_ALLOWED_USERS?.split(',').length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### 2. Create `backend/src/controllers/slack/index.ts`

```typescript
import { Router } from 'express';
import slackController from './slack.controller.js';

export function createSlackRouter(): Router {
  return slackController;
}

export default slackController;
```

### 3. Create `backend/src/controllers/slack/slack.controller.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import slackController from './slack.controller.js';

// Mock services
vi.mock('../../services/slack/slack.service.js', () => ({
  getSlackService: vi.fn(() => ({
    getStatus: vi.fn(() => ({
      connected: true,
      socketMode: true,
      messagesSent: 10,
      messagesReceived: 5,
    })),
    isConnected: vi.fn(() => true),
    initialize: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue('1234567890.123456'),
  })),
}));

vi.mock('../../services/slack/slack-orchestrator-bridge.js', () => ({
  getSlackOrchestratorBridge: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('Slack Controller', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/slack', slackController);
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(500).json({ error: err.message });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/slack/status', () => {
    it('should return Slack status', async () => {
      const response = await request(app).get('/api/slack/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(true);
    });
  });

  describe('POST /api/slack/connect', () => {
    it('should connect with valid credentials', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';

      const response = await request(app)
        .post('/api/slack/connect')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject missing credentials', async () => {
      delete process.env.SLACK_BOT_TOKEN;
      delete process.env.SLACK_APP_TOKEN;
      delete process.env.SLACK_SIGNING_SECRET;

      const response = await request(app)
        .post('/api/slack/connect')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/slack/send', () => {
    it('should send message', async () => {
      const response = await request(app)
        .post('/api/slack/send')
        .send({
          channelId: 'C123456',
          text: 'Hello!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messageTs).toBeDefined();
    });

    it('should require channelId and text', async () => {
      const response = await request(app)
        .post('/api/slack/send')
        .send({ channelId: 'C123' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/slack/notify', () => {
    it('should send notification', async () => {
      const response = await request(app)
        .post('/api/slack/notify')
        .send({
          title: 'Test Alert',
          message: 'This is a test',
          urgency: 'high',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
```

### 4. Update `backend/src/controllers/index.ts`

Add the Slack router:

```typescript
import { createSlackRouter } from './slack/index.js';

// In createApiRouter function:
router.use('/slack', createSlackRouter());
```

### 5. Update Application Startup

Create `backend/src/services/slack/slack-initializer.ts`:

```typescript
/**
 * Slack Initializer
 *
 * Handles automatic Slack connection on application startup.
 *
 * @module services/slack/initializer
 */

import { getSlackService } from './slack.service.js';
import { getSlackOrchestratorBridge } from './slack-orchestrator-bridge.js';
import { SlackConfig } from '../../types/slack.types.js';

/**
 * Initialize Slack integration if environment variables are set
 */
export async function initializeSlackIfConfigured(): Promise<boolean> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!botToken || !appToken || !signingSecret) {
    console.log('[Slack] Not configured - skipping initialization');
    return false;
  }

  const config: SlackConfig = {
    botToken,
    appToken,
    signingSecret,
    defaultChannelId: process.env.SLACK_DEFAULT_CHANNEL,
    allowedUserIds: process.env.SLACK_ALLOWED_USERS?.split(',').filter(Boolean),
    socketMode: true,
  };

  try {
    const slackService = getSlackService();
    await slackService.initialize(config);

    const bridge = getSlackOrchestratorBridge();
    await bridge.initialize();

    console.log('[Slack] Successfully connected');
    return true;
  } catch (error) {
    console.error('[Slack] Failed to initialize:', error);
    return false;
  }
}
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/slack/status` | Get Slack connection status |
| POST | `/api/slack/connect` | Initialize Slack connection |
| POST | `/api/slack/disconnect` | Disconnect from Slack |
| POST | `/api/slack/send` | Send a message to Slack |
| POST | `/api/slack/notify` | Send a notification |
| GET | `/api/slack/config` | Get configuration status |

## Environment Variables

```bash
# Required for Slack integration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret

# Optional
SLACK_DEFAULT_CHANNEL=C0123456789
SLACK_ALLOWED_USERS=U0123456789,U9876543210
```

## Acceptance Criteria

- [ ] Slack controller created with all endpoints
- [ ] Controller integrated into main router
- [ ] Auto-initialization on startup if configured
- [ ] Status endpoint returns connection info
- [ ] Manual send/notify endpoints work
- [ ] Tests cover all endpoints
- [ ] TypeScript compilation passes

## Testing Requirements

- Integration tests for all endpoints
- Environment variable handling tests
- Error handling tests

## Estimated Effort

20 minutes

## Notes

- Slack auto-connects if environment variables are set
- Manual connect endpoint allows runtime configuration
- Status endpoint useful for dashboard monitoring
