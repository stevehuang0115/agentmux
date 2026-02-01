/**
 * Slack Controller
 *
 * REST API endpoints for managing Slack integration.
 * Provides status monitoring, connection management, and message sending.
 *
 * @module controllers/slack
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getSlackService } from '../../services/slack/slack.service.js';
import { getSlackOrchestratorBridge } from '../../services/slack/slack-orchestrator-bridge.js';
import { SlackConfig, SlackNotification, SlackNotificationType } from '../../types/slack.types.js';

const router = Router();

/**
 * GET /api/slack/status
 *
 * Get Slack integration status including connection state and message counts.
 *
 * @returns Status object with connection info
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
 *
 * Initialize Slack connection with configuration.
 * Uses request body or falls back to environment variables.
 *
 * @body botToken - Bot OAuth token (optional if env set)
 * @body appToken - App-level token (optional if env set)
 * @body signingSecret - Signing secret (optional if env set)
 * @body defaultChannelId - Default notification channel
 * @body allowedUserIds - Array of allowed user IDs
 * @returns Connection status on success
 */
router.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config: SlackConfig = {
      botToken: req.body.botToken || process.env.SLACK_BOT_TOKEN || '',
      appToken: req.body.appToken || process.env.SLACK_APP_TOKEN || '',
      signingSecret: req.body.signingSecret || process.env.SLACK_SIGNING_SECRET || '',
      defaultChannelId: req.body.defaultChannelId || process.env.SLACK_DEFAULT_CHANNEL,
      allowedUserIds:
        req.body.allowedUserIds ||
        process.env.SLACK_ALLOWED_USERS?.split(',').filter(Boolean),
      socketMode: true,
    };

    // Validate required fields
    if (!config.botToken || !config.appToken || !config.signingSecret) {
      res.status(400).json({
        success: false,
        error: 'Missing required Slack credentials (botToken, appToken, signingSecret)',
      });
      return;
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
 *
 * Disconnect from Slack gracefully.
 *
 * @returns Success message on disconnect
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
 *
 * Send a message to Slack (for testing/manual notifications).
 *
 * @body channelId - Channel to send to (required)
 * @body text - Message text (required)
 * @body threadTs - Thread timestamp for replies (optional)
 * @returns Message timestamp on success
 */
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channelId, text, threadTs } = req.body;

    if (!channelId || !text) {
      res.status(400).json({
        success: false,
        error: 'channelId and text are required',
      });
      return;
    }

    const slackService = getSlackService();

    if (!slackService.isConnected()) {
      res.status(503).json({
        success: false,
        error: 'Slack is not connected',
      });
      return;
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
 *
 * Send a notification through the orchestrator bridge.
 *
 * @body type - Notification type (optional, defaults to 'alert')
 * @body title - Notification title (required)
 * @body message - Notification message (required)
 * @body urgency - Urgency level (optional, defaults to 'normal')
 * @body metadata - Additional metadata (optional)
 * @returns Success message on send
 */
router.post('/notify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notification: SlackNotification = {
      type: (req.body.type || 'alert') as SlackNotificationType,
      title: req.body.title,
      message: req.body.message,
      urgency: req.body.urgency || 'normal',
      timestamp: new Date().toISOString(),
      metadata: req.body.metadata,
    };

    if (!notification.title || !notification.message) {
      res.status(400).json({
        success: false,
        error: 'title and message are required',
      });
      return;
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
 *
 * Get current Slack configuration (sanitized, no secrets).
 *
 * @returns Configuration status object
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
        allowedUsers: process.env.SLACK_ALLOWED_USERS?.split(',').filter(Boolean).length || 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
