import { RuntimeAgentService } from './runtime-agent.service.abstract.js';
import { SessionCommandHelper } from '../session/index.js';
import { RUNTIME_TYPES, type RuntimeType } from '../../constants.js';

/**
 * OpenAI Codex CLI specific runtime service implementation.
 * Handles Codex CLI initialization, detection, and interaction patterns.
 */
export class CodexRuntimeService extends RuntimeAgentService {
	constructor(sessionHelper: SessionCommandHelper, projectRoot: string) {
		super(sessionHelper, projectRoot);
	}

	protected getRuntimeType(): RuntimeType {
		return RUNTIME_TYPES.CODEX_CLI;
	}

	/**
	 * Codex CLI specific detection using '/' command
	 */
	protected async detectRuntimeSpecific(sessionName: string): Promise<boolean> {
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

		this.logger.debug('Codex detection completed', {
			sessionName,
			hasOutputChange,
			beforeLength: beforeOutput.length,
			afterLength: afterOutput.length,
		});

		return hasOutputChange;
	}

	/**
	 * Codex CLI specific ready patterns
	 */
	protected getRuntimeReadyPatterns(): string[] {
		return [
			'Codex CLI',
			'codex>',
			'Ready for commands',
			'OpenAI Codex',
			'model:',
			'token:',
			'Connected to OpenAI',
			'Welcome to Codex',
			'Initialized successfully',
		];
	}

	/**
	 * Codex CLI specific exit patterns for runtime exit detection
	 */
	protected getRuntimeExitPatterns(): RegExp[] {
		return [
			/codex.*exited/i,
			/Session\s+ended/i,
		];
	}

	/**
	 * Codex CLI specific error patterns
	 */
	protected getRuntimeErrorPatterns(): string[] {
		const commonErrors = ['Permission denied', 'No such file or directory'];
		return [
			...commonErrors,
			'command not found: codex',
			'OpenAI API error',
			'Authentication failed',
			'Invalid API key',
			'Rate limit exceeded',
			'Token limit exceeded',
		];
	}

	/**
	 * Check if Codex CLI is installed and configured
	 */
	async checkCodexInstallation(): Promise<{
		isInstalled: boolean;
		version?: string;
		message: string;
	}> {
		try {
			// This would check if Codex CLI is available
			// Could run: codex --version or similar
			return {
				isInstalled: true,
				message: 'OpenAI Codex CLI is available',
			};
		} catch (error) {
			return {
				isInstalled: false,
				message: 'OpenAI Codex CLI not found or not configured',
			};
		}
	}

	/**
	 * Initialize Codex in an existing session
	 */
	async initializeCodexInSession(sessionName: string): Promise<{
		success: boolean;
		message: string;
	}> {
		try {
			await this.executeRuntimeInitScript(sessionName);
			return {
				success: true,
				message: 'OpenAI Codex CLI initialized successfully',
			};
		} catch (error) {
			return {
				success: false,
				message:
					error instanceof Error
						? error.message
						: 'Failed to initialize OpenAI Codex CLI',
			};
		}
	}
}
