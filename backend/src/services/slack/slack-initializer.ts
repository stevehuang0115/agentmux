/**
 * Slack Initializer
 *
 * Handles automatic Slack connection on application startup.
 * Checks for environment variables and initializes if configured.
 *
 * @module services/slack/initializer
 */

import { getSlackService } from './slack.service.js';
import { getSlackOrchestratorBridge } from './slack-orchestrator-bridge.js';
import { SlackConfig } from '../../types/slack.types.js';

/**
 * Result of initialization attempt
 */
export interface SlackInitResult {
  /** Whether initialization was attempted */
  attempted: boolean;
  /** Whether initialization succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Check if Slack is configured via environment variables
 *
 * @returns True if all required environment variables are set
 */
export function isSlackConfigured(): boolean {
  return !!(
    process.env.SLACK_BOT_TOKEN &&
    process.env.SLACK_APP_TOKEN &&
    process.env.SLACK_SIGNING_SECRET
  );
}

/**
 * Get Slack configuration from environment variables
 *
 * @returns SlackConfig object or null if not configured
 */
export function getSlackConfigFromEnv(): SlackConfig | null {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!botToken || !appToken || !signingSecret) {
    return null;
  }

  return {
    botToken,
    appToken,
    signingSecret,
    defaultChannelId: process.env.SLACK_DEFAULT_CHANNEL,
    allowedUserIds: process.env.SLACK_ALLOWED_USERS?.split(',').filter(Boolean),
    socketMode: true,
  };
}

/**
 * Initialize Slack integration if environment variables are set
 *
 * This function is designed to be called during application startup.
 * It safely handles cases where Slack is not configured.
 *
 * @returns Result object indicating success or failure
 *
 * @example
 * ```typescript
 * const result = await initializeSlackIfConfigured();
 * if (result.success) {
 *   console.log('Slack connected!');
 * } else if (result.attempted) {
 *   console.error('Slack failed to connect:', result.error);
 * } else {
 *   console.log('Slack not configured, skipping');
 * }
 * ```
 */
export async function initializeSlackIfConfigured(): Promise<SlackInitResult> {
  const config = getSlackConfigFromEnv();

  if (!config) {
    console.log('[Slack] Not configured - skipping initialization');
    return { attempted: false, success: false };
  }

  try {
    const slackService = getSlackService();
    await slackService.initialize(config);

    const bridge = getSlackOrchestratorBridge();
    await bridge.initialize();

    console.log('[Slack] Successfully connected');
    return { attempted: true, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Slack] Failed to initialize:', errorMessage);
    return { attempted: true, success: false, error: errorMessage };
  }
}

/**
 * Gracefully shutdown Slack integration
 *
 * Call this during application shutdown to disconnect cleanly.
 */
export async function shutdownSlack(): Promise<void> {
  try {
    const slackService = getSlackService();
    if (slackService.isConnected()) {
      await slackService.disconnect();
      console.log('[Slack] Disconnected');
    }
  } catch (error) {
    console.error('[Slack] Error during shutdown:', error);
  }
}
