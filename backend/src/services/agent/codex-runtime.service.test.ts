import { CodexRuntimeService } from './codex-runtime.service.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { RUNTIME_TYPES } from '../../constants.js';

describe('CodexRuntimeService', () => {
	let service: CodexRuntimeService;
	let mockTmuxCommandService: jest.Mocked<TmuxCommandService>;

	beforeEach(() => {
		mockTmuxCommandService = {
			capturePane: jest.fn(),
			sendKey: jest.fn(),
			sendEnter: jest.fn(),
		} as any;

		service = new CodexRuntimeService(mockTmuxCommandService, '/test/project');
	});

	describe('getRuntimeType', () => {
		it('should return CODEX_CLI runtime type', () => {
			expect(service['getRuntimeType']()).toBe(RUNTIME_TYPES.CODEX_CLI);
		});
	});

	describe('detectRuntimeSpecific', () => {
		it('should detect Codex when status command shows Codex indicators', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before output')
				.mockResolvedValueOnce('after output with codex CLI status');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
			expect(mockTmuxCommandService.sendKey).toHaveBeenCalledWith('test-session', 'status');
			expect(mockTmuxCommandService.sendEnter).toHaveBeenCalledWith('test-session');
		});

		it('should detect Codex when OpenAI indicator is present', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before')
				.mockResolvedValueOnce('Connected to OpenAI API - Available models');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
		});

		it('should detect Codex when model configuration is shown', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before')
				.mockResolvedValueOnce('Current model: code-davinci-002, token: abc123');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
		});

		it('should not detect Codex when no indicators present', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before output')
				.mockResolvedValueOnce('before output');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(false);
		});

		it('should detect Codex based on output length increase', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('short')
				.mockResolvedValueOnce('much longer output indicating CLI response');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
		});
	});

	describe('getRuntimeReadyPatterns', () => {
		it('should return Codex-specific ready patterns', () => {
			const patterns = service['getRuntimeReadyPatterns']();
			
			expect(patterns).toContain('codex>');
			expect(patterns).toContain('Ready for input');
			expect(patterns).toContain('OpenAI Codex');
			expect(patterns).toContain('Connected to OpenAI');
		});
	});

	describe('getRuntimeErrorPatterns', () => {
		it('should return Codex-specific error patterns', () => {
			const patterns = service['getRuntimeErrorPatterns']();
			
			expect(patterns).toContain('command not found: codex');
			expect(patterns).toContain('API key not found');
			expect(patterns).toContain('Authentication failed');
			expect(patterns).toContain('Rate limit exceeded');
		});
	});
});