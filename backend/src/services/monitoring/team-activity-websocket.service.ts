import { EventEmitter } from 'events';
import { StorageService } from '../core/storage.service.js';
import { TmuxService } from '../agent/tmux.service.js';
import { TaskTrackingService } from '../project/task-tracking.service.js';
import { TerminalGateway } from '../../websocket/terminal.gateway.js';
import { CREWLY_CONSTANTS } from '../../constants.js';
import { getSessionBackendSync } from '../session/index.js';

export interface TeamActivityData {
  orchestrator: {
    sessionName: string;
    running: boolean;
    lastCheck: string;
  };
  members: Array<{
    teamId: string;
    teamName: string;
    memberId: string;
    memberName: string;
    role: string;
    sessionName: string;
    agentStatus: 'active' | 'inactive' | 'activating';
    workingStatus: 'in_progress' | 'idle';
    lastActivityCheck: string;
    activityDetected: boolean;
    currentTask?: {
      id: string;
      taskName: string;
      status: string;
      assignedAt: string;
    };
    lastTerminalOutput?: string;
  }>;
}

export class TeamActivityWebSocketService extends EventEmitter {
  private storageService: StorageService;
  private _legacyTmuxService: TmuxService; // DORMANT: kept for backward compatibility, using PTY backend
  private taskTrackingService: TaskTrackingService;
  private terminalGateway: TerminalGateway | null = null;
  private backgroundTimer: NodeJS.Timeout | null = null;
  private cachedActivityData: TeamActivityData | null = null;
  private readonly BACKGROUND_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_OUTPUT_SIZE = 1024; // 1KB max per output
  private readonly SESSION_CHECK_TIMEOUT = 8000; // 8 second timeout (increased for reliability)

  constructor(
    storageService: StorageService,
    tmuxService: TmuxService,
    taskTrackingService: TaskTrackingService
  ) {
    super();
    this.storageService = storageService;
    this._legacyTmuxService = tmuxService; // DORMANT: kept for backward compatibility
    this.taskTrackingService = taskTrackingService;

    // Listen for events that should trigger activity updates
    this.setupEventListeners();
  }

  /**
   * Set the terminal gateway for broadcasting WebSocket events
   */
  setTerminalGateway(terminalGateway: TerminalGateway): void {
    this.terminalGateway = terminalGateway;
  }

  /**
   * Start the event-driven activity monitoring with background refresh
   */
  start(): void {
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
  stop(): void {
    if (this.backgroundTimer) {
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
    }
    console.log('Team activity monitoring stopped');
  }

  /**
   * Set up event listeners for activity triggers
   */
  private setupEventListeners(): void {
    // DORMANT: tmux session lifecycle events removed - using PTY backend polling instead
    // PTY session events could be added here in the future if needed

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
  private async performActivityCheck(): Promise<void> {
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
      
    } catch (error) {
      console.error('Error performing activity check:', error);
    }
  }

  /**
   * Gather comprehensive team activity data (optimized with bulk session checking)
   */
  private async gatherActivityData(): Promise<TeamActivityData> {
    const now = new Date().toISOString();
    
    // Get teams and tasks
    const teams = await this.storageService.getTeams();
    const inProgressTasks = await this.taskTrackingService.getAllInProgressTasks();
    const tasksByMember = new Map();
    inProgressTasks.forEach((task: any) => {
      tasksByMember.set(task.assignedTeamMemberId, task);
    });

    // Collect all session names for bulk checking (including orchestrator)
    const allSessionNames: string[] = [CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME];
    const membersBySession = new Map<string, any>();
    
    for (const team of teams) {
      for (const member of team.members) {
        if (member.sessionName) {
          allSessionNames.push(member.sessionName);
          membersBySession.set(member.sessionName, { team, member });
        }
      }
    }

    // Use PTY session backend for session existence checks (replaces tmux)
    const sessionExistenceMap = new Map<string, boolean>();
    const backend = getSessionBackendSync();

    if (backend) {
      // Get all active PTY sessions
      const activeSessions = new Set(backend.listSessions());

      // Check existence for all session names
      for (const sessionName of allSessionNames) {
        sessionExistenceMap.set(sessionName, activeSessions.has(sessionName));
      }
    } else {
      // No backend initialized yet - all sessions are inactive
      for (const sessionName of allSessionNames) {
        sessionExistenceMap.set(sessionName, false);
      }
    }

    // Build orchestrator data
    const orchestratorRunning = sessionExistenceMap.get(CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME) || false;
    const orchestratorData = {
      sessionName: CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
      running: orchestratorRunning,
      lastCheck: now
    };

    // Build member data
    const memberStatuses: any[] = [];
    
    for (const team of teams) {
      for (const member of team.members) {
        if (member.sessionName) {
          const sessionExists = sessionExistenceMap.get(member.sessionName) || false;
          const currentTask = tasksByMember.get(member.id);
          
          // Use actual PTY session existence as the primary source of truth for agentStatus
          // This ensures the UI reflects the real state, not stale data from teams.json
          const agentStatus = sessionExists ? 'active' : 'inactive';
          const workingStatus = currentTask ? 'in_progress' : 'idle';
          
          // Get terminal output for activity detection (only if session exists)
          let terminalOutput = '';
          let activityDetected = false;
          
          if (sessionExists && backend) {
            try {
              // Use PTY backend to capture terminal output
              terminalOutput = backend.captureOutput(member.sessionName, 5);
              terminalOutput = terminalOutput.slice(-this.MAX_OUTPUT_SIZE); // Limit size
              activityDetected = this.detectActivity(member.sessionName, terminalOutput);
            } catch (error) {
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

    console.log(`🚀 Optimized session check completed: checked ${allSessionNames.length} sessions with ${sessionExistenceMap.has(CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME) ? 'bulk' : 'individual'} method`);

    return {
      orchestrator: orchestratorData,
      members: memberStatuses
    };
  }

  /**
   * Check if session exists using PTY backend
   */
  private checkSessionWithTimeout(sessionName: string): boolean {
    try {
      const backend = getSessionBackendSync();
      if (!backend) {
        return false;
      }
      return backend.sessionExists(sessionName);
    } catch (error) {
      console.warn(`Session check failed for ${sessionName}:`, error);
      return false;
    }
  }

  /**
   * Detect activity by comparing terminal output
   */
  private detectActivity(sessionName: string, currentOutput: string): boolean {
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
  private hasActivityChanged(newData: TeamActivityData): boolean {
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
  private broadcastOrchestratorUpdate(orchestratorData: any): void {
    if (this.terminalGateway) {
      this.terminalGateway!.broadcastOrchestratorStatus(orchestratorData);
    }
  }

  /**
   * Broadcast member status updates
   */
  private broadcastMemberUpdates(members: any[]): void {
    if (this.terminalGateway) {
      members.forEach(member => {
        this.terminalGateway!.broadcastTeamMemberStatus(member);
      });
    }
  }

  /**
   * Broadcast comprehensive team activity update
   */
  private broadcastTeamActivityUpdate(activityData: TeamActivityData): void {
    if (this.terminalGateway) {
      this.terminalGateway!.broadcastTeamActivity(activityData);
    }
  }

  /**
   * Get cached activity data (for immediate responses)
   */
  getCachedActivityData(): TeamActivityData | null {
    return this.cachedActivityData;
  }

  /**
   * Force refresh activity data (for manual triggers)
   */
  async forceRefresh(): Promise<void> {
    console.log('Force refreshing team activity data...');
    await this.performActivityCheck();
  }
}