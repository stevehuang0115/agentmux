import { StorageService } from './storage.service.js';
import { TmuxService } from './tmux.service.js';
import { LoggerService, ComponentLogger } from './logger.service.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export class ActivityMonitorService {
  private static instance: ActivityMonitorService;
  private logger: ComponentLogger;
  private storageService: StorageService;
  private tmuxService: TmuxService;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL = 30000; // 30 seconds
  private running: boolean = false;
  private lastTerminalOutputs: Map<string, string> = new Map();
  private readonly MAX_CACHED_OUTPUTS = 10; // Limit cached terminal outputs
  private readonly MAX_OUTPUT_SIZE = 1024; // 1KB max per output
  private readonly ACTIVITY_CHECK_TIMEOUT = 2000; // 2 second timeout per check
  private lastCleanup: number = Date.now();

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('ActivityMonitor');
    this.storageService = new StorageService();
    this.tmuxService = new TmuxService();
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

    this.logger.info('Starting activity monitoring with 30-second intervals');
    
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

  private async performActivityCheckInternal(): Promise<void> {
    const now = new Date().toISOString();
    
    // Check orchestrator status with timeout
    const orchestratorRunning = await Promise.race([
      this.tmuxService.sessionExists('agentmux-orc'),
      new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('Orchestrator check timeout')), 1000)
      )
    ]).catch(() => false);
    
    // Update orchestrator status if needed
    const orchestratorStatus = await this.storageService.getOrchestratorStatus();
    if (orchestratorStatus) {
      const newOrchestratorStatus = orchestratorRunning ? 'active' : 'inactive';
      const newAgentStatus = orchestratorRunning ? 'active' : 'inactive';
      
      if (orchestratorStatus.agentStatus !== newOrchestratorStatus || 
          !orchestratorStatus.agentStatus || 
          orchestratorStatus.agentStatus !== newAgentStatus) {
        
        await this.updateOrchestratorWithStatuses(newOrchestratorStatus, newAgentStatus, 'idle');
        this.logger.info('Updated orchestrator status', {
          agentStatus: newAgentStatus,
          workingStatus: 'idle'
        });
      }
    }
    
    // Get all teams and process members with memory-efficient approach
    const teams = await this.storageService.getTeams();
    const teamsToUpdate: Set<string> = new Set();
    
    for (const team of teams) {
      for (const member of team.members) {
        // Only check members that are marked as active and have sessions
        if (member.agentStatus === 'active' && member.sessionName) {
          try {
            // Check if session still exists with timeout
            const sessionExists = await Promise.race([
              this.tmuxService.sessionExists(member.sessionName),
              new Promise<boolean>((_, reject) => 
                setTimeout(() => reject(new Error('Session check timeout')), 500)
              )
            ]).catch(() => false);
            
            if (!sessionExists) {
              // Session no longer exists, update to inactive
              member.agentStatus = 'inactive';
              member.workingStatus = 'idle';
              member.lastActivityCheck = now;
              member.updatedAt = now;
              teamsToUpdate.add(team.id);
              
              // Clean up stored output
              delete (member as any).lastTerminalOutput;
              
              this.logger.info('Member session inactive', {
                teamId: team.id,
                memberId: member.id,
                memberName: member.name,
                sessionName: member.sessionName
              });
              continue;
            }
            
            // Capture current terminal output with strict limits
            const currentOutput = await Promise.race([
              this.tmuxService.capturePane(member.sessionName, 10), // Reduced from 50 to 10 lines
              new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error('Capture timeout')), 800)
              )
            ]).catch(() => '');
            
            // Limit output size to prevent memory issues
            const truncatedOutput = currentOutput.length > this.MAX_OUTPUT_SIZE 
              ? currentOutput.substring(currentOutput.length - this.MAX_OUTPUT_SIZE)
              : currentOutput;
            
            // Get previous output from member's stored data
            const previousOutput = (member as any).lastTerminalOutput || '';
            
            // Check for activity (delta in terminal output)
            const activityDetected = truncatedOutput !== previousOutput && truncatedOutput.trim() !== '';
            
            // Update working status based on activity
            const newWorkingStatus = activityDetected ? 'in_progress' : 'idle';
            
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
                workingStatus: newWorkingStatus,
                activityDetected
              });
            }
            
            // Store current output for next comparison (with size limit)
            (member as any).lastTerminalOutput = truncatedOutput;
            
          } catch (error) {
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
    for (const teamId of teamsToUpdate) {
      const team = teams.find(t => t.id === teamId);
      if (team) {
        try {
          await this.storageService.saveTeam(team);
        } catch (error) {
          this.logger.error('Error saving updated team', {
            teamId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private performPeriodicCleanup(): void {
    const now = Date.now();
    
    // Clean up every 5 minutes
    if (now - this.lastCleanup > 5 * 60 * 1000) {
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
      this.logger.debug('Performed periodic cleanup', {
        mapSize: this.lastTerminalOutputs.size
      });
    }
  }

  private async updateOrchestratorWithStatuses(status: string, agentStatus: string, workingStatus: string): Promise<void> {
    try {
      const teamsFilePath = join(homedir(), '.agentmux', 'teams.json');
      const content = JSON.parse(await readFile(teamsFilePath, 'utf-8'));
      
      if (content.orchestrator) {
        // Remove legacy status field and use only the new fields
        delete content.orchestrator.status;
        content.orchestrator.agentStatus = agentStatus;
        content.orchestrator.workingStatus = workingStatus;
        content.orchestrator.updatedAt = new Date().toISOString();
      } else {
        content.orchestrator = {
          sessionId: 'agentmux-orc',
          agentStatus,
          workingStatus,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
      
      await writeFile(teamsFilePath, JSON.stringify(content, null, 2));
      
    } catch (error) {
      this.logger.error('Error updating orchestrator with statuses', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  public isRunning(): boolean {
    return this.intervalId !== null;
  }

  public getPollingInterval(): number {
    return this.POLLING_INTERVAL;
  }
}