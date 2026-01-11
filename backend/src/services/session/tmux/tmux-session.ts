/**
 * TmuxSession Adapter Module
 *
 * Implements ISession interface using tmux as the underlying session manager.
 * Since tmux doesn't have native event-based output, this adapter polls for changes.
 *
 * NOTE: This backend is DORMANT and not actively used. The PTY backend is preferred.
 * To re-enable, see session-backend.factory.ts.
 *
 * @module tmux-session
 */

import type { ISession } from '../session-backend.interface.js';
// Import from original location - will be moved when tmux is fully deprecated
import type { TmuxCommandService } from '../../agent/tmux-command.service.js';
import { LoggerService, ComponentLogger } from '../../core/logger.service.js';

/** Polling interval for detecting output changes (milliseconds) */
const POLLING_INTERVAL_MS = 1000;

/** Default number of lines to capture for polling */
const CAPTURE_LINES = 50;

/**
 * TmuxSession implements the ISession interface using tmux.
 *
 * Since tmux doesn't provide event-based output streaming like node-pty,
 * this adapter uses polling to detect changes and notify listeners.
 *
 * Key differences from PtySession:
 * - Output is polled, not streamed (higher latency)
 * - PID returns -1 (tmux doesn't expose underlying process PID)
 * - Resize is not implemented (would require tmux resize-pane)
 *
 * @example
 * ```typescript
 * const session = new TmuxSession('my-session', '/home/user', tmuxCommand);
 *
 * session.onData((data) => {
 *   console.log('New output:', data);
 * });
 *
 * session.write('echo hello\n');
 * ```
 */
export class TmuxSession implements ISession {
	/** Data output callbacks */
	private dataCallbacks: ((data: string) => void)[] = [];

	/** Exit event callbacks */
	private exitCallbacks: ((code: number) => void)[] = [];

	/** Polling interval handle */
	private pollingInterval: ReturnType<typeof setInterval> | null = null;

	/** Last captured output for diff detection */
	private lastOutput = '';

	/** Whether the session has been killed */
	private isKilled = false;

	/** Logger instance */
	private logger: ComponentLogger;

	/**
	 * Create a new TmuxSession adapter.
	 *
	 * @param name - Unique session name
	 * @param cwd - Working directory of the session
	 * @param tmuxCommand - TmuxCommandService instance for tmux operations
	 */
	constructor(
		public readonly name: string,
		public readonly cwd: string,
		private readonly tmuxCommand: TmuxCommandService
	) {
		this.logger = LoggerService.getInstance().createComponentLogger('TmuxSession');
		this.startPolling();
	}

	/**
	 * Get the process ID.
	 *
	 * NOTE: tmux doesn't expose the underlying process PID directly,
	 * so this returns -1.
	 *
	 * @returns -1 (PID not available for tmux sessions)
	 */
	get pid(): number {
		return -1;
	}

	/**
	 * Subscribe to data output from the session.
	 *
	 * NOTE: Since tmux doesn't have native events, this uses polling.
	 * Expect ~1 second latency between output and callback.
	 *
	 * @param callback - Function called when new data is detected
	 * @returns Unsubscribe function
	 */
	onData(callback: (data: string) => void): () => void {
		this.dataCallbacks.push(callback);
		return () => {
			const index = this.dataCallbacks.indexOf(callback);
			if (index > -1) {
				this.dataCallbacks.splice(index, 1);
			}
		};
	}

	/**
	 * Subscribe to the session exit event.
	 *
	 * @param callback - Function called when session exits
	 * @returns Unsubscribe function
	 */
	onExit(callback: (code: number) => void): () => void {
		this.exitCallbacks.push(callback);
		return () => {
			const index = this.exitCallbacks.indexOf(callback);
			if (index > -1) {
				this.exitCallbacks.splice(index, 1);
			}
		};
	}

	/**
	 * Write data to the session.
	 *
	 * @param data - Data to write to the tmux session
	 */
	write(data: string): void {
		if (this.isKilled) {
			this.logger.warn('Attempted to write to killed session', { name: this.name });
			return;
		}

		// Split data into message and potential Enter key
		// Handle \n or \r as Enter key
		if (data.endsWith('\n') || data.endsWith('\r')) {
			const message = data.slice(0, -1);
			this.tmuxCommand.sendMessage(this.name, message).catch((error) => {
				this.logger.error('Failed to send message', { name: this.name, error });
			});
			this.tmuxCommand.sendEnter(this.name).catch((error) => {
				this.logger.error('Failed to send Enter', { name: this.name, error });
			});
		} else {
			this.tmuxCommand.sendMessage(this.name, data).catch((error) => {
				this.logger.error('Failed to send message', { name: this.name, error });
			});
		}
	}

	/**
	 * Resize the terminal dimensions.
	 *
	 * NOTE: Not implemented for tmux backend. Would require tmux resize-pane.
	 *
	 * @param _cols - Number of columns (unused)
	 * @param _rows - Number of rows (unused)
	 */
	resize(_cols: number, _rows: number): void {
		this.logger.debug('resize() not implemented for tmux backend', { name: this.name });
		// tmux resize would require different approach
		// Not implemented for dormant backend
	}

	/**
	 * Kill the session and stop polling.
	 */
	kill(): void {
		if (this.isKilled) {
			return;
		}

		this.isKilled = true;
		this.stopPolling();

		this.tmuxCommand.killSession(this.name).catch((error) => {
			this.logger.error('Failed to kill tmux session', { name: this.name, error });
		});

		// Notify exit listeners
		this.exitCallbacks.forEach((cb) => cb(0));
	}

	/**
	 * Start polling for output changes.
	 */
	private startPolling(): void {
		this.pollingInterval = setInterval(async () => {
			try {
				const output = await this.tmuxCommand.capturePane(this.name, CAPTURE_LINES);

				if (output !== this.lastOutput) {
					const newContent = this.getNewContent(output);
					if (newContent) {
						this.dataCallbacks.forEach((cb) => cb(newContent));
					}
					this.lastOutput = output;
				}
			} catch (error) {
				// Session might be gone
				this.logger.debug('Polling failed, session may be terminated', {
					name: this.name,
					error,
				});
				this.stopPolling();
				this.exitCallbacks.forEach((cb) => cb(1));
			}
		}, POLLING_INTERVAL_MS);
	}

	/**
	 * Stop polling for output changes.
	 */
	private stopPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
	}

	/**
	 * Get new content by comparing with last output.
	 *
	 * @param current - Current captured output
	 * @returns New content that wasn't in last output
	 */
	private getNewContent(current: string): string {
		// Simple diff - find new content
		if (current.startsWith(this.lastOutput)) {
			return current.slice(this.lastOutput.length);
		}
		return current;
	}
}
