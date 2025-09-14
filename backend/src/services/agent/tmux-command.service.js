import { spawn } from 'child_process';
import { LoggerService } from '../core/logger.service.js';
/**
 * Service responsible for all direct, low-level interactions with the tmux command-line tool.
 * Abstracts away the details of executing tmux commands.
 * Implements caching and rate limiting to reduce excessive tmux command execution.
 */
export class TmuxCommandService {
    logger;
    // Cache for session existence checks - expires in 5 seconds
    sessionCache = new Map();
    SESSION_CACHE_TTL = 5000; // 5 seconds
    // Cache for pane captures - expires in 2 seconds for frequent captures
    paneCache = new Map();
    PANE_CACHE_TTL = 2000; // 2 seconds
    // Rate limiting for expensive operations
    lastListSessions = 0;
    LIST_SESSIONS_THROTTLE = 3000; // 3 seconds between list-sessions calls
    cachedSessionList = null;
    constructor() {
        this.logger = LoggerService.getInstance().createComponentLogger('TmuxCommandService');
    }
    /**
     * Execute a tmux command with bashrc sourced first
     */
    async executeTmuxCommand(args) {
        // Debug logging for all tmux commands
        this.logger.debug('🔍 TMUX Command:', {
            command: `tmux ${args.join(' ')}`,
            args: args,
            argsLength: args.length,
            firstArg: args[0] || 'undefined',
            secondArg: args[1] || 'undefined',
            thirdArg: args[2] || 'undefined',
        });
        return new Promise((resolve, reject) => {
            // FINAL DEBUG: Log the exact arguments right before spawn
            this.logger.debug('🔍 FINAL SPAWN ARGS BEFORE EXECUTION:', {
                executable: 'tmux',
                args: args,
                argsJson: JSON.stringify(args),
                argsLength: args.length,
                commandString: `tmux ${args.join(' ')}`,
                containsP: args.includes('-p'),
                containsSendKeys: args.includes('send-keys'),
                isSendKeysWithP: args[0] === 'send-keys' && args.includes('-p'),
                timestamp: new Date().toISOString(),
            });
            // Use spawn directly with tmux to avoid shell escaping issues
            const process = spawn('tmux', args);
            let output = '';
            let error = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            process.stderr.on('data', (data) => {
                error += data.toString();
            });
            process.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                }
                else {
                    // DETAILED ERROR LOGGING: Capture all failure info
                    this.logger.error('🚨 TMUX COMMAND FAILED WITH ERROR:', {
                        exitCode: code,
                        error: error,
                        output: output,
                        originalArgs: args,
                        commandString: `tmux ${args.join(' ')}`,
                        executable: 'tmux',
                        containsP: args.includes('-p'),
                        containsSendKeys: args.includes('send-keys'),
                        isSendKeysWithP: args[0] === 'send-keys' && args.includes('-p'),
                        timestamp: new Date().toISOString(),
                        stackTrace: new Error().stack,
                    });
                    reject(new Error(`tmux command failed: ${error || `exit code ${code}`}`));
                }
            });
            process.on('error', (err) => {
                reject(new Error(`Failed to spawn bash for tmux: ${err.message}`));
            });
        });
    }
    /**
     * Check if a tmux session exists (optimized to use listSessions instead of individual has-session calls)
     */
    async sessionExists(sessionName) {
        const now = Date.now();
        const cacheKey = sessionName;
        // Check cache first
        const cached = this.sessionCache.get(cacheKey);
        if (cached && now - cached.timestamp < this.SESSION_CACHE_TTL) {
            this.logger.debug('Using cached session existence result', {
                sessionName,
                exists: cached.exists,
            });
            return cached.exists;
        }
        try {
            // Use listSessions instead of individual has-session calls for efficiency
            // This leverages the existing caching and rate limiting in listSessions()
            const sessions = await this.listSessions();
            const exists = sessions.some((session) => session.sessionName === sessionName);
            // Cache the result
            this.sessionCache.set(cacheKey, { exists, timestamp: now });
            // Clean up old cache entries (keep only last 20)
            if (this.sessionCache.size > 20) {
                const entries = Array.from(this.sessionCache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                for (let i = 0; i < entries.length - 20; i++) {
                    this.sessionCache.delete(entries[i][0]);
                }
            }
            this.logger.debug('Session existence checked via listSessions', {
                sessionName,
                exists,
                totalSessions: sessions.length,
            });
            return exists;
        }
        catch (error) {
            this.logger.warn('Error checking session existence via listSessions, fallback to has-session', {
                sessionName,
                error: error instanceof Error ? error.message : String(error),
            });
            // Fallback to individual has-session call if listSessions fails
            try {
                await this.executeTmuxCommand(['has-session', '-t', sessionName]);
                this.sessionCache.set(cacheKey, { exists: true, timestamp: now });
                return true;
            }
            catch (fallbackError) {
                this.sessionCache.set(cacheKey, { exists: false, timestamp: now });
                return false;
            }
        }
    }
    /**
     * Check multiple sessions at once (highly optimized for bulk checking)
     * Returns a Map with sessionName -> boolean for each session
     */
    async bulkSessionExists(sessionNames) {
        if (sessionNames.length === 0) {
            return new Map();
        }
        const now = Date.now();
        const result = new Map();
        const uncachedSessions = [];
        // First check cache for all sessions
        for (const sessionName of sessionNames) {
            const cached = this.sessionCache.get(sessionName);
            if (cached && now - cached.timestamp < this.SESSION_CACHE_TTL) {
                result.set(sessionName, cached.exists);
                this.logger.debug('Using cached session existence result', {
                    sessionName,
                    exists: cached.exists,
                });
            }
            else {
                uncachedSessions.push(sessionName);
            }
        }
        // If all sessions were cached, return early
        if (uncachedSessions.length === 0) {
            return result;
        }
        try {
            // Get all sessions with a single listSessions call
            const allSessions = await this.listSessions();
            const activeSessionNames = new Set(allSessions.map((s) => s.sessionName));
            // Check existence for all uncached sessions
            for (const sessionName of uncachedSessions) {
                const exists = activeSessionNames.has(sessionName);
                result.set(sessionName, exists);
                // Cache the result
                this.sessionCache.set(sessionName, { exists, timestamp: now });
            }
            // Clean up old cache entries (keep only last 20)
            if (this.sessionCache.size > 20) {
                const entries = Array.from(this.sessionCache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                for (let i = 0; i < entries.length - 20; i++) {
                    this.sessionCache.delete(entries[i][0]);
                }
            }
            this.logger.debug('Bulk session existence check completed', {
                checkedSessions: uncachedSessions.length,
                cachedSessions: sessionNames.length - uncachedSessions.length,
                totalActiveSessions: allSessions.length,
            });
        }
        catch (error) {
            this.logger.warn('Error in bulk session check, using individual fallback', {
                sessionCount: uncachedSessions.length,
                error: error instanceof Error ? error.message : String(error),
            });
            // Fallback to individual checks for uncached sessions
            for (const sessionName of uncachedSessions) {
                try {
                    const exists = await this.sessionExists(sessionName);
                    result.set(sessionName, exists);
                }
                catch (individualError) {
                    this.logger.warn('Individual session check failed', {
                        sessionName,
                        error: individualError,
                    });
                    result.set(sessionName, false);
                }
            }
        }
        return result;
    }
    /**
     * Kill a tmux session
     */
    async killSession(sessionName) {
        try {
            await this.executeTmuxCommand(['kill-session', '-t', sessionName]);
            // Clear caches for the killed session
            this.clearSessionCache(sessionName);
            this.logger.info('Session killed successfully', { sessionName });
        }
        catch (error) {
            // Session might not exist, that's ok
            this.logger.debug(`Session ${sessionName} does not exist or was already killed`);
        }
    }
    /**
     * Send a message to a specific tmux session
     */
    async sendMessage(sessionName, message) {
        const cleanMessage = message
            .replace(/\r\n/g, '\n') // Normalize line endings
            .replace(/\r/g, '\n') // Handle Mac line endings
            .trim(); // Remove leading/trailing whitespace
        // Debug logging for message sending
        this.logger.debug('🔍 Sending message to tmux session:', {
            sessionName,
            messageLength: cleanMessage.length,
            preview: cleanMessage.slice(0, 100) + (cleanMessage.length > 100 ? '...' : ''),
        });
        // Send the entire message as one piece to avoid corrupting structured content
        this.logger.debug('Sending complete message without chunking', {
            sessionName,
            messageLength: cleanMessage.length,
        });
        try {
            // Send the entire message at once to preserve structure
            const args = ['send-keys', '-t', sessionName, cleanMessage];
            this.logger.debug('🔍 SENDMESSAGE: About to call executeTmuxCommand for complete message', {
                sessionName,
                args: [
                    'send-keys',
                    '-t',
                    sessionName,
                    `<message ${cleanMessage.length} chars>`,
                ],
                argCount: args.length,
                messagePreview: cleanMessage.slice(0, 100) + (cleanMessage.length > 100 ? '...' : ''),
            });
            await this.executeTmuxCommand(args);
        }
        catch (error) {
            this.logger.error('Error sending complete message', {
                sessionName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        // CRITICAL: Wait for terminal/Claude to process the message before sending Enter
        // This delay allows the UI to register the text input properly
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    /**
     * Send individual key to a specific tmux session
     */
    async sendKey(sessionName, key, allowRetry = false) {
        try {
            let beforeOutput = '', afterOutput = '', needRetry = false;
            if (allowRetry) {
                beforeOutput = await this.capturePane(sessionName, 20);
            }
            await this.executeTmuxCommand(['send-keys', '-t', sessionName, key]);
            await new Promise((resolve) => setTimeout(resolve, 5000));
            if (allowRetry) {
                afterOutput = await this.capturePane(sessionName, 20);
                if (afterOutput.length - beforeOutput.length < key.length) {
                    needRetry = true;
                }
            }
            if (needRetry) {
                await this.executeTmuxCommand(['send-keys', '-t', sessionName, key]);
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
            this.logger.debug('Key sent successfully', { sessionName, key });
        }
        catch (error) {
            this.logger.error('Error sending key', {
                sessionName,
                key,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    /**
     * To clear the commandline commands regardless it is in coding agent runtime or regular terminal
     * @param sessionName
     */
    async clearCurrentCommandLine(sessionName) {
        await this.sendCtrlC(sessionName);
        await this.sendEnter(sessionName);
        await this.sendEscape(sessionName);
        await this.sendEscape(sessionName);
    }
    /**
     * Send Enter key to a session
     */
    async sendEnter(sessionName) {
        await this.executeTmuxCommand(['send-keys', '-t', sessionName, 'Enter']);
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    /**
     * Send Ctrl+C to a session
     */
    async sendCtrlC(sessionName) {
        await this.executeTmuxCommand(['send-keys', '-t', sessionName, 'C-c']);
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    /**
     * Send Escape key to a session
     */
    async sendEscape(sessionName) {
        await this.executeTmuxCommand(['send-keys', '-t', sessionName, 'Escape']);
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    /**
     * Capture terminal output from a session (cached for 2 seconds to reduce frequent calls)
     */
    async capturePane(sessionName, lines = 100) {
        const now = Date.now();
        const cacheKey = `${sessionName}:${lines}`;
        // Check cache first for frequent capture requests
        const cached = this.paneCache.get(cacheKey);
        if (cached && now - cached.timestamp < this.PANE_CACHE_TTL) {
            this.logger.debug('Using cached pane content', {
                sessionName,
                lines,
                age: now - cached.timestamp,
            });
            return cached.content;
        }
        try {
            // First check if session exists to avoid timing issues
            const sessionExists = await this.sessionExists(sessionName);
            if (!sessionExists) {
                this.logger.debug('Session does not exist for capture', { sessionName });
                return '';
            }
            // Small delay to ensure pane is ready after session creation
            await new Promise((resolve) => setTimeout(resolve, 100));
            const output = await this.executeTmuxCommand([
                'capture-pane',
                '-t',
                sessionName,
                '-p',
                '-S',
                `-${lines}`,
            ]);
            // Cache the result
            this.paneCache.set(cacheKey, { content: output.trim(), timestamp: now });
            // Clean up old cache entries (keep only last 15)
            if (this.paneCache.size > 15) {
                const entries = Array.from(this.paneCache.entries());
                entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
                for (let i = 0; i < entries.length - 15; i++) {
                    this.paneCache.delete(entries[i][0]);
                }
            }
            // Debug logging to see what's in the tmux pane
            this.logger.debug('🔍 Tmux pane capture:', {
                sessionName,
                lines: lines,
                outputLength: output.length,
                preview: output.slice(0, 200) + (output.length > 200 ? '...' : ''),
            });
            return output.trim();
        }
        catch (error) {
            // Check if it's a "can't find pane" error - this is usually temporary
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes("can't find pane")) {
                this.logger.debug('Pane not ready yet for capture', {
                    sessionName,
                    error: errorMessage,
                });
                // Return empty string without logging error - this is expected during session startup
                return '';
            }
            // Log other errors as they may be more serious
            this.logger.warn('Error capturing pane', { sessionName, error: errorMessage });
            return '';
        }
    }
    /**
     * List all tmux sessions (rate limited and cached for 3 seconds)
     */
    async listSessions() {
        const now = Date.now();
        // Check if we have cached results
        if (this.cachedSessionList &&
            now - this.cachedSessionList.timestamp < this.LIST_SESSIONS_THROTTLE) {
            this.logger.debug('Using cached session list', {
                age: now - this.cachedSessionList.timestamp,
            });
            return this.cachedSessionList.sessions;
        }
        // Rate limiting: don't call list-sessions too frequently
        if (now - this.lastListSessions < this.LIST_SESSIONS_THROTTLE) {
            // Return cached data if available, empty array otherwise
            if (this.cachedSessionList) {
                this.logger.debug('Rate limited list-sessions, using cached data');
                return this.cachedSessionList.sessions;
            }
            return [];
        }
        this.lastListSessions = now;
        try {
            const output = await this.executeTmuxCommand([
                'list-sessions',
                '-F',
                '#{session_name}:#{session_created}:#{session_attached}:#{session_windows}',
            ]);
            if (!output.trim()) {
                const emptyResult = [];
                this.cachedSessionList = { sessions: emptyResult, timestamp: now };
                return emptyResult;
            }
            const sessions = output
                .trim()
                .split('\n')
                .map((line) => {
                const [sessionName, created, attached, windows] = line.split(':');
                return {
                    sessionName,
                    pid: 0, // tmux doesn't provide PID in this format
                    windows: parseInt(windows) || 1,
                    created: new Date(parseInt(created) * 1000).toISOString(),
                    attached: attached === '1',
                };
            });
            // Cache the result
            this.cachedSessionList = { sessions, timestamp: now };
            this.logger.debug('Listed tmux sessions', {
                count: sessions.length,
                sessions: sessions.map((s) => s.sessionName),
            });
            return sessions;
        }
        catch (error) {
            this.logger.error('Error listing sessions', {
                error: error instanceof Error ? error.message : String(error),
            });
            // Don't cache errors, return cached data if available
            if (this.cachedSessionList) {
                return this.cachedSessionList.sessions;
            }
            return [];
        }
    }
    /**
     * Create a new tmux session
     */
    async createSession(sessionName, workingDirectory, windowName) {
        const createCommand = ['new-session', '-d', '-s', sessionName, '-c', workingDirectory];
        await this.executeTmuxCommand(createCommand);
        this.logger.info('Session created', { sessionName, workingDirectory });
        // Rename the window if specified
        if (windowName) {
            await this.executeTmuxCommand(['rename-window', '-t', `${sessionName}:0`, windowName]);
            this.logger.info('Window renamed', { sessionName, windowName });
        }
    }
    /**
     * Set environment variable in a tmux session
     */
    async setEnvironmentVariable(sessionName, key, value) {
        this.logger.debug('🔍 Setting environment variable:', { sessionName, key, value });
        await this.clearCurrentCommandLine(sessionName);
        // Send the export command without any special flags to avoid truncation
        await this.executeTmuxCommand(['send-keys', '-t', sessionName, `export ${key}="${value}"`]);
        await this.sendEnter(sessionName);
        this.logger.info('✅ Environment variable set successfully', { sessionName, key });
    }
    /**
     * Clear all caches for a specific session
     */
    clearSessionCache(sessionName) {
        // Clear session existence cache
        this.sessionCache.delete(sessionName);
        // Clear pane capture cache for this session (all line counts)
        const keysToDelete = [];
        for (const key of this.paneCache.keys()) {
            if (key.startsWith(`${sessionName}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach((key) => this.paneCache.delete(key));
        this.logger.debug('Cleared caches for session', {
            sessionName,
            clearedKeys: keysToDelete.length,
        });
    }
    /**
     * Force clear all caches (useful for debugging or when cache becomes stale)
     */
    clearAllCaches() {
        const sessionCacheSize = this.sessionCache.size;
        const paneCacheSize = this.paneCache.size;
        this.sessionCache.clear();
        this.paneCache.clear();
        this.cachedSessionList = null;
        this.logger.info('Cleared all tmux caches', {
            clearedSessionCache: sessionCacheSize,
            clearedPaneCache: paneCacheSize,
        });
    }
    /**
     * Get cache statistics for monitoring
     */
    getCacheStats() {
        return {
            sessionCache: {
                size: this.sessionCache.size,
                entries: Array.from(this.sessionCache.keys()),
            },
            paneCache: {
                size: this.paneCache.size,
                entries: Array.from(this.paneCache.keys()),
            },
            sessionList: {
                cached: this.cachedSessionList !== null,
                age: this.cachedSessionList
                    ? Date.now() - this.cachedSessionList.timestamp
                    : undefined,
            },
        };
    }
}
//# sourceMappingURL=tmux-command.service.js.map