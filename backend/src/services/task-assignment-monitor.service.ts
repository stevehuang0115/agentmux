import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { LoggerService, ComponentLogger } from './logger.service.js';
import type { TmuxService } from './tmux.service.js';

export interface TaskMonitoringConfig {
  monitoringId: string;
  taskPath: string;
  originalPath: string;
  targetPath: string;
  orchestratorSession: string;
  assignmentPrompt: string;
  retryCount: number;
  timeoutSeconds: number;
  projectPath: string;
  taskId: string;
}

interface MonitoringJob {
  config: TaskMonitoringConfig;
  startTime: number;
  currentAttempt: number;
  timeoutHandle?: NodeJS.Timeout;
  pollHandle?: NodeJS.Timeout;
  lastAssignedAgent?: string;
  status: 'monitoring' | 'completed' | 'failed' | 'timeout';
}

export class TaskAssignmentMonitorService extends EventEmitter {
  private activeMonitors: Map<string, MonitoringJob> = new Map();
  private logger: ComponentLogger;
  private tmuxService: TmuxService;
  
  // Polling configuration
  private readonly POLL_INTERVAL = 2000; // Check every 2 seconds
  private readonly MAX_CONCURRENT_JOBS = 10; // Prevent resource exhaustion

  constructor(tmuxService: TmuxService) {
    super();
    this.tmuxService = tmuxService;
    this.logger = LoggerService.getInstance().createComponentLogger('TaskAssignmentMonitor');
    
    this.logger.info('TaskAssignmentMonitor service initialized');
  }

  /**
   * Start monitoring a task assignment
   */
  async startMonitoring(config: TaskMonitoringConfig): Promise<{ 
    success: boolean; 
    monitoringId: string; 
    message?: string; 
    error?: string; 
  }> {
    try {
      // Check if we're at capacity
      if (this.activeMonitors.size >= this.MAX_CONCURRENT_JOBS) {
        const oldestJob = this.findOldestJob();
        if (oldestJob) {
          this.logger.warn('Monitor at capacity, stopping oldest job', { oldestJobId: oldestJob.config.monitoringId });
          await this.stopMonitoring(oldestJob.config.monitoringId, 'capacity_exceeded');
        }
      }

      // Create monitoring job
      const job: MonitoringJob = {
        config,
        startTime: Date.now(),
        currentAttempt: 1,
        status: 'monitoring'
      };

      // Start monitoring process
      await this.startMonitoringJob(job);
      
      this.activeMonitors.set(config.monitoringId, job);

      this.logger.info('Started task assignment monitoring', { 
        monitoringId: config.monitoringId,
        taskId: config.taskId,
        retryCount: config.retryCount,
        timeoutSeconds: config.timeoutSeconds
      });

      return {
        success: true,
        monitoringId: config.monitoringId,
        message: `Monitoring started for task ${config.taskId}`
      };

    } catch (error) {
      this.logger.error('Failed to start monitoring', { 
        error: error instanceof Error ? error.message : String(error),
        monitoringId: config.monitoringId 
      });

      return {
        success: false,
        monitoringId: config.monitoringId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Stop monitoring a specific task
   */
  async stopMonitoring(monitoringId: string, reason: string = 'manual_stop'): Promise<boolean> {
    const job = this.activeMonitors.get(monitoringId);
    if (!job) {
      return false;
    }

    // Clear timers
    if (job.timeoutHandle) {
      clearTimeout(job.timeoutHandle);
    }
    if (job.pollHandle) {
      clearTimeout(job.pollHandle);
    }

    // Update status
    job.status = reason === 'completed' ? 'completed' : 'failed';

    // Remove from active monitors
    this.activeMonitors.delete(monitoringId);

    this.logger.info('Stopped task monitoring', { monitoringId, reason });

    // Emit event
    this.emit('monitoring_stopped', { monitoringId, reason, job });

    return true;
  }

  /**
   * Get status of all active monitors
   */
  getActiveMonitors(): Array<{
    monitoringId: string;
    taskId: string;
    status: string;
    currentAttempt: number;
    elapsedSeconds: number;
    lastAssignedAgent?: string;
  }> {
    const now = Date.now();
    return Array.from(this.activeMonitors.values()).map(job => ({
      monitoringId: job.config.monitoringId,
      taskId: job.config.taskId,
      status: job.status,
      currentAttempt: job.currentAttempt,
      elapsedSeconds: Math.floor((now - job.startTime) / 1000),
      lastAssignedAgent: job.lastAssignedAgent
    }));
  }

  /**
   * Start the actual monitoring job with polling and timeout
   */
  private async startMonitoringJob(job: MonitoringJob): Promise<void> {
    const { config } = job;

    // Set up timeout for this attempt
    job.timeoutHandle = setTimeout(async () => {
      await this.handleTimeout(job);
    }, config.timeoutSeconds * 1000);

    // Start polling for file changes
    this.startPolling(job);

    this.logger.debug('Started monitoring job', { 
      monitoringId: config.monitoringId,
      attempt: job.currentAttempt,
      timeout: config.timeoutSeconds
    });
  }

  /**
   * Start polling for file system changes
   */
  private startPolling(job: MonitoringJob): void {
    const poll = async () => {
      try {
        // Check if task file has moved from open/ to in_progress/
        const taskAccepted = !existsSync(job.config.originalPath) && existsSync(job.config.targetPath);

        if (taskAccepted) {
          this.logger.info('Task accepted! File moved to in_progress', { 
            monitoringId: job.config.monitoringId,
            taskId: job.config.taskId,
            attempt: job.currentAttempt
          });

          await this.stopMonitoring(job.config.monitoringId, 'completed');
          
          // Emit success event
          this.emit('task_accepted', {
            monitoringId: job.config.monitoringId,
            taskId: job.config.taskId,
            attempt: job.currentAttempt,
            elapsedSeconds: Math.floor((Date.now() - job.startTime) / 1000)
          });

          return; // Stop polling
        }

        // Continue polling if not completed or failed
        if (job.status === 'monitoring') {
          job.pollHandle = setTimeout(poll, this.POLL_INTERVAL);
        }

      } catch (error) {
        this.logger.error('Error during polling', { 
          error: error instanceof Error ? error.message : String(error),
          monitoringId: job.config.monitoringId 
        });

        // Continue polling unless there's a critical error
        if (job.status === 'monitoring') {
          job.pollHandle = setTimeout(poll, this.POLL_INTERVAL);
        }
      }
    };

    // Start initial poll
    poll();
  }

  /**
   * Handle timeout - send escape and retry
   */
  private async handleTimeout(job: MonitoringJob): Promise<void> {
    const { config } = job;

    this.logger.warn('Task assignment timeout', { 
      monitoringId: config.monitoringId,
      taskId: config.taskId,
      attempt: job.currentAttempt,
      timeoutSeconds: config.timeoutSeconds
    });

    // Clear polling
    if (job.pollHandle) {
      clearTimeout(job.pollHandle);
    }

    // Try to find and interrupt the target agent
    await this.sendEscapeToTargetAgent(job);

    // Check if we should retry
    if (job.currentAttempt < config.retryCount) {
      job.currentAttempt++;
      
      this.logger.info('Retrying task assignment', { 
        monitoringId: config.monitoringId,
        taskId: config.taskId,
        attempt: job.currentAttempt,
        maxAttempts: config.retryCount
      });

      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Resend assignment prompt to orchestrator
      try {
        await this.tmuxService.sendMessage(config.orchestratorSession, config.assignmentPrompt);
        
        // Restart monitoring for this retry
        await this.startMonitoringJob(job);
        
        // Emit retry event
        this.emit('task_retry', {
          monitoringId: config.monitoringId,
          taskId: config.taskId,
          attempt: job.currentAttempt,
          maxAttempts: config.retryCount
        });

      } catch (error) {
        this.logger.error('Failed to retry task assignment', { 
          error: error instanceof Error ? error.message : String(error),
          monitoringId: config.monitoringId 
        });
        
        await this.stopMonitoring(config.monitoringId, 'retry_failed');
      }
    } else {
      // Max retries reached
      this.logger.error('Task assignment failed - max retries exceeded', { 
        monitoringId: config.monitoringId,
        taskId: config.taskId,
        maxAttempts: config.retryCount
      });

      await this.stopMonitoring(config.monitoringId, 'max_retries_exceeded');

      // Emit failure event
      this.emit('task_failed', {
        monitoringId: config.monitoringId,
        taskId: config.taskId,
        attempts: job.currentAttempt,
        reason: 'max_retries_exceeded'
      });
    }
  }

  /**
   * Send escape key to target agent to cancel hanging prompts
   */
  private async sendEscapeToTargetAgent(job: MonitoringJob): Promise<void> {
    try {
      // Get list of all team sessions (excluding orchestrator)
      const sessions = await this.tmuxService.listSessions();
      const teamSessions = sessions.filter(s => 
        !s.sessionName.includes('orc') && 
        !s.sessionName.includes('orchestrator') &&
        s.sessionName.includes('team')
      );

      if (teamSessions.length === 0) {
        this.logger.warn('No team sessions found to send escape key', { 
          monitoringId: job.config.monitoringId 
        });
        return;
      }

      // Send escape to all team sessions (we don't know which one the orchestrator assigned)
      const escapePromises = teamSessions.map(async (session) => {
        try {
          this.logger.debug('Sending escape key to agent session', { 
            sessionName: session.sessionName,
            monitoringId: job.config.monitoringId 
          });
          
          await this.tmuxService.sendKey(session.sessionName, 'Escape');
          
          // Also send Ctrl+C as backup
          await new Promise(resolve => setTimeout(resolve, 500));
          await this.tmuxService.sendKey(session.sessionName, 'C-c');
          
        } catch (error) {
          this.logger.warn('Failed to send escape to session', { 
            sessionName: session.sessionName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      await Promise.allSettled(escapePromises);

      this.logger.info('Escape keys sent to team sessions', { 
        monitoringId: job.config.monitoringId,
        sessionCount: teamSessions.length
      });

    } catch (error) {
      this.logger.error('Failed to send escape keys', { 
        error: error instanceof Error ? error.message : String(error),
        monitoringId: job.config.monitoringId 
      });
    }
  }

  /**
   * Find the oldest monitoring job for cleanup
   */
  private findOldestJob(): MonitoringJob | null {
    let oldestJob: MonitoringJob | null = null;
    let oldestTime = Date.now();

    for (const job of this.activeMonitors.values()) {
      if (job.startTime < oldestTime) {
        oldestTime = job.startTime;
        oldestJob = job;
      }
    }

    return oldestJob;
  }

  /**
   * Cleanup and destroy service
   */
  async destroy(): Promise<void> {
    const activeIds = Array.from(this.activeMonitors.keys());
    
    // Stop all active monitors
    for (const monitoringId of activeIds) {
      await this.stopMonitoring(monitoringId, 'service_shutdown');
    }

    this.logger.info('TaskAssignmentMonitor service destroyed', { 
      stoppedJobs: activeIds.length 
    });
  }
}