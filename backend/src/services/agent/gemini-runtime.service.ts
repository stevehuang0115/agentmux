import * as os from 'os';
import * as path from 'path';
import { RuntimeAgentService } from './runtime-agent.service.abstract.js';
import { SessionCommandHelper } from '../session/index.js';
import { AGENTMUX_CONSTANTS, RUNTIME_TYPES, type RuntimeType } from '../../constants.js';

/**
 * Gemini CLI specific runtime service implementation.
 * Handles Gemini CLI initialization, detection, and interaction patterns.
 */
export class GeminiRuntimeService extends RuntimeAgentService {
	constructor(sessionHelper: SessionCommandHelper, projectRoot: string) {
		super(sessionHelper, projectRoot);
	}

	protected getRuntimeType(): RuntimeType {
		return RUNTIME_TYPES.GEMINI_CLI;
	}

	/**
	 * Gemini CLI specific detection using '/' command
	 */
	protected async detectRuntimeSpecific(sessionName: string): Promise<boolean> {
		// Send a simple command to test if Gemini CLI is running.
		// Do NOT use clearCurrentCommandLine — it sends Ctrl+C which triggers
		// /quit at an empty Gemini CLI prompt, and Ctrl+U which is ignored.
		// Do NOT send Escape — it defocuses the Ink TUI input box permanently.

		// Capture the output before checking
		const beforeOutput = this.sessionHelper.capturePane(sessionName, 20);
		// Send the '/' key to detect changes (triggers command palette)
		await this.sessionHelper.sendKey(sessionName, '/');
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Capture the output after sending '/'
		const afterOutput = this.sessionHelper.capturePane(sessionName, 20);

		// Clear the '/' by sending Backspace (safe in TUI — just deletes the character)
		await this.sessionHelper.sendKey(sessionName, 'Backspace');
		await new Promise((resolve) => setTimeout(resolve, 500));

		const hasOutputChange = afterOutput.length - beforeOutput.length > 5;

		this.logger.debug('Gemini detection completed', {
			sessionName,
			hasOutputChange,
			beforeLength: beforeOutput.length,
			afterLength: afterOutput.length,
		});

		return hasOutputChange;
	}

	/**
	 * Gemini CLI specific ready patterns
	 */
	protected getRuntimeReadyPatterns(): string[] {
		return [
			'Type your message',
			'shell mode',
			'gemini>',
			'Ready for input',
			'Model loaded',
			'context left)',
		];
	}

	/**
	 * Gemini CLI specific exit patterns for runtime exit detection
	 */
	protected getRuntimeExitPatterns(): RegExp[] {
		return [
			/Agent powering down/i,
			/Interaction Summary/,
		];
	}

	/**
	 * Gemini CLI specific error patterns
	 */
	protected getRuntimeErrorPatterns(): string[] {
		const commonErrors = ['Permission denied', 'No such file or directory'];
		return [
			...commonErrors,
			'command not found: gemini',
			'API key not found',
			'Authentication failed',
			'Invalid API key',
			'Rate limit exceeded',
		];
	}

	/**
	 * Post-initialization hook for Gemini CLI.
	 * Adds ~/.agentmux to the directory allowlist so the agent can read
	 * init prompt files and memory data stored outside the project directory.
	 *
	 * @param sessionName - PTY session name
	 */
	async postInitialize(sessionName: string): Promise<void> {
		const agentmuxHome = path.join(os.homedir(), AGENTMUX_CONSTANTS.PATHS.AGENTMUX_HOME);
		this.logger.info('Gemini CLI post-init: adding ~/.agentmux to directory allowlist', {
			sessionName,
			path: agentmuxHome,
		});

		// Wait for Gemini CLI's async auto-update check to complete before
		// sending commands. The auto-update notification (e.g., "Automatic
		// update failed") appears shortly after startup and can interfere
		// with slash command processing if we send /directory add too early.
		await new Promise((resolve) => setTimeout(resolve, 3000));

		const result = await this.addProjectToAllowlist(sessionName, agentmuxHome);
		if (!result.success) {
			this.logger.warn('Failed to add ~/.agentmux to Gemini CLI allowlist (non-fatal)', {
				sessionName,
				error: result.message,
			});
		}
	}

	/**
	 * Check if Gemini CLI is installed and configured
	 */
	async checkGeminiInstallation(): Promise<{
		isInstalled: boolean;
		version?: string;
		message: string;
	}> {
		try {
			// This would check if Gemini CLI is available
			// Could run: gemini --version or similar
			return {
				isInstalled: true,
				message: 'Gemini CLI is available',
			};
		} catch (error) {
			return {
				isInstalled: false,
				message: 'Gemini CLI not found or not configured',
			};
		}
	}

	/**
	 * Initialize Gemini in an existing session
	 */
	async initializeGeminiInSession(sessionName: string): Promise<{
		success: boolean;
		message: string;
	}> {
		try {
			await this.executeRuntimeInitScript(sessionName);
			return {
				success: true,
				message: 'Gemini CLI initialized successfully',
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : 'Failed to initialize Gemini CLI',
			};
		}
	}

	/**
	 * Add a single project path to Gemini CLI allowlist
	 * Uses '/directory add' command after Gemini CLI is running
	 */
	async addProjectToAllowlist(
		sessionName: string,
		projectPath: string
	): Promise<{
		success: boolean;
		message: string;
	}> {
		const maxAttempts = 3;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			try {
				this.logger.info('Adding project to Gemini CLI allowlist', {
					sessionName,
					projectPath,
					attempt,
				});

				// Send Enter to dismiss any pending notification (e.g., "Automatic
				// update failed") that may overlay the TUI input and swallow the
				// slash command. Enter on an empty `> ` prompt is a safe no-op.
				// Do NOT send Escape (defocuses TUI permanently) or Ctrl+C
				// (triggers /quit on empty prompt).
				await this.sessionHelper.sendEnter(sessionName);
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Capture output before sending to verify the command was processed
				const beforeOutput = this.sessionHelper.capturePane(sessionName, 20);

				// Send the directory add command
				const addCommand = `/directory add ${projectPath}`;
				await this.sessionHelper.sendMessage(sessionName, addCommand);

				// Wait for command to complete
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Verify: check if output changed (slash commands produce confirmation)
				const afterOutput = this.sessionHelper.capturePane(sessionName, 20);
				const outputChanged = beforeOutput !== afterOutput;
				const hasConfirmation = /added|directory|✓|success/i.test(afterOutput);

				if (outputChanged || hasConfirmation) {
					this.logger.info('Project added to Gemini CLI allowlist (verified)', {
						sessionName,
						projectPath,
						attempt,
						outputChanged,
						hasConfirmation,
					});
					return {
						success: true,
						message: `Project path ${projectPath} added to Gemini CLI allowlist`,
					};
				}

				this.logger.warn('Directory add command may not have been processed, retrying', {
					sessionName,
					projectPath,
					attempt,
					outputChanged,
				});

				// Wait before retry to let any notification/overlay clear
				await new Promise((resolve) => setTimeout(resolve, 2000));
			} catch (error) {
				this.logger.error('Failed to add project to Gemini CLI allowlist', {
					sessionName,
					projectPath,
					attempt,
					error: error instanceof Error ? error.message : String(error),
				});

				if (attempt === maxAttempts) {
					return {
						success: false,
						message: `Failed to add project path to allowlist: ${
							error instanceof Error ? error.message : String(error)
						}`,
					};
				}
			}
		}

		return {
			success: false,
			message: `Failed to add project path to allowlist after ${maxAttempts} attempts`,
		};
	}

	/**
	 * Add multiple project paths to Gemini CLI allowlist
	 * Efficiently adds all paths in sequence
	 */
	async addMultipleProjectsToAllowlist(
		sessionName: string,
		projectPaths: string[]
	): Promise<{
		success: boolean;
		message: string;
		results: Array<{ path: string; success: boolean; error?: string }>;
	}> {
		const results: Array<{ path: string; success: boolean; error?: string }> = [];
		let successCount = 0;

		this.logger.info('Adding multiple projects to Gemini CLI allowlist', {
			sessionName,
			projectCount: projectPaths.length,
			projectPaths,
		});

		for (const projectPath of projectPaths) {
			try {
				const result = await this.addProjectToAllowlist(sessionName, projectPath);
				if (result.success) {
					successCount++;
					results.push({ path: projectPath, success: true });
				} else {
					results.push({
						path: projectPath,
						success: false,
						error: result.message,
					});
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				results.push({
					path: projectPath,
					success: false,
					error: errorMessage,
				});
			}

			// Small delay between commands
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		const message = `Added ${successCount}/${projectPaths.length} projects to Gemini CLI allowlist`;

		this.logger.info('Completed adding multiple projects to Gemini CLI allowlist', {
			sessionName,
			totalProjects: projectPaths.length,
			successCount,
			failureCount: projectPaths.length - successCount,
		});

		return {
			success: successCount > 0,
			message,
			results,
		};
	}
}
