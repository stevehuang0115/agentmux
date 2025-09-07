import { StorageService } from './storage.service.js';
import { TmuxService } from './tmux.service.js';
import { LoggerService } from './logger.service.js';
export class ActivityMonitorService {
    static instance;
    logger;
    storageService;
    tmuxService;
    intervalId = null;
    POLLING_INTERVAL = 30000; // 30 seconds
    constructor() {
        this.logger = LoggerService.getInstance().createComponentLogger('ActivityMonitor');
        this.storageService = new StorageService();
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
        this.logger.info('Starting activity monitoring with 30-second intervals');
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
            const now = new Date().toISOString();
            // Check orchestrator status
            const orchestratorRunning = await this.tmuxService.sessionExists('agentmux-orc');
            // Update orchestrator status if needed
            const orchestratorStatus = await this.storageService.getOrchestratorStatus();
            if (orchestratorStatus) {
                const newOrchestratorStatus = orchestratorRunning ? 'active' : 'inactive';
                const newAgentStatus = orchestratorRunning ? 'active' : 'inactive';
                if (orchestratorStatus.status !== newOrchestratorStatus ||
                    !orchestratorStatus.agentStatus ||
                    orchestratorStatus.agentStatus !== newAgentStatus) {
                    await this.updateOrchestratorWithStatuses(newOrchestratorStatus, newAgentStatus, 'idle');
                    this.logger.info('Updated orchestrator status', {
                        status: newOrchestratorStatus,
                        agentStatus: newAgentStatus,
                        workingStatus: 'idle'
                    });
                }
            }
            // Get all teams and process members
            const teams = await this.storageService.getTeams();
            let updatedTeams = false;
            for (const team of teams) {
                for (const member of team.members) {
                    // Only check members that are marked as active and have sessions
                    if (member.agentStatus === 'active' && member.sessionName) {
                        try {
                            // Check if session still exists
                            const sessionExists = await this.tmuxService.sessionExists(member.sessionName);
                            if (!sessionExists) {
                                // Session no longer exists, update to inactive
                                member.agentStatus = 'inactive';
                                member.workingStatus = 'idle';
                                member.lastActivityCheck = now;
                                member.updatedAt = now;
                                updatedTeams = true;
                                this.logger.info('Member session inactive', {
                                    teamId: team.id,
                                    memberId: member.id,
                                    memberName: member.name,
                                    sessionName: member.sessionName
                                });
                                continue;
                            }
                            // Capture current terminal output for activity detection
                            const currentOutput = await this.tmuxService.capturePane(member.sessionName, 50);
                            // Get previous output from member's stored data
                            const previousOutput = member.lastTerminalOutput || '';
                            // Check for activity (delta in terminal output)
                            const activityDetected = currentOutput !== previousOutput && currentOutput.trim() !== '';
                            // Update working status based on activity
                            const newWorkingStatus = activityDetected ? 'in_progress' : 'idle';
                            // Update member if working status changed
                            if (member.workingStatus !== newWorkingStatus) {
                                member.workingStatus = newWorkingStatus;
                                member.lastActivityCheck = now;
                                member.updatedAt = now;
                                updatedTeams = true;
                                this.logger.info('Member activity status updated', {
                                    teamId: team.id,
                                    memberId: member.id,
                                    memberName: member.name,
                                    workingStatus: newWorkingStatus,
                                    activityDetected
                                });
                            }
                            // Store current output for next comparison
                            member.lastTerminalOutput = currentOutput;
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
                // Save team if any members were updated
                if (updatedTeams) {
                    await this.storageService.saveTeam(team);
                }
            }
        }
        catch (error) {
            this.logger.error('Error during activity check', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    async updateOrchestratorWithStatuses(status, agentStatus, workingStatus) {
        try {
            const content = JSON.parse(await require('fs/promises').readFile(require('path').join(require('os').homedir(), '.agentmux', 'teams.json'), 'utf-8'));
            if (content.orchestrator) {
                content.orchestrator.status = status;
                content.orchestrator.agentStatus = agentStatus;
                content.orchestrator.workingStatus = workingStatus;
                content.orchestrator.updatedAt = new Date().toISOString();
            }
            else {
                content.orchestrator = {
                    sessionId: 'agentmux-orc',
                    status,
                    agentStatus,
                    workingStatus,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }
            await require('fs/promises').writeFile(require('path').join(require('os').homedir(), '.agentmux', 'teams.json'), JSON.stringify(content, null, 2));
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