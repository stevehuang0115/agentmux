"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TmuxController = void 0;
const pty = __importStar(require("node-pty"));
const child_process_1 = require("child_process");
const events_1 = require("events");
class TmuxController extends events_1.EventEmitter {
    constructor() {
        super();
        this.attachedSessions = new Map();
        this.captureProcesses = new Map();
    }
    // Create a real-time attached terminal to tmux session
    async attachToSession(options) {
        const { sessionName, windowIndex, paneIndex, cols = 80, rows = 24 } = options;
        const sessionKey = `${sessionName}:${windowIndex || 0}:${paneIndex || 0}`;
        // Check if already attached
        if (this.attachedSessions.has(sessionKey)) {
            const existing = this.attachedSessions.get(sessionKey);
            if (existing.pid !== undefined) {
                return existing;
            }
            this.attachedSessions.delete(sessionKey);
        }
        // Build tmux attach command
        let attachCommand = ['attach-session', '-t', sessionName];
        if (windowIndex !== undefined) {
            attachCommand = ['select-window', '-t', `${sessionName}:${windowIndex}`, '&&', 'tmux', 'attach-session', '-t', sessionName];
        }
        // Create pty process
        const ptyProcess = pty.spawn('tmux', attachCommand, {
            name: 'xterm-256color',
            cols,
            rows,
            cwd: process.cwd(),
            env: {
                ...process.env,
                TERM: 'xterm-256color'
            }
        });
        // Store the attached session
        this.attachedSessions.set(sessionKey, ptyProcess);
        // Handle process events
        ptyProcess.onExit((e) => {
            console.log(`Tmux session ${sessionKey} detached with code ${e.exitCode}, signal ${e.signal}`);
            this.attachedSessions.delete(sessionKey);
            this.emit('session-detached', { sessionKey, code: e.exitCode, signal: e.signal });
        });
        ptyProcess.onData((data) => {
            this.emit('session-data', { sessionKey, data });
        });
        this.emit('session-attached', { sessionKey, ptyProcess });
        return ptyProcess;
    }
    // Detach from a session
    detachFromSession(sessionName, windowIndex, paneIndex) {
        const sessionKey = `${sessionName}:${windowIndex || 0}:${paneIndex || 0}`;
        const session = this.attachedSessions.get(sessionKey);
        if (session && session.pid !== undefined) {
            // Send detach command (Ctrl+B, then d)
            session.write('\x02d');
            this.attachedSessions.delete(sessionKey);
            return true;
        }
        return false;
    }
    // Send input to attached session
    sendInput(sessionName, input, windowIndex, paneIndex) {
        const sessionKey = `${sessionName}:${windowIndex || 0}:${paneIndex || 0}`;
        const session = this.attachedSessions.get(sessionKey);
        if (session && session.pid !== undefined) {
            session.write(input);
            return true;
        }
        return false;
    }
    // Resize attached session
    resizeSession(sessionName, cols, rows, windowIndex, paneIndex) {
        const sessionKey = `${sessionName}:${windowIndex || 0}:${paneIndex || 0}`;
        const session = this.attachedSessions.get(sessionKey);
        if (session && session.pid !== undefined) {
            session.resize(cols, rows);
            return true;
        }
        return false;
    }
    // Enhanced session listing with detailed info
    async getDetailedSessions() {
        return new Promise((resolve, reject) => {
            const cmd = (0, child_process_1.spawn)('tmux', ['list-sessions', '-F', '#{session_name}|#{session_created}|#{session_activity}']);
            let output = '';
            cmd.stdout.on('data', (data) => {
                output += data.toString();
            });
            cmd.on('close', async (code) => {
                if (code !== 0) {
                    resolve([]);
                    return;
                }
                const sessionLines = output.trim().split('\n').filter(line => line);
                const sessions = [];
                for (const line of sessionLines) {
                    const [name, created, activity] = line.split('|');
                    if (!name)
                        continue;
                    try {
                        const windows = await this.getDetailedWindows(name);
                        sessions.push({
                            name,
                            windows,
                            created: new Date(parseInt(created) * 1000),
                            lastActivity: new Date(parseInt(activity) * 1000)
                        });
                    }
                    catch (error) {
                        console.warn(`Failed to get windows for session ${name}:`, error);
                    }
                }
                resolve(sessions);
            });
            cmd.on('error', reject);
        });
    }
    // Get detailed window information
    async getDetailedWindows(sessionName) {
        return new Promise((resolve, reject) => {
            const cmd = (0, child_process_1.spawn)('tmux', [
                'list-windows', '-t', sessionName, '-F',
                '#{window_index}|#{window_name}|#{window_active}'
            ]);
            let output = '';
            cmd.stdout.on('data', (data) => {
                output += data.toString();
            });
            cmd.on('close', async (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to list windows for session ${sessionName}`));
                    return;
                }
                const windowLines = output.trim().split('\n').filter(line => line);
                const windows = [];
                for (const line of windowLines) {
                    const [indexStr, name, activeStr] = line.split('|');
                    const index = parseInt(indexStr);
                    try {
                        const panes = await this.getWindowPanes(sessionName, index);
                        windows.push({
                            index,
                            name: name || `window-${index}`,
                            active: activeStr === '1',
                            panes
                        });
                    }
                    catch (error) {
                        console.warn(`Failed to get panes for window ${sessionName}:${index}:`, error);
                        windows.push({
                            index,
                            name: name || `window-${index}`,
                            active: activeStr === '1',
                            panes: []
                        });
                    }
                }
                resolve(windows);
            });
            cmd.on('error', reject);
        });
    }
    // Get pane information for a window
    async getWindowPanes(sessionName, windowIndex) {
        return new Promise((resolve, reject) => {
            const cmd = (0, child_process_1.spawn)('tmux', [
                'list-panes', '-t', `${sessionName}:${windowIndex}`, '-F',
                '#{pane_index}|#{pane_active}|#{pane_width}|#{pane_height}|#{pane_current_command}'
            ]);
            let output = '';
            cmd.stdout.on('data', (data) => {
                output += data.toString();
            });
            cmd.on('close', (code) => {
                if (code !== 0) {
                    resolve([]); // Return empty array instead of rejecting
                    return;
                }
                const paneLines = output.trim().split('\n').filter(line => line);
                const panes = paneLines.map(line => {
                    const [indexStr, activeStr, widthStr, heightStr, command] = line.split('|');
                    return {
                        index: parseInt(indexStr) || 0,
                        active: activeStr === '1',
                        width: parseInt(widthStr) || 80,
                        height: parseInt(heightStr) || 24,
                        command: command || undefined
                    };
                });
                resolve(panes);
            });
            cmd.on('error', () => resolve([])); // Return empty array on error
        });
    }
    // Start continuous capture of a pane with streaming
    startPaneStream(sessionName, windowIndex, paneIndex = 0) {
        const target = `${sessionName}:${windowIndex}.${paneIndex}`;
        const streamKey = `stream-${target}`;
        // Stop existing stream if any
        this.stopPaneStream(sessionName, windowIndex, paneIndex);
        const streamEmitter = new events_1.EventEmitter();
        // Use tmux pipe-pane for real-time streaming
        const pipeCmd = (0, child_process_1.spawn)('tmux', [
            'pipe-pane', '-t', target,
            'cat >> /tmp/tmux-stream-' + streamKey
        ]);
        // Monitor the pipe file
        const tailCmd = (0, child_process_1.spawn)('tail', ['-f', `/tmp/tmux-stream-${streamKey}`]);
        tailCmd.stdout.on('data', (data) => {
            streamEmitter.emit('data', data.toString());
        });
        tailCmd.stderr.on('data', (data) => {
            streamEmitter.emit('error', data.toString());
        });
        tailCmd.on('close', (code) => {
            streamEmitter.emit('close', code);
        });
        // Store the process for cleanup
        this.captureProcesses.set(streamKey, tailCmd);
        return streamEmitter;
    }
    // Stop pane streaming
    stopPaneStream(sessionName, windowIndex, paneIndex = 0) {
        const target = `${sessionName}:${windowIndex}.${paneIndex}`;
        const streamKey = `stream-${target}`;
        // Stop pipe-pane
        (0, child_process_1.spawn)('tmux', ['pipe-pane', '-t', target]);
        // Kill tail process
        const process = this.captureProcesses.get(streamKey);
        if (process && !process.killed) {
            process.kill();
            this.captureProcesses.delete(streamKey);
            // Clean up temp file
            (0, child_process_1.spawn)('rm', [`/tmp/tmux-stream-${streamKey}`]);
            return true;
        }
        return false;
    }
    // Create new session with advanced options
    async createSession(name, command, workingDir) {
        return new Promise((resolve) => {
            const args = ['new-session', '-d', '-s', name];
            if (workingDir) {
                args.push('-c', workingDir);
            }
            if (command) {
                args.push(command);
            }
            const cmd = (0, child_process_1.spawn)('tmux', args);
            cmd.on('close', (code) => {
                resolve(code === 0);
            });
            cmd.on('error', () => {
                resolve(false);
            });
        });
    }
    // Kill session
    async killSession(sessionName) {
        return new Promise((resolve) => {
            const cmd = (0, child_process_1.spawn)('tmux', ['kill-session', '-t', sessionName]);
            cmd.on('close', (code) => {
                // Also clean up any attached sessions
                for (const [key, session] of this.attachedSessions.entries()) {
                    if (key.startsWith(`${sessionName}:`)) {
                        session.kill();
                        this.attachedSessions.delete(key);
                    }
                }
                resolve(code === 0);
            });
            cmd.on('error', () => resolve(false));
        });
    }
    // Get all attached sessions
    getAttachedSessions() {
        return Array.from(this.attachedSessions.keys());
    }
    // Cleanup all resources
    cleanup() {
        // Kill all attached sessions
        for (const [key, session] of this.attachedSessions.entries()) {
            if (session.pid !== undefined) {
                session.kill();
            }
        }
        this.attachedSessions.clear();
        // Kill all capture processes
        for (const [key, process] of this.captureProcesses.entries()) {
            if (!process.killed) {
                process.kill();
            }
        }
        this.captureProcesses.clear();
        this.removeAllListeners();
    }
}
exports.TmuxController = TmuxController;
//# sourceMappingURL=tmuxController.js.map