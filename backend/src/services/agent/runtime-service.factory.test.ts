import { RuntimeServiceFactory } from './runtime-service.factory.js';
import { ClaudeRuntimeService } from './claude-runtime.service.js';
import { GeminiRuntimeService } from './gemini-runtime.service.js';
import { CodexRuntimeService } from './codex-runtime.service.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { RUNTIME_TYPES } from '../../constants.js';

describe('RuntimeServiceFactory', () => {
	let mockTmuxCommandService: jest.Mocked<TmuxCommandService>;
	const testProjectRoot = '/test/project';

	beforeEach(() => {
		mockTmuxCommandService = {
			capturePane: jest.fn(),
			sendKey: jest.fn(),
			sendEnter: jest.fn(),
		} as any;
		
		// Clear the instance cache before each test
		RuntimeServiceFactory['instanceCache'].clear();
	});

	afterEach(() => {
		// Clear the instance cache after each test
		RuntimeServiceFactory['instanceCache'].clear();
	});

	describe('create', () => {
		it('should create ClaudeRuntimeService for CLAUDE_CODE runtime type', () => {
			const service = RuntimeServiceFactory.create(
				RUNTIME_TYPES.CLAUDE_CODE,
				mockTmuxCommandService,
				testProjectRoot
			);

			expect(service).toBeInstanceOf(ClaudeRuntimeService);
		});

		it('should create GeminiRuntimeService for GEMINI_CLI runtime type', () => {
			const service = RuntimeServiceFactory.create(
				RUNTIME_TYPES.GEMINI_CLI,
				mockTmuxCommandService,
				testProjectRoot
			);

			expect(service).toBeInstanceOf(GeminiRuntimeService);
		});

		it('should create CodexRuntimeService for CODEX_CLI runtime type', () => {
			const service = RuntimeServiceFactory.create(
				RUNTIME_TYPES.CODEX_CLI,
				mockTmuxCommandService,
				testProjectRoot
			);

			expect(service).toBeInstanceOf(CodexRuntimeService);
		});

		it('should fallback to ClaudeRuntimeService for unknown runtime type', () => {
			const service = RuntimeServiceFactory.create(
				'unknown-runtime' as any,
				mockTmuxCommandService,
				testProjectRoot
			);

			expect(service).toBeInstanceOf(ClaudeRuntimeService);
		});

		it('should return cached instance for same parameters', () => {
			const service1 = RuntimeServiceFactory.create(
				RUNTIME_TYPES.CLAUDE_CODE,
				mockTmuxCommandService,
				testProjectRoot
			);

			const service2 = RuntimeServiceFactory.create(
				RUNTIME_TYPES.CLAUDE_CODE,
				mockTmuxCommandService,
				testProjectRoot
			);

			expect(service1).toBe(service2);
		});

		it('should create separate instances for different project roots', () => {
			const service1 = RuntimeServiceFactory.create(
				RUNTIME_TYPES.CLAUDE_CODE,
				mockTmuxCommandService,
				'/project1'
			);

			const service2 = RuntimeServiceFactory.create(
				RUNTIME_TYPES.CLAUDE_CODE,
				mockTmuxCommandService,
				'/project2'
			);

			expect(service1).not.toBe(service2);
		});

		it('should create separate instances for different runtime types', () => {
			const claudeService = RuntimeServiceFactory.create(
				RUNTIME_TYPES.CLAUDE_CODE,
				mockTmuxCommandService,
				testProjectRoot
			);

			const geminiService = RuntimeServiceFactory.create(
				RUNTIME_TYPES.GEMINI_CLI,
				mockTmuxCommandService,
				testProjectRoot
			);

			expect(claudeService).not.toBe(geminiService);
			expect(claudeService).toBeInstanceOf(ClaudeRuntimeService);
			expect(geminiService).toBeInstanceOf(GeminiRuntimeService);
		});

		it('should handle cache key generation correctly', () => {
			const service1 = RuntimeServiceFactory.create(
				RUNTIME_TYPES.CLAUDE_CODE,
				mockTmuxCommandService,
				testProjectRoot
			);

			// Cache should contain the entry
			const cacheKey = `${RUNTIME_TYPES.CLAUDE_CODE}-${testProjectRoot}`;
			expect(RuntimeServiceFactory['instanceCache'].has(cacheKey)).toBe(true);
			expect(RuntimeServiceFactory['instanceCache'].get(cacheKey)).toBe(service1);
		});
	});

	describe('clearCache', () => {
		it('should allow clearing cache for testing purposes', () => {
			RuntimeServiceFactory.create(
				RUNTIME_TYPES.CLAUDE_CODE,
				mockTmuxCommandService,
				testProjectRoot
			);

			expect(RuntimeServiceFactory['instanceCache'].size).toBe(1);

			RuntimeServiceFactory['instanceCache'].clear();

			expect(RuntimeServiceFactory['instanceCache'].size).toBe(0);
		});
	});
});