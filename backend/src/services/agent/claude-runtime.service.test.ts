import { ClaudeRuntimeService } from './claude-runtime.service.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { RUNTIME_TYPES } from '../../constants.js';

describe('ClaudeRuntimeService', () => {
	let service: ClaudeRuntimeService;
	let mockTmuxCommandService: jest.Mocked<TmuxCommandService>;

	beforeEach(() => {
		mockTmuxCommandService = {
			capturePane: jest.fn(),
			sendKey: jest.fn(),
			sendCtrlC: jest.fn(),
			sendEscape: jest.fn(),
			sendEnter: jest.fn(),
			executeScript: jest.fn(),
		} as any;

		service = new ClaudeRuntimeService(mockTmuxCommandService, '/test/project');
	});

	describe('getRuntimeType', () => {
		it('should return CLAUDE_CODE runtime type', () => {
			expect(service['getRuntimeType']()).toBe(RUNTIME_TYPES.CLAUDE_CODE);
		});
	});

	describe('detectRuntimeSpecific', () => {
		it('should detect Claude when slash command triggers command palette', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before output')
				.mockResolvedValueOnce('after output with Command palette');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
			expect(mockTmuxCommandService.sendKey).toHaveBeenCalledWith('test-session', '/');
			expect(mockTmuxCommandService.sendCtrlC).toHaveBeenCalledWith('test-session');
			expect(mockTmuxCommandService.sendEscape).toHaveBeenCalledWith('test-session');
		});

		it('should detect Claude when output length increases significantly', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('short')
				.mockResolvedValueOnce('much longer output that indicates Claude is running');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
		});

		it('should not detect Claude when no indicators present', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before output')
				.mockResolvedValueOnce('before output');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(false);
		});
	});

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
		it('should detect installed Claude CLI', async () => {
			// Mock spawn to simulate which command finding claude
			jest.doMock('child_process', () => ({
				spawn: jest.fn().mockImplementation((cmd, args) => {
					if (cmd === 'which' && args[0] === 'claude') {
						return {
							stdout: { on: jest.fn((event, cb) => cb('/usr/local/bin/claude\n')) },
							stderr: { on: jest.fn() },
							on: jest.fn((event, cb) => cb(0))
						};
					}
					return {
						stdout: { on: jest.fn((event, cb) => cb('Claude Code CLI v1.0.0\n')) },
						stderr: { on: jest.fn() },
						on: jest.fn((event, cb) => cb(0))
					};
				})
			}));

			const result = await service.checkClaudeInstallation();

			expect(result.installed).toBe(true);
			expect(result.message).toContain('Claude Code CLI is available');
		});

		it('should handle missing Claude CLI', async () => {
			jest.doMock('child_process', () => ({
				spawn: jest.fn().mockImplementation(() => ({
					stdout: { on: jest.fn() },
					stderr: { on: jest.fn() },
					on: jest.fn((event, cb) => cb(1))
				}))
			}));

			const result = await service.checkClaudeInstallation();

			expect(result.installed).toBe(false);
			expect(result.message).toContain('Claude Code CLI not found');
		});
	});

	describe('initializeClaudeInSession', () => {
		it('should initialize Claude successfully', async () => {
			// Mock waitForRuntimeReady to return true
			jest.spyOn(service as any, 'waitForRuntimeReady').mockResolvedValue(true);

			const result = await service.initializeClaudeInSession('test-session');

			expect(result.success).toBe(true);
			expect(result.message).toBe('Claude Code initialized and ready');
			expect(mockTmuxCommandService.sendEnter).toHaveBeenCalledWith('test-session');
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
});