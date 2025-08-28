"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
class Validator {
    static validateTmuxTarget(target) {
        const errors = [];
        // Basic format validation (session:window or session:window.pane)
        const targetRegex = /^[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+(\.[0-9]+)?$/;
        if (!targetRegex.test(target)) {
            errors.push({
                field: 'target',
                message: 'Invalid tmux target format. Must be session:window or session:window.pane'
            });
        }
        // Prevent command injection
        if (target.includes(';') || target.includes('&') || target.includes('|') || target.includes('`')) {
            errors.push({
                field: 'target',
                message: 'Invalid characters in target'
            });
        }
        return errors;
    }
    static validateSessionName(name) {
        const errors = [];
        if (!name || name.trim().length === 0) {
            errors.push({
                field: 'session',
                message: 'Session name is required'
            });
            return errors;
        }
        // Check for dangerous patterns first
        const dangerousPatterns = [
            /rm\s+/i, // rm commands
            /\.\./, // path traversal
            /\/\w/, // absolute paths
            /%00/i, // null byte
            /%2e%2e/i, // URL encoded ..
            /[;&|`$()]/, // command injection chars
            /\\\w/, // Windows paths
            /\s/, // whitespace
            /\x00-\x1F/, // control characters
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(name)) {
                errors.push({
                    field: 'session',
                    message: 'Session name contains invalid or dangerous characters'
                });
                break;
            }
        }
        // Only alphanumeric, hyphens, and underscores - strictly enforced
        const nameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!nameRegex.test(name)) {
            errors.push({
                field: 'session',
                message: 'Session name can only contain letters, numbers, hyphens, and underscores'
            });
        }
        if (name.length > 50) {
            errors.push({
                field: 'session',
                message: 'Session name must be 50 characters or less'
            });
        }
        return errors;
    }
    static validateWindowName(name) {
        const errors = [];
        if (!name || name.trim().length === 0) {
            errors.push({
                field: 'window',
                message: 'Window name is required'
            });
            return errors;
        }
        // Only alphanumeric, hyphens, underscores, and spaces
        const nameRegex = /^[a-zA-Z0-9_\s-]+$/;
        if (!nameRegex.test(name)) {
            errors.push({
                field: 'window',
                message: 'Window name can only contain letters, numbers, spaces, hyphens, and underscores'
            });
        }
        if (name.length > 50) {
            errors.push({
                field: 'window',
                message: 'Window name must be 50 characters or less'
            });
        }
        return errors;
    }
    static validateMessage(message) {
        const errors = [];
        if (!message) {
            errors.push({
                field: 'message',
                message: 'Message is required'
            });
            return errors;
        }
        // Check length first - reject very long strings (including exactly 10000)
        if (message.length >= 10000) {
            errors.push({
                field: 'message',
                message: 'Message must be 10,000 characters or less'
            });
            return errors; // Early return for length violations
        }
        // Check for dangerous command patterns - comprehensive security check
        const dangerousPatterns = [
            /rm\s+.*-rf/i, // rm -rf commands
            /rm\s+/i, // any rm commands
            /\.\./, // path traversal
            /%00/i, // null byte
            /%2e%2e/i, // URL encoded ..
            /\\\\\w/, // Windows UNC paths
            /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/, // control characters
            /[\u0000-\u001F\u007F]/, // Unicode control characters
            /\r\n|\r|\n/, // newlines (all variants)
            /[;&|`$()]/, // command injection chars
            /\/etc\//i, // Linux system paths
            /\/root\//i, // Root directory
            /\/bin\//i, // Binary paths
            /\/sbin\//i, // System binary paths
            /\/usr\/bin\//i, // User binary paths
            /\/tmp\//i, // Temp directory
            /system32/i, // Windows system paths
            /<script/i, // Script tags
            /javascript:/i, // JavaScript protocol
            /curl\s/i, // curl commands
            /wget\s/i, // wget commands
            /eval\s*\(/i, // JavaScript eval
            /SELECT.*FROM/i, // SQL injection
            /DROP.*TABLE/i, // SQL injection
            /DELETE.*FROM/i, // SQL injection
            /INSERT.*INTO/i, // SQL injection
            /UPDATE.*SET/i, // SQL injection
            /UNION.*SELECT/i, // SQL injection
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(message)) {
                errors.push({
                    field: 'message',
                    message: 'Message contains potentially dangerous content'
                });
                break;
            }
        }
        return errors;
    }
    static validateWorkingDir(dir) {
        const errors = [];
        if (!dir)
            return errors; // Optional field
        // Basic path validation - must start with / or ~
        if (!dir.startsWith('/') && !dir.startsWith('~')) {
            errors.push({
                field: 'workingDir',
                message: 'Working directory must be an absolute path'
            });
        }
        // Prevent dangerous paths
        const dangerousPaths = ['/', '/bin', '/sbin', '/usr/bin', '/usr/sbin'];
        if (dangerousPaths.includes(dir)) {
            errors.push({
                field: 'workingDir',
                message: 'Working directory not allowed'
            });
        }
        if (dir.length > 500) {
            errors.push({
                field: 'workingDir',
                message: 'Working directory path must be 500 characters or less'
            });
        }
        return errors;
    }
}
exports.Validator = Validator;
//# sourceMappingURL=validation.js.map