/**
 * Tests for useSettings Hook
 *
 * @module hooks/useSettings.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSettings } from './useSettings';
import { settingsService } from '../services/settings.service';
import { CrewlySettings } from '../types/settings.types';

vi.mock('../services/settings.service');

describe('useSettings Hook', () => {
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
        'codex-cli': 'codex --full-auto',
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
    vi.mocked(settingsService.getSettings).mockResolvedValue(mockSettings);
  });

  describe('Initial Load', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useSettings());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.settings).toBe(null);
    });

    it('should load settings on mount', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings).toEqual(mockSettings);
      expect(settingsService.getSettings).toHaveBeenCalledTimes(1);
    });

    it('should set error when load fails', async () => {
      vi.mocked(settingsService.getSettings).mockRejectedValue(new Error('Failed to load'));

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load');
      expect(result.current.settings).toBe(null);
    });
  });

  describe('updateSettings', () => {
    it('should update settings successfully', async () => {
      const updatedSettings = {
        ...mockSettings,
        general: { ...mockSettings.general, verboseLogging: true },
      };
      vi.mocked(settingsService.updateSettings).mockResolvedValue(updatedSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateSettings({ general: { verboseLogging: true } });
      });

      expect(result.current.settings?.general.verboseLogging).toBe(true);
    });

    it('should return updated settings', async () => {
      const updatedSettings = {
        ...mockSettings,
        general: { ...mockSettings.general, verboseLogging: true },
      };
      vi.mocked(settingsService.updateSettings).mockResolvedValue(updatedSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let returnedSettings: CrewlySettings | undefined;
      await act(async () => {
        returnedSettings = await result.current.updateSettings({ general: { verboseLogging: true } });
      });

      expect(returnedSettings?.general.verboseLogging).toBe(true);
    });
  });

  describe('resetSettings', () => {
    it('should reset settings successfully', async () => {
      vi.mocked(settingsService.resetSettings).mockResolvedValue(mockSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.resetSettings();
      });

      expect(settingsService.resetSettings).toHaveBeenCalled();
      expect(result.current.settings).toEqual(mockSettings);
    });
  });

  describe('resetSection', () => {
    it('should reset section successfully', async () => {
      vi.mocked(settingsService.resetSection).mockResolvedValue(mockSettings);

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.resetSection('general');
      });

      expect(settingsService.resetSection).toHaveBeenCalledWith('general');
    });
  });

  describe('refreshSettings', () => {
    it('should refresh settings from server', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(settingsService.getSettings).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refreshSettings();
      });

      expect(settingsService.getSettings).toHaveBeenCalledTimes(2);
    });
  });
});
