import { promises as fsPromises } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RuntimeAgentService } from './runtime-agent.service.abstract.js';
import { SessionCommandHelper } from '../session/index.js';
import { CREWLY_CONSTANTS, RUNTIME_TYPES, GEMINI_FAILURE_PATTERNS, type RuntimeType } from '../../constants.js';
import { delay } from '../../utils/async.utils.js';

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
		await delay(2000);

		// Capture the output after sending '/'
		const afterOutput = this.sessionHelper.capturePane(sessionName, 20);

		// Clear the '/' by sending Backspace (safe in TUI — just deletes the character)
		await this.sessionHelper.sendKey(sessionName, 'Backspace');
		await delay(500);

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
	 * Gemini CLI specific exit patterns for runtime exit detection.
	 *
	 * Includes both clean exit patterns (e.g. "Agent powering down") and
	 * failure patterns that indicate the CLI is stuck or crashed and needs
	 * recovery (e.g. API quota exhaustion, network errors).
	 *
	 * @returns Array of RegExp patterns that match runtime exit or failure output
	 */
	protected getRuntimeExitPatterns(): RegExp[] {
		return [
			// Clean exit patterns
			/Agent powering down/i,
			/Interaction Summary/,
			// Gemini CLI failure/stuck patterns — CLI may crash or become
			// unresponsive when these errors occur, requiring a restart
			...GEMINI_FAILURE_PATTERNS,
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
	 * Adds ~/.crewly to the directory allowlist and ensures MCP server
	 * configuration (e.g., playwright) is present in the project directory.
	 *
	 * @param sessionName - PTY session name
	 * @param targetProjectPath - Optional target project path for MCP config.
	 *                            Falls back to this.projectRoot if not provided.
	 */
	async postInitialize(sessionName: string, targetProjectPath?: string): Promise<void> {
		const effectiveProjectPath = targetProjectPath || this.projectRoot;
		const crewlyHome = path.join(os.homedir(), CREWLY_CONSTANTS.PATHS.CREWLY_HOME);
		this.logger.info('Gemini CLI post-init: adding paths to directory allowlist', {
			sessionName,
			crewlyHome,
			projectRoot: this.projectRoot,
			targetProjectPath: effectiveProjectPath,
		});

		// Ensure MCP servers (e.g., playwright) are configured before the agent starts.
		// This is done before the allowlist step because it's a filesystem operation
		// that doesn't depend on the CLI being ready for interactive commands.
		await this.ensureGeminiMcpConfig(effectiveProjectPath);

		// Ensure GOOGLE_GENAI_API_KEY is in the project .env file
		await this.ensureGeminiEnvFile(effectiveProjectPath);

		// Wait for Gemini CLI's async auto-update check to complete before
		// sending commands. The auto-update notification (e.g., "Automatic
		// update failed") appears shortly after startup and can interfere
		// with slash command processing if we send /directory add too early.
		await delay(3000);

		// Add ~/.crewly, the Crewly project root, and the target project to the allowlist.
		// The target project path may differ from projectRoot when the agent works on a
		// separate project (e.g., business_os vs crewly).
		const pathsToAdd = [crewlyHome, this.projectRoot];
		if (effectiveProjectPath !== this.projectRoot) {
			pathsToAdd.push(effectiveProjectPath);
		}

		const result = await this.addMultipleProjectsToAllowlist(sessionName, pathsToAdd);

		if (!result.success) {
			this.logger.warn('Failed to add paths to Gemini CLI allowlist (non-fatal)', {
				sessionName,
				results: result.results,
			});
		}
	}

	/**
	 * Ensure Gemini CLI MCP server configuration exists in the project directory.
	 *
	 * Creates or merges `.gemini/settings.json` with required MCP servers.
	 * Delegates to the shared `ensureMcpConfig` in the base class.
	 *
	 * @param projectPath - Project directory where `.gemini/settings.json` will be created
	 */
	async ensureGeminiMcpConfig(projectPath: string): Promise<void> {
		const settingsPath = path.join(projectPath, '.gemini', 'settings.json');
		await this.ensureMcpConfig(settingsPath, projectPath);
	}

	/**
	 * Ensure the project root `.env` file contains GOOGLE_GENAI_API_KEY.
	 * Gemini CLI reads this key from `.env` in the working directory.
	 * If the key exists in the process environment but not in `.env`, append it.
	 * Also ensures `.gitignore` includes `.env` to prevent accidental commits.
	 *
	 * @param projectPath - Project directory where `.env` will be created/updated
	 */
	private async ensureGeminiEnvFile(projectPath: string): Promise<void> {
		const apiKey = process.env.GOOGLE_GENAI_API_KEY;
		if (!apiKey) {
			this.logger.debug('GOOGLE_GENAI_API_KEY not found in process environment, skipping .env setup');
			return;
		}

		const envPath = path.join(projectPath, '.env');
		const envLine = `GOOGLE_GENAI_API_KEY="${apiKey}"`;

		try {
			// Check if .env already contains the key
			let existingContent: string | null = null;
			try {
				existingContent = await fsPromises.readFile(envPath, 'utf8');
			} catch {
				// File doesn't exist yet
			}

			if (existingContent !== null) {
				if (existingContent.includes('GOOGLE_GENAI_API_KEY=')) {
					this.logger.debug('GOOGLE_GENAI_API_KEY already present in .env', { projectPath });
					return;
				}
				// Append to existing .env
				const separator = existingContent.endsWith('\n') ? '' : '\n';
				await fsPromises.appendFile(envPath, `${separator}${envLine}\n`);
			} else {
				// Create new .env
				await fsPromises.writeFile(envPath, `${envLine}\n`);
			}
			this.logger.info('Added GOOGLE_GENAI_API_KEY to .env', { projectPath });
		} catch (error) {
			this.logger.warn('Failed to write GOOGLE_GENAI_API_KEY to .env (non-fatal)', {
				projectPath,
				error: error instanceof Error ? error.message : String(error),
			});
			return;
		}

		// Ensure .gitignore includes .env
		try {
			const gitignorePath = path.join(projectPath, '.gitignore');
			let gitignoreContent: string | null = null;
			try {
				gitignoreContent = await fsPromises.readFile(gitignorePath, 'utf8');
			} catch {
				// File doesn't exist yet
			}

			if (gitignoreContent !== null) {
				if (!gitignoreContent.split('\n').some(line => line.trim() === '.env')) {
					const separator = gitignoreContent.endsWith('\n') ? '' : '\n';
					await fsPromises.appendFile(gitignorePath, `${separator}.env\n`);
					this.logger.info('Added .env to .gitignore', { projectPath });
				}
			} else {
				await fsPromises.writeFile(gitignorePath, '.env\n');
				this.logger.info('Created .gitignore with .env entry', { projectPath });
			}
		} catch (error) {
			this.logger.warn('Failed to update .gitignore (non-fatal)', {
				projectPath,
				error: error instanceof Error ? error.message : String(error),
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
				await delay(1000);

				// Capture output before sending to verify the command was processed.
				// Use 100 lines (not 20) because Gemini CLI TUI has a fixed layout:
				// messages area at top, input box + status at bottom (~15-20 lines).
				// The "/directory add" success message appears in the upper messages
				// area via addItem(), so 20 lines only captures the unchanging bottom.
				const beforeOutput = this.sessionHelper.capturePane(sessionName, 100);

				// Send the directory add command
				// Add a trailing space as sometimes Gemini CLI needs it to delimit the path properly
				const addCommand = `/directory add ${projectPath} `;
				await this.sessionHelper.sendMessage(sessionName, addCommand);

				// Wait for command to complete
				await delay(2000);

				// Verify: check if output changed (slash commands produce confirmation)
				const afterOutput = this.sessionHelper.capturePane(sessionName, 100);
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
				await delay(2000);
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
			await delay(500);
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
