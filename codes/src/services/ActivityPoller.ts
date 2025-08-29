import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { FileStorage, ActivityEntry, Team, Role } from './FileStorage';

export interface PaneStatus {
  sessionName: string;
  windowIndex: number;
  paneIndex: number;
  byteCount: number;
  lastActive: Date;
  isActive: boolean;
}

export class ActivityPoller extends EventEmitter {
  private interval: NodeJS.Timeout | null = null;
  private storage: FileStorage;
  private lastByteCounts = new Map<string, number>();
  private isPolling = false;
  private pollInterval = 30000; // 30 seconds

  constructor(storage: FileStorage) {
    super();
    this.storage = storage;
  }

  start(): void {
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
      } catch (error) {
        console.error('Activity polling error:', error);
        this.emit('error', error);
      }
    }, this.pollInterval);

    this.emit('started');
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.isPolling = false;
    console.log('ActivityPoller stopped');
    this.emit('stopped');
  }

  isRunning(): boolean {
    return this.isPolling && this.interval !== null;
  }

  setPollInterval(ms: number): void {
    this.pollInterval = ms;
    if (this.isRunning()) {
      this.stop();
      this.start();
    }
  }

  private async checkAllPanes(): Promise<void> {
    try {
      // Get all active teams with tmux sessions
      const teams = await this.storage.getTeams();
      const activeTeams = teams.filter(team => 
        team.status === 'active' && team.tmuxSessionName
      );

      for (const team of activeTeams) {
        await this.checkTeamActivity(team);
      }
    } catch (error) {
      console.error('Error checking all panes:', error);
    }
  }

  private async checkTeamActivity(team: Team): Promise<void> {
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

      // Check each window/pane defined in team roles
      for (let i = 0; i < team.roles.length; i++) {
        const role = team.roles[i];
        // Use role index as window index for now
        await this.checkPaneActivity(
          team.tmuxSessionName,
          i,
          0, // Default to pane 0
          team.id,
          team.assignedProjectId
        );
      }
    } catch (error) {
      console.error(`Error checking activity for team ${team.name}:`, error);
    }
  }

  private async checkPaneActivity(
    sessionName: string,
    windowIndex: number,
    paneIndex: number,
    teamId: string,
    projectId?: string
  ): Promise<void> {
    const paneKey = `${sessionName}:${windowIndex}.${paneIndex}`;
    
    try {
      const byteCount = await this.getPaneByteCount(sessionName, windowIndex, paneIndex);
      const lastCount = this.lastByteCounts.get(paneKey) || 0;
      const isActive = byteCount > lastCount;

      // Update byte count
      this.lastByteCounts.set(paneKey, byteCount);

      // Record activity if status changed
      const activityEntry: ActivityEntry = {
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

    } catch (error) {
      console.error(`Error checking pane ${paneKey}:`, error);
    }
  }

  private async getPaneByteCount(
    sessionName: string, 
    windowIndex: number, 
    paneIndex: number
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const target = `${sessionName}:${windowIndex}.${paneIndex}`;
      
      // Use tmux display-message to get pane info including byte count
      const cmd = spawn('tmux', [
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
        } catch (error) {
          reject(error);
        }
      });

      cmd.on('error', reject);
    });
  }

  private async capturePaneContent(
    sessionName: string,
    windowIndex: number,
    paneIndex: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const target = `${sessionName}:${windowIndex}.${paneIndex}`;
      
      const cmd = spawn('tmux', [
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

  private async getSessionInfo(sessionName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const cmd = spawn('tmux', [
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
  async getCurrentStatus(): Promise<PaneStatus[]> {
    const teams = await this.storage.getTeams();
    const activeTeams = teams.filter(team => 
      team.status === 'active' && team.tmuxSessionName
    );

    const statuses: PaneStatus[] = [];

    for (const team of activeTeams) {
      if (!team.tmuxSessionName) continue;

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

  cleanup(): void {
    this.stop();
    this.lastByteCounts.clear();
    this.removeAllListeners();
  }
}