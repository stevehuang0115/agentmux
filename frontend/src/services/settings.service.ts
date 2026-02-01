/**
 * Settings Service
 *
 * API client for settings management endpoints.
 *
 * @module services/settings.service
 */

import axios from 'axios';
import {
  AgentMuxSettings,
  UpdateSettingsInput,
  SettingsValidationResult,
} from '../types/settings.types';
import { ApiResponse } from '../types';

/** Base URL for settings API */
const SETTINGS_API_BASE = '/api/settings';

/**
 * Settings service for managing application settings via API
 */
class SettingsService {
  /**
   * Get current settings
   *
   * @returns Promise resolving to current settings
   * @throws Error if request fails
   */
  async getSettings(): Promise<AgentMuxSettings> {
    const response = await axios.get<ApiResponse<AgentMuxSettings>>(SETTINGS_API_BASE);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to get settings');
    }
    return response.data.data;
  }

  /**
   * Update settings (partial update supported)
   *
   * @param input - Settings to update
   * @returns Promise resolving to updated settings
   * @throws Error if validation fails or request fails
   */
  async updateSettings(input: UpdateSettingsInput): Promise<AgentMuxSettings> {
    const response = await axios.put<ApiResponse<AgentMuxSettings>>(SETTINGS_API_BASE, input);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update settings');
    }
    return response.data.data;
  }

  /**
   * Validate settings without saving
   *
   * @param input - Settings to validate
   * @returns Promise resolving to validation result
   * @throws Error if request fails
   */
  async validateSettings(input: UpdateSettingsInput): Promise<SettingsValidationResult> {
    const response = await axios.post<ApiResponse<SettingsValidationResult>>(
      `${SETTINGS_API_BASE}/validate`,
      input
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to validate settings');
    }
    return response.data.data;
  }

  /**
   * Reset all settings to defaults
   *
   * @returns Promise resolving to default settings
   * @throws Error if request fails
   */
  async resetSettings(): Promise<AgentMuxSettings> {
    const response = await axios.post<ApiResponse<AgentMuxSettings>>(
      `${SETTINGS_API_BASE}/reset`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to reset settings');
    }
    return response.data.data;
  }

  /**
   * Reset a specific settings section to defaults
   *
   * @param section - Settings section to reset
   * @returns Promise resolving to updated settings
   * @throws Error if request fails
   */
  async resetSection(section: keyof AgentMuxSettings): Promise<AgentMuxSettings> {
    const response = await axios.post<ApiResponse<AgentMuxSettings>>(
      `${SETTINGS_API_BASE}/reset/${section}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to reset section');
    }
    return response.data.data;
  }

  /**
   * Export settings as downloadable JSON
   *
   * @returns Promise resolving to settings object
   * @throws Error if request fails
   */
  async exportSettings(): Promise<AgentMuxSettings> {
    const response = await axios.post<AgentMuxSettings>(`${SETTINGS_API_BASE}/export`);
    return response.data;
  }

  /**
   * Import settings from JSON
   *
   * @param settings - Settings to import
   * @returns Promise resolving to imported settings
   * @throws Error if validation fails or request fails
   */
  async importSettings(settings: AgentMuxSettings): Promise<AgentMuxSettings> {
    const response = await axios.post<ApiResponse<AgentMuxSettings>>(
      `${SETTINGS_API_BASE}/import`,
      settings
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to import settings');
    }
    return response.data.data;
  }
}

/** Singleton instance */
export const settingsService = new SettingsService();

export default settingsService;
