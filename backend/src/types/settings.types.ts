/**
 * Settings Type Definitions
 *
 * Types for managing Crewly application settings including
 * runtime preferences, chat settings, and skill configurations.
 *
 * @module types/settings.types
 */

/**
 * Available AI runtime options
 */
export type AIRuntime = 'claude-code' | 'gemini-cli' | 'codex-cli';

/**
 * Array of all valid AI runtimes
 */
export const AI_RUNTIMES: readonly AIRuntime[] = [
  'claude-code',
  'gemini-cli',
  'codex-cli',
] as const;

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

  /** Whether to auto-resume agent sessions on restart */
  autoResumeOnRestart: boolean;

  /** Per-runtime CLI init commands. Key = runtime type, value = CLI command string */
  runtimeCommands: Record<AIRuntime, string>;

  /** Minutes of inactivity before an agent is automatically suspended (0 = disabled) */
  agentIdleTimeoutMinutes: number;

  /** Enable proactive context compaction based on cumulative terminal output volume */
  enableProactiveCompact: boolean;

  /** Enable Self Evolution mode — orchestrator monitors for errors and self-triages */
  enableSelfEvolution: boolean;
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

  /** Browser runtime profile used when generating MCP browser config */
  browserProfile?: {
    headless: boolean;
    stealth: boolean;
    humanDelayMinMs: number;
    humanDelayMaxMs: number;
  };

  /** Enable script execution */
  enableScriptExecution: boolean;

  /** Timeout for skill execution in milliseconds */
  skillExecutionTimeoutMs: number;
}

/**
 * Complete Crewly settings
 */
export interface CrewlySettings {
  /** General application settings */
  general: GeneralSettings;

  /** Chat interface settings */
  chat: ChatSettings;

  /** Skills system settings */
  skills: SkillsSettings;
}

/**
 * Partial settings for updates
 */
export interface UpdateSettingsInput {
  /** Partial general settings */
  general?: Partial<GeneralSettings>;

  /** Partial chat settings */
  chat?: Partial<ChatSettings>;

  /** Partial skills settings */
  skills?: Partial<SkillsSettings>;
}

/**
 * Settings validation result
 */
export interface SettingsValidationResult {
  /** Whether the settings are valid */
  valid: boolean;

  /** Array of validation error messages */
  errors: string[];
}

// ============================================================================
// Settings Constants
// ============================================================================

/**
 * Minimum values for numeric settings
 */
export const SETTINGS_CONSTRAINTS = {
  MIN_CHECK_IN_INTERVAL: 1,
  MIN_MAX_CONCURRENT_AGENTS: 1,
  MIN_MAX_MESSAGE_HISTORY: 10,
  MIN_SKILL_EXECUTION_TIMEOUT: 1000,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard to check if a string is a valid AI runtime
 *
 * @param value - The string to check
 * @returns True if the value is a valid AI runtime
 *
 * @example
 * ```typescript
 * if (isValidAIRuntime(input)) {
 *   // input is typed as AIRuntime
 * }
 * ```
 */
export function isValidAIRuntime(value: string): value is AIRuntime {
  return AI_RUNTIMES.includes(value as AIRuntime);
}

/**
 * Get default settings with all sensible values
 *
 * @returns Complete Crewly settings with default values
 *
 * @example
 * ```typescript
 * const defaults = getDefaultSettings();
 * console.log(defaults.general.defaultRuntime); // 'claude-code'
 * ```
 */
export function getDefaultSettings(): CrewlySettings {
  return {
    general: {
      defaultRuntime: 'claude-code',
      autoStartOrchestrator: true,
      checkInIntervalMinutes: 5,
      maxConcurrentAgents: 10,
      verboseLogging: false,
      autoResumeOnRestart: true,
      runtimeCommands: {
        'claude-code': 'claude --dangerously-skip-permissions',
        'gemini-cli': 'gemini --yolo',
        'codex-cli': 'codex -a never -s danger-full-access',
      },
      agentIdleTimeoutMinutes: 10,
      enableProactiveCompact: true,
      enableSelfEvolution: false,
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
      browserProfile: {
        headless: true,
        stealth: false,
        humanDelayMinMs: 300,
        humanDelayMaxMs: 1200,
      },
      enableScriptExecution: true,
      skillExecutionTimeoutMs: 60000,
    },
  };
}

/**
 * Validate settings and return validation result
 *
 * @param settings - The settings to validate
 * @returns Validation result with valid flag and any errors
 *
 * @example
 * ```typescript
 * const result = validateSettings(settings);
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export function validateSettings(settings: CrewlySettings): SettingsValidationResult {
  const errors: string[] = [];

  // Validate general settings
  if (!isValidAIRuntime(settings.general.defaultRuntime)) {
    errors.push(`Invalid default runtime: ${settings.general.defaultRuntime}`);
  }

  if (typeof settings.general.autoStartOrchestrator !== 'boolean') {
    errors.push('autoStartOrchestrator must be a boolean');
  }

  if (typeof settings.general.autoResumeOnRestart !== 'boolean') {
    errors.push('autoResumeOnRestart must be a boolean');
  }

  if (settings.general.checkInIntervalMinutes < SETTINGS_CONSTRAINTS.MIN_CHECK_IN_INTERVAL) {
    errors.push(`Check-in interval must be at least ${SETTINGS_CONSTRAINTS.MIN_CHECK_IN_INTERVAL} minute`);
  }

  if (settings.general.maxConcurrentAgents < SETTINGS_CONSTRAINTS.MIN_MAX_CONCURRENT_AGENTS) {
    errors.push(`Max concurrent agents must be at least ${SETTINGS_CONSTRAINTS.MIN_MAX_CONCURRENT_AGENTS}`);
  }

  if (typeof settings.general.agentIdleTimeoutMinutes === 'number' && settings.general.agentIdleTimeoutMinutes < 0) {
    errors.push('agentIdleTimeoutMinutes must be >= 0 (0 disables idle suspension)');
  }

  if (typeof settings.general.enableProactiveCompact !== 'boolean') {
    errors.push('enableProactiveCompact must be a boolean');
  }

  if (typeof settings.general.enableSelfEvolution !== 'undefined' && typeof settings.general.enableSelfEvolution !== 'boolean') {
    errors.push('enableSelfEvolution must be a boolean');
  }

  // Validate runtimeCommands
  if (settings.general.runtimeCommands) {
    for (const runtime of AI_RUNTIMES) {
      const cmd = settings.general.runtimeCommands[runtime];
      if (typeof cmd !== 'string' || cmd.trim().length === 0) {
        errors.push(`Runtime command for ${runtime} must be a non-empty string`);
      }
    }
  }

  // Validate chat settings
  if (settings.chat.maxMessageHistory < SETTINGS_CONSTRAINTS.MIN_MAX_MESSAGE_HISTORY) {
    errors.push(`Max message history must be at least ${SETTINGS_CONSTRAINTS.MIN_MAX_MESSAGE_HISTORY}`);
  }

  // Validate skills settings
  if (settings.skills.skillExecutionTimeoutMs < SETTINGS_CONSTRAINTS.MIN_SKILL_EXECUTION_TIMEOUT) {
    errors.push(`Skill execution timeout must be at least ${SETTINGS_CONSTRAINTS.MIN_SKILL_EXECUTION_TIMEOUT}ms`);
  }

  if (settings.skills.browserProfile) {
    if (typeof settings.skills.browserProfile.headless !== 'boolean') {
      errors.push('skills.browserProfile.headless must be a boolean');
    }
    if (typeof settings.skills.browserProfile.stealth !== 'boolean') {
      errors.push('skills.browserProfile.stealth must be a boolean');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Deep merge settings with partial updates
 *
 * Creates a new settings object without modifying the originals.
 *
 * @param existing - The existing settings
 * @param updates - Partial updates to apply
 * @returns New settings object with updates applied
 *
 * @example
 * ```typescript
 * const updated = mergeSettings(current, {
 *   general: { defaultRuntime: 'gemini-cli' },
 * });
 * ```
 */
export function mergeSettings(
  existing: CrewlySettings,
  updates: UpdateSettingsInput
): CrewlySettings {
  return {
    general: { ...existing.general, ...updates.general },
    chat: { ...existing.chat, ...updates.chat },
    skills: { ...existing.skills, ...updates.skills },
  };
}

/**
 * Check if a partial settings object has any defined values
 *
 * @param settings - The partial settings to check
 * @returns True if any section has defined values
 */
export function hasSettingsUpdates(settings: UpdateSettingsInput): boolean {
  if (settings.general && Object.keys(settings.general).length > 0) {
    return true;
  }
  if (settings.chat && Object.keys(settings.chat).length > 0) {
    return true;
  }
  if (settings.skills && Object.keys(settings.skills).length > 0) {
    return true;
  }
  return false;
}

/**
 * Get the display name for an AI runtime
 *
 * @param runtime - The AI runtime
 * @returns Human-readable display name
 */
export function getAIRuntimeDisplayName(runtime: AIRuntime): string {
  switch (runtime) {
    case 'claude-code':
      return 'Claude Code';
    case 'gemini-cli':
      return 'Gemini CLI';
    case 'codex-cli':
      return 'Codex CLI';
    default:
      return runtime;
  }
}
