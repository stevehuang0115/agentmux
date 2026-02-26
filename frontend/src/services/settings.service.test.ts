/**
 * Tests for Settings Service
 *
 * @module services/settings.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { settingsService } from './settings.service';
import { CrewlySettings } from '../types/settings.types';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('SettingsService', () => {
  const mockSettings: CrewlySettings = {
    general: {
      defaultRuntime: 'claude-code',
      autoStartOrchestrator: false,
      checkInIntervalMinutes: 5,
      maxConcurrentAgents: 10,
      verboseLogging: false,
      autoResumeOnRestart: true,
      runtimeCommands: {
        'claude-code': 'claude --dangerously-skip-permissions',
        'gemini-cli': 'gemini --yolo',
        'codex-cli': 'codex -a never -s danger-full-access',
      },
    },
    chat: {
      showRawTerminalOutput: false,
      enableTypingIndicator: true,
      maxMessageHistory: 1000,
      autoScrollToBottom: true,
      showTimestamps: true,
    },
    skills: {
      skillsDirectory: '',
      enableBrowserAutomation: true,
      enableScriptExecution: true,
      skillExecutionTimeoutMs: 60000,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should fetch settings successfully', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: mockSettings },
      });

      const result = await settingsService.getSettings();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/settings');
      expect(result).toEqual(mockSettings);
    });

    it('should throw error when request fails', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { success: false, error: 'Failed to get settings' },
      });

      await expect(settingsService.getSettings()).rejects.toThrow('Failed to get settings');
    });
  });

  describe('updateSettings', () => {
    it('should update settings successfully', async () => {
      const input = { general: { verboseLogging: true } };
      const updatedSettings = {
        ...mockSettings,
        general: { ...mockSettings.general, verboseLogging: true },
      };

      mockedAxios.put.mockResolvedValue({
        data: { success: true, data: updatedSettings },
      });

      const result = await settingsService.updateSettings(input);

      expect(mockedAxios.put).toHaveBeenCalledWith('/api/settings', input);
      expect(result.general.verboseLogging).toBe(true);
    });

    it('should throw error when update fails', async () => {
      mockedAxios.put.mockResolvedValue({
        data: { success: false, error: 'Validation failed' },
      });

      await expect(settingsService.updateSettings({})).rejects.toThrow('Validation failed');
    });
  });

  describe('validateSettings', () => {
    it('should validate settings successfully', async () => {
      const input = { general: { verboseLogging: true } };

      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: { valid: true, errors: [] } },
      });

      const result = await settingsService.validateSettings(input);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/settings/validate', input);
      expect(result.valid).toBe(true);
    });

    it('should return validation errors', async () => {
      const input = { general: { checkInIntervalMinutes: -5 } };

      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: { valid: false, errors: ['Check-in interval must be positive'] } },
      });

      const result = await settingsService.validateSettings(input);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Check-in interval must be positive');
    });
  });

  describe('resetSettings', () => {
    it('should reset settings successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: mockSettings },
      });

      const result = await settingsService.resetSettings();

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/settings/reset');
      expect(result).toEqual(mockSettings);
    });

    it('should throw error when reset fails', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: false, error: 'Reset failed' },
      });

      await expect(settingsService.resetSettings()).rejects.toThrow('Reset failed');
    });
  });

  describe('resetSection', () => {
    it('should reset specific section successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: mockSettings },
      });

      const result = await settingsService.resetSection('general');

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/settings/reset/general');
      expect(result).toEqual(mockSettings);
    });

    it('should throw error when section reset fails', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: false, error: 'Invalid section' },
      });

      await expect(settingsService.resetSection('general')).rejects.toThrow('Invalid section');
    });
  });

  describe('exportSettings', () => {
    it('should export settings successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: mockSettings,
      });

      const result = await settingsService.exportSettings();

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/settings/export');
      expect(result).toEqual(mockSettings);
    });
  });

  describe('importSettings', () => {
    it('should import settings successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: mockSettings },
      });

      const result = await settingsService.importSettings(mockSettings);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/settings/import', mockSettings);
      expect(result).toEqual(mockSettings);
    });

    it('should throw error when import fails', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: false, error: 'Invalid format' },
      });

      await expect(settingsService.importSettings(mockSettings)).rejects.toThrow('Invalid format');
    });
  });
});
