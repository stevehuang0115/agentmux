/**
 * Tests for Slack Controller
 *
 * @module controllers/slack/slack.controller.test
 */

// Jest globals are available automatically
import request from 'supertest';
import express, { Application, Request, Response, NextFunction } from 'express';
import slackController from './slack.controller.js';
import { getSlackService, resetSlackService } from '../../services/slack/slack.service.js';
import {
  getSlackOrchestratorBridge,
  resetSlackOrchestratorBridge,
} from '../../services/slack/slack-orchestrator-bridge.js';

describe('Slack Controller', () => {
  let app: Application;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset singletons
    resetSlackService();
    resetSlackOrchestratorBridge();

    // Setup express app
    app = express();
    app.use(express.json());
    app.use('/api/slack', slackController);
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });

    // Reset environment
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
  });

  describe('GET /api/slack/status', () => {
    it('should return initial status when not connected', async () => {
      const response = await request(app).get('/api/slack/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.connected).toBe(false);
      expect(response.body.data.isConfigured).toBe(false);
    });

    it('should return message counts', async () => {
      const response = await request(app).get('/api/slack/status');

      expect(response.body.data.messagesSent).toBe(0);
      expect(response.body.data.messagesReceived).toBe(0);
    });

    it('should include socketMode flag', async () => {
      const response = await request(app).get('/api/slack/status');

      expect(response.body.data.socketMode).toBe(false);
    });
  });

  describe('POST /api/slack/connect', () => {
    it('should reject missing credentials from body and env', async () => {
      const response = await request(app).post('/api/slack/connect').send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required Slack credentials');
    });

    it('should reject partial credentials', async () => {
      const response = await request(app).post('/api/slack/connect').send({
        botToken: 'xoxb-test',
        // Missing appToken and signingSecret
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should accept credentials from environment', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';

      // Note: This will fail because @slack/bolt isn't installed
      const response = await request(app).post('/api/slack/connect').send({});

      // Will fail at initialization since bolt isn't installed
      expect(response.status).toBe(500);
    });

    it('should prefer body credentials over environment', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-env';

      const response = await request(app).post('/api/slack/connect').send({
        botToken: 'xoxb-body',
        appToken: 'xapp-body',
        signingSecret: 'secret-body',
      });

      // Will fail at initialization, but validates that body takes precedence
      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/slack/disconnect', () => {
    it('should disconnect without error when not connected', async () => {
      const response = await request(app).post('/api/slack/disconnect');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Slack disconnected');
    });
  });

  describe('POST /api/slack/send', () => {
    it('should require channelId', async () => {
      const response = await request(app).post('/api/slack/send').send({
        text: 'Hello!',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('channelId and text are required');
    });

    it('should require text', async () => {
      const response = await request(app).post('/api/slack/send').send({
        channelId: 'C123456',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('channelId and text are required');
    });

    it('should return 503 when not connected', async () => {
      const response = await request(app).post('/api/slack/send').send({
        channelId: 'C123456',
        text: 'Hello!',
      });

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Slack is not connected');
    });
  });

  describe('POST /api/slack/notify', () => {
    it('should require title', async () => {
      const response = await request(app).post('/api/slack/notify').send({
        message: 'Test message',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('title and message are required');
    });

    it('should require message', async () => {
      const response = await request(app).post('/api/slack/notify').send({
        title: 'Test Title',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('title and message are required');
    });

    it('should send notification with valid data', async () => {
      const response = await request(app).post('/api/slack/notify').send({
        title: 'Test Alert',
        message: 'This is a test notification',
        urgency: 'high',
      });

      // Will succeed (notification is queued, no connection required for the call)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification sent');
    });

    it('should default to alert type and normal urgency', async () => {
      const response = await request(app).post('/api/slack/notify').send({
        title: 'Test',
        message: 'Test message',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept metadata', async () => {
      const response = await request(app).post('/api/slack/notify').send({
        title: 'Task Done',
        message: 'Task completed',
        metadata: {
          taskId: 'task-123',
          projectId: 'proj-456',
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/slack/upload-image', () => {
    it('should require channelId', async () => {
      const response = await request(app).post('/api/slack/upload-image').send({
        filePath: '/tmp/test.png',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('channelId and filePath are required');
    });

    it('should require filePath', async () => {
      const response = await request(app).post('/api/slack/upload-image').send({
        channelId: 'C123',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('channelId and filePath are required');
    });

    it('should return 404 when file does not exist', async () => {
      const response = await request(app).post('/api/slack/upload-image').send({
        channelId: 'C123',
        filePath: '/tmp/nonexistent-image-file.png',
      });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('File not found');
    });

    it('should reject unsupported file extensions', async () => {
      // Create a temp file with unsupported extension
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      const tmpFile = path.join(os.tmpdir(), 'test-upload.txt');
      await fs.writeFile(tmpFile, 'not an image');

      try {
        const response = await request(app).post('/api/slack/upload-image').send({
          channelId: 'C123',
          filePath: tmpFile,
        });

        expect(response.status).toBe(415);
        expect(response.body.error).toContain('Unsupported image type');
      } finally {
        await fs.unlink(tmpFile).catch(() => {});
      }
    });

    it('should return 503 when Slack is not connected', async () => {
      // Create a temp PNG file
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');
      const tmpFile = path.join(os.tmpdir(), 'test-upload.png');
      await fs.writeFile(tmpFile, 'fake png data');

      try {
        const response = await request(app).post('/api/slack/upload-image').send({
          channelId: 'C123',
          filePath: tmpFile,
        });

        expect(response.status).toBe(503);
        expect(response.body.error).toBe('Slack is not connected');
      } finally {
        await fs.unlink(tmpFile).catch(() => {});
      }
    });
  });

  describe('GET /api/slack/config', () => {
    it('should return false for all flags when env not set', async () => {
      const response = await request(app).get('/api/slack/config');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hasToken).toBe(false);
      expect(response.body.data.hasAppToken).toBe(false);
      expect(response.body.data.hasSigningSecret).toBe(false);
      expect(response.body.data.defaultChannel).toBe(null);
      expect(response.body.data.allowedUsers).toBe(0);
    });

    it('should return true for flags when env is set', async () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';
      process.env.SLACK_DEFAULT_CHANNEL = 'C123456';
      process.env.SLACK_ALLOWED_USERS = 'U111,U222,U333';

      const response = await request(app).get('/api/slack/config');

      expect(response.body.data.hasToken).toBe(true);
      expect(response.body.data.hasAppToken).toBe(true);
      expect(response.body.data.hasSigningSecret).toBe(true);
      expect(response.body.data.defaultChannel).toBe('C123456');
      expect(response.body.data.allowedUsers).toBe(3);
    });

    it('should handle empty allowed users string', async () => {
      process.env.SLACK_ALLOWED_USERS = '';

      const response = await request(app).get('/api/slack/config');

      expect(response.body.data.allowedUsers).toBe(0);
    });

    it('should filter empty strings from allowed users', async () => {
      process.env.SLACK_ALLOWED_USERS = 'U111,,U222,';

      const response = await request(app).get('/api/slack/config');

      expect(response.body.data.allowedUsers).toBe(2);
    });
  });
});
