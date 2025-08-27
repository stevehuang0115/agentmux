export interface ValidationError {
  field: string;
  message: string;
}

export class Validator {
  static validateTmuxTarget(target: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
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

  static validateSessionName(name: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!name || name.trim().length === 0) {
      errors.push({
        field: 'session',
        message: 'Session name is required'
      });
      return errors;
    }

    // Only alphanumeric, hyphens, and underscores
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

  static validateWindowName(name: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
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

  static validateMessage(message: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!message) {
      errors.push({
        field: 'message',
        message: 'Message is required'
      });
      return errors;
    }

    if (message.length > 10000) {
      errors.push({
        field: 'message',
        message: 'Message must be 10,000 characters or less'
      });
    }

    return errors;
  }

  static validateWorkingDir(dir: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!dir) return errors; // Optional field
    
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