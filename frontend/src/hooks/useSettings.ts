/**
 * useSettings Hook
 *
 * React hook for managing application settings.
 * Provides CRUD operations and state management for settings.
 *
 * @module hooks/useSettings
 */

import { useState, useEffect, useCallback } from 'react';
import { settingsService } from '../services/settings.service';
import {
  AgentMuxSettings,
  UpdateSettingsInput,
} from '../types/settings.types';

/**
 * Return type for useSettings hook
 */
export interface UseSettingsResult {
  /** Current settings */
  settings: AgentMuxSettings | null;
  /** Whether settings are loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Update settings */
  updateSettings: (input: UpdateSettingsInput) => Promise<AgentMuxSettings>;
  /** Reset all settings to defaults */
  resetSettings: () => Promise<AgentMuxSettings>;
  /** Reset a specific section to defaults */
  resetSection: (section: keyof AgentMuxSettings) => Promise<AgentMuxSettings>;
  /** Refresh settings from server */
  refreshSettings: () => Promise<void>;
}

/**
 * Hook for managing application settings
 *
 * @returns Settings state and operations
 *
 * @example
 * ```tsx
 * const { settings, updateSettings, isLoading } = useSettings();
 *
 * const handleChange = async () => {
 *   await updateSettings({ general: { verboseLogging: true } });
 * };
 * ```
 */
export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<AgentMuxSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch settings from server
   */
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await settingsService.getSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update settings
   */
  const updateSettings = useCallback(async (input: UpdateSettingsInput): Promise<AgentMuxSettings> => {
    const updated = await settingsService.updateSettings(input);
    setSettings(updated);
    return updated;
  }, []);

  /**
   * Reset all settings to defaults
   */
  const resetSettings = useCallback(async (): Promise<AgentMuxSettings> => {
    const defaults = await settingsService.resetSettings();
    setSettings(defaults);
    return defaults;
  }, []);

  /**
   * Reset a specific section to defaults
   */
  const resetSection = useCallback(async (section: keyof AgentMuxSettings): Promise<AgentMuxSettings> => {
    const updated = await settingsService.resetSection(section);
    setSettings(updated);
    return updated;
  }, []);

  /**
   * Refresh settings from server
   */
  const refreshSettings = useCallback(async (): Promise<void> => {
    await fetchSettings();
  }, [fetchSettings]);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    resetSettings,
    resetSection,
    refreshSettings,
  };
}

export default useSettings;
