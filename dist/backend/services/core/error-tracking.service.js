import { LoggerService } from './logger.service.js';
import { ConfigService } from './config.service.js';
export class ErrorTrackingService {
    static instance;
    errors = [];
    logger;
    config;
    errorCounts = new Map();
    maxStoredErrors;
    errorRetentionHours;
    constructor() {
        this.logger = LoggerService.getInstance();
        this.config = ConfigService.getInstance();
        this.maxStoredErrors = parseInt(process.env.ERROR_TRACKING_MAX_STORED || '1000');
        this.errorRetentionHours = parseInt(process.env.ERROR_TRACKING_RETENTION_HOURS || '24');
        // Set up periodic cleanup
        setInterval(() => {
            this.cleanupOldErrors();
        }, 60 * 60 * 1000); // Every hour
    }
    static getInstance() {
        if (!ErrorTrackingService.instance) {
            ErrorTrackingService.instance = new ErrorTrackingService();
        }
        return ErrorTrackingService.instance;
    }
    /**
     * Track an error event
     */
    trackError(error, context = {}) {
        const errorId = this.generateErrorId();
        const timestamp = new Date().toISOString();
        let message;
        let stack;
        if (error instanceof Error) {
            message = error.message;
            stack = error.stack;
        }
        else {
            message = error;
        }
        const errorEvent = {
            id: errorId,
            timestamp,
            level: context.level || 'error',
            message,
            stack,
            context: {
                source: context.source || 'backend',
                userId: context.userId,
                sessionId: context.sessionId,
                component: context.component,
                action: context.action,
                ...context.metadata
            },
            source: context.source || 'backend',
            userId: context.userId,
            sessionId: context.sessionId,
            component: context.component,
            action: context.action,
            metadata: context.metadata
        };
        // Store the error
        this.errors.unshift(errorEvent);
        this.trimStoredErrors();
        // Update error counts for statistics
        this.updateErrorCounts(errorEvent);
        // Log the error
        this.logError(errorEvent);
        // For critical errors, consider additional notification mechanisms
        if (context.level === 'critical') {
            this.handleCriticalError(errorEvent);
        }
        return errorId;
    }
    /**
     * Get error statistics
     */
    getErrorStats() {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        // Filter errors from last 24 hours
        const recentErrors = this.errors.filter(error => new Date(error.timestamp) > last24Hours);
        // Calculate statistics
        const errorsByLevel = {};
        const errorsBySource = {};
        const errorsByComponent = {};
        recentErrors.forEach(error => {
            // Count by level
            errorsByLevel[error.level] = (errorsByLevel[error.level] || 0) + 1;
            // Count by source
            errorsBySource[error.source] = (errorsBySource[error.source] || 0) + 1;
            // Count by component
            if (error.component) {
                errorsByComponent[error.component] = (errorsByComponent[error.component] || 0) + 1;
            }
        });
        // Get top errors by frequency
        const errorFrequency = new Map();
        recentErrors.forEach(error => {
            const key = error.message;
            const existing = errorFrequency.get(key);
            if (existing) {
                existing.count++;
                if (new Date(error.timestamp) > new Date(existing.lastSeen)) {
                    existing.lastSeen = error.timestamp;
                }
            }
            else {
                errorFrequency.set(key, { count: 1, lastSeen: error.timestamp });
            }
        });
        const topErrors = Array.from(errorFrequency.entries())
            .map(([message, data]) => ({
            message,
            count: data.count,
            lastSeen: data.lastSeen
        }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return {
            totalErrors: recentErrors.length,
            errorsByLevel,
            errorsBySource,
            errorsByComponent,
            topErrors,
            recentErrors: recentErrors.slice(0, 50) // Last 50 errors
        };
    }
    /**
     * Get errors by criteria
     */
    getErrors(criteria = {}) {
        let filteredErrors = this.errors;
        // Apply filters
        if (criteria.level) {
            filteredErrors = filteredErrors.filter(error => error.level === criteria.level);
        }
        if (criteria.source) {
            filteredErrors = filteredErrors.filter(error => error.source === criteria.source);
        }
        if (criteria.component) {
            filteredErrors = filteredErrors.filter(error => error.component === criteria.component);
        }
        if (criteria.userId) {
            filteredErrors = filteredErrors.filter(error => error.userId === criteria.userId);
        }
        if (criteria.sessionId) {
            filteredErrors = filteredErrors.filter(error => error.sessionId === criteria.sessionId);
        }
        if (criteria.since) {
            const sinceDate = new Date(criteria.since);
            filteredErrors = filteredErrors.filter(error => new Date(error.timestamp) > sinceDate);
        }
        // Apply limit
        const limit = criteria.limit || 100;
        return filteredErrors.slice(0, limit);
    }
    /**
     * Get a specific error by ID
     */
    getError(errorId) {
        return this.errors.find(error => error.id === errorId) || null;
    }
    /**
     * Clear errors (for maintenance or testing)
     */
    clearErrors(criteria) {
        let removedCount = 0;
        if (!criteria) {
            // Clear all errors
            removedCount = this.errors.length;
            this.errors = [];
            this.errorCounts.clear();
        }
        else {
            // Clear errors matching criteria
            const originalLength = this.errors.length;
            this.errors = this.errors.filter(error => {
                let shouldKeep = true;
                if (criteria.olderThan) {
                    const cutoffDate = new Date(criteria.olderThan);
                    if (new Date(error.timestamp) < cutoffDate) {
                        shouldKeep = false;
                    }
                }
                if (criteria.level && error.level === criteria.level) {
                    shouldKeep = false;
                }
                if (criteria.source && error.source === criteria.source) {
                    shouldKeep = false;
                }
                return shouldKeep;
            });
            removedCount = originalLength - this.errors.length;
        }
        this.logger.info(`Cleared ${removedCount} error records`, {
            component: 'ErrorTrackingService',
            action: 'clearErrors',
            criteria
        });
        return removedCount;
    }
    /**
     * Health check for error tracking service
     */
    getHealthStatus() {
        const recentCritical = this.errors.filter(error => error.level === 'critical' &&
            new Date(error.timestamp) > new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
        ).length;
        // Estimate memory usage (rough calculation)
        const avgErrorSize = 500; // bytes per error (rough estimate)
        const memoryUsageBytes = this.errors.length * avgErrorSize;
        const memoryUsageMB = (memoryUsageBytes / 1024 / 1024).toFixed(2);
        let status = 'healthy';
        if (recentCritical > 5) {
            status = 'critical';
        }
        else if (recentCritical > 2 || this.errors.length > this.maxStoredErrors * 0.9) {
            status = 'warning';
        }
        return {
            status,
            details: {
                storedErrors: this.errors.length,
                memoryUsage: `${memoryUsageMB} MB`,
                recentCriticalErrors: recentCritical,
                oldestError: this.errors[this.errors.length - 1]?.timestamp,
                newestError: this.errors[0]?.timestamp
            }
        };
    }
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    trimStoredErrors() {
        if (this.errors.length > this.maxStoredErrors) {
            this.errors = this.errors.slice(0, this.maxStoredErrors);
        }
    }
    updateErrorCounts(errorEvent) {
        const key = errorEvent.message;
        this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
    }
    logError(errorEvent) {
        const logLevel = errorEvent.level === 'critical' ? 'error' :
            errorEvent.level === 'warning' ? 'warn' : 'error';
        this.logger[logLevel](`Error tracked: ${errorEvent.message}`, {
            errorId: errorEvent.id,
            source: errorEvent.source,
            component: errorEvent.component,
            action: errorEvent.action,
            userId: errorEvent.userId,
            sessionId: errorEvent.sessionId,
            stack: errorEvent.stack,
            metadata: errorEvent.metadata
        });
    }
    handleCriticalError(errorEvent) {
        // For critical errors, we might want to:
        // 1. Send notifications (email, Slack, etc.)
        // 2. Create incidents in monitoring systems
        // 3. Trigger alerts
        this.logger.error(`CRITICAL ERROR detected`, {
            errorId: errorEvent.id,
            message: errorEvent.message,
            source: errorEvent.source,
            component: errorEvent.component,
            timestamp: errorEvent.timestamp,
            context: errorEvent.context
        });
        // In production, you might integrate with services like:
        // - PagerDuty for incident management
        // - Slack/Discord for team notifications  
        // - Email alerts for critical errors
        // - External monitoring systems
    }
    cleanupOldErrors() {
        const cutoffTime = new Date(Date.now() - this.errorRetentionHours * 60 * 60 * 1000);
        const originalLength = this.errors.length;
        this.errors = this.errors.filter(error => new Date(error.timestamp) > cutoffTime);
        const removedCount = originalLength - this.errors.length;
        if (removedCount > 0) {
            this.logger.info(`Cleaned up ${removedCount} old error records`, {
                component: 'ErrorTrackingService',
                action: 'cleanupOldErrors'
            });
        }
    }
}
//# sourceMappingURL=error-tracking.service.js.map