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
  CrewlySettings,
  UpdateSettingsInput,
} from '../types/settings.types';

/**
 * Return type for useSettings hook
 */
export interface UseSettingsResult {
  /** Current settings */
  settings: CrewlySettings | null;
  /** Whether settings are loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Update settings */
  updateSettings: (input: UpdateSettingsInput) => Promise<CrewlySettings>;
  /** Reset all settings to defaults */
  resetSettings: () => Promise<CrewlySettings>;
  /** Reset a specific section to defaults */
  resetSection: (section: keyof CrewlySettings) => Promise<CrewlySettings>;
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
  const [settings, setSettings] = useState<CrewlySettings | null>(null);
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
  const updateSettings = useCallback(async (input: UpdateSettingsInput): Promise<CrewlySettings> => {
    const updated = await settingsService.updateSettings(input);
    setSettings(updated);
    return updated;
  }, []);

  /**
   * Reset all settings to defaults
   */
  const resetSettings = useCallback(async (): Promise<CrewlySettings> => {
    const defaults = await settingsService.resetSettings();
    setSettings(defaults);
    return defaults;
  }, []);

  /**
   * Reset a specific section to defaults
   */
  const resetSection = useCallback(async (section: keyof CrewlySettings): Promise<CrewlySettings> => {
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
