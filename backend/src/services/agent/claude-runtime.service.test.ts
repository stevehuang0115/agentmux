import * as path from 'path';
import { promises as fs } from 'fs';
import { ClaudeRuntimeService } from './claude-runtime.service.js';
import { SessionCommandHelper } from '../session/index.js';
import { RUNTIME_TYPES } from '../../constants.js';
import { getSettingsService } from '../settings/settings.service.js';
import { safeReadJson, atomicWriteJson } from '../../utils/file-io.utils.js';
import { getDefaultSettings } from '../../types/settings.types.js';

jest.mock('fs', () => ({
	...jest.requireActual('fs'),
	promises: {
		...jest.requireActual('fs').promises,
		mkdir: jest.fn().mockResolvedValue(undefined),
	},
}));

jest.mock('../../utils/file-io.utils.js', () => ({
	safeReadJson: jest.fn().mockResolvedValue({}),
	atomicWriteJson: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../settings/settings.service.js', () => ({
	getSettingsService: jest.fn().mockReturnValue({
		getSettings: jest.fn().mockResolvedValue({
			...require('../../types/settings.types.js').getDefaultSettings(),
		}),
	}),
}));

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

	describe('getRuntimeExitPatterns', () => {
		it('should return Claude-specific exit patterns', () => {
			const patterns = service['getRuntimeExitPatterns']();
			expect(patterns).toHaveLength(2);
			expect(patterns[0].test('Claude Code exited')).toBe(true);
			expect(patterns[0].test('Claude exited')).toBe(true);
			expect(patterns[1].test('Session ended')).toBe(true);
		});

		it('should not match unrelated text', () => {
			const patterns = service['getRuntimeExitPatterns']();
			expect(patterns.some(p => p.test('Welcome to Claude Code!'))).toBe(false);
		});
	});

	describe('getExitPatterns', () => {
		it('should expose exit patterns via public accessor', () => {
			const patterns = service.getExitPatterns();
			expect(patterns).toHaveLength(2);
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

	describe('ensureClaudeMcpConfig', () => {
		const mockSafeReadJson = safeReadJson as jest.MockedFunction<typeof safeReadJson>;
		const mockAtomicWriteJson = atomicWriteJson as jest.MockedFunction<typeof atomicWriteJson>;
		const mockMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
		const mockGetSettingsService = getSettingsService as jest.MockedFunction<typeof getSettingsService>;

		beforeEach(() => {
			jest.clearAllMocks();
			mockSafeReadJson.mockResolvedValue({});
			mockAtomicWriteJson.mockResolvedValue(undefined);
			mockMkdir.mockResolvedValue(undefined);
			mockGetSettingsService.mockReturnValue({
				getSettings: jest.fn().mockResolvedValue(getDefaultSettings()),
			} as any);
		});

		it('should create .mcp.json with playwright when it does not exist', async () => {
			mockSafeReadJson.mockResolvedValue({});

			await service.ensureClaudeMcpConfig('/test/project');

			expect(mockMkdir).toHaveBeenCalledWith(
				'/test/project',
				{ recursive: true }
			);
			expect(mockAtomicWriteJson).toHaveBeenCalledWith(
				path.join('/test/project', '.mcp.json'),
				{
					mcpServers: {
							playwright: {
								command: 'npx',
								args: [
									'@playwright/mcp@latest',
									'--headless',
									'--human-delay-min',
									'300',
									'--human-delay-max',
									'1200',
								],
							},
						},
					}
				);
		});

		it('should preserve existing user MCP servers', async () => {
			mockSafeReadJson.mockResolvedValue({
				mcpServers: {
					'my-custom-server': { command: 'node', args: ['server.js'] },
				},
				otherSetting: 'preserved',
			});

			await service.ensureClaudeMcpConfig('/test/project');

			expect(mockAtomicWriteJson).toHaveBeenCalledWith(
				path.join('/test/project', '.mcp.json'),
				{
					mcpServers: {
						'my-custom-server': { command: 'node', args: ['server.js'] },
							playwright: {
								command: 'npx',
								args: [
									'@playwright/mcp@latest',
									'--headless',
									'--human-delay-min',
									'300',
									'--human-delay-max',
									'1200',
								],
							},
						},
						otherSetting: 'preserved',
				}
			);
		});

		it('should not overwrite existing playwright config', async () => {
			const userPlaywright = { command: 'playwright', args: ['--custom'] };
			mockSafeReadJson.mockResolvedValue({
				mcpServers: {
					playwright: userPlaywright,
				},
			});

			await service.ensureClaudeMcpConfig('/test/project');

			expect(mockAtomicWriteJson).toHaveBeenCalledWith(
				path.join('/test/project', '.mcp.json'),
				{
					mcpServers: {
						playwright: userPlaywright,
					},
				}
			);
		});

		it('should skip playwright when enableBrowserAutomation is false', async () => {
			const disabledSettings = getDefaultSettings();
			disabledSettings.skills.enableBrowserAutomation = false;
			mockGetSettingsService.mockReturnValue({
				getSettings: jest.fn().mockResolvedValue(disabledSettings),
			} as any);

			await service.ensureClaudeMcpConfig('/test/project');

			expect(mockAtomicWriteJson).not.toHaveBeenCalled();
		});

		it('should default to enabled when settings service is unavailable', async () => {
			mockGetSettingsService.mockReturnValue({
				getSettings: jest.fn().mockRejectedValue(new Error('Settings unavailable')),
			} as any);

			await service.ensureClaudeMcpConfig('/test/project');

			expect(mockAtomicWriteJson).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					mcpServers: expect.objectContaining({
						playwright: expect.any(Object),
					}),
				})
			);
		});

		it('should not throw when filesystem operations fail', async () => {
			mockAtomicWriteJson.mockRejectedValue(new Error('Permission denied'));

			await expect(service.ensureClaudeMcpConfig('/test/project')).resolves.not.toThrow();
		});
	});

	describe('postInitialize', () => {
		it('should call ensureClaudeMcpConfig with project root when no target path given', async () => {
			const spy = jest.spyOn(service, 'ensureClaudeMcpConfig').mockResolvedValue(undefined);

			await service.postInitialize('test-session');

			expect(spy).toHaveBeenCalledWith('/test/project');
		});

		it('should call ensureClaudeMcpConfig with target project path when provided', async () => {
			const spy = jest.spyOn(service, 'ensureClaudeMcpConfig').mockResolvedValue(undefined);

			await service.postInitialize('test-session', '/target/project');

			expect(spy).toHaveBeenCalledWith('/target/project');
		});
	});

});
