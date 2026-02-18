/**
 * Tests for Slack Initializer
 *
 * @module services/slack/slack-initializer.test
 */

// Jest globals are available automatically
import {
  isSlackConfigured,
  getSlackConfigFromEnv,
  initializeSlackIfConfigured,
  shutdownSlack,
} from './slack-initializer.js';
import { resetSlackService, getSlackService, SlackService } from './slack.service.js';
import { resetSlackOrchestratorBridge } from './slack-orchestrator-bridge.js';

describe('Slack Initializer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetSlackService();
    resetSlackOrchestratorBridge();
    process.env = { ...originalEnv };
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_APP_TOKEN;
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.SLACK_DEFAULT_CHANNEL;
    delete process.env.SLACK_ALLOWED_USERS;
  });

  afterEach(() => {
    process.env = originalEnv;
    resetSlackService();
    resetSlackOrchestratorBridge();
    jest.restoreAllMocks();
  });

  describe('isSlackConfigured', () => {
    it('should return false when no env vars are set', () => {
      expect(isSlackConfigured()).toBe(false);
    });

    it('should return false when only bot token is set', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      expect(isSlackConfigured()).toBe(false);
    });

    it('should return false when only app token is set', () => {
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      expect(isSlackConfigured()).toBe(false);
    });

    it('should return false when only signing secret is set', () => {
      process.env.SLACK_SIGNING_SECRET = 'secret';
      expect(isSlackConfigured()).toBe(false);
    });

    it('should return false when missing one required var', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      // Missing signing secret
      expect(isSlackConfigured()).toBe(false);
    });

    it('should return true when all required vars are set', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';
      expect(isSlackConfigured()).toBe(true);
    });
  });

  describe('getSlackConfigFromEnv', () => {
    it('should return null when not configured', () => {
      expect(getSlackConfigFromEnv()).toBeNull();
    });

    it('should return null when partially configured', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      expect(getSlackConfigFromEnv()).toBeNull();
    });

    it('should return config when fully configured', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';

      const config = getSlackConfigFromEnv();
      expect(config).not.toBeNull();
      expect(config?.botToken).toBe('xoxb-test');
      expect(config?.appToken).toBe('xapp-test');
      expect(config?.signingSecret).toBe('secret');
      expect(config?.socketMode).toBe(true);
    });

    it('should include optional default channel', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';
      process.env.SLACK_DEFAULT_CHANNEL = 'C123456';

      const config = getSlackConfigFromEnv();
      expect(config?.defaultChannelId).toBe('C123456');
    });

    it('should parse allowed user IDs', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';
      process.env.SLACK_ALLOWED_USERS = 'U111,U222,U333';

      const config = getSlackConfigFromEnv();
      expect(config?.allowedUserIds).toEqual(['U111', 'U222', 'U333']);
    });

    it('should filter empty strings from allowed users', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';
      process.env.SLACK_ALLOWED_USERS = 'U111,,U222,';

      const config = getSlackConfigFromEnv();
      expect(config?.allowedUserIds).toEqual(['U111', 'U222']);
    });

    it('should handle empty allowed users string', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';
      process.env.SLACK_ALLOWED_USERS = '';

      const config = getSlackConfigFromEnv();
      expect(config?.allowedUserIds).toEqual([]);
    });
  });

  describe('initializeSlackIfConfigured', () => {
    it('should return not attempted when not configured', async () => {
      const result = await initializeSlackIfConfigured();

      expect(result.attempted).toBe(false);
      expect(result.success).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should attempt initialization when configured', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';

      // Mock SlackService.initialize to throw a controlled error
      // instead of making real network calls to Slack
      const mockError = new Error('Mock Slack init failure');
      jest.spyOn(SlackService.prototype, 'initialize').mockRejectedValue(mockError);

      const result = await initializeSlackIfConfigured();

      expect(result.attempted).toBe(true);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include error message on failure', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';

      // Mock SlackService.initialize to throw a controlled error
      // instead of making real network calls to Slack
      const mockError = new Error('Mock Slack connection error');
      jest.spyOn(SlackService.prototype, 'initialize').mockRejectedValue(mockError);

      const result = await initializeSlackIfConfigured();

      expect(result.attempted).toBe(true);
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(result.error?.length).toBeGreaterThan(0);
      expect(result.error).toBe('Mock Slack connection error');
    });
  });

  describe('shutdownSlack', () => {
    it('should not throw when not connected', async () => {
      await expect(shutdownSlack()).resolves.not.toThrow();
    });

    it('should handle shutdown gracefully', async () => {
      // Get service to ensure it exists
      const service = getSlackService();
      expect(service.isConnected()).toBe(false);

      await expect(shutdownSlack()).resolves.not.toThrow();
    });
  });
});
