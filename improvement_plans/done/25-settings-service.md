# Task: Implement Settings Service

## Overview

Create a backend service for managing AgentMux application settings. This service handles global configuration options for the application including runtime preferences, chat settings, and skill configurations.

## Priority

**Sprint 1** - Foundation (Settings + Roles)

## Dependencies

- None (can be developed in parallel with role service)

## Files to Create

### 1. `backend/src/types/settings.types.ts`

```typescript
/**
 * Available AI runtime options
 */
export type AIRuntime = 'claude-code' | 'gemini-cli' | 'codex-cli';

/**
 * General application settings
 */
export interface GeneralSettings {
  /** Default AI runtime for new agents */
  defaultRuntime: AIRuntime;

  /** Whether to auto-start the orchestrator on application launch */
  autoStartOrchestrator: boolean;

  /** Agent check-in interval in minutes */
  checkInIntervalMinutes: number;

  /** Maximum concurrent agents allowed */
  maxConcurrentAgents: number;

  /** Enable verbose logging */
  verboseLogging: boolean;
}

/**
 * Chat interface settings
 */
export interface ChatSettings {
  /** Show raw terminal output in chat messages */
  showRawTerminalOutput: boolean;

  /** Enable typing indicator when agent is processing */
  enableTypingIndicator: boolean;

  /** Maximum number of messages to keep in history */
  maxMessageHistory: number;

  /** Auto-scroll to newest messages */
  autoScrollToBottom: boolean;

  /** Show timestamps on messages */
  showTimestamps: boolean;
}

/**
 * Skills system settings
 */
export interface SkillsSettings {
  /** Custom skills directory path */
  skillsDirectory: string;

  /** Enable browser automation capabilities */
  enableBrowserAutomation: boolean;

  /** Enable script execution */
  enableScriptExecution: boolean;

  /** Timeout for skill execution in milliseconds */
  skillExecutionTimeoutMs: number;
}

/**
 * Complete AgentMux settings
 */
export interface AgentMuxSettings {
  general: GeneralSettings;
  chat: ChatSettings;
  skills: SkillsSettings;
}

/**
 * Partial settings for updates
 */
export interface UpdateSettingsInput {
  general?: Partial<GeneralSettings>;
  chat?: Partial<ChatSettings>;
  skills?: Partial<SkillsSettings>;
}

/**
 * Settings validation result
 */
export interface SettingsValidationResult {
  valid: boolean;
  errors: string[];
}
```

### 2. `backend/src/types/settings.types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  AIRuntime,
  AgentMuxSettings,
  isValidAIRuntime,
  getDefaultSettings,
  validateSettings,
  mergeSettings,
} from './settings.types.js';

describe('Settings Types', () => {
  describe('isValidAIRuntime', () => {
    it('should return true for valid runtimes', () => {
      expect(isValidAIRuntime('claude-code')).toBe(true);
      expect(isValidAIRuntime('gemini-cli')).toBe(true);
      expect(isValidAIRuntime('codex-cli')).toBe(true);
    });

    it('should return false for invalid runtimes', () => {
      expect(isValidAIRuntime('invalid')).toBe(false);
      expect(isValidAIRuntime('')).toBe(false);
    });
  });

  describe('getDefaultSettings', () => {
    it('should return complete default settings', () => {
      const defaults = getDefaultSettings();

      expect(defaults.general).toBeDefined();
      expect(defaults.chat).toBeDefined();
      expect(defaults.skills).toBeDefined();
    });

    it('should have sensible default values', () => {
      const defaults = getDefaultSettings();

      expect(defaults.general.defaultRuntime).toBe('claude-code');
      expect(defaults.general.autoStartOrchestrator).toBe(false);
      expect(defaults.chat.maxMessageHistory).toBeGreaterThan(0);
    });
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const settings = getDefaultSettings();
      const result = validateSettings(settings);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid runtime', () => {
      const settings = getDefaultSettings();
      settings.general.defaultRuntime = 'invalid' as any;

      const result = validateSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('runtime'))).toBe(true);
    });

    it('should detect negative values', () => {
      const settings = getDefaultSettings();
      settings.general.checkInIntervalMinutes = -1;

      const result = validateSettings(settings);

      expect(result.valid).toBe(false);
    });
  });

  describe('mergeSettings', () => {
    it('should merge partial updates into existing settings', () => {
      const existing = getDefaultSettings();
      const update = {
        general: { defaultRuntime: 'gemini-cli' as const },
      };

      const merged = mergeSettings(existing, update);

      expect(merged.general.defaultRuntime).toBe('gemini-cli');
      expect(merged.general.autoStartOrchestrator).toBe(existing.general.autoStartOrchestrator);
      expect(merged.chat).toEqual(existing.chat);
    });

    it('should not modify the original settings', () => {
      const existing = getDefaultSettings();
      const originalRuntime = existing.general.defaultRuntime;

      mergeSettings(existing, {
        general: { defaultRuntime: 'gemini-cli' },
      });

      expect(existing.general.defaultRuntime).toBe(originalRuntime);
    });
  });
});
```

### 3. `backend/src/services/settings/settings.service.ts`

```typescript
import { promises as fs } from 'fs';
import path from 'path';
import {
  AgentMuxSettings,
  UpdateSettingsInput,
  SettingsValidationResult,
  getDefaultSettings,
  validateSettings,
  mergeSettings,
} from '../../types/settings.types.js';

/**
 * Service for managing AgentMux application settings
 *
 * Settings are stored in ~/.agentmux/settings.json
 * Default values are used when no settings file exists
 */
export class SettingsService {
  private readonly settingsDir: string;
  private readonly settingsFile: string;
  private settingsCache: AgentMuxSettings | null = null;

  constructor(options?: { settingsDir?: string }) {
    this.settingsDir = options?.settingsDir ??
      path.join(process.env.HOME || '~', '.agentmux');
    this.settingsFile = path.join(this.settingsDir, 'settings.json');
  }

  /**
   * Get current settings, loading from file if not cached
   */
  async getSettings(): Promise<AgentMuxSettings> {
    if (this.settingsCache) {
      return this.settingsCache;
    }

    try {
      const content = await fs.readFile(this.settingsFile, 'utf-8');
      const loaded = JSON.parse(content);
      this.settingsCache = mergeSettings(getDefaultSettings(), loaded);
      return this.settingsCache;
    } catch (error) {
      // File doesn't exist or is invalid, return defaults
      return getDefaultSettings();
    }
  }

  /**
   * Update settings with partial input
   */
  async updateSettings(input: UpdateSettingsInput): Promise<AgentMuxSettings> {
    const current = await this.getSettings();
    const merged = mergeSettings(current, input);

    const validation = validateSettings(merged);
    if (!validation.valid) {
      throw new SettingsValidationError(validation.errors);
    }

    await this.saveSettings(merged);
    this.settingsCache = merged;
    return merged;
  }

  /**
   * Reset all settings to defaults
   */
  async resetSettings(): Promise<AgentMuxSettings> {
    const defaults = getDefaultSettings();
    await this.saveSettings(defaults);
    this.settingsCache = defaults;
    return defaults;
  }

  /**
   * Reset a specific settings section to defaults
   */
  async resetSection(
    section: keyof AgentMuxSettings
  ): Promise<AgentMuxSettings> {
    const current = await this.getSettings();
    const defaults = getDefaultSettings();

    const updated = {
      ...current,
      [section]: defaults[section],
    };

    await this.saveSettings(updated);
    this.settingsCache = updated;
    return updated;
  }

  /**
   * Validate settings without saving
   */
  async validateSettingsInput(
    input: UpdateSettingsInput
  ): Promise<SettingsValidationResult> {
    const current = await this.getSettings();
    const merged = mergeSettings(current, input);
    return validateSettings(merged);
  }

  /**
   * Export settings to a file
   */
  async exportSettings(exportPath: string): Promise<void> {
    const settings = await this.getSettings();
    await fs.writeFile(exportPath, JSON.stringify(settings, null, 2));
  }

  /**
   * Import settings from a file
   */
  async importSettings(importPath: string): Promise<AgentMuxSettings> {
    const content = await fs.readFile(importPath, 'utf-8');
    const imported = JSON.parse(content);

    const defaults = getDefaultSettings();
    const merged = mergeSettings(defaults, imported);

    const validation = validateSettings(merged);
    if (!validation.valid) {
      throw new SettingsValidationError(validation.errors);
    }

    await this.saveSettings(merged);
    this.settingsCache = merged;
    return merged;
  }

  /**
   * Clear the settings cache (useful for testing)
   */
  clearCache(): void {
    this.settingsCache = null;
  }

  private async saveSettings(settings: AgentMuxSettings): Promise<void> {
    await fs.mkdir(this.settingsDir, { recursive: true });
    await fs.writeFile(
      this.settingsFile,
      JSON.stringify(settings, null, 2)
    );
  }
}

export class SettingsValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Settings validation failed: ${errors.join(', ')}`);
    this.name = 'SettingsValidationError';
  }
}

// Singleton instance
let settingsServiceInstance: SettingsService | null = null;

export function getSettingsService(): SettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new SettingsService();
  }
  return settingsServiceInstance;
}

export function resetSettingsService(): void {
  settingsServiceInstance = null;
}
```

### 4. `backend/src/services/settings/settings.service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  SettingsService,
  SettingsValidationError,
  getSettingsService,
  resetSettingsService,
} from './settings.service.js';
import { getDefaultSettings } from '../../types/settings.types.js';

describe('SettingsService', () => {
  let service: SettingsService;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `settings-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    service = new SettingsService({ settingsDir: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    resetSettingsService();
  });

  describe('getSettings', () => {
    it('should return defaults when no settings file exists', async () => {
      const settings = await service.getSettings();
      const defaults = getDefaultSettings();

      expect(settings).toEqual(defaults);
    });

    it('should load settings from file', async () => {
      const customSettings = getDefaultSettings();
      customSettings.general.defaultRuntime = 'gemini-cli';

      await fs.writeFile(
        path.join(testDir, 'settings.json'),
        JSON.stringify(customSettings, null, 2)
      );

      service.clearCache();
      const settings = await service.getSettings();

      expect(settings.general.defaultRuntime).toBe('gemini-cli');
    });

    it('should cache settings after loading', async () => {
      const settings1 = await service.getSettings();
      const settings2 = await service.getSettings();

      expect(settings1).toBe(settings2);
    });

    it('should merge loaded settings with defaults', async () => {
      // Save partial settings
      await fs.writeFile(
        path.join(testDir, 'settings.json'),
        JSON.stringify({ general: { defaultRuntime: 'gemini-cli' } })
      );

      service.clearCache();
      const settings = await service.getSettings();

      // Should have the custom value
      expect(settings.general.defaultRuntime).toBe('gemini-cli');
      // Should have default values for missing properties
      expect(settings.chat.maxMessageHistory).toBe(
        getDefaultSettings().chat.maxMessageHistory
      );
    });
  });

  describe('updateSettings', () => {
    it('should update partial settings', async () => {
      const updated = await service.updateSettings({
        general: { defaultRuntime: 'gemini-cli' },
      });

      expect(updated.general.defaultRuntime).toBe('gemini-cli');
      // Other settings should be defaults
      expect(updated.general.autoStartOrchestrator).toBe(false);
    });

    it('should persist settings to file', async () => {
      await service.updateSettings({
        chat: { showTimestamps: false },
      });

      // Create a new service instance to verify persistence
      const newService = new SettingsService({ settingsDir: testDir });
      const settings = await newService.getSettings();

      expect(settings.chat.showTimestamps).toBe(false);
    });

    it('should validate settings before saving', async () => {
      await expect(
        service.updateSettings({
          general: { checkInIntervalMinutes: -5 },
        })
      ).rejects.toThrow(SettingsValidationError);
    });

    it('should update cache after saving', async () => {
      await service.updateSettings({
        general: { defaultRuntime: 'codex-cli' },
      });

      const settings = await service.getSettings();
      expect(settings.general.defaultRuntime).toBe('codex-cli');
    });
  });

  describe('resetSettings', () => {
    it('should reset all settings to defaults', async () => {
      // First customize settings
      await service.updateSettings({
        general: { defaultRuntime: 'gemini-cli' },
        chat: { showTimestamps: false },
      });

      // Then reset
      const reset = await service.resetSettings();

      expect(reset).toEqual(getDefaultSettings());
    });

    it('should persist reset to file', async () => {
      await service.updateSettings({
        general: { defaultRuntime: 'gemini-cli' },
      });

      await service.resetSettings();

      const newService = new SettingsService({ settingsDir: testDir });
      const settings = await newService.getSettings();

      expect(settings.general.defaultRuntime).toBe('claude-code');
    });
  });

  describe('resetSection', () => {
    it('should reset only specified section', async () => {
      await service.updateSettings({
        general: { defaultRuntime: 'gemini-cli' },
        chat: { showTimestamps: false },
      });

      await service.resetSection('general');
      const settings = await service.getSettings();

      // General should be reset
      expect(settings.general.defaultRuntime).toBe('claude-code');
      // Chat should remain customized
      expect(settings.chat.showTimestamps).toBe(false);
    });
  });

  describe('validateSettingsInput', () => {
    it('should validate without saving', async () => {
      const result = await service.validateSettingsInput({
        general: { checkInIntervalMinutes: -5 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Settings should not have changed
      const settings = await service.getSettings();
      expect(settings.general.checkInIntervalMinutes).toBeGreaterThan(0);
    });
  });

  describe('exportSettings', () => {
    it('should export settings to file', async () => {
      await service.updateSettings({
        general: { defaultRuntime: 'gemini-cli' },
      });

      const exportPath = path.join(testDir, 'export.json');
      await service.exportSettings(exportPath);

      const content = await fs.readFile(exportPath, 'utf-8');
      const exported = JSON.parse(content);

      expect(exported.general.defaultRuntime).toBe('gemini-cli');
    });
  });

  describe('importSettings', () => {
    it('should import settings from file', async () => {
      const importData = getDefaultSettings();
      importData.general.defaultRuntime = 'codex-cli';

      const importPath = path.join(testDir, 'import.json');
      await fs.writeFile(importPath, JSON.stringify(importData));

      const imported = await service.importSettings(importPath);

      expect(imported.general.defaultRuntime).toBe('codex-cli');
    });

    it('should validate imported settings', async () => {
      const importPath = path.join(testDir, 'invalid-import.json');
      await fs.writeFile(
        importPath,
        JSON.stringify({ general: { checkInIntervalMinutes: -5 } })
      );

      await expect(service.importSettings(importPath)).rejects.toThrow(
        SettingsValidationError
      );
    });
  });
});

describe('getSettingsService', () => {
  afterEach(() => {
    resetSettingsService();
  });

  it('should return singleton instance', () => {
    const instance1 = getSettingsService();
    const instance2 = getSettingsService();
    expect(instance1).toBe(instance2);
  });
});
```

## Utility Functions in settings.types.ts

Add these to the types file:

```typescript
/**
 * Check if a value is a valid AI runtime
 */
export function isValidAIRuntime(value: string): value is AIRuntime {
  return ['claude-code', 'gemini-cli', 'codex-cli'].includes(value);
}

/**
 * Get default settings
 */
export function getDefaultSettings(): AgentMuxSettings {
  return {
    general: {
      defaultRuntime: 'claude-code',
      autoStartOrchestrator: false,
      checkInIntervalMinutes: 5,
      maxConcurrentAgents: 10,
      verboseLogging: false,
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
}

/**
 * Validate settings
 */
export function validateSettings(
  settings: AgentMuxSettings
): SettingsValidationResult {
  const errors: string[] = [];

  // Validate general settings
  if (!isValidAIRuntime(settings.general.defaultRuntime)) {
    errors.push('Invalid default runtime');
  }
  if (settings.general.checkInIntervalMinutes < 1) {
    errors.push('Check-in interval must be at least 1 minute');
  }
  if (settings.general.maxConcurrentAgents < 1) {
    errors.push('Max concurrent agents must be at least 1');
  }

  // Validate chat settings
  if (settings.chat.maxMessageHistory < 10) {
    errors.push('Max message history must be at least 10');
  }

  // Validate skills settings
  if (settings.skills.skillExecutionTimeoutMs < 1000) {
    errors.push('Skill execution timeout must be at least 1000ms');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Deep merge settings with partial updates
 */
export function mergeSettings(
  existing: AgentMuxSettings,
  updates: UpdateSettingsInput
): AgentMuxSettings {
  return {
    general: { ...existing.general, ...updates.general },
    chat: { ...existing.chat, ...updates.chat },
    skills: { ...existing.skills, ...updates.skills },
  };
}
```

## Acceptance Criteria

- [ ] Settings types are fully defined with JSDoc comments
- [ ] SettingsService class is fully implemented
- [ ] Settings persist to ~/.agentmux/settings.json
- [ ] Default values are applied when settings are missing
- [ ] Validation prevents invalid settings from being saved
- [ ] Export/import functionality works correctly
- [ ] Reset functionality works for all and individual sections
- [ ] Comprehensive test coverage (>80%)
- [ ] Singleton pattern implemented correctly

## Testing Requirements

1. Unit tests for all type utility functions
2. Integration tests for file persistence
3. Validation tests for all constraint rules
4. Edge case tests (missing file, corrupted JSON)
5. Export/import round-trip tests

## Notes

- Use deep merge for partial updates
- Validate all settings before saving
- Always return defaults for missing sections
- Support both ~/.agentmux and configurable paths for testing
