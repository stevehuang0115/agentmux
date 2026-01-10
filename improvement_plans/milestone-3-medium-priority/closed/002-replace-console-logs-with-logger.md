# Ticket 002: Replace Console.logs with LoggerService in MCP Server

## Priority: Medium
## Estimated Effort: Medium
## Component: MCP Server

---

## Problem Description

The MCP server (`mcp-server/src/server.ts`) contains 80+ `console.log` statements. This violates best practices because:

1. No log levels (debug, info, warn, error)
2. No way to control logging in production
3. No structured logging for analysis
4. Inconsistent log formatting

The backend already has a `LoggerService` that should be used instead.

---

## Files Affected

| File | Console Statements |
|------|-------------------|
| `mcp-server/src/server.ts` | 80+ instances |
| `mcp-server/src/index.ts` | Several instances |

---

## Detailed Instructions

### Step 1: Create Logger for MCP Server

Since MCP server is a separate package, create a local logger that follows the same pattern as the backend's LoggerService.

**File:** `mcp-server/src/logger.ts`

```typescript
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

class MCPLogger {
  private config: LoggerConfig;
  private context: LogContext;

  constructor(config: Partial<LoggerConfig> = {}, context: LogContext = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): MCPLogger {
    return new MCPLogger(this.config, { ...this.context, ...context });
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  /**
   * Format a log message with context
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
   */
  debug(message: string, context?: LogContext): void {
    if (this.isLevelEnabled('debug')) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    if (this.isLevelEnabled('info')) {
      console.info(this.formatMessage('info', message, context));
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (this.isLevelEnabled('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  /**
   * Log an error message
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

// Singleton instance
export const logger = new MCPLogger();

// Factory for creating contextual loggers
export function createLogger(context: LogContext): MCPLogger {
  return logger.child(context);
}

export default logger;
```

### Step 2: Create Logger Test File

**File:** `mcp-server/src/logger.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPLogger, logger, createLogger } from './logger';

describe('MCPLogger', () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should respect log level setting', () => {
      logger.setLevel('warn');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log all levels when set to debug', () => {
      logger.setLevel('debug');

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleDebugSpy).toHaveBeenCalled();
      expect(consoleInfoSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('message formatting', () => {
    it('should include prefix and level', () => {
      logger.setLevel('info');
      logger.info('test message');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MCP]')
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
    });

    it('should include context when provided', () => {
      logger.setLevel('info');
      logger.info('test message', { sessionName: 'test-session' });

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('sessionName=test-session')
      );
    });
  });

  describe('child loggers', () => {
    it('should create child with inherited context', () => {
      logger.setLevel('info');
      const childLogger = createLogger({ toolName: 'getAgentStatus' });

      childLogger.info('tool executed');

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('toolName=getAgentStatus')
      );
    });
  });

  describe('error logging', () => {
    it('should log error stack trace', () => {
      logger.setLevel('error');
      const error = new Error('Test error');

      logger.error('Operation failed', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Operation failed')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stack:')
      );
    });
  });
});
```

### Step 3: Update server.ts to Use Logger

**File:** `mcp-server/src/server.ts`

**Before:**
```typescript
console.log('Starting MCP server...');
console.log(`Received request for tool: ${toolName}`);
console.log('Agent registered:', sessionName);
console.error('Error processing request:', error);
```

**After:**
```typescript
import { logger, createLogger } from './logger.js';

// At class level, create contextual loggers
private logger = logger;

// In methods, use appropriate levels
async getAgentStatus(params: AgentStatusParams): Promise<AgentStatusResult> {
  const methodLogger = createLogger({ toolName: 'getAgentStatus', sessionName: params.sessionName });

  methodLogger.debug('Starting agent status check');

  try {
    // ... implementation
    methodLogger.info('Agent status retrieved successfully');
    return result;
  } catch (error) {
    methodLogger.error('Failed to get agent status', error);
    throw error;
  }
}

// For startup messages
this.logger.info('MCP server starting', { port: this.port });

// For tool calls
this.logger.debug('Tool invoked', { toolName, requestId });

// For warnings
this.logger.warn('Rate limit approaching', { remaining: 10 });

// For errors
this.logger.error('Request processing failed', error, { toolName });
```

### Step 4: Replace All Console Statements

Use this mapping to replace console statements:

| Original | Replacement |
|----------|-------------|
| `console.log('Starting...')` | `logger.info('Starting...')` |
| `console.log('Debug info...')` | `logger.debug('Debug info...')` |
| `console.error('Error:', e)` | `logger.error('Error', e)` |
| `console.warn('Warning...')` | `logger.warn('Warning...')` |

### Step 5: Search and Replace Pattern

```bash
# Find all console statements
grep -n "console\." mcp-server/src/server.ts

# Common replacements:
# console.log -> logger.info or logger.debug
# console.error -> logger.error
# console.warn -> logger.warn
# console.debug -> logger.debug
```

---

## Log Level Guidelines

| Level | When to Use | Example |
|-------|-------------|---------|
| `debug` | Detailed info for development | Parameter values, internal state |
| `info` | Notable events, startup/shutdown | Server started, tool completed |
| `warn` | Potential issues, degraded state | Rate limit near, retry needed |
| `error` | Errors requiring attention | Failed operations, exceptions |

---

## Evaluation Criteria

### Automated Verification

```bash
cd mcp-server

# 1. No console.log statements remain (except in logger.ts)
grep -c "console\." src/server.ts
# Expected: 0

# 2. Logger is imported
grep "from './logger" src/server.ts
# Expected: Match found

# 3. Build succeeds
npm run build

# 4. Tests pass
npm test

# 5. Logger tests pass
npm test -- --grep "MCPLogger"
```

### Manual Verification Checklist

- [ ] All `console.log` replaced with `logger.info` or `logger.debug`
- [ ] All `console.error` replaced with `logger.error`
- [ ] All `console.warn` replaced with `logger.warn`
- [ ] Logger created and tested
- [ ] Log levels appropriate for each message
- [ ] Contextual information included where helpful
- [ ] Production logs are clean (only warn/error by default)

---

## Rollback Plan

```bash
git checkout HEAD -- mcp-server/src/server.ts
git checkout HEAD -- mcp-server/src/index.ts
rm -f mcp-server/src/logger.ts
rm -f mcp-server/src/logger.test.ts
```

---

## Environment Variables

The logger respects these environment variables:

- `LOG_LEVEL`: Set to `debug`, `info`, `warn`, or `error`
- `NODE_ENV`: When `production`, defaults to `warn` level

```bash
# Development - see all logs
LOG_LEVEL=debug npm start

# Production - only warnings and errors
NODE_ENV=production npm start
```

---

## Dependencies

- None

## Blocks

- None
