import { StorageService } from '../core/storage.service.js';
import { getSessionBackendSync, createSessionBackend, type ISessionBackend } from '../session/index.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { AgentHeartbeatService } from '../agent/agent-heartbeat.service.js';
import { writeFile, readFile, rename, unlink } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { AGENTMUX_CONSTANTS, type WorkingStatus } from '../../constants.js';

/**
 * Team Working Status File Structure
 * Tracks ONLY workingStatus (idle vs in_progress) based on terminal activity
 * agentStatus is now managed by AgentHeartbeatService via MCP calls
 */
export interface TeamWorkingStatusFile {
  /** Orchestrator working status */
  orchestrator: {
    sessionName: string;
    workingStatus: WorkingStatus;
    lastActivityCheck: string;
    updatedAt: string;
  };
  /** Team member working statuses indexed by sessionName */
  teamMembers: Record<string, {
    sessionName: string;
    teamMemberId: string;
    workingStatus: WorkingStatus;
    lastActivityCheck: string;
    updatedAt: string;
  }>;
  /** File metadata */
  metadata: {
    lastUpdated: string;
    version: string;
  };
}

/**
 * Activity Monitor Service - NEW ARCHITECTURE
 *
 * Responsibilities:
 * - Track ONLY workingStatus (idle vs in_progress) based on terminal activity
 * - Create and manage teamWorkingStatus.json file
 * - Integrate with AgentHeartbeatService for stale agent detection
 * - Remove ALL agentStatus management (now owned by AgentHeartbeatService)
 *
 * Key Changes:
 * - No more agentStatus updates to teams.json
 * - Simple activity detection: output changed = in_progress, else = idle
 * - Integration with stale detection (30-minute threshold)
 * - Separate teamWorkingStatus.json file for working statuses
 */
export class ActivityMonitorService {
  private static instance: ActivityMonitorService;
  private logger: ComponentLogger;
  private storageService: StorageService;
  private _sessionBackend: ISessionBackend | null = null;
  private agentHeartbeatService: AgentHeartbeatService;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL = 120000; // 2 minutes
  private lastTerminalOutputs: Map<string, string> = new Map();
  private readonly MAX_OUTPUT_SIZE = 512; // 512 bytes max per output
  private readonly ACTIVITY_CHECK_TIMEOUT = 6000; // 6 second timeout per check
  private lastCleanup: number = Date.now();
  private agentmuxHome: string;
  private teamWorkingStatusFile: string;

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('ActivityMonitor');
    this.storageService = StorageService.getInstance();
    this.agentHeartbeatService = AgentHeartbeatService.getInstance();
    this.agentmuxHome = join(homedir(), AGENTMUX_CONSTANTS.PATHS.AGENTMUX_HOME);
    this.teamWorkingStatusFile = join(this.agentmuxHome, 'teamWorkingStatus.json');
  }

  /**
   * Get the session backend, lazily initializing if needed.
   */
  private async getBackend(): Promise<ISessionBackend> {
    if (!this._sessionBackend) {
      this._sessionBackend = getSessionBackendSync();
      if (!this._sessionBackend) {
        this._sessionBackend = await createSessionBackend('pty');
      }
    }
    return this._sessionBackend;
  }

  /**
   * Get the session backend synchronously (may return null if not initialized).
   */
  private get sessionBackend(): ISessionBackend | null {
    if (!this._sessionBackend) {
      this._sessionBackend = getSessionBackendSync();
    }
    return this._sessionBackend;
  }

  public static getInstance(): ActivityMonitorService {
    if (!ActivityMonitorService.instance) {
      ActivityMonitorService.instance = new ActivityMonitorService();
    }
    return ActivityMonitorService.instance;
  }

  public startPolling(): void {
    if (this.intervalId) {
      this.logger.warn('Activity monitoring already running');
      return;
    }

    this.logger.info('Starting activity monitoring with 2-minute intervals (NEW ARCHITECTURE: workingStatus only)');
    
    // Run immediately first
    this.performActivityCheck();
    
    // Set up recurring polling
    this.intervalId = setInterval(() => {
      this.performActivityCheck();
    }, this.POLLING_INTERVAL);
  }

  public stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Activity monitoring stopped');
    }
  }

  private async performActivityCheck(): Promise<void> {
    try {
      // Add timeout protection for entire activity check
      await Promise.race([
        this.performActivityCheckInternal(),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Activity check timeout')), this.ACTIVITY_CHECK_TIMEOUT)
        )
      ]);
      
      // Perform periodic cleanup
      this.performPeriodicCleanup();
      
    } catch (error) {
      this.logger.error('Error during activity check', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * NEW ARCHITECTURE: Simplified activity checking
   *
   * This method now:
   * 1. Detects stale agents via AgentHeartbeatService (30-minute threshold)
   * 2. Checks terminal activity for working status (ONLY)
   * 3. Updates teamWorkingStatus.json (separate from teams.json)
   * 4. Removes ALL agentStatus logic (handled by AgentHeartbeatService)
   */
  private async performActivityCheckInternal(): Promise<void> {
    const now = new Date().toISOString();

    try {
      // Step 1: Detect stale agents and mark as potentialInactive
      const staleAgents = await this.agentHeartbeatService.detectStaleAgents(30);
      if (staleAgents.length > 0) {
        this.logger.info('Detected stale agents for potential inactivity', {
          staleAgents,
          thresholdMinutes: 30
        });
        // Note: AgentHeartbeatService will handle marking them as potentialInactive
      }

      // Step 2: Load current working status file
      const workingStatusData = await this.loadTeamWorkingStatusFile();
      let hasChanges = false;

      // Step 3: Check orchestrator working status
      const backend = await this.getBackend();
      const orchestratorRunning = await Promise.race([
        Promise.resolve(backend.sessionExists(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME)),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Orchestrator check timeout')), 1000)
        )
      ]).catch(() => false);

      if (orchestratorRunning) {
        const orchestratorOutput = await this.getTerminalOutput(AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME);
        const previousOutput = this.lastTerminalOutputs.get('orchestrator') || '';
        const outputChanged = orchestratorOutput !== previousOutput && orchestratorOutput.trim() !== '';
        const newWorkingStatus: WorkingStatus = outputChanged ? 'in_progress' : 'idle';

        if (workingStatusData.orchestrator.workingStatus !== newWorkingStatus) {
          workingStatusData.orchestrator.workingStatus = newWorkingStatus;
          workingStatusData.orchestrator.lastActivityCheck = now;
          workingStatusData.orchestrator.updatedAt = now;
          hasChanges = true;

          this.logger.info('Orchestrator working status updated', {
            sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
            newWorkingStatus,
            outputChanged
          });
        }

        this.lastTerminalOutputs.set('orchestrator', orchestratorOutput);
      } else {
        // Orchestrator not running, set to idle
        if (workingStatusData.orchestrator.workingStatus !== 'idle') {
          workingStatusData.orchestrator.workingStatus = 'idle';
          workingStatusData.orchestrator.lastActivityCheck = now;
          workingStatusData.orchestrator.updatedAt = now;
          hasChanges = true;
        }
      }

      // Step 4: Check team member working statuses
      const teams = await this.storageService.getTeams();

      for (const team of teams) {
        for (const member of team.members) {
          if (member.sessionName) {
            try {
              // Check if session exists
              const sessionExists = await Promise.race([
                Promise.resolve(backend.sessionExists(member.sessionName)),
                new Promise<boolean>((_, reject) =>
                  setTimeout(() => reject(new Error('Session check timeout')), 500)
                )
              ]).catch(() => false);

              if (!sessionExists) {
                // Session doesn't exist, set to idle
                const memberKey = member.sessionName;
                if (!workingStatusData.teamMembers[memberKey]) {
                  workingStatusData.teamMembers[memberKey] = {
                    sessionName: member.sessionName,
                    teamMemberId: member.id,
                    workingStatus: 'idle',
                    lastActivityCheck: now,
                    updatedAt: now
                  };
                  hasChanges = true;
                } else if (workingStatusData.teamMembers[memberKey].workingStatus !== 'idle') {
                  workingStatusData.teamMembers[memberKey].workingStatus = 'idle';
                  workingStatusData.teamMembers[memberKey].lastActivityCheck = now;
                  workingStatusData.teamMembers[memberKey].updatedAt = now;
                  hasChanges = true;
                }

                this.lastTerminalOutputs.delete(memberKey);
                continue;
              }

              // Get terminal output and check for activity
              const currentOutput = await this.getTerminalOutput(member.sessionName);
              const previousOutput = this.lastTerminalOutputs.get(member.sessionName) || '';
              const outputChanged = currentOutput !== previousOutput && currentOutput.trim() !== '';
              const newWorkingStatus: WorkingStatus = outputChanged ? 'in_progress' : 'idle';

              // Update working status if changed
              const memberKey = member.sessionName;
              if (!workingStatusData.teamMembers[memberKey]) {
                workingStatusData.teamMembers[memberKey] = {
                  sessionName: member.sessionName,
                  teamMemberId: member.id,
                  workingStatus: newWorkingStatus,
                  lastActivityCheck: now,
                  updatedAt: now
                };
                hasChanges = true;
              } else if (workingStatusData.teamMembers[memberKey].workingStatus !== newWorkingStatus) {
                workingStatusData.teamMembers[memberKey].workingStatus = newWorkingStatus;
                workingStatusData.teamMembers[memberKey].lastActivityCheck = now;
                workingStatusData.teamMembers[memberKey].updatedAt = now;
                hasChanges = true;

                this.logger.info('Team member working status updated', {
                  teamId: team.id,
                  memberId: member.id,
                  memberName: member.name,
                  sessionName: member.sessionName,
                  newWorkingStatus,
                  outputChanged
                });
              }

              this.lastTerminalOutputs.set(member.sessionName, currentOutput);

            } catch (error) {
              this.logger.error('Error checking member working status', {
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

      // Step 5: Save changes if any
      if (hasChanges) {
        workingStatusData.metadata.lastUpdated = now;
        await this.saveTeamWorkingStatusFile(workingStatusData);
        this.logger.debug('Updated teamWorkingStatus.json with activity changes');
      }

      // Perform periodic cleanup
      this.performPeriodicCleanup();

    } catch (error) {
      this.logger.error('Error during activity check', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Load teamWorkingStatus.json file with proper initialization
   */
  private async loadTeamWorkingStatusFile(): Promise<TeamWorkingStatusFile> {
    try {
      if (!existsSync(this.teamWorkingStatusFile)) {
        const defaultData = this.createDefaultTeamWorkingStatusFile();
        await this.saveTeamWorkingStatusFile(defaultData);
        this.logger.info('Created new teamWorkingStatus.json file');
        return defaultData;
      }

      const content = await readFile(this.teamWorkingStatusFile, 'utf-8');
      const data = JSON.parse(content) as TeamWorkingStatusFile;

      // Validate structure
      if (!data.orchestrator || !data.teamMembers || !data.metadata) {
        this.logger.warn('Invalid teamWorkingStatus.json structure, reinitializing');
        const defaultData = this.createDefaultTeamWorkingStatusFile();
        await this.saveTeamWorkingStatusFile(defaultData);
        return defaultData;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to load teamWorkingStatus.json, creating new file', {
        error: error instanceof Error ? error.message : String(error)
      });
      const defaultData = this.createDefaultTeamWorkingStatusFile();
      await this.saveTeamWorkingStatusFile(defaultData);
      return defaultData;
    }
  }

  /**
   * Save teamWorkingStatus.json file with atomic write
   */
  private async saveTeamWorkingStatusFile(data: TeamWorkingStatusFile): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    const tempFile = `${this.teamWorkingStatusFile}.tmp`;

    try {
      // Write to temp file first, then rename (atomic operation)
      await writeFile(tempFile, content, 'utf-8');
      await rename(tempFile, this.teamWorkingStatusFile);
    } catch (error) {
      // Clean up temp file if something went wrong
      try {
        await unlink(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * Create default teamWorkingStatus.json structure
   */
  private createDefaultTeamWorkingStatusFile(): TeamWorkingStatusFile {
    const now = new Date().toISOString();
    return {
      orchestrator: {
        sessionName: AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME,
        workingStatus: 'idle',
        lastActivityCheck: now,
        updatedAt: now
      },
      teamMembers: {},
      metadata: {
        lastUpdated: now,
        version: '1.0.0'
      }
    };
  }

  /**
   * Cleanup old terminal outputs and perform garbage collection
   */
  private performPeriodicCleanup(): void {
    const now = Date.now();

    // Clean up every 2 minutes
    if (now - this.lastCleanup > 2 * 60 * 1000) {
      // Limit the size of lastTerminalOutputs Map to prevent memory leaks
      if (this.lastTerminalOutputs.size > 50) {
        const entries = Array.from(this.lastTerminalOutputs.entries());
        this.lastTerminalOutputs.clear();

        // Keep only the most recent 25 entries
        const recentEntries = entries.slice(-25);
        for (const [key, value] of recentEntries) {
          this.lastTerminalOutputs.set(key, value);
        }
      }

      this.lastCleanup = now;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.logger.debug('Performed periodic cleanup with garbage collection', {
          mapSize: this.lastTerminalOutputs.size
        });
      } else {
        this.logger.debug('Performed periodic cleanup', {
          mapSize: this.lastTerminalOutputs.size
        });
      }
    }
  }

  /**
   * Get terminal output with size limits for activity detection
   */
  private async getTerminalOutput(sessionName: string): Promise<string> {
    try {
      const backend = await this.getBackend();
      const output = await Promise.race([
        Promise.resolve(backend.captureOutput(sessionName, 5)), // 5 lines only
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Capture timeout')), 500)
        )
      ]);

      // Limit output size to prevent memory issues
      return output.length > this.MAX_OUTPUT_SIZE
        ? output.substring(output.length - this.MAX_OUTPUT_SIZE)
        : output;
    } catch (error) {
      return '';
    }
  }

  public isRunning(): boolean {
    return this.intervalId !== null;
  }

  public getPollingInterval(): number {
    return this.POLLING_INTERVAL;
  }

  /**
   * Get current team working status data
   * Useful for external services that need to check working statuses
   */
  public async getTeamWorkingStatus(): Promise<TeamWorkingStatusFile> {
    return await this.loadTeamWorkingStatusFile();
  }

  /**
   * Get working status for a specific session
   */
  public async getWorkingStatusForSession(sessionName: string): Promise<WorkingStatus | null> {
    try {
      const data = await this.loadTeamWorkingStatusFile();

      if (sessionName === AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME) {
        return data.orchestrator.workingStatus;
      }

      return data.teamMembers[sessionName]?.workingStatus || null;
    } catch (error) {
      this.logger.error('Failed to get working status for session', {
        sessionName,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
}