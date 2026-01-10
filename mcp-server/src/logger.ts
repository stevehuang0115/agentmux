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
   * Format a log message with context
   *
   * @param level - Log level
   * @param message - Message to log
   * @param context - Optional additional context
   * @returns Formatted log string
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const parts: string[] = [];

    if (this.config.showTimestamp) {
      parts.push(new Date().toISOString());
    }

    parts.push(this.config.prefix);
    parts.push(`[${level.toUpperCase()}]`);

    const mergedContext = { ...this.context, ...context };
    if (Object.keys(mergedContext).length > 0) {
      const contextStr = Object.entries(mergedContext)
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
   * @param context - Optional context
   */
  debug(message: string, context?: LogContext): void {
    if (this.isLevelEnabled('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  /**
   * Log an info message
   *
   * @param message - Message to log
   * @param context - Optional context
   */
  info(message: string, context?: LogContext): void {
    if (this.isLevelEnabled('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  /**
   * Log a warning message
   *
   * @param message - Message to log
   * @param context - Optional context
   */
  warn(message: string, context?: LogContext): void {
    if (this.isLevelEnabled('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  /**
   * Log an error message
   *
   * @param message - Message to log
   * @param error - Optional error object
   * @param context - Optional context
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.isLevelEnabled('error')) {
      console.error(this.formatMessage('error', message, context));
      if (error) {
        if (error instanceof Error) {
          console.error(`  Stack: ${error.stack}`);
        } else {
          console.error(`  Details: ${JSON.stringify(error)}`);
        }
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
