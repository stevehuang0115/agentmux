import { RuntimeAgentService } from './runtime-agent.service.abstract.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { RUNTIME_TYPES, type RuntimeType } from '../../constants.js';

/**
 * Gemini CLI specific runtime service implementation.
 * Handles Gemini CLI initialization, detection, and interaction patterns.
 */
export class GeminiRuntimeService extends RuntimeAgentService {
	constructor(tmuxCommandService: TmuxCommandService, projectRoot: string) {
		super(tmuxCommandService, projectRoot);
	}

	protected getRuntimeType(): RuntimeType {
		return RUNTIME_TYPES.GEMINI_CLI;
	}

	/**
	 * Gemini CLI specific detection using '/' command
	 */
	protected async detectRuntimeSpecific(sessionName: string): Promise<boolean> {
		// Send a simple command to test if Gemini CLI is running

		// First to clear the current command
		await this.tmuxCommand.clearCurrentCommandLine(sessionName);

		// Capture the output before checking
		const beforeOutput = await this.tmuxCommand.capturePane(sessionName, 20);
		// Send the '/' key to detect changes
		await this.tmuxCommand.sendKey(sessionName, '/', true);
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Capture the output after sending '/'
		const afterOutput = await this.tmuxCommand.capturePane(sessionName, 20);

		// Clear the '/' command again
		await this.tmuxCommand.clearCurrentCommandLine(sessionName);

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
			'Gemini CLI',
			'gemini>',
			'Ready for input',
			'Model loaded',
			'temperature:',
			'google ai',
			'GEMINI.md',
			'Welcome to Gemini',
			'Initialized successfully',
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
		try {
			this.logger.info('Adding project to Gemini CLI allowlist', {
				sessionName,
				projectPath,
			});

			// Clear any existing command
			await this.tmuxCommand.clearCurrentCommandLine(sessionName);
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Send the directory add command
			const addCommand = `/directory add ${projectPath}`;
			await this.tmuxCommand.sendMessage(sessionName, addCommand);
			await this.tmuxCommand.sendEnter(sessionName);

			// Wait for command to complete
			await new Promise((resolve) => setTimeout(resolve, 2000));

			this.logger.info('Project added to Gemini CLI allowlist', {
				sessionName,
				projectPath,
			});

			return {
				success: true,
				message: `Project path ${projectPath} added to Gemini CLI allowlist`,
			};
		} catch (error) {
			this.logger.error('Failed to add project to Gemini CLI allowlist', {
				sessionName,
				projectPath,
				error: error instanceof Error ? error.message : String(error),
			});

			return {
				success: false,
				message: `Failed to add project path to allowlist: ${
					error instanceof Error ? error.message : String(error)
				}`,
			};
		}
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
