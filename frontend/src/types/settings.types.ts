/**
 * Frontend Settings Types
 *
 * Type definitions for Crewly application settings.
 * These types mirror the backend settings types.
 *
 * @module types/settings.types
 */

/**
 * Supported AI runtime types
 */
export type AIRuntime = 'claude-code' | 'gemini-cli' | 'codex-cli';

/**
 * General application settings
 */
export interface GeneralSettings {
  /** Default AI runtime for new agents */
  defaultRuntime: AIRuntime;
  /** Whether to auto-start the orchestrator on launch */
  autoStartOrchestrator: boolean;
  /** How often agents should check in (in minutes) */
  checkInIntervalMinutes: number;
  /** Maximum number of concurrent agents */
  maxConcurrentAgents: number;
  /** Enable verbose logging */
  verboseLogging: boolean;
  /** Whether to auto-resume agent sessions on restart */
  autoResumeOnRestart: boolean;
  /** Per-runtime CLI init commands. Key = runtime type, value = CLI command string */
  runtimeCommands: Record<AIRuntime, string>;
}

/**
 * Chat interface settings
 */
export interface ChatSettings {
  /** Show raw terminal output in chat */
  showRawTerminalOutput: boolean;
  /** Show typing indicator when agents are processing */
  enableTypingIndicator: boolean;
  /** Maximum number of messages to keep in history */
  maxMessageHistory: number;
  /** Automatically scroll to bottom on new messages */
  autoScrollToBottom: boolean;
  /** Show timestamps on messages */
  showTimestamps: boolean;
}

/**
 * Skills-related settings
 */
export interface SkillsSettings {
  /** Custom skills directory path */
  skillsDirectory: string;
  /** Enable browser automation skills */
  enableBrowserAutomation: boolean;
  /** Enable script execution skills */
  enableScriptExecution: boolean;
  /** Default skill execution timeout in milliseconds */
  skillExecutionTimeoutMs: number;
}

/**
 * Complete settings object
 */
export interface CrewlySettings {
  general: GeneralSettings;
  chat: ChatSettings;
  skills: SkillsSettings;
}

/**
 * Partial settings update input
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

/**
 * Available AI runtimes
 */
export const AI_RUNTIMES: AIRuntime[] = ['claude-code', 'gemini-cli', 'codex-cli'];

/**
 * AI runtime display names
 */
export const AI_RUNTIME_DISPLAY_NAMES: Record<AIRuntime, string> = {
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  'codex-cli': 'Codex CLI',
};

/**
 * Get display name for an AI runtime
 *
 * @param runtime - AI runtime type
 * @returns Display name for the runtime
 */
export function getAIRuntimeDisplayName(runtime: AIRuntime): string {
  return AI_RUNTIME_DISPLAY_NAMES[runtime] || runtime;
}

/**
 * Check if a value is a valid AI runtime
 *
 * @param value - Value to check
 * @returns True if valid runtime
 */
export function isValidAIRuntime(value: string): value is AIRuntime {
  return AI_RUNTIMES.includes(value as AIRuntime);
}
