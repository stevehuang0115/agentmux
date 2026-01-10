/**
 * Logger service for MCP Server
 *
 * Provides structured logging with levels and optional context.
 * In production, only warn and error are shown by default.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  sessionName?: string;
  toolName?: string;
  requestId?: string;
  [key: string]: unknown;
}

interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  showTimestamp: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_CONFIG: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug'),
  prefix: '[MCP]',
  showTimestamp: true,
};

/**
 * Format additional data for logging
 *
 * @param data - Any additional data to format
 * @returns Formatted string representation
 */
function formatAdditionalData(data: unknown): string {
  if (data === undefined || data === null) {
    return '';
  }
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof Error) {
    return `${data.message}${data.stack ? `\n  Stack: ${data.stack}` : ''}`;
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/**
 * MCP Logger class for structured logging
 *
 * Provides log levels, context support, and child loggers.
 */
export class MCPLogger {
  private config: LoggerConfig;
  private context: LogContext;

  constructor(config: Partial<LoggerConfig> = {}, context: LogContext = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   *
   * @param context - Additional context to merge with parent context
   * @returns New logger instance with merged context
   */
  child(context: LogContext): MCPLogger {
    return new MCPLogger(this.config, { ...this.context, ...context });
  }

  /**
   * Set the minimum log level
   *
   * @param level - Minimum level to display
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Check if a log level is enabled
   *
   * @param level - Level to check
   * @returns True if the level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  /**
   * Format a log message with timestamp and prefix
   *
   * @param level - Log level
   * @param message - Message to log
   * @returns Formatted log string
   */
  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = [];

    if (this.config.showTimestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(this.config.prefix);
    parts.push(`[${level.toUpperCase()}]`);

    if (Object.keys(this.context).length > 0) {
      const contextStr = Object.entries(this.context)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      if (contextStr) {
        parts.push(`(${contextStr})`);
      }
    }

    parts.push(message);

    return parts.join(' ');
  }

  /**
   * Log a debug message (development only by default)
   *
   * @param message - Message to log
   * @param data - Optional additional data to log
   */
  debug(message: string, data?: unknown): void {
    if (this.isLevelEnabled('debug')) {
      const formatted = this.formatMessage('debug', message);
      if (data !== undefined) {
        console.debug(formatted, formatAdditionalData(data));
      } else {
        console.debug(formatted);
      }
    }
  }

  /**
   * Log an info message
   *
   * @param message - Message to log
   * @param data - Optional additional data to log
   */
  info(message: string, data?: unknown): void {
    if (this.isLevelEnabled('info')) {
      const formatted = this.formatMessage('info', message);
      if (data !== undefined) {
        console.info(formatted, formatAdditionalData(data));
      } else {
        console.info(formatted);
      }
    }
  }

  /**
   * Log a warning message
   *
   * @param message - Message to log
   * @param data - Optional additional data to log
   */
  warn(message: string, data?: unknown): void {
    if (this.isLevelEnabled('warn')) {
      const formatted = this.formatMessage('warn', message);
      if (data !== undefined) {
        console.warn(formatted, formatAdditionalData(data));
      } else {
        console.warn(formatted);
      }
    }
  }

  /**
   * Log an error message
   *
   * @param message - Message to log
   * @param error - Optional error or additional data
   */
  error(message: string, error?: unknown): void {
    if (this.isLevelEnabled('error')) {
      const formatted = this.formatMessage('error', message);
      if (error !== undefined) {
        console.error(formatted);
        if (error instanceof Error) {
          console.error(`  Error: ${error.message}`);
          if (error.stack) {
            console.error(`  Stack: ${error.stack}`);
          }
        } else {
          console.error(`  Details:`, formatAdditionalData(error));
        }
      } else {
        console.error(formatted);
      }
    }
  }
}

/** Singleton logger instance */
export const logger = new MCPLogger();

/**
 * Factory for creating contextual loggers
 *
 * @param context - Context for the new logger
 * @returns New logger with context
 */
export function createLogger(context: LogContext): MCPLogger {
  return logger.child(context);
}

export default logger;
