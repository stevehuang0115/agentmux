"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TmuxManager = void 0;
const child_process_1 = require("child_process");
class TmuxManager {
    constructor() {
        this.processes = new Map();
    }
    async listSessions() {
        return new Promise((resolve, reject) => {
            const cmd = (0, child_process_1.spawn)('tmux', ['list-sessions', '-F', '#{session_name}']);
            let output = '';
            cmd.stdout.on('data', (data) => {
                output += data.toString();
            });
            cmd.on('close', async (code) => {
                if (code !== 0) {
                    resolve([]);
                    return;
                }
                const sessionNames = output.trim().split('\n').filter(name => name);
                const sessions = [];
                for (const sessionName of sessionNames) {
                    try {
                        const windows = await this.listWindows(sessionName);
                        sessions.push({ name: sessionName, windows });
                    }
                    catch (error) {
                        console.warn(`Failed to get windows for session ${sessionName}:`, error);
                    }
                }
                resolve(sessions);
            });
            cmd.on('error', reject);
        });
    }
    async listWindows(sessionName) {
        return new Promise((resolve, reject) => {
            const cmd = (0, child_process_1.spawn)('tmux', ['list-windows', '-t', sessionName, '-F', '#{window_index}:#{window_name}:#{window_active}']);
            let output = '';
            cmd.stdout.on('data', (data) => {
                output += data.toString();
            });
            cmd.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to list windows for session ${sessionName}`));
                    return;
                }
                const windows = output.trim().split('\n')
                    .filter(line => line)
                    .map(line => {
                    const [index, name, active] = line.split(':');
                    return {
                        index: parseInt(index),
                        name: name || `window-${index}`,
                        active: active === '1'
                    };
                });
                resolve(windows);
            });
            cmd.on('error', reject);
        });
    }
    async sendMessage(target, message) {
        return new Promise((resolve, reject) => {
            // Send the message
            const sendCmd = (0, child_process_1.spawn)('tmux', ['send-keys', '-t', target, message]);
            sendCmd.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to send message to ${target}`));
                    return;
                }
                // Send Enter key after a brief delay
                setTimeout(() => {
                    const enterCmd = (0, child_process_1.spawn)('tmux', ['send-keys', '-t', target, 'Enter']);
                    enterCmd.on('close', (enterCode) => {
                        resolve(enterCode === 0);
                    });
                    enterCmd.on('error', reject);
                }, 500);
            });
            sendCmd.on('error', reject);
        });
    }
    async capturePane(target, lines = 50) {
        return new Promise((resolve, reject) => {
            const cmd = (0, child_process_1.spawn)('tmux', ['capture-pane', '-t', target, '-p', '-S', `-${lines}`]);
            let output = '';
            cmd.stdout.on('data', (data) => {
                output += data.toString();
            });
            cmd.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to capture pane ${target}`));
                    return;
                }
                resolve(output);
            });
            cmd.on('error', reject);
        });
    }
    async createWindow(sessionName, windowName, workingDir) {
        return new Promise((resolve, reject) => {
            const args = ['new-window', '-t', sessionName, '-n', windowName];
            if (workingDir) {
                args.push('-c', workingDir);
            }
            const cmd = (0, child_process_1.spawn)('tmux', args);
            cmd.on('close', (code) => {
                resolve(code === 0);
            });
            cmd.on('error', reject);
        });
    }
    async killWindow(sessionName, windowIndex) {
        return new Promise((resolve, reject) => {
            const cmd = (0, child_process_1.spawn)('tmux', ['kill-window', '-t', `${sessionName}:${windowIndex}`]);
            cmd.on('close', (code) => {
                resolve(code === 0);
            });
            cmd.on('error', reject);
        });
    }
}
exports.TmuxManager = TmuxManager;
//# sourceMappingURL=tmux.js.map