"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityPoller = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
class ActivityPoller extends events_1.EventEmitter {
    constructor(storage) {
        super();
        this.interval = null;
        this.lastByteCounts = new Map();
        this.isPolling = false;
        this.pollInterval = 30000; // 30 seconds
        this.storage = storage;
    }
    start() {
        if (this.interval) {
            console.log('ActivityPoller already running');
            return;
        }
        console.log('Starting ActivityPoller with 30-second intervals');
        this.isPolling = true;
        // Initial check
        this.checkAllPanes().catch(console.error);
        // Set up interval
        this.interval = setInterval(async () => {
            try {
                await this.checkAllPanes();
            }
            catch (error) {
                console.error('Activity polling error:', error);
                this.emit('error', error);
            }
        }, this.pollInterval);
        this.emit('started');
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isPolling = false;
        console.log('ActivityPoller stopped');
        this.emit('stopped');
    }
    isRunning() {
        return this.isPolling && this.interval !== null;
    }
    setPollInterval(ms) {
        this.pollInterval = ms;
        if (this.isRunning()) {
            this.stop();
            this.start();
        }
    }
    async checkAllPanes() {
        try {
            // Get all active teams with tmux sessions
            const teams = await this.storage.getTeams();
            const activeTeams = teams.filter(team => team.status === 'active' && team.tmuxSessionName);
            for (const team of activeTeams) {
                await this.checkTeamActivity(team);
            }
        }
        catch (error) {
            console.error('Error checking all panes:', error);
        }
    }
    async checkTeamActivity(team) {
        if (!team.tmuxSessionName) {
            return;
        }
        try {
            // Get session info
            const sessionInfo = await this.getSessionInfo(team.tmuxSessionName);
            if (!sessionInfo) {
                console.warn(`Session ${team.tmuxSessionName} not found for team ${team.name}`);
                return;
            }
            // Check only the first window (index 0) for Phase 1
            // In Phase 1, each team has one tmux session with one window
            await this.checkPaneActivity(team.tmuxSessionName, 0, // Always check window 0
            0, // Always check pane 0  
            team.id, team.assignedProjectId);
        }
        catch (error) {
            console.error(`Error checking activity for team ${team.name}:`, error);
        }
    }
    async checkPaneActivity(sessionName, windowIndex, paneIndex, teamId, projectId) {
        const paneKey = `${sessionName}:${windowIndex}.${paneIndex}`;
        try {
            const byteCount = await this.getPaneByteCount(sessionName, windowIndex, paneIndex);
            const lastCount = this.lastByteCounts.get(paneKey) || 0;
            const isActive = byteCount > lastCount;
            // Update byte count
            this.lastByteCounts.set(paneKey, byteCount);
            // Record activity if status changed
            const activityEntry = {
                timestamp: new Date().toISOString(),
                type: 'pane',
                targetId: teamId,
                status: isActive ? 'active' : 'idle',
                metadata: {
                    projectId,
                    sessionName,
                    windowIndex,
                    paneIndex,
                    byteCount,
                    byteDiff: byteCount - lastCount
                }
            };
            await this.storage.appendActivity(activityEntry);
            // Emit activity event
            this.emit('pane-activity', {
                paneKey,
                teamId,
                projectId,
                isActive,
                byteCount,
                byteDiff: byteCount - lastCount
            });
        }
        catch (error) {
            console.error(`Error checking pane ${paneKey}:`, error);
        }
    }
    async getPaneByteCount(sessionName, windowIndex, paneIndex) {
        return new Promise((resolve, reject) => {
            const target = `${sessionName}:${windowIndex}.${paneIndex}`;
            // Use tmux display-message to get pane info including byte count
            const cmd = (0, child_process_1.spawn)('tmux', [
                'display-message',
                '-t', target,
                '-p',
                '#{pane_width}x#{pane_height}'
            ]);
            let output = '';
            let errorOutput = '';
            cmd.stdout.on('data', (data) => {
                output += data.toString();
            });
            cmd.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            cmd.on('close', async (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to get pane info: ${errorOutput}`));
                    return;
                }
                try {
                    // Get actual content byte count by capturing pane
                    const content = await this.capturePaneContent(sessionName, windowIndex, paneIndex);
                    resolve(Buffer.byteLength(content, 'utf8'));
                }
                catch (error) {
                    reject(error);
                }
            });
            cmd.on('error', reject);
        });
    }
    async capturePaneContent(sessionName, windowIndex, paneIndex) {
        return new Promise((resolve, reject) => {
            const target = `${sessionName}:${windowIndex}.${paneIndex}`;
            const cmd = (0, child_process_1.spawn)('tmux', [
                'capture-pane',
                '-t', target,
                '-p'
            ]);
            let output = '';
            let errorOutput = '';
            cmd.stdout.on('data', (data) => {
                output += data.toString();
            });
            cmd.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            cmd.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Failed to capture pane: ${errorOutput}`));
                    return;
                }
                resolve(output);
            });
            cmd.on('error', reject);
        });
    }
    async getSessionInfo(sessionName) {
        return new Promise((resolve, reject) => {
            const cmd = (0, child_process_1.spawn)('tmux', [
                'list-sessions',
                '-F',
                '#{session_name}',
                '-f',
                `#{==:#{session_name},${sessionName}}`
            ]);
            let output = '';
            let errorOutput = '';
            cmd.stdout.on('data', (data) => {
                output += data.toString();
            });
            cmd.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            cmd.on('close', (code) => {
                if (code !== 0 || !output.trim()) {
                    resolve(null); // Session doesn't exist
                    return;
                }
                resolve({ name: sessionName, exists: true });
            });
            cmd.on('error', reject);
        });
    }
    // Get current status of all monitored panes
    async getCurrentStatus() {
        const teams = await this.storage.getTeams();
        const activeTeams = teams.filter(team => team.status === 'active' && team.tmuxSessionName);
        const statuses = [];
        for (const team of activeTeams) {
            if (!team.tmuxSessionName)
                continue;
            for (let i = 0; i < team.roles.length; i++) {
                const paneKey = `${team.tmuxSessionName}:${i}.0`;
                const byteCount = this.lastByteCounts.get(paneKey) || 0;
                statuses.push({
                    sessionName: team.tmuxSessionName,
                    windowIndex: i,
                    paneIndex: 0,
                    byteCount,
                    lastActive: new Date(),
                    isActive: byteCount > 0
                });
            }
        }
        return statuses;
    }
    cleanup() {
        this.stop();
        this.lastByteCounts.clear();
        this.removeAllListeners();
    }
}
exports.ActivityPoller = ActivityPoller;
//# sourceMappingURL=ActivityPoller.js.map