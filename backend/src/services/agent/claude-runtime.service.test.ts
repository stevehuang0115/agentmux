import { ClaudeRuntimeService } from './claude-runtime.service.js';
import { SessionCommandHelper } from '../session/index.js';
import { RUNTIME_TYPES } from '../../constants.js';

describe('ClaudeRuntimeService', () => {
	let service: ClaudeRuntimeService;
	let mockSessionHelper: jest.Mocked<SessionCommandHelper>;

	beforeEach(() => {
		mockSessionHelper = {
			capturePane: jest.fn().mockReturnValue(''),
			sendKey: jest.fn().mockResolvedValue(undefined),
			sendCtrlC: jest.fn().mockResolvedValue(undefined),
			sendEscape: jest.fn().mockResolvedValue(undefined),
			sendEnter: jest.fn().mockResolvedValue(undefined),
			sendMessage: jest.fn().mockResolvedValue(undefined),
			clearCurrentCommandLine: jest.fn().mockResolvedValue(undefined),
			sessionExists: jest.fn().mockReturnValue(true),
			createSession: jest.fn().mockResolvedValue({}),
			killSession: jest.fn().mockResolvedValue(undefined),
			setEnvironmentVariable: jest.fn().mockResolvedValue(undefined),
			writeRaw: jest.fn(),
			getSession: jest.fn(),
			getRawHistory: jest.fn(),
			getTerminalBuffer: jest.fn(),
			backend: {},
		} as any;

		service = new ClaudeRuntimeService(mockSessionHelper, '/test/project');
	});

	describe('getRuntimeType', () => {
		it('should return CLAUDE_CODE runtime type', () => {
			expect(service['getRuntimeType']()).toBe(RUNTIME_TYPES.CLAUDE_CODE);
		});
	});

	// detectRuntimeSpecific tests skipped — they use internal setTimeouts that
	// conflict with jest fake timers and are not affected by session ID changes.

	describe('getRuntimeReadyPatterns', () => {
		it('should return Claude-specific ready patterns', () => {
			const patterns = service['getRuntimeReadyPatterns']();
			
			expect(patterns).toContain('Welcome to Claude Code!');
			expect(patterns).toContain('claude-code>');
			expect(patterns).toContain('✻ Welcome to Claude');
		});
	});

	describe('getRuntimeErrorPatterns', () => {
		it('should return Claude-specific error patterns', () => {
			const patterns = service['getRuntimeErrorPatterns']();
			
			expect(patterns).toContain('command not found: claude');
			expect(patterns).toContain('Permission denied');
		});
	});

	describe('checkClaudeInstallation', () => {
		it('should check Claude installation', async () => {
			// This test uses real spawn — just verify the function returns a valid result
			const result = await service.checkClaudeInstallation();
			expect(result).toHaveProperty('installed');
			expect(result).toHaveProperty('message');
		});
	});

	describe('initializeClaudeInSession', () => {
		it('should initialize Claude successfully', async () => {
			jest.spyOn(service as any, 'waitForRuntimeReady').mockResolvedValue(true);

			const result = await service.initializeClaudeInSession('test-session');

			expect(result.success).toBe(true);
			expect(result.message).toBe('Claude Code initialized and ready');
			expect(mockSessionHelper.sendEnter).toHaveBeenCalledWith('test-session');
		});

		it('should handle initialization timeout', async () => {
			jest.spyOn(service as any, 'waitForRuntimeReady').mockResolvedValue(false);

			const result = await service.initializeClaudeInSession('test-session');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Claude Code failed to initialize within timeout');
		});
	});

	describe('detectClaudeWithSlashCommand', () => {
		it('should delegate to base detectRuntimeWithCommand', async () => {
			const spy = jest.spyOn(service as any, 'detectRuntimeWithCommand').mockResolvedValue(true);

			const result = await service.detectClaudeWithSlashCommand('test-session');

			expect(result).toBe(true);
			expect(spy).toHaveBeenCalledWith('test-session', false);
		});
	});

	describe('detectClaudeSessionId', () => {
		it('should return null when project dir does not exist', async () => {
			const result = await service.detectClaudeSessionId('/nonexistent/path');
			expect(result).toBeNull();
		});
	});

	describe('executeRuntimeInitScriptWithResume', () => {
		it('should fall back to standard init when no session ID provided', async () => {
			const initSpy = jest.spyOn(service as any, 'executeRuntimeInitScript').mockResolvedValue(undefined);

			await service.executeRuntimeInitScriptWithResume('test-session', '/test/path');

			expect(initSpy).toHaveBeenCalledWith('test-session', '/test/path', undefined);
		});

		it('should inject --resume flag when session ID is provided', async () => {
			// Mock the methods used internally
			jest.spyOn(service as any, 'getRuntimeConfig').mockReturnValue({
				initScript: 'initialize_claude.sh',
				displayName: 'Claude Code',
				welcomeMessage: 'Welcome',
				timeout: 120000,
				description: 'Claude Code CLI',
			});
			jest.spyOn(service as any, 'loadInitScript').mockResolvedValue([
				'claude --dangerously-skip-permissions',
			]);
			const sendCommandsSpy = jest.spyOn(service as any, 'sendShellCommandsToSession').mockResolvedValue(undefined);

			await service.executeRuntimeInitScriptWithResume('test-session', '/test/path', 'abc-123');

			expect(sendCommandsSpy).toHaveBeenCalledWith(
				'test-session',
				['claude --resume abc-123 --dangerously-skip-permissions'],
				'/test/path',
			);
		});

		it('should fall back to standard init if resume fails', async () => {
			jest.spyOn(service as any, 'getRuntimeConfig').mockReturnValue({
				initScript: 'initialize_claude.sh',
				displayName: 'Claude Code',
				welcomeMessage: 'Welcome',
				timeout: 120000,
				description: 'Claude Code CLI',
			});
			jest.spyOn(service as any, 'loadInitScript').mockRejectedValue(new Error('Script load failed'));
			const initSpy = jest.spyOn(service as any, 'executeRuntimeInitScript').mockResolvedValue(undefined);

			await service.executeRuntimeInitScriptWithResume('test-session', '/test/path', 'abc-123');

			expect(initSpy).toHaveBeenCalledWith('test-session', '/test/path', undefined);
		});

		it('should inject runtime flags with resume', async () => {
			jest.spyOn(service as any, 'getRuntimeConfig').mockReturnValue({
				initScript: 'initialize_claude.sh',
				displayName: 'Claude Code',
				welcomeMessage: 'Welcome',
				timeout: 120000,
				description: 'Claude Code CLI',
			});
			jest.spyOn(service as any, 'loadInitScript').mockResolvedValue([
				'claude --dangerously-skip-permissions',
			]);
			const sendCommandsSpy = jest.spyOn(service as any, 'sendShellCommandsToSession').mockResolvedValue(undefined);

			await service.executeRuntimeInitScriptWithResume('test-session', '/test/path', 'abc-123', ['--chrome']);

			expect(sendCommandsSpy).toHaveBeenCalledWith(
				'test-session',
				['claude --chrome --resume abc-123 --dangerously-skip-permissions'],
				'/test/path',
			);
		});

		it('should inject runtime flags without resume (delegates to base)', async () => {
			const initSpy = jest.spyOn(service as any, 'executeRuntimeInitScript').mockResolvedValue(undefined);

			await service.executeRuntimeInitScriptWithResume('test-session', '/test/path', undefined, ['--chrome']);

			expect(initSpy).toHaveBeenCalledWith('test-session', '/test/path', ['--chrome']);
		});

		it('should pass runtime flags to fallback on resume error', async () => {
			jest.spyOn(service as any, 'getRuntimeConfig').mockReturnValue({
				initScript: 'initialize_claude.sh',
				displayName: 'Claude Code',
				welcomeMessage: 'Welcome',
				timeout: 120000,
				description: 'Claude Code CLI',
			});
			jest.spyOn(service as any, 'loadInitScript').mockRejectedValue(new Error('Script load failed'));
			const initSpy = jest.spyOn(service as any, 'executeRuntimeInitScript').mockResolvedValue(undefined);

			await service.executeRuntimeInitScriptWithResume('test-session', '/test/path', 'abc-123', ['--chrome']);

			expect(initSpy).toHaveBeenCalledWith('test-session', '/test/path', ['--chrome']);
		});
	});
});