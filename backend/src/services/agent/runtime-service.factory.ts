import { RuntimeAgentService } from './runtime-agent.service.abstract.js';
import { ClaudeRuntimeService } from './claude-runtime.service.js';
import { GeminiRuntimeService } from './gemini-runtime.service.js';
import { CodexRuntimeService } from './codex-runtime.service.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { RUNTIME_TYPES, type RuntimeType } from '../../constants.js';

/**
 * Factory for creating runtime-specific service instances.
 * Implements factory pattern to encapsulate runtime service creation logic.
 */
export class RuntimeServiceFactory {
	// Cache instances to avoid creating multiple services for the same runtime type
	private static instanceCache: Map<string, RuntimeAgentService> = new Map();

	/**
	 * Create a runtime service instance for the specified runtime type
	 */
	static create(
		runtimeType: RuntimeType,
		tmuxCommandService: TmuxCommandService,
		projectRoot: string
	): RuntimeAgentService {
		// Create a cache key that includes all constructor parameters
		const cacheKey = `${runtimeType}-${projectRoot}`;

		// Return cached instance if available
		if (this.instanceCache.has(cacheKey)) {
			const cachedInstance = this.instanceCache.get(cacheKey)!;
			return cachedInstance;
		}

		// Create new instance based on runtime type
		let runtimeService: RuntimeAgentService;

		switch (runtimeType) {
			case RUNTIME_TYPES.CLAUDE_CODE:
				runtimeService = new ClaudeRuntimeService(tmuxCommandService, projectRoot);
				break;

			case RUNTIME_TYPES.GEMINI_CLI:
				runtimeService = new GeminiRuntimeService(tmuxCommandService, projectRoot);
				break;

			case RUNTIME_TYPES.CODEX_CLI:
				runtimeService = new CodexRuntimeService(tmuxCommandService, projectRoot);
				break;

			default:
				// Fallback to Claude Code for unknown runtime types
				console.warn(`Unknown runtime type: ${runtimeType}, falling back to Claude Code`);
				runtimeService = new ClaudeRuntimeService(tmuxCommandService, projectRoot);
				break;
		}

		// Cache the instance
		this.instanceCache.set(cacheKey, runtimeService);

		return runtimeService;
	}

	/**
	 * Create a runtime service without caching (for testing or special cases)
	 */
	static createFresh(
		runtimeType: RuntimeType,
		tmuxCommandService: TmuxCommandService,
		projectRoot: string
	): RuntimeAgentService {
		switch (runtimeType) {
			case RUNTIME_TYPES.CLAUDE_CODE:
				return new ClaudeRuntimeService(tmuxCommandService, projectRoot);

			case RUNTIME_TYPES.GEMINI_CLI:
				return new GeminiRuntimeService(tmuxCommandService, projectRoot);

			case RUNTIME_TYPES.CODEX_CLI:
				return new CodexRuntimeService(tmuxCommandService, projectRoot);

			default:
				// Fallback to Claude Code for unknown runtime types
				console.warn(`Unknown runtime type: ${runtimeType}, falling back to Claude Code`);
				return new ClaudeRuntimeService(tmuxCommandService, projectRoot);
		}
	}

	/**
	 * Get available runtime types
	 */
	static getAvailableRuntimeTypes(): RuntimeType[] {
		return [
			RUNTIME_TYPES.CLAUDE_CODE,
			RUNTIME_TYPES.GEMINI_CLI,
			RUNTIME_TYPES.CODEX_CLI,
		];
	}

	/**
	 * Clear cached instances (useful for testing or when configuration changes)
	 */
	static clearCache(): void {
		this.instanceCache.clear();
	}

	/**
	 * Clear cached instance for a specific runtime type and project
	 */
	static clearCacheFor(runtimeType: RuntimeType, projectRoot: string): void {
		const cacheKey = `${runtimeType}-${projectRoot}`;
		this.instanceCache.delete(cacheKey);
	}

	/**
	 * Get cached instance count (useful for debugging/monitoring)
	 */
	static getCachedInstanceCount(): number {
		return this.instanceCache.size;
	}

	/**
	 * Check if a runtime type is supported
	 */
	static isRuntimeTypeSupported(runtimeType: string): runtimeType is RuntimeType {
		return this.getAvailableRuntimeTypes().includes(runtimeType as RuntimeType);
	}
}