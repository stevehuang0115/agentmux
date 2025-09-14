import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { ConfigService } from './config.service.js';
export class LoggerService {
    static instance;
    config;
    logQueue = [];
    flushTimer = null;
    isShuttingDown = false;
    LOG_LEVELS = {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3
    };
    constructor() {
        this.config = ConfigService.getInstance();
        this.initializeLogDirectory();
        this.startLogFlusher();
        this.setupProcessHandlers();
    }
    static getInstance() {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService();
        }
        return LoggerService.instance;
    }
    async initializeLogDirectory() {
        if (!this.config.get('logging').enableFileLogging)
            return;
        const logDir = this.config.get('logging').logDir;
        try {
            if (!existsSync(logDir)) {
                await fs.mkdir(logDir, { recursive: true });
            }
        }
        catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }
    startLogFlusher() {
        this.flushTimer = setInterval(() => {
            this.flushLogs();
        }, 5000); // Flush every 5 seconds
    }
    setupProcessHandlers() {
        process.on('exit', () => {
            this.shutdown();
        });
        process.on('SIGINT', () => {
            this.shutdown();
        });
        process.on('SIGTERM', () => {
            this.shutdown();
        });
        process.on('uncaughtException', (error) => {
            this.error('Uncaught exception', { error: error.message, stack: error.stack });
            this.flushLogs();
        });
        process.on('unhandledRejection', (reason, promise) => {
            this.error('Unhandled promise rejection', {
                reason: reason instanceof Error ? reason.message : String(reason),
                stack: reason instanceof Error ? reason.stack : undefined,
                promise: String(promise)
            });
        });
    }
    shouldLog(level) {
        const configLevel = this.config.get('logging').level;
        return this.LOG_LEVELS[level] <= this.LOG_LEVELS[configLevel];
    }
    formatLogEntry(entry) {
        const logConfig = this.config.get('logging');
        if (logConfig.format === 'json') {
            return JSON.stringify(entry);
        }
        // Simple format
        const timestamp = entry.timestamp;
        const level = entry.level.toUpperCase().padEnd(5);
        const component = entry.component ? `[${entry.component}]` : '';
        const requestId = entry.requestId ? `[${entry.requestId}]` : '';
        let logLine = `${timestamp} ${level} ${component}${requestId} ${entry.message}`;
        if (entry.context && Object.keys(entry.context).length > 0) {
            try {
                logLine += ` | Context: ${JSON.stringify(entry.context)}`;
            }
            catch (error) {
                logLine += ` | Context: [Circular/Unserializable]`;
            }
        }
        if (entry.stack) {
            logLine += `\n${entry.stack}`;
        }
        return logLine;
    }
    async writeToFile(entry) {
        const logConfig = this.config.get('logging');
        if (!logConfig.enableFileLogging)
            return;
        try {
            const logDir = logConfig.logDir;
            const date = new Date().toISOString().split('T')[0];
            const filename = `agentmux-${date}.log`;
            const logPath = path.join(logDir, filename);
            const formattedEntry = this.formatLogEntry(entry) + '\n';
            await fs.appendFile(logPath, formattedEntry, 'utf-8');
            // Check if we need to rotate logs
            await this.rotateLogs();
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }
    async rotateLogs() {
        const logConfig = this.config.get('logging');
        const logDir = logConfig.logDir;
        try {
            const files = await fs.readdir(logDir);
            const logFiles = files
                .filter(file => file.startsWith('agentmux-') && file.endsWith('.log'))
                .sort()
                .reverse();
            if (logFiles.length > logConfig.maxFiles) {
                const filesToDelete = logFiles.slice(logConfig.maxFiles);
                for (const file of filesToDelete) {
                    await fs.unlink(path.join(logDir, file));
                }
            }
        }
        catch (error) {
            console.error('Failed to rotate logs:', error);
        }
    }
    log(level, message, context, options) {
        if (!this.shouldLog(level))
            return;
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            component: options?.component,
            requestId: options?.requestId,
            userId: options?.userId
        };
        // Add stack trace for errors
        if (level === 'error' && context?.error instanceof Error) {
            entry.stack = context.error.stack;
        }
        // Console output (always enabled)
        this.writeToConsole(entry);
        // Queue for file logging
        if (this.config.get('logging').enableFileLogging) {
            this.logQueue.push(entry);
        }
    }
    writeToConsole(entry) {
        const formatted = this.formatLogEntry(entry);
        switch (entry.level) {
            case 'error':
                console.error(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            case 'info':
                console.info(formatted);
                break;
            case 'debug':
                console.debug(formatted);
                break;
        }
    }
    async flushLogs() {
        if (this.logQueue.length === 0)
            return;
        const logsToFlush = [...this.logQueue];
        this.logQueue = [];
        for (const entry of logsToFlush) {
            await this.writeToFile(entry);
        }
    }
    // Public logging methods
    error(message, context, options) {
        this.log('error', message, context, options);
    }
    warn(message, context, options) {
        this.log('warn', message, context, options);
    }
    info(message, context, options) {
        this.log('info', message, context, options);
    }
    debug(message, context, options) {
        this.log('debug', message, context, options);
    }
    // Convenience methods for common scenarios
    logHttpRequest(method, url, statusCode, duration, options) {
        this.info('HTTP Request', {
            method,
            url,
            statusCode,
            duration,
            type: 'http_request'
        }, options);
    }
    logHttpError(method, url, statusCode, error, options) {
        this.error('HTTP Error', {
            method,
            url,
            statusCode,
            error,
            type: 'http_error'
        }, options);
    }
    logAgentAction(agentId, action, success, details, options) {
        const level = success ? 'info' : 'warn';
        this.log(level, `Agent Action: ${action}`, {
            agentId,
            action,
            success,
            ...details,
            type: 'agent_action'
        }, options);
    }
    logSystemMetric(metric, value, unit, options) {
        this.info('System Metric', {
            metric,
            value,
            unit,
            type: 'system_metric'
        }, options);
    }
    logSecurityEvent(event, details, options) {
        this.warn('Security Event', {
            event,
            ...details,
            type: 'security_event'
        }, options);
    }
    logDatabaseOperation(operation, table, duration, success, options) {
        const level = success ? 'debug' : 'error';
        this.log(level, 'Database Operation', {
            operation,
            table,
            duration,
            success,
            type: 'database_operation'
        }, options);
    }
    // Create scoped logger for a specific component
    createComponentLogger(component) {
        return new ComponentLogger(this, component);
    }
    // Create scoped logger for a specific request
    createRequestLogger(requestId, userId) {
        return new RequestLogger(this, requestId, userId);
    }
    // Get recent logs
    async getRecentLogs(level, limit = 100) {
        const logConfig = this.config.get('logging');
        if (!logConfig.enableFileLogging) {
            return [];
        }
        try {
            const logDir = logConfig.logDir;
            const today = new Date().toISOString().split('T')[0];
            const logPath = path.join(logDir, `agentmux-${today}.log`);
            if (!existsSync(logPath)) {
                return [];
            }
            const content = await fs.readFile(logPath, 'utf-8');
            const lines = content.trim().split('\n');
            const entries = [];
            for (const line of lines.slice(-limit)) {
                try {
                    if (logConfig.format === 'json') {
                        const entry = JSON.parse(line);
                        if (!level || entry.level === level) {
                            entries.push(entry);
                        }
                    }
                }
                catch {
                    // Skip invalid JSON lines
                }
            }
            return entries;
        }
        catch (error) {
            this.error('Failed to read recent logs', { error: error instanceof Error ? error.message : String(error) });
            return [];
        }
    }
    shutdown() {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        // Flush any remaining logs synchronously
        this.flushLogs();
    }
}
// Component-scoped logger
export class ComponentLogger {
    logger;
    component;
    constructor(logger, component) {
        this.logger = logger;
        this.component = component;
    }
    error(message, context, options) {
        this.logger.error(message, context, { ...options, component: this.component });
    }
    warn(message, context, options) {
        this.logger.warn(message, context, { ...options, component: this.component });
    }
    info(message, context, options) {
        this.logger.info(message, context, { ...options, component: this.component });
    }
    debug(message, context, options) {
        this.logger.debug(message, context, { ...options, component: this.component });
    }
}
// Request-scoped logger
export class RequestLogger {
    logger;
    requestId;
    userId;
    constructor(logger, requestId, userId) {
        this.logger = logger;
        this.requestId = requestId;
        this.userId = userId;
    }
    error(message, context, options) {
        this.logger.error(message, context, { ...options, requestId: this.requestId, userId: this.userId });
    }
    warn(message, context, options) {
        this.logger.warn(message, context, { ...options, requestId: this.requestId, userId: this.userId });
    }
    info(message, context, options) {
        this.logger.info(message, context, { ...options, requestId: this.requestId, userId: this.userId });
    }
    debug(message, context, options) {
        this.logger.debug(message, context, { ...options, requestId: this.requestId, userId: this.userId });
    }
}
//# sourceMappingURL=logger.service.js.map