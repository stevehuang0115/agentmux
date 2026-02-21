/**
 * Process Manager
 *
 * Manages the lifecycle of the Crewly backend server process.
 * Provides start/stop controls used by the system tray and IPC handlers.
 *
 * @module desktop/main/process-manager
 */

import { spawn, type ChildProcess } from 'child_process';

/**
 * Manages starting and stopping the `crewly start` process.
 */
export class ProcessManager {
  private process: ChildProcess | null = null;

  /**
   * Returns whether the Crewly backend process is currently running.
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Starts the Crewly backend by spawning `crewly start --no-browser`.
   *
   * If already running, this is a no-op.
   */
  start(): void {
    if (this.isRunning()) {
      return;
    }

    this.process = spawn('crewly', ['start', '--no-browser'], {
      stdio: 'pipe',
      shell: true,
      detached: false,
    });

    this.process.on('exit', () => {
      this.process = null;
    });
  }

  /**
   * Stops the Crewly backend process by sending SIGTERM.
   *
   * Falls back to SIGKILL after 5 seconds if the process doesn't exit.
   */
  stop(): void {
    if (!this.process || this.process.killed) {
      return;
    }

    this.process.kill('SIGTERM');

    const proc = this.process;
    setTimeout(() => {
      if (proc && !proc.killed) {
        proc.kill('SIGKILL');
      }
    }, 5000);

    this.process = null;
  }
}
