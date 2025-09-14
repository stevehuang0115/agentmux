import { GeminiRuntimeService } from './gemini-runtime.service.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { RUNTIME_TYPES } from '../../constants.js';

describe('GeminiRuntimeService', () => {
	let service: GeminiRuntimeService;
	let mockTmuxCommandService: jest.Mocked<TmuxCommandService>;

	beforeEach(() => {
		mockTmuxCommandService = {
			capturePane: jest.fn(),
			sendKey: jest.fn(),
			sendEnter: jest.fn(),
		} as any;

		service = new GeminiRuntimeService(mockTmuxCommandService, '/test/project');
	});

	describe('getRuntimeType', () => {
		it('should return GEMINI_CLI runtime type', () => {
			expect(service['getRuntimeType']()).toBe(RUNTIME_TYPES.GEMINI_CLI);
		});
	});

	describe('detectRuntimeSpecific', () => {
		it('should detect Gemini when help command shows Gemini indicators', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before output')
				.mockResolvedValueOnce('after output with gemini CLI help');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
			expect(mockTmuxCommandService.sendKey).toHaveBeenCalledWith('test-session', 'help');
			expect(mockTmuxCommandService.sendEnter).toHaveBeenCalledWith('test-session');
		});

		it('should detect Gemini when Google AI indicator is present', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before')
				.mockResolvedValueOnce('Google AI Studio CLI - Available commands');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
		});

		it('should detect Gemini when model configuration is shown', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before')
				.mockResolvedValueOnce('Current model: gemini-pro, temperature: 0.7');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
		});

		it('should not detect Gemini when no indicators present', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('before output')
				.mockResolvedValueOnce('before output');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(false);
		});

		it('should detect Gemini based on output length increase', async () => {
			mockTmuxCommandService.capturePane
				.mockResolvedValueOnce('short')
				.mockResolvedValueOnce('much longer output indicating CLI response');

			const result = await service['detectRuntimeSpecific']('test-session');

			expect(result).toBe(true);
		});
	});

	describe('getRuntimeReadyPatterns', () => {
		it('should return Gemini-specific ready patterns', () => {
			const patterns = service['getRuntimeReadyPatterns']();
			
			expect(patterns).toContain('gemini>');
			expect(patterns).toContain('Ready for input');
			expect(patterns).toContain('Gemini CLI');
			expect(patterns).toContain('Google AI');
		});
	});

	describe('getRuntimeErrorPatterns', () => {
		it('should return Gemini-specific error patterns', () => {
			const patterns = service['getRuntimeErrorPatterns']();
			
			expect(patterns).toContain('command not found: gemini');
			expect(patterns).toContain('API key not found');
			expect(patterns).toContain('Authentication failed');
		});
	});

	describe('addProjectToAllowlist', () => {
		beforeEach(() => {
			mockTmuxCommandService.clearCurrentCommandLine = jest.fn();
			mockTmuxCommandService.sendMessage = jest.fn();
			mockTmuxCommandService.sendEnter = jest.fn();
		});

		it('should successfully add a project to Gemini CLI allowlist', async () => {
			const sessionName = 'test-session';
			const projectPath = '/path/to/project';

			const result = await service.addProjectToAllowlist(sessionName, projectPath);

			expect(result.success).toBe(true);
			expect(result.message).toBe(`Project path ${projectPath} added to Gemini CLI allowlist`);
			
			// Verify tmux commands were called
			expect(mockTmuxCommandService.clearCurrentCommandLine).toHaveBeenCalledWith(sessionName);
			expect(mockTmuxCommandService.sendMessage).toHaveBeenCalledWith(sessionName, `/directory add ${projectPath}`);
			expect(mockTmuxCommandService.sendEnter).toHaveBeenCalledWith(sessionName);
		});

		it('should handle errors gracefully', async () => {
			const sessionName = 'test-session';
			const projectPath = '/path/to/project';

			// Mock an error
			mockTmuxCommandService.sendMessage.mockRejectedValue(new Error('Connection failed'));

			const result = await service.addProjectToAllowlist(sessionName, projectPath);

			expect(result.success).toBe(false);
			expect(result.message).toContain('Failed to add project path to allowlist');
		});
	});

	describe('addMultipleProjectsToAllowlist', () => {
		beforeEach(() => {
			mockTmuxCommandService.clearCurrentCommandLine = jest.fn();
			mockTmuxCommandService.sendMessage = jest.fn();
			mockTmuxCommandService.sendEnter = jest.fn();
		});

		it('should successfully add multiple projects to allowlist', async () => {
			const sessionName = 'test-session';
			const projectPaths = ['/path/to/project1', '/path/to/project2'];

			const result = await service.addMultipleProjectsToAllowlist(sessionName, projectPaths);

			expect(result.success).toBe(true);
			expect(result.message).toBe('Added 2/2 projects to Gemini CLI allowlist');
			expect(result.results).toHaveLength(2);
			expect(result.results.every(r => r.success)).toBe(true);

			// Verify tmux commands were called for each project
			expect(mockTmuxCommandService.sendMessage).toHaveBeenCalledTimes(2);
			expect(mockTmuxCommandService.sendMessage).toHaveBeenCalledWith(sessionName, '/directory add /path/to/project1');
			expect(mockTmuxCommandService.sendMessage).toHaveBeenCalledWith(sessionName, '/directory add /path/to/project2');
		});

		it('should handle partial failures gracefully', async () => {
			const sessionName = 'test-session';
			const projectPaths = ['/path/to/project1', '/path/to/project2'];

			// Mock success for first, error for second
			mockTmuxCommandService.sendMessage
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error('Failed for project2'));

			const result = await service.addMultipleProjectsToAllowlist(sessionName, projectPaths);

			expect(result.success).toBe(true); // Should be true since at least one succeeded
			expect(result.message).toBe('Added 1/2 projects to Gemini CLI allowlist');
			expect(result.results).toHaveLength(2);
			expect(result.results[0].success).toBe(true);
			expect(result.results[1].success).toBe(false);
		});

		it('should return success false when no projects can be added', async () => {
			const sessionName = 'test-session';
			const projectPaths = ['/path/to/project1'];

			// Mock error for all
			mockTmuxCommandService.sendMessage.mockRejectedValue(new Error('Connection failed'));

			const result = await service.addMultipleProjectsToAllowlist(sessionName, projectPaths);

			expect(result.success).toBe(false);
			expect(result.message).toBe('Added 0/1 projects to Gemini CLI allowlist');
		});
	});
});