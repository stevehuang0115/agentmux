import { spawn } from 'child_process';
import { RuntimeAgentService } from './runtime-agent.service.abstract.js';
import { SessionCommandHelper } from '../session/index.js';
import { RUNTIME_TYPES, type RuntimeType } from '../../constants.js';

/**
 * Claude Code specific runtime service implementation.
 * Handles Claude Code CLI initialization, detection, and interaction patterns.
 */
export class ClaudeRuntimeService extends RuntimeAgentService {
	constructor(sessionHelper: SessionCommandHelper, projectRoot: string) {
		super(sessionHelper, projectRoot);
	}

	protected getRuntimeType(): RuntimeType {
		return RUNTIME_TYPES.CLAUDE_CODE;
	}

	/**
	 * Claude Code specific detection using slash command
	 */
	protected async detectRuntimeSpecific(sessionName: string): Promise<boolean> {
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// First to clear the current command
		await this.sessionHelper.clearCurrentCommandLine(sessionName);

		// Capture the output before checking
		const beforeOutput = this.sessionHelper.capturePane(sessionName, 20);
		// Send the '/' key to detect changes
		await this.sessionHelper.sendKey(sessionName, '/');
		await new Promise((resolve) => setTimeout(resolve, 2000));
		// Capture the output after sending '/'
		const afterOutput = this.sessionHelper.capturePane(sessionName, 20);

		// Clear the '/' command again
		await this.sessionHelper.clearCurrentCommandLine(sessionName);

		const hasOutputChange = afterOutput.length - beforeOutput.length > 5;

		this.logger.debug('Claude detection completed', {
			sessionName,
			hasOutputChange,
			beforeLength: beforeOutput.length,
			afterLength: afterOutput.length,
		});
		return hasOutputChange;
	}

	/**
	 * Claude Code specific ready patterns
	 */
	protected getRuntimeReadyPatterns(): string[] {
		return [
			'Welcome to Claude Code!',
			'claude-code>',
			'Ready to assist',
			'How can I help',
			'/help for help',
			'cwd:',
			'bypass permissions on',
			'✻ Welcome to Claude',
		];
	}

	/**
	 * Claude Code specific error patterns
	 */
	protected getRuntimeErrorPatterns(): string[] {
		const commonErrors = ['Permission denied', 'No such file or directory'];
		return [...commonErrors, 'command not found: claude'];
	}

	/**
	 * Check if Claude Code CLI is installed on the system
	 */
	async checkClaudeInstallation(): Promise<{
		installed: boolean;
		version?: string;
		message: string;
	}> {
		try {
			return new Promise((resolve) => {
				const whichProcess = spawn('which', ['claude']);
				let stdout = '';
				let stderr = '';

				whichProcess.stdout.on('data', (data) => {
					stdout += data.toString();
				});

				whichProcess.stderr.on('data', (data) => {
					stderr += data.toString();
				});

				whichProcess.on('close', (code) => {
					if (code === 0 && stdout.trim()) {
						// Claude CLI found, try to get version
						const versionProcess = spawn('claude', ['--version']);
						let versionOutput = '';

						versionProcess.stdout.on('data', (data) => {
							versionOutput += data.toString();
						});

						versionProcess.on('close', (versionCode) => {
							resolve({
								installed: true,
								version: versionCode === 0 ? versionOutput.trim() : 'unknown',
								message: 'Claude Code CLI is available',
							});
						});

						// Timeout for version check
						setTimeout(() => {
							versionProcess.kill();
							resolve({
								installed: true,
								message: 'Claude Code CLI found but version check timed out',
							});
						}, 5000);
					} else {
						resolve({
							installed: false,
							message:
								'Claude Code CLI not found. Please install Claude Code to enable agent functionality.',
						});
					}
				});

				// Timeout for which command
				setTimeout(() => {
					whichProcess.kill();
					resolve({
						installed: false,
						message: 'Claude Code installation check timed out',
					});
				}, 5000);
			});
		} catch (error) {
			return {
				installed: false,
				message: `Failed to check Claude installation: ${
					error instanceof Error ? error.message : 'Unknown error'
				}`,
			};
		}
	}

	/**
	 * Initialize Claude in an existing session (legacy compatibility)
	 */
	async initializeClaudeInSession(sessionName: string): Promise<{
		success: boolean;
		message?: string;
		error?: string;
	}> {
		try {
			this.logger.info('Initializing Claude Code in session', { sessionName });

			// Start Claude Code by sending Enter
			await this.sessionHelper.sendEnter(sessionName);

			// Wait for Claude to be ready
			const isReady = await this.waitForRuntimeReady(sessionName, 45000);

			if (isReady) {
				this.logger.info('Claude Code initialized successfully', { sessionName });
				return {
					success: true,
					message: 'Claude Code initialized and ready',
				};
			} else {
				return {
					success: false,
					error: 'Claude Code failed to initialize within timeout',
				};
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.logger.error('Failed to initialize Claude Code in session', {
				sessionName,
				error: errorMessage,
			});

			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Enhanced Claude detection using slash command with detailed analysis
	 * This is the legacy method that provides more detailed detection than the base detectRuntimeSpecific
	 */
	async detectClaudeWithSlashCommand(
		sessionName: string,
		forceRefresh: boolean = false
	): Promise<boolean> {
		// For now, delegate to the base detectRuntimeWithCommand method
		// which calls our detectRuntimeSpecific implementation
		return await this.detectRuntimeWithCommand(sessionName, forceRefresh);
	}

	/**
	 * Execute Claude initialization script (legacy compatibility)
	 */
	async executeClaudeInitScript(sessionName: string, targetPath?: string): Promise<void> {
		return await this.executeRuntimeInitScript(sessionName, targetPath);
	}
}
