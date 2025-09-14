import { EventEmitter } from 'events';
import { AGENTMUX_CONSTANTS } from '../../../../config/constants.js';
export class TeamActivityWebSocketService extends EventEmitter {
    storageService;
    tmuxService;
    taskTrackingService;
    terminalGateway = null;
    backgroundTimer = null;
    cachedActivityData = null;
    BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
    MAX_OUTPUT_SIZE = 1024; // 1KB max per output
    SESSION_CHECK_TIMEOUT = 3000; // 3 second timeout
    constructor(storageService, tmuxService, taskTrackingService) {
        super();
        this.storageService = storageService;
        this.tmuxService = tmuxService;
        this.taskTrackingService = taskTrackingService;
        // Listen for events that should trigger activity updates
        this.setupEventListeners();
    }
    /**
     * Set the terminal gateway for broadcasting WebSocket events
     */
    setTerminalGateway(terminalGateway) {
        this.terminalGateway = terminalGateway;
    }
    /**
     * Start the event-driven activity monitoring with background refresh
     */
    start() {
        console.log('Starting event-driven team activity monitoring...');
        // Perform initial activity check
        this.performActivityCheck();
        // Set up background refresh every 5 minutes
        this.backgroundTimer = setInterval(() => {
            console.log('Background team activity refresh...');
            this.performActivityCheck();
        }, this.BACKGROUND_REFRESH_INTERVAL);
    }
    /**
     * Stop the activity monitoring
     */
    stop() {
        if (this.backgroundTimer) {
            clearInterval(this.backgroundTimer);
            this.backgroundTimer = null;
        }
        console.log('Team activity monitoring stopped');
    }
    /**
     * Set up event listeners for activity triggers
     */
    setupEventListeners() {
        // Listen for tmux session lifecycle events
        this.tmuxService.on('session_created', (data) => {
            console.log(`Session created: ${data.sessionName} - triggering activity check`);
            this.performActivityCheck();
        });
        this.tmuxService.on('session_killed', (data) => {
            console.log(`Session killed: ${data.sessionName} - triggering activity check`);
            this.performActivityCheck();
        });
        // Listen for task tracking events
        this.taskTrackingService.on('task_assigned', () => {
            console.log('Task assigned - triggering activity check');
            this.performActivityCheck();
        });
        this.taskTrackingService.on('task_completed', () => {
            console.log('Task completed - triggering activity check');
            this.performActivityCheck();
        });
    }
    /**
     * Perform comprehensive activity check and broadcast changes
     */
    async performActivityCheck() {
        try {
            const activityData = await this.gatherActivityData();
            // Check if data has meaningfully changed
            if (this.hasActivityChanged(activityData)) {
                console.log('Team activity changes detected, broadcasting updates...');
                // Cache the new data
                this.cachedActivityData = activityData;
                // Broadcast individual events
                this.broadcastOrchestratorUpdate(activityData.orchestrator);
                this.broadcastMemberUpdates(activityData.members);
                // Broadcast comprehensive update
                this.broadcastTeamActivityUpdate(activityData);
            }
        }
        catch (error) {
            console.error('Error performing activity check:', error);
        }
    }
    /**
     * Gather comprehensive team activity data (optimized with bulk session checking)
     */
    async gatherActivityData() {
        const now = new Date().toISOString();
        // Get teams and tasks
        const teams = await this.storageService.getTeams();
        const inProgressTasks = await this.taskTrackingService.getAllInProgressTasks();
        const tasksByMember = new Map();
        inProgressTasks.forEach((task) => {
            tasksByMember.set(task.assignedTeamMemberId, task);
        });
        // Collect all session names for bulk checking (including orchestrator)
        const allSessionNames = [AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME];
        const membersBySession = new Map();
        for (const team of teams) {
            for (const member of team.members) {
                if (member.sessionName) {
                    allSessionNames.push(member.sessionName);
                    membersBySession.set(member.sessionName, { team, member });
                }
            }
        }
        // Perform bulk session existence check with timeout protection
        let sessionExistenceMap;
        try {
            sessionExistenceMap = await Promise.race([
                this.tmuxService.bulkSessionExists(allSessionNames),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Bulk session check timeout')), this.SESSION_CHECK_TIMEOUT * 2) // Double timeout for bulk
                )
            ]);
        }
        catch (error) {
            console.warn('Bulk session check failed, falling back to individual checks:', error);
            // Fallback to individual checks with timeout
            sessionExistenceMap = new Map();
            for (const sessionName of allSessionNames) {
                const exists = await this.checkSessionWithTimeout(sessionName);
                sessionExistenceMap.set(sessionName, exists);
            }
        }
        // Build orchestrator data
        const orchestratorRunning = sessionExistenceMap.get(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME) || false;
        const orchestratorData = {
            sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
            running: orchestratorRunning,
            lastCheck: now
        };
        // Build member data
        const memberStatuses = [];
        for (const team of teams) {
            for (const member of team.members) {
                if (member.sessionName) {
                    const sessionExists = sessionExistenceMap.get(member.sessionName) || false;
                    const currentTask = tasksByMember.get(member.id);
                    // Read agentStatus directly from member data, fallback to session check
                    const agentStatus = member.agentStatus || (sessionExists ? 'active' : 'inactive');
                    const workingStatus = currentTask ? 'in_progress' : 'idle';
                    // Get terminal output for activity detection (only if session exists)
                    let terminalOutput = '';
                    let activityDetected = false;
                    if (sessionExists) {
                        try {
                            terminalOutput = await this.tmuxService.capturePane(member.sessionName, 5);
                            terminalOutput = terminalOutput.slice(-this.MAX_OUTPUT_SIZE); // Limit size
                            activityDetected = this.detectActivity(member.sessionName, terminalOutput);
                        }
                        catch (error) {
                            // Terminal capture failed, but session exists - still mark as active
                            activityDetected = false;
                        }
                    }
                    memberStatuses.push({
                        teamId: team.id,
                        teamName: team.name,
                        memberId: member.id,
                        memberName: member.name,
                        role: member.role,
                        sessionName: member.sessionName,
                        agentStatus,
                        workingStatus,
                        lastActivityCheck: now,
                        activityDetected,
                        currentTask: currentTask ? {
                            id: currentTask.id,
                            taskName: currentTask.taskName,
                            status: currentTask.status,
                            assignedAt: currentTask.assignedAt
                        } : undefined,
                        lastTerminalOutput: terminalOutput || undefined
                    });
                }
            }
        }
        console.log(`🚀 Optimized session check completed: checked ${allSessionNames.length} sessions with ${sessionExistenceMap.has(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME) ? 'bulk' : 'individual'} method`);
        return {
            orchestrator: orchestratorData,
            members: memberStatuses
        };
    }
    /**
     * Check if session exists with timeout
     */
    async checkSessionWithTimeout(sessionName) {
        try {
            return await Promise.race([
                this.tmuxService.sessionExists(sessionName),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Session check timeout')), this.SESSION_CHECK_TIMEOUT))
            ]);
        }
        catch (error) {
            console.warn(`Session check failed for ${sessionName}:`, error);
            return false;
        }
    }
    /**
     * Detect activity by comparing terminal output
     */
    detectActivity(sessionName, currentOutput) {
        const lastOutput = this.cachedActivityData?.members.find(m => m.sessionName === sessionName)?.lastTerminalOutput;
        if (!lastOutput) {
            return !!currentOutput.trim(); // Activity if there's any output
        }
        // Compare outputs to detect changes
        return currentOutput !== lastOutput;
    }
    /**
     * Check if activity data has meaningfully changed
     */
    hasActivityChanged(newData) {
        if (!this.cachedActivityData) {
            return true; // First time, always broadcast
        }
        // Check orchestrator changes
        if (newData.orchestrator.running !== this.cachedActivityData.orchestrator.running) {
            return true;
        }
        // Check member status changes
        for (const newMember of newData.members) {
            const oldMember = this.cachedActivityData.members.find(m => m.memberId === newMember.memberId);
            if (!oldMember ||
                oldMember.agentStatus !== newMember.agentStatus ||
                oldMember.workingStatus !== newMember.workingStatus ||
                oldMember.activityDetected !== newMember.activityDetected ||
                oldMember.currentTask?.id !== newMember.currentTask?.id) {
                return true;
            }
        }
        // Check if members were added/removed
        if (newData.members.length !== this.cachedActivityData.members.length) {
            return true;
        }
        return false; // No meaningful changes
    }
    /**
     * Broadcast orchestrator status update
     */
    broadcastOrchestratorUpdate(orchestratorData) {
        if (this.terminalGateway) {
            this.terminalGateway.broadcastOrchestratorStatus(orchestratorData);
        }
    }
    /**
     * Broadcast member status updates
     */
    broadcastMemberUpdates(members) {
        if (this.terminalGateway) {
            members.forEach(member => {
                this.terminalGateway.broadcastTeamMemberStatus(member);
            });
        }
    }
    /**
     * Broadcast comprehensive team activity update
     */
    broadcastTeamActivityUpdate(activityData) {
        if (this.terminalGateway) {
            this.terminalGateway.broadcastTeamActivity(activityData);
        }
    }
    /**
     * Get cached activity data (for immediate responses)
     */
    getCachedActivityData() {
        return this.cachedActivityData;
    }
    /**
     * Force refresh activity data (for manual triggers)
     */
    async forceRefresh() {
        console.log('Force refreshing team activity data...');
        await this.performActivityCheck();
    }
}
//# sourceMappingURL=team-activity-websocket.service.js.map