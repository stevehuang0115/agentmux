import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { LoggerService } from '../core/logger.service.js';
/**
 * Service that watches the global teams.json file for changes and triggers
 * real-time WebSocket updates when agent registrations or team status changes occur.
 */
export class TeamsJsonWatcherService extends EventEmitter {
    logger;
    teamActivityService = null;
    watcher = null;
    debounceTimer = null;
    DEBOUNCE_DELAY = 1000; // 1 second debounce
    teamsJsonPath;
    lastTeamsData = []; // Cache of previous teams data for comparison
    constructor() {
        super();
        this.logger = LoggerService.getInstance().createComponentLogger('TeamsJsonWatcher');
        this.teamsJsonPath = path.join(os.homedir(), '.agentmux', 'teams.json');
        // Cleanup on process exit
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
    }
    /**
     * Set the TeamActivityWebSocketService instance to trigger when teams.json changes
     */
    setTeamActivityService(teamActivityService) {
        this.teamActivityService = teamActivityService;
    }
    /**
     * Start watching the teams.json file for changes
     */
    start() {
        this.logger.info('Starting teams.json file watcher...', {
            path: this.teamsJsonPath
        });
        // Ensure the directory exists
        const agentmuxDir = path.dirname(this.teamsJsonPath);
        if (!fs.existsSync(agentmuxDir)) {
            this.logger.warn('AgentMux directory does not exist, creating it...', {
                dir: agentmuxDir
            });
            fs.mkdirSync(agentmuxDir, { recursive: true });
        }
        // Stop existing watcher if any
        this.stop();
        try {
            // Watch the entire .agentmux directory to catch teams.json creation/modification/deletion
            this.watcher = fs.watch(agentmuxDir, { persistent: true }, (eventType, filename) => {
                // Only respond to teams.json changes
                if (filename === 'teams.json') {
                    this.handleTeamsJsonChange(eventType);
                }
            });
            this.watcher.on('error', (error) => {
                this.logger.error('Teams.json watcher error:', {
                    error: error instanceof Error ? error.message : String(error),
                    path: this.teamsJsonPath
                });
                // Emit error event for handling by parent services
                this.emit('watcher_error', error);
                // Attempt to restart watcher after a delay
                setTimeout(() => {
                    this.logger.info('Attempting to restart teams.json watcher...');
                    this.start();
                }, 5000);
            });
            // Perform initial check to ensure current state is broadcasted
            this.triggerTeamActivityUpdate('initial_check');
            this.logger.info('Teams.json file watcher started successfully');
        }
        catch (error) {
            this.logger.error('Failed to start teams.json file watcher:', {
                error: error instanceof Error ? error.message : String(error),
                path: this.teamsJsonPath
            });
            throw error;
        }
    }
    /**
     * Stop watching the teams.json file
     */
    stop() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.watcher) {
            try {
                this.watcher.close();
                this.logger.debug('Teams.json file watcher stopped');
            }
            catch (error) {
                this.logger.error('Error stopping teams.json watcher:', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
            finally {
                this.watcher = null;
            }
        }
    }
    /**
     * Handle teams.json file changes with debouncing
     */
    handleTeamsJsonChange(eventType) {
        this.logger.debug('Teams.json change detected', { eventType });
        // Clear existing debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        // Set new debounce timer
        this.debounceTimer = setTimeout(() => {
            this.processTeamsJsonChange(eventType);
            this.debounceTimer = null;
        }, this.DEBOUNCE_DELAY);
    }
    /**
     * Process the actual teams.json change after debouncing
     */
    async processTeamsJsonChange(eventType) {
        try {
            // Check if file exists (might be deleted)
            const fileExists = fs.existsSync(this.teamsJsonPath);
            this.logger.info('Processing teams.json change', {
                eventType,
                fileExists,
                timestamp: new Date().toISOString()
            });
            // Emit change event for other services that might be interested
            this.emit('teams_json_changed', {
                eventType,
                fileExists,
                path: this.teamsJsonPath,
                timestamp: new Date()
            });
            // Smart change detection - only trigger activity refresh for relevant changes
            const shouldTriggerActivityRefresh = await this.shouldTriggerActivityRefresh(fileExists);
            if (shouldTriggerActivityRefresh) {
                this.logger.info('Activity-relevant change detected, triggering team activity refresh', {
                    eventType
                });
                this.triggerTeamActivityUpdate(eventType);
            }
            else {
                this.logger.info('Metadata-only change detected, skipping activity refresh', {
                    eventType
                });
            }
        }
        catch (error) {
            this.logger.error('Error processing teams.json change:', {
                error: error instanceof Error ? error.message : String(error),
                eventType
            });
        }
    }
    /**
     * Determine if the teams.json change should trigger an activity refresh
     * Only session/activity-relevant changes should trigger tmux commands
     */
    async shouldTriggerActivityRefresh(fileExists) {
        try {
            // If file was deleted or doesn't exist, this affects team activity
            if (!fileExists) {
                this.lastTeamsData = [];
                return true;
            }
            // Read current teams data
            const currentData = JSON.parse(fs.readFileSync(this.teamsJsonPath, 'utf8'));
            // If this is the first time or we don't have cached data, trigger refresh
            if (!this.lastTeamsData || this.lastTeamsData.length === 0) {
                this.lastTeamsData = JSON.parse(JSON.stringify(currentData)); // Deep copy
                return true;
            }
            // Compare teams data for activity-relevant changes
            const hasActivityRelevantChange = this.hasActivityRelevantChanges(this.lastTeamsData, currentData);
            // Update cached data for next comparison
            this.lastTeamsData = JSON.parse(JSON.stringify(currentData)); // Deep copy
            return hasActivityRelevantChange;
        }
        catch (error) {
            this.logger.warn('Error comparing teams data, defaulting to trigger refresh', {
                error: error instanceof Error ? error.message : String(error)
            });
            return true; // Default to safe behavior
        }
    }
    /**
     * Compare old and new teams data to detect activity-relevant changes
     * Returns true if changes affect session status or activity monitoring
     */
    hasActivityRelevantChanges(oldTeams, newTeams) {
        // Check if number of teams changed (teams added/removed)
        if (oldTeams.length !== newTeams.length) {
            this.logger.debug('Teams count changed - activity relevant', {
                oldCount: oldTeams.length,
                newCount: newTeams.length
            });
            return true;
        }
        // Check each team for activity-relevant changes
        for (let i = 0; i < newTeams.length; i++) {
            const oldTeam = oldTeams.find((team) => team.id === newTeams[i].id);
            const newTeam = newTeams[i];
            // If team doesn't exist in old data, it's a new team (activity relevant)
            if (!oldTeam) {
                this.logger.debug('New team detected - activity relevant', { teamId: newTeam.id });
                return true;
            }
            // Check if number of members changed (members added/removed)
            if (oldTeam.members.length !== newTeam.members.length) {
                this.logger.debug('Member count changed - activity relevant', {
                    teamId: newTeam.id,
                    oldCount: oldTeam.members.length,
                    newCount: newTeam.members.length
                });
                return true;
            }
            // Check each member for activity-relevant changes
            for (const newMember of newTeam.members) {
                const oldMember = oldTeam.members.find((member) => member.id === newMember.id);
                // If member doesn't exist in old data, it's a new member (activity relevant)
                if (!oldMember) {
                    this.logger.debug('New member detected - activity relevant', {
                        teamId: newTeam.id,
                        memberId: newMember.id
                    });
                    return true;
                }
                // Check for activity-relevant field changes
                if (oldMember.agentStatus !== newMember.agentStatus ||
                    oldMember.workingStatus !== newMember.workingStatus ||
                    oldMember.sessionName !== newMember.sessionName) {
                    this.logger.debug('Activity-relevant field changed', {
                        teamId: newTeam.id,
                        memberId: newMember.id,
                        changes: {
                            agentStatus: oldMember.agentStatus !== newMember.agentStatus ?
                                { old: oldMember.agentStatus, new: newMember.agentStatus } : undefined,
                            workingStatus: oldMember.workingStatus !== newMember.workingStatus ?
                                { old: oldMember.workingStatus, new: newMember.workingStatus } : undefined,
                            sessionName: oldMember.sessionName !== newMember.sessionName ?
                                { old: oldMember.sessionName, new: newMember.sessionName } : undefined,
                        }
                    });
                    return true;
                }
                // Log metadata changes but don't trigger activity refresh
                const metadataChanges = [];
                if (oldMember.runtimeType !== newMember.runtimeType) {
                    metadataChanges.push(`runtimeType: ${oldMember.runtimeType} → ${newMember.runtimeType}`);
                }
                if (oldMember.systemPrompt !== newMember.systemPrompt) {
                    metadataChanges.push('systemPrompt changed');
                }
                if (oldMember.name !== newMember.name) {
                    metadataChanges.push(`name: ${oldMember.name} → ${newMember.name}`);
                }
                if (oldMember.role !== newMember.role) {
                    metadataChanges.push(`role: ${oldMember.role} → ${newMember.role}`);
                }
                if (oldMember.readyAt !== newMember.readyAt) {
                    metadataChanges.push('readyAt timestamp updated');
                }
                if (oldMember.lastActivityCheck !== newMember.lastActivityCheck) {
                    metadataChanges.push('lastActivityCheck timestamp updated');
                }
                if (oldMember.updatedAt !== newMember.updatedAt) {
                    metadataChanges.push('updatedAt timestamp updated');
                }
                if (metadataChanges.length > 0) {
                    this.logger.debug('Metadata-only changes detected (not triggering activity refresh)', {
                        teamId: newTeam.id,
                        memberId: newMember.id,
                        changes: metadataChanges
                    });
                }
            }
        }
        // No activity-relevant changes found
        return false;
    }
    /**
     * Trigger team activity update through TeamActivityWebSocketService
     */
    triggerTeamActivityUpdate(reason) {
        if (!this.teamActivityService) {
            this.logger.warn('TeamActivityWebSocketService not set, cannot trigger update');
            return;
        }
        this.logger.info('Triggering team activity WebSocket update', { reason });
        try {
            // Force refresh of team activity data and broadcast to all connected clients
            this.teamActivityService.forceRefresh();
            // Emit event for logging/monitoring
            this.emit('team_activity_triggered', { reason, timestamp: new Date() });
        }
        catch (error) {
            this.logger.error('Error triggering team activity update:', {
                error: error instanceof Error ? error.message : String(error),
                reason
            });
        }
    }
    /**
     * Get watcher status information
     */
    getStatus() {
        const fileExists = fs.existsSync(this.teamsJsonPath);
        let lastModified;
        if (fileExists) {
            try {
                const stats = fs.statSync(this.teamsJsonPath);
                lastModified = stats.mtime;
            }
            catch (error) {
                this.logger.warn('Error getting teams.json file stats:', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        return {
            isWatching: this.watcher !== null,
            teamsJsonPath: this.teamsJsonPath,
            fileExists,
            lastModified
        };
    }
    /**
     * Force trigger a team activity update (for testing or manual refresh)
     */
    forceTrigger(reason = 'manual_trigger') {
        this.logger.info('Force triggering team activity update', { reason });
        this.triggerTeamActivityUpdate(reason);
    }
    /**
     * Cleanup resources
     */
    cleanup() {
        this.logger.info('Cleaning up teams.json watcher...');
        this.stop();
        this.removeAllListeners();
    }
}
//# sourceMappingURL=teams-json-watcher.service.js.map