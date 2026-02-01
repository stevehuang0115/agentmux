/**
 * Settings Controller
 *
 * REST API endpoints for managing AgentMux application settings.
 *
 * @module controllers/settings/settings.controller
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  getSettingsService,
  SettingsValidationError,
} from '../../services/settings/settings.service.js';
import { UpdateSettingsInput, AgentMuxSettings } from '../../types/settings.types.js';

const router = Router();

/**
 * Valid section names for reset endpoints
 */
const VALID_SECTIONS: (keyof AgentMuxSettings)[] = ['general', 'chat', 'skills'];

/**
 * GET /api/settings
 * Get current application settings
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/settings
 * Update application settings (partial update supported)
 */
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: UpdateSettingsInput = req.body;

    const settingsService = getSettingsService();
    const settings = await settingsService.updateSettings(input);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        validationErrors: error.errors,
      });
    }
    next(error);
  }
});

/**
 * POST /api/settings/validate
 * Validate settings without saving
 */
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input: UpdateSettingsInput = req.body;

    const settingsService = getSettingsService();
    const result = await settingsService.validateSettingsInput(input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/reset
 * Reset all settings to defaults
 */
router.post('/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.resetSettings();

    res.json({
      success: true,
      data: settings,
      message: 'Settings reset to defaults',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/reset/:section
 * Reset a specific settings section to defaults
 */
router.post('/reset/:section', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const section = req.params.section as keyof AgentMuxSettings;

    if (!VALID_SECTIONS.includes(section)) {
      return res.status(400).json({
        success: false,
        error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}`,
      });
    }

    const settingsService = getSettingsService();
    const settings = await settingsService.resetSection(section);

    res.json({
      success: true,
      data: settings,
      message: `${section} settings reset to defaults`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/export
 * Export settings to a downloadable file
 */
router.post('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettings();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=agentmux-settings.json');
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/settings/import
 * Import settings from uploaded JSON
 */
router.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const importedSettings = req.body;

    if (!importedSettings || typeof importedSettings !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings format',
      });
    }

    const settingsService = getSettingsService();

    // Validate first
    const validation = await settingsService.validateSettingsInput(importedSettings);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid settings',
        validationErrors: validation.errors,
      });
    }

    const settings = await settingsService.updateSettings(importedSettings);

    res.json({
      success: true,
      data: settings,
      message: 'Settings imported successfully',
    });
  } catch (error) {
    if (error instanceof SettingsValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        validationErrors: error.errors,
      });
    }
    next(error);
  }
});

export default router;
