/**
 * In-Process Log Buffer
 *
 * Ring buffer that captures structured output from in-process Crewly Agent
 * runtimes. Provides the same interface as PTY terminal capture so the
 * frontend Side Terminal panel can display crewly-agent activity.
 *
 * @module services/agent/crewly-agent/in-process-log-buffer
 */

/**
 * Single log entry from an in-process agent session.
 */
export interface LogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Log level */
  level: 'info' | 'debug' | 'warn' | 'error';
  /** Log message */
  message: string;
}

/** Maximum number of entries to keep per session */
const MAX_ENTRIES_PER_SESSION = 500;

/**
 * Singleton buffer that captures in-process agent output.
 *
 * Used by CrewlyAgentRuntimeService to log tool calls, responses,
 * and errors. The terminal controller reads from this buffer when
 * the requested session is an in-process agent (no PTY).
 *
 * @example
 * ```typescript
 * const buffer = InProcessLogBuffer.getInstance();
 * buffer.append('crewly-assistant', 'info', 'Calling get_team_status tool...');
 * const output = buffer.capture('crewly-assistant', 50);
 * ```
 */
export class InProcessLogBuffer {
  private static instance: InProcessLogBuffer | null = null;
  private sessions = new Map<string, LogEntry[]>();

  /**
   * Get the singleton instance.
   *
   * @returns The shared InProcessLogBuffer instance
   */
  static getInstance(): InProcessLogBuffer {
    if (!InProcessLogBuffer.instance) {
      InProcessLogBuffer.instance = new InProcessLogBuffer();
    }
    return InProcessLogBuffer.instance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    InProcessLogBuffer.instance = null;
  }

  /**
   * Append a log entry for a session.
   *
   * @param sessionName - In-process agent session name
   * @param level - Log level
   * @param message - Log message text
   */
  append(sessionName: string, level: LogEntry['level'], message: string): void {
    if (!this.sessions.has(sessionName)) {
      this.sessions.set(sessionName, []);
    }
    const entries = this.sessions.get(sessionName)!;
    entries.push({
      timestamp: new Date().toISOString(),
      level,
      message,
    });
    // Ring buffer — drop oldest entries
    if (entries.length > MAX_ENTRIES_PER_SESSION) {
      entries.splice(0, entries.length - MAX_ENTRIES_PER_SESSION);
    }
  }

  /**
   * Check if a session has any log entries.
   *
   * @param sessionName - Session to check
   * @returns True if the session has been registered with at least one entry
   */
  hasSession(sessionName: string): boolean {
    return this.sessions.has(sessionName);
  }

  /**
   * Capture recent output from an in-process session, formatted like
   * terminal output for frontend compatibility.
   *
   * @param sessionName - Session to capture from
   * @param lines - Maximum number of lines to return
   * @returns Formatted output string (one log entry per line)
   */
  capture(sessionName: string, lines = 100): string {
    const entries = this.sessions.get(sessionName);
    if (!entries || entries.length === 0) {
      return '[crewly-agent] No output yet';
    }
    const slice = entries.slice(-lines);
    return slice.map(e => {
      const ts = e.timestamp.substring(11, 23); // HH:MM:SS.mmm
      const prefix = e.level === 'error' ? 'ERROR' : e.level === 'warn' ? 'WARN' : e.level === 'debug' ? 'DEBUG' : '';
      return prefix ? `[${ts}] ${prefix}: ${e.message}` : `[${ts}] ${e.message}`;
    }).join('\n');
  }

  /**
   * Register a session (creates empty entry list).
   *
   * @param sessionName - Session to register
   */
  registerSession(sessionName: string): void {
    if (!this.sessions.has(sessionName)) {
      this.sessions.set(sessionName, []);
    }
  }

  /**
   * Remove a session's log buffer.
   *
   * @param sessionName - Session to remove
   */
  removeSession(sessionName: string): void {
    this.sessions.delete(sessionName);
  }

  /**
   * Get all registered in-process session names.
   *
   * @returns Array of session names
   */
  getSessionNames(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clear all sessions (for testing).
   */
  clear(): void {
    this.sessions.clear();
  }
}
