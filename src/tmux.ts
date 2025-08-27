import { spawn, ChildProcess } from 'child_process';

export interface TmuxSession {
  name: string;
  windows: TmuxWindow[];
}

export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
}

export interface TmuxMessage {
  session: string;
  window: number | string;
  pane?: number;
  message: string;
}

export class TmuxManager {
  private processes: Map<string, ChildProcess> = new Map();

  async listSessions(): Promise<TmuxSession[]> {
    return new Promise((resolve, reject) => {
      const cmd = spawn('tmux', ['list-sessions', '-F', '#{session_name}']);
      let output = '';

      cmd.stdout.on('data', (data) => {
        output += data.toString();
      });

      cmd.on('close', async (code) => {
        if (code !== 0) {
          resolve([]);
          return;
        }

        const sessionNames = output.trim().split('\n').filter(name => name);
        const sessions: TmuxSession[] = [];

        for (const sessionName of sessionNames) {
          try {
            const windows = await this.listWindows(sessionName);
            sessions.push({ name: sessionName, windows });
          } catch (error) {
            console.warn(`Failed to get windows for session ${sessionName}:`, error);
          }
        }

        resolve(sessions);
      });

      cmd.on('error', reject);
    });
  }

  async listWindows(sessionName: string): Promise<TmuxWindow[]> {
    return new Promise((resolve, reject) => {
      const cmd = spawn('tmux', ['list-windows', '-t', sessionName, '-F', '#{window_index}:#{window_name}:#{window_active}']);
      let output = '';

      cmd.stdout.on('data', (data) => {
        output += data.toString();
      });

      cmd.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to list windows for session ${sessionName}`));
          return;
        }

        const windows = output.trim().split('\n')
          .filter(line => line)
          .map(line => {
            const [index, name, active] = line.split(':');
            return {
              index: parseInt(index),
              name: name || `window-${index}`,
              active: active === '1'
            };
          });

        resolve(windows);
      });

      cmd.on('error', reject);
    });
  }

  async sendMessage(target: string, message: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Send the message
      const sendCmd = spawn('tmux', ['send-keys', '-t', target, message]);
      
      sendCmd.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to send message to ${target}`));
          return;
        }

        // Send Enter key after a brief delay
        setTimeout(() => {
          const enterCmd = spawn('tmux', ['send-keys', '-t', target, 'Enter']);
          enterCmd.on('close', (enterCode) => {
            resolve(enterCode === 0);
          });
          enterCmd.on('error', reject);
        }, 500);
      });

      sendCmd.on('error', reject);
    });
  }

  async capturePane(target: string, lines: number = 50): Promise<string> {
    return new Promise((resolve, reject) => {
      const cmd = spawn('tmux', ['capture-pane', '-t', target, '-p', '-S', `-${lines}`]);
      let output = '';

      cmd.stdout.on('data', (data) => {
        output += data.toString();
      });

      cmd.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to capture pane ${target}`));
          return;
        }
        resolve(output);
      });

      cmd.on('error', reject);
    });
  }

  async createWindow(sessionName: string, windowName: string, workingDir?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const args = ['new-window', '-t', sessionName, '-n', windowName];
      if (workingDir) {
        args.push('-c', workingDir);
      }

      const cmd = spawn('tmux', args);
      
      cmd.on('close', (code) => {
        resolve(code === 0);
      });

      cmd.on('error', reject);
    });
  }

  async killWindow(sessionName: string, windowIndex: number | string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const cmd = spawn('tmux', ['kill-window', '-t', `${sessionName}:${windowIndex}`]);
      
      cmd.on('close', (code) => {
        resolve(code === 0);
      });

      cmd.on('error', reject);
    });
  }
}