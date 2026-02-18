/**
 * Idle State Pattern Definitions
 *
 * Patterns for detecting when an agent has returned
 * to an idle state (shell prompt, Claude exited, etc.).
 *
 * @module services/continuation/patterns/idle-patterns
 */

/**
 * Patterns indicating shell prompt is visible (agent returned to shell)
 */
export const SHELL_PROMPT_PATTERNS: RegExp[] = [
  /\$\s*$/m,
  />\s*$/m,
  /❯\s*$/m,
  /%\s*$/m,
  /bash-\d+\.\d+\$\s*$/m,
  /zsh.*%\s*$/m,
  /Type\s+your\s+message/i,
  /YOLO\s+mode/i,
];

/**
 * Patterns indicating Claude Code has exited or is idle
 */
export const CLAUDE_IDLE_PATTERNS: RegExp[] = [
  /Claude\s+(Code\s+)?exited/i,
  /Session\s+ended/i,
  /Goodbye/i,
  /claude\s+code\s+session\s+complete/i,
  /conversation\s+ended/i,
];

/**
 * Patterns indicating a process has completed
 */
export const PROCESS_COMPLETE_PATTERNS: RegExp[] = [
  /Done\s+in\s+\d+/i,
  /Finished\s+in\s+\d+/i,
  /Process\s+exited/i,
  /\[Process completed\]/i,
];

/**
 * All idle pattern categories
 */
export const IDLE_PATTERNS = {
  shellPrompt: SHELL_PROMPT_PATTERNS,
  claudeIdle: CLAUDE_IDLE_PATTERNS,
  processComplete: PROCESS_COMPLETE_PATTERNS,
} as const;
