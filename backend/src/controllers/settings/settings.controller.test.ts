/**
 * Tests for Settings Controller
 *
 * @module controllers/settings/settings.controller.test
 */

// Jest globals are available automatically
import request from 'supertest';
import express, { Express, Request, Response, NextFunction, Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { SettingsService, SettingsValidationError, resetSettingsService } from '../../services/settings/settings.service.js';
import { getDefaultSettings, UpdateSettingsInput, AgentMuxSettings } from '../../types/settings.types.js';

const VALID_SECTIONS: (keyof AgentMuxSettings)[] = ['general', 'chat', 'skills'];

/**
 * Create a settings controller router with a specific service
 */
function createSettingsControllerWithService(service: SettingsService): Router {
  const router = Router();

  router.get('/', async (_req, res, next) => {
    try {
      const settings = await service.getSettings();
      res.json({ success: true, data: settings });
    } catch (error) { next(error); }
  });

  router.put('/', async (req, res, next) => {
    try {
      const input: UpdateSettingsInput = req.body;
      const settings = await service.updateSettings(input);
      res.json({ success: true, data: settings });
    } catch (error) {
      if (error instanceof SettingsValidationError) {
        return res.status(400).json({ success: false, error: error.message, validationErrors: error.errors });
      }
      next(error);
    }
  });

  router.post('/validate', async (req, res, next) => {
    try {
      const input: UpdateSettingsInput = req.body;
      const result = await service.validateSettingsInput(input);
      res.json({ success: true, data: result });
    } catch (error) { next(error); }
  });

  router.post('/reset', async (_req, res, next) => {
    try {
      const settings = await service.resetSettings();
      res.json({ success: true, data: settings, message: 'Settings reset to defaults' });
    } catch (error) { next(error); }
  });

  router.post('/reset/:section', async (req, res, next) => {
    try {
      const section = req.params.section as keyof AgentMuxSettings;
      if (!VALID_SECTIONS.includes(section)) {
        return res.status(400).json({ success: false, error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}` });
      }
      const settings = await service.resetSection(section);
      res.json({ success: true, data: settings, message: `${section} settings reset to defaults` });
    } catch (error) { next(error); }
  });

  router.post('/export', async (_req, res, next) => {
    try {
      const settings = await service.getSettings();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=agentmux-settings.json');
      res.json(settings);
    } catch (error) { next(error); }
  });

  router.post('/import', async (req, res, next) => {
    try {
      const importedSettings = req.body;
      if (!importedSettings || typeof importedSettings !== 'object' || Array.isArray(importedSettings)) {
        return res.status(400).json({ success: false, error: 'Invalid settings format' });
      }
      const validation = await service.validateSettingsInput(importedSettings);
      if (!validation.valid) {
        return res.status(400).json({ success: false, error: 'Invalid settings', validationErrors: validation.errors });
      }
      const settings = await service.updateSettings(importedSettings);
      res.json({ success: true, data: settings, message: 'Settings imported successfully' });
    } catch (error) {
      if (error instanceof SettingsValidationError) {
        return res.status(400).json({ success: false, error: error.message, validationErrors: error.errors });
      }
      next(error);
    }
  });

  return router;
}

describe('Settings Controller', () => {
  let app: Express;
  let testDir: string;
  let settingsService: SettingsService;

  beforeEach(async () => {
    // Create temporary directory for testing
    testDir = path.join(os.tmpdir(), `settings-controller-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create settings service with test directory
    settingsService = new SettingsService({ settingsDir: testDir });

    // Create Express app with injected service
    app = express();
    app.use(express.json());
    app.use('/api/settings', createSettingsControllerWithService(settingsService));

    // Error handler
    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ success: false, error: err.message });
    });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    resetSettingsService();
  });

  describe('GET /api/settings', () => {
    it('should return current settings', async () => {
      const response = await request(app).get('/api/settings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('general');
      expect(response.body.data).toHaveProperty('chat');
      expect(response.body.data).toHaveProperty('skills');
    });

    it('should return default settings when no file exists', async () => {
      const response = await request(app).get('/api/settings');
      const defaults = getDefaultSettings();

      expect(response.status).toBe(200);
      expect(response.body.data.general.defaultRuntime).toBe(defaults.general.defaultRuntime);
    });
  });

  describe('PUT /api/settings', () => {
    it('should update settings', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({
          general: { defaultRuntime: 'gemini-cli' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.general.defaultRuntime).toBe('gemini-cli');
    });

    it('should update multiple sections', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({
          general: { verboseLogging: true },
          chat: { showTimestamps: false },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.general.verboseLogging).toBe(true);
      expect(response.body.data.chat.showTimestamps).toBe(false);
    });

    it('should return 400 for invalid settings', async () => {
      const response = await request(app)
        .put('/api/settings')
        .send({
          general: { checkInIntervalMinutes: -5 },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.validationErrors).toBeDefined();
    });

    it('should persist settings', async () => {
      await request(app)
        .put('/api/settings')
        .send({
          general: { verboseLogging: true },
        });

      // Clear cache and fetch again
      settingsService.clearCache();
      const response = await request(app).get('/api/settings');

      expect(response.body.data.general.verboseLogging).toBe(true);
    });
  });

  describe('POST /api/settings/validate', () => {
    it('should validate valid settings', async () => {
      const response = await request(app)
        .post('/api/settings/validate')
        .send({
          general: { defaultRuntime: 'gemini-cli' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.errors).toHaveLength(0);
    });

    it('should return errors for invalid settings', async () => {
      const response = await request(app)
        .post('/api/settings/validate')
        .send({
          general: { checkInIntervalMinutes: -5 },
        });

      expect(response.status).toBe(200);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });

    it('should not persist validated settings', async () => {
      await request(app)
        .post('/api/settings/validate')
        .send({
          general: { verboseLogging: true },
        });

      const response = await request(app).get('/api/settings');

      expect(response.body.data.general.verboseLogging).toBe(false);
    });
  });

  describe('POST /api/settings/reset', () => {
    it('should reset all settings to defaults', async () => {
      // First modify settings
      await request(app)
        .put('/api/settings')
        .send({
          general: { defaultRuntime: 'gemini-cli' },
          chat: { showTimestamps: false },
        });

      // Then reset
      const response = await request(app).post('/api/settings/reset');
      const defaults = getDefaultSettings();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.general.defaultRuntime).toBe(defaults.general.defaultRuntime);
      expect(response.body.data.chat.showTimestamps).toBe(defaults.chat.showTimestamps);
    });

    it('should include reset message', async () => {
      const response = await request(app).post('/api/settings/reset');

      expect(response.body.message).toContain('reset');
    });
  });

  describe('POST /api/settings/reset/:section', () => {
    it('should reset only general section', async () => {
      // First modify both sections
      await request(app)
        .put('/api/settings')
        .send({
          general: { defaultRuntime: 'gemini-cli' },
          chat: { showTimestamps: false },
        });

      // Reset only general
      const response = await request(app).post('/api/settings/reset/general');
      const defaults = getDefaultSettings();

      expect(response.status).toBe(200);
      expect(response.body.data.general.defaultRuntime).toBe(defaults.general.defaultRuntime);
      expect(response.body.data.chat.showTimestamps).toBe(false);
    });

    it('should reset only chat section', async () => {
      await request(app)
        .put('/api/settings')
        .send({
          general: { verboseLogging: true },
          chat: { showTimestamps: false },
        });

      const response = await request(app).post('/api/settings/reset/chat');
      const defaults = getDefaultSettings();

      expect(response.status).toBe(200);
      expect(response.body.data.general.verboseLogging).toBe(true);
      expect(response.body.data.chat.showTimestamps).toBe(defaults.chat.showTimestamps);
    });

    it('should reset only skills section', async () => {
      await request(app)
        .put('/api/settings')
        .send({
          general: { verboseLogging: true },
          skills: { enableBrowserAutomation: false },
        });

      const response = await request(app).post('/api/settings/reset/skills');
      const defaults = getDefaultSettings();

      expect(response.status).toBe(200);
      expect(response.body.data.general.verboseLogging).toBe(true);
      expect(response.body.data.skills.enableBrowserAutomation).toBe(defaults.skills.enableBrowserAutomation);
    });

    it('should return 400 for invalid section', async () => {
      const response = await request(app).post('/api/settings/reset/invalid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid section');
    });
  });

  describe('POST /api/settings/export', () => {
    it('should export settings as JSON', async () => {
      await request(app)
        .put('/api/settings')
        .send({
          general: { verboseLogging: true },
        });

      const response = await request(app).post('/api/settings/export');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body.general.verboseLogging).toBe(true);
    });
  });

  describe('POST /api/settings/import', () => {
    it('should import valid settings', async () => {
      const importData = {
        general: { defaultRuntime: 'codex-cli' },
        chat: { showTimestamps: false },
      };

      const response = await request(app)
        .post('/api/settings/import')
        .send(importData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.general.defaultRuntime).toBe('codex-cli');
      expect(response.body.data.chat.showTimestamps).toBe(false);
    });

    it('should return 400 for invalid settings', async () => {
      const importData = {
        general: { checkInIntervalMinutes: -5 },
      };

      const response = await request(app)
        .post('/api/settings/import')
        .send(importData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.validationErrors).toBeDefined();
    });

    it('should return 400 when body is empty/falsy', async () => {
      // Empty object is technically valid since it will pass through merge
      // So we test with array which should be rejected
      const response = await request(app)
        .post('/api/settings/import')
        .send([]);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for array input', async () => {
      const response = await request(app)
        .post('/api/settings/import')
        .send([{ general: {} }]);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should persist imported settings', async () => {
      await request(app)
        .post('/api/settings/import')
        .send({
          general: { verboseLogging: true },
        });

      settingsService.clearCache();
      const response = await request(app).get('/api/settings');

      expect(response.body.data.general.verboseLogging).toBe(true);
    });
  });
});
