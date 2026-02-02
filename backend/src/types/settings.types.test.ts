/**
 * Tests for Settings Type Definitions
 *
 * @module types/settings.types.test
 */

// Jest globals are available automatically
import {
  AIRuntime,
  AgentMuxSettings,
  GeneralSettings,
  ChatSettings,
  SkillsSettings,
  UpdateSettingsInput,
  SettingsValidationResult,
  AI_RUNTIMES,
  SETTINGS_CONSTRAINTS,
  isValidAIRuntime,
  getDefaultSettings,
  validateSettings,
  mergeSettings,
  hasSettingsUpdates,
  getAIRuntimeDisplayName,
} from './settings.types.js';

describe('Settings Types', () => {
  describe('AI_RUNTIMES constant', () => {
    it('should contain all valid AI runtimes', () => {
      expect(AI_RUNTIMES).toContain('claude-code');
      expect(AI_RUNTIMES).toContain('gemini-cli');
      expect(AI_RUNTIMES).toContain('codex-cli');
    });

    it('should have exactly 3 runtimes', () => {
      expect(AI_RUNTIMES).toHaveLength(3);
    });
  });

  describe('SETTINGS_CONSTRAINTS constant', () => {
    it('should have sensible minimum values', () => {
      expect(SETTINGS_CONSTRAINTS.MIN_CHECK_IN_INTERVAL).toBe(1);
      expect(SETTINGS_CONSTRAINTS.MIN_MAX_CONCURRENT_AGENTS).toBe(1);
      expect(SETTINGS_CONSTRAINTS.MIN_MAX_MESSAGE_HISTORY).toBe(10);
      expect(SETTINGS_CONSTRAINTS.MIN_SKILL_EXECUTION_TIMEOUT).toBe(1000);
    });
  });

  describe('GeneralSettings interface', () => {
    it('should define all required properties', () => {
      const settings: GeneralSettings = {
        defaultRuntime: 'claude-code',
        autoStartOrchestrator: false,
        checkInIntervalMinutes: 5,
        maxConcurrentAgents: 10,
        verboseLogging: false,
        claudeCodeCommand: 'claude --flag',
        claudeCodeInitScript: 'scripts/init.sh',
      };

      expect(settings.defaultRuntime).toBe('claude-code');
      expect(settings.autoStartOrchestrator).toBe(false);
      expect(settings.checkInIntervalMinutes).toBe(5);
      expect(settings.maxConcurrentAgents).toBe(10);
      expect(settings.verboseLogging).toBe(false);
      expect(settings.claudeCodeCommand).toBe('claude --flag');
      expect(settings.claudeCodeInitScript).toBe('scripts/init.sh');
    });

    it('should allow custom Claude Code configuration', () => {
      const settings: GeneralSettings = {
        defaultRuntime: 'claude-code',
        autoStartOrchestrator: true,
        checkInIntervalMinutes: 10,
        maxConcurrentAgents: 5,
        verboseLogging: true,
        claudeCodeCommand: '/custom/path/to/claude --dangerously-skip-permissions',
        claudeCodeInitScript: 'custom/runtime_scripts/my_init.sh',
      };

      expect(settings.claudeCodeCommand).toContain('/custom/path');
      expect(settings.claudeCodeInitScript).toContain('custom/runtime_scripts');
    });
  });

  describe('ChatSettings interface', () => {
    it('should define all required properties', () => {
      const settings: ChatSettings = {
        showRawTerminalOutput: false,
        enableTypingIndicator: true,
        maxMessageHistory: 1000,
        autoScrollToBottom: true,
        showTimestamps: true,
      };

      expect(settings.showRawTerminalOutput).toBe(false);
      expect(settings.enableTypingIndicator).toBe(true);
      expect(settings.maxMessageHistory).toBe(1000);
      expect(settings.autoScrollToBottom).toBe(true);
      expect(settings.showTimestamps).toBe(true);
    });
  });

  describe('SkillsSettings interface', () => {
    it('should define all required properties', () => {
      const settings: SkillsSettings = {
        skillsDirectory: '/custom/skills',
        enableBrowserAutomation: true,
        enableScriptExecution: true,
        skillExecutionTimeoutMs: 60000,
      };

      expect(settings.skillsDirectory).toBe('/custom/skills');
      expect(settings.enableBrowserAutomation).toBe(true);
      expect(settings.enableScriptExecution).toBe(true);
      expect(settings.skillExecutionTimeoutMs).toBe(60000);
    });
  });

  describe('AgentMuxSettings interface', () => {
    it('should combine all settings sections', () => {
      const settings: AgentMuxSettings = {
        general: {
          defaultRuntime: 'claude-code',
          autoStartOrchestrator: false,
          checkInIntervalMinutes: 5,
          maxConcurrentAgents: 10,
          verboseLogging: false,
          claudeCodeCommand: 'claude --dangerously-skip-permissions',
          claudeCodeInitScript: 'config/runtime_scripts/initialize_claude.sh',
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

      expect(settings.general).toBeDefined();
      expect(settings.chat).toBeDefined();
      expect(settings.skills).toBeDefined();
      expect(settings.general.claudeCodeCommand).toBeDefined();
      expect(settings.general.claudeCodeInitScript).toBeDefined();
    });
  });

  describe('UpdateSettingsInput interface', () => {
    it('should allow partial updates', () => {
      const input: UpdateSettingsInput = {
        general: { defaultRuntime: 'gemini-cli' },
      };

      expect(input.general?.defaultRuntime).toBe('gemini-cli');
      expect(input.chat).toBeUndefined();
      expect(input.skills).toBeUndefined();
    });

    it('should allow multiple partial sections', () => {
      const input: UpdateSettingsInput = {
        general: { verboseLogging: true },
        chat: { showTimestamps: false },
      };

      expect(input.general?.verboseLogging).toBe(true);
      expect(input.chat?.showTimestamps).toBe(false);
    });
  });

  describe('SettingsValidationResult interface', () => {
    it('should define valid result', () => {
      const result: SettingsValidationResult = {
        valid: true,
        errors: [],
      };

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should define invalid result with errors', () => {
      const result: SettingsValidationResult = {
        valid: false,
        errors: ['Error 1', 'Error 2'],
      };

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('isValidAIRuntime', () => {
    it('should return true for valid runtimes', () => {
      expect(isValidAIRuntime('claude-code')).toBe(true);
      expect(isValidAIRuntime('gemini-cli')).toBe(true);
      expect(isValidAIRuntime('codex-cli')).toBe(true);
    });

    it('should return false for invalid runtimes', () => {
      expect(isValidAIRuntime('invalid')).toBe(false);
      expect(isValidAIRuntime('')).toBe(false);
      expect(isValidAIRuntime('Claude-Code')).toBe(false);
      expect(isValidAIRuntime('claude_code')).toBe(false);
    });

    it('should return false for non-string types coerced to string', () => {
      expect(isValidAIRuntime(String(null))).toBe(false);
      expect(isValidAIRuntime(String(undefined))).toBe(false);
      expect(isValidAIRuntime(String(123))).toBe(false);
    });
  });

  describe('getDefaultSettings', () => {
    it('should return complete default settings', () => {
      const defaults = getDefaultSettings();

      expect(defaults.general).toBeDefined();
      expect(defaults.chat).toBeDefined();
      expect(defaults.skills).toBeDefined();
    });

    it('should have sensible general defaults', () => {
      const defaults = getDefaultSettings();

      expect(defaults.general.defaultRuntime).toBe('claude-code');
      expect(defaults.general.autoStartOrchestrator).toBe(false);
      expect(defaults.general.checkInIntervalMinutes).toBe(5);
      expect(defaults.general.maxConcurrentAgents).toBe(10);
      expect(defaults.general.verboseLogging).toBe(false);
    });

    it('should have Claude Code configuration defaults', () => {
      const defaults = getDefaultSettings();

      expect(defaults.general.claudeCodeCommand).toBe('~/.claude/local/claude --dangerously-skip-permissions');
      expect(defaults.general.claudeCodeInitScript).toBe('config/runtime_scripts/initialize_claude.sh');
    });

    it('should include Claude Code fields in default settings', () => {
      const defaults = getDefaultSettings();

      expect(typeof defaults.general.claudeCodeCommand).toBe('string');
      expect(typeof defaults.general.claudeCodeInitScript).toBe('string');
      expect(defaults.general.claudeCodeCommand.length).toBeGreaterThan(0);
      expect(defaults.general.claudeCodeInitScript.length).toBeGreaterThan(0);
    });

    it('should have sensible chat defaults', () => {
      const defaults = getDefaultSettings();

      expect(defaults.chat.showRawTerminalOutput).toBe(false);
      expect(defaults.chat.enableTypingIndicator).toBe(true);
      expect(defaults.chat.maxMessageHistory).toBe(1000);
      expect(defaults.chat.autoScrollToBottom).toBe(true);
      expect(defaults.chat.showTimestamps).toBe(true);
    });

    it('should have sensible skills defaults', () => {
      const defaults = getDefaultSettings();

      expect(defaults.skills.skillsDirectory).toBe('');
      expect(defaults.skills.enableBrowserAutomation).toBe(true);
      expect(defaults.skills.enableScriptExecution).toBe(true);
      expect(defaults.skills.skillExecutionTimeoutMs).toBe(60000);
    });

    it('should return a new object each time', () => {
      const defaults1 = getDefaultSettings();
      const defaults2 = getDefaultSettings();

      expect(defaults1).not.toBe(defaults2);
      expect(defaults1.general).not.toBe(defaults2.general);
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
      settings.general.defaultRuntime = 'invalid' as AIRuntime;

      const result = validateSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('runtime'))).toBe(true);
    });

    it('should detect negative checkInIntervalMinutes', () => {
      const settings = getDefaultSettings();
      settings.general.checkInIntervalMinutes = -1;

      const result = validateSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Check-in interval'))).toBe(true);
    });

    it('should detect zero checkInIntervalMinutes', () => {
      const settings = getDefaultSettings();
      settings.general.checkInIntervalMinutes = 0;

      const result = validateSettings(settings);

      expect(result.valid).toBe(false);
    });

    it('should detect negative maxConcurrentAgents', () => {
      const settings = getDefaultSettings();
      settings.general.maxConcurrentAgents = 0;

      const result = validateSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Max concurrent agents'))).toBe(true);
    });

    it('should detect too small maxMessageHistory', () => {
      const settings = getDefaultSettings();
      settings.chat.maxMessageHistory = 5;

      const result = validateSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Max message history'))).toBe(true);
    });

    it('should detect too small skillExecutionTimeoutMs', () => {
      const settings = getDefaultSettings();
      settings.skills.skillExecutionTimeoutMs = 500;

      const result = validateSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Skill execution timeout'))).toBe(true);
    });

    it('should collect multiple errors', () => {
      const settings = getDefaultSettings();
      settings.general.defaultRuntime = 'invalid' as AIRuntime;
      settings.general.checkInIntervalMinutes = -1;
      settings.chat.maxMessageHistory = 5;

      const result = validateSettings(settings);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should accept boundary values', () => {
      const settings = getDefaultSettings();
      settings.general.checkInIntervalMinutes = 1;
      settings.general.maxConcurrentAgents = 1;
      settings.chat.maxMessageHistory = 10;
      settings.skills.skillExecutionTimeoutMs = 1000;

      const result = validateSettings(settings);

      expect(result.valid).toBe(true);
    });
  });

  describe('mergeSettings', () => {
    it('should merge partial updates into existing settings', () => {
      const existing = getDefaultSettings();
      const update: UpdateSettingsInput = {
        general: { defaultRuntime: 'gemini-cli' },
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

    it('should merge multiple sections', () => {
      const existing = getDefaultSettings();
      const update: UpdateSettingsInput = {
        general: { verboseLogging: true },
        chat: { showTimestamps: false },
        skills: { enableBrowserAutomation: false },
      };

      const merged = mergeSettings(existing, update);

      expect(merged.general.verboseLogging).toBe(true);
      expect(merged.chat.showTimestamps).toBe(false);
      expect(merged.skills.enableBrowserAutomation).toBe(false);
    });

    it('should handle empty update', () => {
      const existing = getDefaultSettings();
      const update: UpdateSettingsInput = {};

      const merged = mergeSettings(existing, update);

      expect(merged).toEqual(existing);
    });

    it('should handle undefined sections in update', () => {
      const existing = getDefaultSettings();
      const update: UpdateSettingsInput = {
        general: { verboseLogging: true },
        chat: undefined,
        skills: undefined,
      };

      const merged = mergeSettings(existing, update);

      expect(merged.general.verboseLogging).toBe(true);
      expect(merged.chat).toEqual(existing.chat);
      expect(merged.skills).toEqual(existing.skills);
    });

    it('should return a new object', () => {
      const existing = getDefaultSettings();
      const update: UpdateSettingsInput = {};

      const merged = mergeSettings(existing, update);

      expect(merged).not.toBe(existing);
      expect(merged.general).not.toBe(existing.general);
    });
  });

  describe('hasSettingsUpdates', () => {
    it('should return false for empty input', () => {
      const input: UpdateSettingsInput = {};
      expect(hasSettingsUpdates(input)).toBe(false);
    });

    it('should return false for empty sections', () => {
      const input: UpdateSettingsInput = {
        general: {},
        chat: {},
        skills: {},
      };
      expect(hasSettingsUpdates(input)).toBe(false);
    });

    it('should return true for general updates', () => {
      const input: UpdateSettingsInput = {
        general: { verboseLogging: true },
      };
      expect(hasSettingsUpdates(input)).toBe(true);
    });

    it('should return true for chat updates', () => {
      const input: UpdateSettingsInput = {
        chat: { showTimestamps: false },
      };
      expect(hasSettingsUpdates(input)).toBe(true);
    });

    it('should return true for skills updates', () => {
      const input: UpdateSettingsInput = {
        skills: { enableBrowserAutomation: false },
      };
      expect(hasSettingsUpdates(input)).toBe(true);
    });
  });

  describe('getAIRuntimeDisplayName', () => {
    it('should return correct display names', () => {
      expect(getAIRuntimeDisplayName('claude-code')).toBe('Claude Code');
      expect(getAIRuntimeDisplayName('gemini-cli')).toBe('Gemini CLI');
      expect(getAIRuntimeDisplayName('codex-cli')).toBe('Codex CLI');
    });

    it('should handle unknown runtime gracefully', () => {
      const name = getAIRuntimeDisplayName('unknown' as AIRuntime);
      expect(name).toBe('unknown');
    });
  });
});
