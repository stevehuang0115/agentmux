import { StorageService } from '../core/storage.service.js';
import { TmuxService } from '../agent/tmux.service.js';
import { LoggerService } from '../core/logger.service.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { AGENTMUX_CONSTANTS } from '../../constants.js';
export class ActivityMonitorService {
    static instance;
    logger;
    storageService;
    tmuxService;
    intervalId = null;
    POLLING_INTERVAL = 120000; // 2 minutes (reduced frequency to prevent memory issues)
    running = false;
    lastTerminalOutputs = new Map();
    MAX_CACHED_OUTPUTS = 5; // Reduced cached terminal outputs
    MAX_OUTPUT_SIZE = 512; // 512 bytes max per output (reduced from 1KB)
    ACTIVITY_CHECK_TIMEOUT = 6000; // 6 second timeout per check (increased for reliability)
    lastCleanup = Date.now();
    constructor() {
        this.logger = LoggerService.getInstance().createComponentLogger('ActivityMonitor');
        this.storageService = StorageService.getInstance();
        this.tmuxService = new TmuxService();
    }
    static getInstance() {
        if (!ActivityMonitorService.instance) {
            ActivityMonitorService.instance = new ActivityMonitorService();
        }
        return ActivityMonitorService.instance;
    }
    startPolling() {
        if (this.intervalId) {
            this.logger.warn('Activity monitoring already running');
            return;
        }
        this.logger.info('Starting activity monitoring with 2-minute intervals');
        // Run immediately first
        this.performActivityCheck();
        // Set up recurring polling
        this.intervalId = setInterval(() => {
            this.performActivityCheck();
        }, this.POLLING_INTERVAL);
    }
    stopPolling() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.logger.info('Activity monitoring stopped');
        }
    }
    async performActivityCheck() {
        try {
            // Add timeout protection for entire activity check
            await Promise.race([
                this.performActivityCheckInternal(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Activity check timeout')), this.ACTIVITY_CHECK_TIMEOUT))
            ]);
            // Perform periodic cleanup
            this.performPeriodicCleanup();
        }
        catch (error) {
            this.logger.error('Error during activity check', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async performActivityCheckInternal() {
        const now = new Date().toISOString();
        // Check orchestrator status with timeout
        const orchestratorRunning = await Promise.race([
            this.tmuxService.sessionExists(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Orchestrator check timeout')), 1000))
        ]).catch(() => false);
        // Update orchestrator status if needed - read directly from teams.json
        const orchestratorStatus = await this.storageService.getOrchestratorStatus();
        if (orchestratorStatus) {
            // Don't override "activating" status during registration process
            const currentAgentStatus = orchestratorStatus.agentStatus;
            const shouldBeActive = orchestratorRunning ? 'active' : 'inactive';
            const finalAgentStatus = currentAgentStatus === 'activating' ? 'activating' : shouldBeActive;
            // Only update if the current status differs from what it should be
            if (orchestratorStatus.agentStatus !== finalAgentStatus || !orchestratorStatus.agentStatus) {
                await this.updateOrchestratorWithStatuses(finalAgentStatus, finalAgentStatus, 'idle');
                this.logger.info('Updated orchestrator status in teams.json', {
                    agentStatus: finalAgentStatus,
                    workingStatus: 'idle'
                });
            }
        }
        // Get all teams and process members with memory-efficient approach
        const teams = await this.storageService.getTeams();
        const teamsToUpdate = new Set();
        for (const team of teams) {
            for (const member of team.members) {
                // Only check members that are marked as active and have sessions
                if (member.agentStatus === 'active' && member.sessionName) {
                    try {
                        // Check if session still exists with timeout
                        const sessionExists = await Promise.race([
                            this.tmuxService.sessionExists(member.sessionName),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Session check timeout')), 500))
                        ]).catch(() => false);
                        if (!sessionExists) {
                            // Session no longer exists - only update workingStatus, NOT agentStatus
                            // NOTE: agentStatus should only be managed by registration/termination processes
                            member.workingStatus = 'idle';
                            member.lastActivityCheck = now;
                            member.updatedAt = now;
                            teamsToUpdate.add(team.id);
                            // Clean up stored output
                            delete member.lastTerminalOutput;
                            this.logger.info('Member session not found, setting workingStatus to idle', {
                                teamId: team.id,
                                memberId: member.id,
                                memberName: member.name,
                                sessionName: member.sessionName,
                                agentStatus: member.agentStatus // Log current agentStatus but don't change it
                            });
                            continue;
                        }
                        // Capture current terminal output with strict limits
                        const currentOutput = await Promise.race([
                            this.tmuxService.capturePane(member.sessionName, 5), // Further reduced from 10 to 5 lines
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Capture timeout')), 500))
                        ]).catch(() => '');
                        // Limit output size to prevent memory issues
                        const truncatedOutput = currentOutput.length > this.MAX_OUTPUT_SIZE
                            ? currentOutput.substring(currentOutput.length - this.MAX_OUTPUT_SIZE)
                            : currentOutput;
                        // Get previous output from member's stored data
                        const previousOutput = member.lastTerminalOutput || '';
                        // Smart idle pattern recognition
                        const idlePatterns = [
                            /Type your message or @path\/to\/file/i,
                            />\s*$/, // Command prompt ending
                            /Task completed successfully/i,
                            /✓.*completed/i,
                            /✓.*done/i,
                            /finished/i,
                            /ready for next/i,
                            /waiting for input/i,
                            /press any key to continue/i,
                            /\[y\/n\]/i // Waiting for user confirmation
                        ];
                        const outputChanged = truncatedOutput !== previousOutput && truncatedOutput.trim() !== '';
                        const isIdle = idlePatterns.some(pattern => truncatedOutput.match(pattern));
                        // Activity detected only if output changed AND not showing idle patterns
                        const activityDetected = outputChanged && !isIdle;
                        // Update working status based on intelligent activity detection
                        const newWorkingStatus = isIdle ? 'idle' : (activityDetected ? 'in_progress' : 'idle');
                        // Update member if working status changed
                        if (member.workingStatus !== newWorkingStatus) {
                            member.workingStatus = newWorkingStatus;
                            member.lastActivityCheck = now;
                            member.updatedAt = now;
                            teamsToUpdate.add(team.id);
                            this.logger.info('Member activity status updated', {
                                teamId: team.id,
                                memberId: member.id,
                                memberName: member.name,
                                previousStatus: member.workingStatus,
                                newWorkingStatus: newWorkingStatus,
                                activityDetected,
                                isIdle,
                                outputChanged,
                                terminalSnippet: truncatedOutput.slice(-100) // Last 100 chars for debugging
                            });
                        }
                        // Store current output for next comparison (with size limit)
                        member.lastTerminalOutput = truncatedOutput;
                    }
                    catch (error) {
                        this.logger.error('Error checking member activity', {
                            teamId: team.id,
                            memberId: member.id,
                            memberName: member.name,
                            sessionName: member.sessionName,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            }
        }
        // Save only teams that were actually updated
        // CRITICAL: Load fresh team data to prevent overwriting concurrent MCP registration updates
        for (const teamId of teamsToUpdate) {
            try {
                // Get fresh team data to avoid stale data race conditions
                const freshTeams = await this.storageService.getTeams();
                const freshTeam = freshTeams.find(t => t.id === teamId);
                if (freshTeam) {
                    // Find the corresponding stale team to get our activity updates
                    const staleTeam = teams.find(t => t.id === teamId);
                    if (staleTeam) {
                        // Apply only workingStatus and activity-related changes to fresh team
                        for (const staleMember of staleTeam.members) {
                            const freshMember = freshTeam.members.find(m => m.id === staleMember.id);
                            if (freshMember) {
                                // Only update activity-related fields, preserve agentStatus from fresh data
                                if (staleMember.lastActivityCheck) {
                                    freshMember.lastActivityCheck = staleMember.lastActivityCheck;
                                }
                                if (staleMember.workingStatus !== undefined) {
                                    freshMember.workingStatus = staleMember.workingStatus;
                                }
                                if (staleMember.lastTerminalOutput !== undefined) {
                                    freshMember.lastTerminalOutput = staleMember.lastTerminalOutput;
                                }
                                else if ('lastTerminalOutput' in staleMember && staleMember.lastTerminalOutput === undefined) {
                                    // Handle explicit deletion of lastTerminalOutput
                                    delete freshMember.lastTerminalOutput;
                                }
                                // Update timestamp for activity changes only
                                freshMember.updatedAt = staleMember.updatedAt;
                            }
                        }
                        // Save the fresh team with our activity updates applied
                        await this.storageService.saveTeam(freshTeam);
                    }
                }
            }
            catch (error) {
                this.logger.error('Error saving updated team with fresh data', {
                    teamId,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
    }
    performPeriodicCleanup() {
        const now = Date.now();
        // Clean up every 2 minutes (more frequent cleanup)
        if (now - this.lastCleanup > 2 * 60 * 1000) {
            // Limit the size of lastTerminalOutputs Map
            if (this.lastTerminalOutputs.size > this.MAX_CACHED_OUTPUTS) {
                const entries = Array.from(this.lastTerminalOutputs.entries());
                this.lastTerminalOutputs.clear();
                // Keep only the most recent entries
                const recentEntries = entries.slice(-this.MAX_CACHED_OUTPUTS);
                for (const [key, value] of recentEntries) {
                    this.lastTerminalOutputs.set(key, value);
                }
            }
            this.lastCleanup = now;
            // Force garbage collection after cleanup if available
            if (global.gc) {
                global.gc();
                this.logger.debug('Performed periodic cleanup with garbage collection', {
                    mapSize: this.lastTerminalOutputs.size
                });
            }
            else {
                this.logger.debug('Performed periodic cleanup', {
                    mapSize: this.lastTerminalOutputs.size
                });
            }
        }
    }
    async updateOrchestratorWithStatuses(status, agentStatus, workingStatus) {
        try {
            const teamsFilePath = join(homedir(), '.agentmux', 'teams.json');
            const content = JSON.parse(await readFile(teamsFilePath, 'utf-8'));
            if (content.orchestrator) {
                // Remove legacy status field and use only the new fields
                delete content.orchestrator.status;
                content.orchestrator.agentStatus = agentStatus;
                content.orchestrator.workingStatus = workingStatus;
                content.orchestrator.updatedAt = new Date().toISOString();
            }
            else {
                content.orchestrator = {
                    sessionId: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
                    agentStatus,
                    workingStatus,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }
            await writeFile(teamsFilePath, JSON.stringify(content, null, 2));
        }
        catch (error) {
            this.logger.error('Error updating orchestrator with statuses', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    isRunning() {
        return this.intervalId !== null;
    }
    getPollingInterval() {
        return this.POLLING_INTERVAL;
    }
}
//# sourceMappingURL=activity-monitor.service.js.map