import * as os from 'os';
import * as path from 'path';
import * as fsModule from 'fs';
import { promises as fs } from 'fs';
import { GeminiRuntimeService, GEMINI_FAILURE_PATTERNS } from './gemini-runtime.service.js';
import { SessionCommandHelper } from '../session/index.js';
import { CREWLY_CONSTANTS, RUNTIME_TYPES } from '../../constants.js';
import { getSettingsService } from '../settings/settings.service.js';
import { safeReadJson, atomicWriteJson } from '../../utils/file-io.utils.js';
import { getDefaultSettings } from '../../types/settings.types.js';

jest.mock('fs', () => ({
	...jest.requireActual('fs'),
	existsSync: jest.fn(),
	readFileSync: jest.fn(),
	writeFileSync: jest.fn(),
	appendFileSync: jest.fn(),
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

describe('GeminiRuntimeService', () => {
	let service: GeminiRuntimeService;
	let mockSessionHelper: jest.Mocked<SessionCommandHelper>;

	beforeEach(() => {
		jest.useFakeTimers();

		mockSessionHelper = {
			capturePane: jest.fn().mockReturnValue(''),
			sendKey: jest.fn().mockResolvedValue(undefined),
			sendEnter: jest.fn().mockResolvedValue(undefined),
			sendCtrlC: jest.fn().mockResolvedValue(undefined),
			sendMessage: jest.fn().mockResolvedValue(undefined),
			sendEscape: jest.fn().mockResolvedValue(undefined),
			clearCurrentCommandLine: jest.fn().mockResolvedValue(undefined),
			sessionExists: jest.fn().mockReturnValue(true),
			createSession: jest.fn().mockResolvedValue({ pid: 123, cwd: '/test' }),
			killSession: jest.fn().mockResolvedValue(undefined),
			setEnvironmentVariable: jest.fn().mockResolvedValue(undefined),
			writeRaw: jest.fn(),
			getSession: jest.fn(),
			getRawHistory: jest.fn(),
			getTerminalBuffer: jest.fn(),
			getSessionOrThrow: jest.fn(),
			backend: {},
		} as any;

		service = new GeminiRuntimeService(mockSessionHelper, '/test/project');
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('getRuntimeType', () => {
		it('should return GEMINI_CLI runtime type', () => {
			expect(service['getRuntimeType']()).toBe(RUNTIME_TYPES.GEMINI_CLI);
		});
	});

	describe('detectRuntimeSpecific', () => {
		it('should detect Gemini when output length increases significantly after / key', async () => {
			mockSessionHelper.capturePane
				.mockReturnValueOnce('before output')
				.mockReturnValueOnce('before output with much more content added');

			const promise = service['detectRuntimeSpecific']('test-session');
			await jest.advanceTimersByTimeAsync(10000);
			const result = await promise;

			expect(result).toBe(true);
			// No clearCurrentCommandLine — Ctrl+C triggers /quit, Escape defocuses TUI
			expect(mockSessionHelper.clearCurrentCommandLine).not.toHaveBeenCalled();
			expect(mockSessionHelper.sendKey).toHaveBeenCalledWith('test-session', '/');
			// Cleanup uses Backspace (safe in TUI)
			expect(mockSessionHelper.sendKey).toHaveBeenCalledWith('test-session', 'Backspace');
		});

		it('should not detect Gemini when output length stays the same', async () => {
			mockSessionHelper.capturePane
				.mockReturnValueOnce('before output')
				.mockReturnValueOnce('before output');

			const promise = service['detectRuntimeSpecific']('test-session');
			await jest.advanceTimersByTimeAsync(10000);
			const result = await promise;

			expect(result).toBe(false);
		});

		it('should not detect Gemini when output increase is small (<=5 chars)', async () => {
			mockSessionHelper.capturePane
				.mockReturnValueOnce('before')
				.mockReturnValueOnce('before/');

			const promise = service['detectRuntimeSpecific']('test-session');
			await jest.advanceTimersByTimeAsync(10000);
			const result = await promise;

			expect(result).toBe(false);
		});

		it('should clean up with Backspace after detection (not clearCurrentCommandLine)', async () => {
			mockSessionHelper.capturePane
				.mockReturnValueOnce('before')
				.mockReturnValueOnce('before with more content added');

			const promise = service['detectRuntimeSpecific']('test-session');
			await jest.advanceTimersByTimeAsync(10000);
			await promise;

			// No clearCurrentCommandLine — Ctrl+C triggers /quit, Escape defocuses TUI
			expect(mockSessionHelper.clearCurrentCommandLine).not.toHaveBeenCalled();
			// Backspace cleans up the '/' character safely in the TUI
			expect(mockSessionHelper.sendKey).toHaveBeenCalledWith('test-session', 'Backspace');
		});
	});

	describe('getRuntimeReadyPatterns', () => {
		it('should return Gemini-specific ready patterns', () => {
			const patterns = service['getRuntimeReadyPatterns']();

			expect(patterns).toContain('gemini>');
			expect(patterns).toContain('Ready for input');
			expect(patterns).toContain('Type your message');
			expect(patterns).toContain('shell mode');
			expect(patterns).toContain('context left)');
		});
	});

	describe('getRuntimeErrorPatterns', () => {
		it('should return Gemini-specific error patterns', () => {
			const patterns = service['getRuntimeErrorPatterns']();

			expect(patterns).toContain('command not found: gemini');
			expect(patterns).toContain('API key not found');
			expect(patterns).toContain('Authentication failed');
			expect(patterns).toContain('Invalid API key');
			expect(patterns).toContain('Rate limit exceeded');
		});

		it('should include common error patterns', () => {
			const patterns = service['getRuntimeErrorPatterns']();

			expect(patterns).toContain('Permission denied');
			expect(patterns).toContain('No such file or directory');
		});
	});

	describe('postInitialize', () => {
		it('should add ~/.crewly to Gemini CLI directory allowlist', async () => {
			const expectedPath = path.join(os.homedir(), CREWLY_CONSTANTS.PATHS.CREWLY_HOME);

			// Mock capturePane to return different values (simulating output change)
			// so addProjectToAllowlist succeeds on first attempt
			let captureCallCount = 0;
			mockSessionHelper.capturePane.mockImplementation(() => {
				captureCallCount++;
				return captureCallCount % 2 === 1 ? 'before' : 'before\n✓ Directory added';
			});

			const promise = service.postInitialize('test-session');
			await jest.advanceTimersByTimeAsync(20000);
			await promise;

			// Should send /directory add command for ~/.crewly (trailing space for path delimiter)
			expect(mockSessionHelper.sendMessage).toHaveBeenCalledWith(
				'test-session',
				`/directory add ${expectedPath} `
			);
		});

		it('should not throw when addProjectToAllowlist fails', async () => {
			mockSessionHelper.sendMessage.mockRejectedValue(new Error('Connection failed'));

			const promise = service.postInitialize('test-session');
			await jest.advanceTimersByTimeAsync(60000);

			// Should not throw — errors are handled gracefully
			await expect(promise).resolves.not.toThrow();
		});
	});

	describe('addProjectToAllowlist', () => {
		it('should successfully add a project when output changes on first attempt', async () => {
			const sessionName = 'test-session';
			const projectPath = '/path/to/project';

			// Mock capturePane: first call (before) returns one value,
			// second call (after) returns a different value (simulating confirmation)
			let captureCallCount = 0;
			mockSessionHelper.capturePane.mockImplementation(() => {
				captureCallCount++;
				return captureCallCount % 2 === 1 ? 'before' : 'before\n✓ Added directory';
			});

			const promise = service.addProjectToAllowlist(sessionName, projectPath);
			await jest.advanceTimersByTimeAsync(10000);
			const result = await promise;

			expect(result.success).toBe(true);
			expect(result.message).toBe(`Project path ${projectPath} added to Gemini CLI allowlist`);

			// Should send Enter first (wake-up) then the command
			expect(mockSessionHelper.sendEnter).toHaveBeenCalledWith(sessionName);
			// No Escape — defocuses Ink TUI input permanently
			expect(mockSessionHelper.sendEscape).not.toHaveBeenCalled();
			expect(mockSessionHelper.sendMessage).toHaveBeenCalledWith(
				sessionName,
				`/directory add ${projectPath} `
			);
		});

		it('should retry when output does not change', async () => {
			const sessionName = 'test-session';
			const projectPath = '/path/to/project';

			// Mock capturePane: return same value for first 2 attempts (2 before + 2 after),
			// then different value on 3rd attempt (success)
			let captureCallCount = 0;
			mockSessionHelper.capturePane.mockImplementation(() => {
				captureCallCount++;
				// Calls 1-4 (attempts 1-2 before/after): same value → retry
				// Calls 5 (attempt 3 before): 'before'
				// Call 6 (attempt 3 after): different value → success
				if (captureCallCount <= 4) return 'same output';
				if (captureCallCount === 5) return 'before';
				return 'before\n✓ Added directory';
			});

			const promise = service.addProjectToAllowlist(sessionName, projectPath);
			await jest.advanceTimersByTimeAsync(30000);
			const result = await promise;

			expect(result.success).toBe(true);
			// sendMessage called 3 times (3 attempts)
			expect(mockSessionHelper.sendMessage).toHaveBeenCalledTimes(3);
		});

		it('should handle errors gracefully after all retries', async () => {
			const sessionName = 'test-session';
			const projectPath = '/path/to/project';

			mockSessionHelper.sendMessage.mockRejectedValue(new Error('Connection failed'));

			const promise = service.addProjectToAllowlist(sessionName, projectPath);
			await jest.advanceTimersByTimeAsync(60000);
			const result = await promise;

			expect(result.success).toBe(false);
			expect(result.message).toContain('Failed to add project path to allowlist');
		});
	});

	describe('addMultipleProjectsToAllowlist', () => {
		it('should successfully add multiple projects to allowlist', async () => {
			const sessionName = 'test-session';
			const projectPaths = ['/path/to/project1', '/path/to/project2'];

			// Mock capturePane to always show change (success on first attempt)
			let captureCallCount = 0;
			mockSessionHelper.capturePane.mockImplementation(() => {
				captureCallCount++;
				return captureCallCount % 2 === 1 ? 'before' : 'before\n✓ Added';
			});

			const promise = service.addMultipleProjectsToAllowlist(sessionName, projectPaths);
			await jest.advanceTimersByTimeAsync(30000);
			const result = await promise;

			expect(result.success).toBe(true);
			expect(result.message).toBe('Added 2/2 projects to Gemini CLI allowlist');
			expect(result.results).toHaveLength(2);
			expect(result.results.every((r) => r.success)).toBe(true);
		});

		it('should handle partial failures gracefully', async () => {
			const sessionName = 'test-session';
			const projectPaths = ['/path/to/project1', '/path/to/project2'];

			// First addProjectToAllowlist call succeeds (output changes),
			// second call fails (sendMessage throws on later calls)
			let captureCallCount = 0;
			mockSessionHelper.capturePane.mockImplementation(() => {
				captureCallCount++;
				return captureCallCount % 2 === 1 ? 'before' : 'before\n✓ Added';
			});

			let sendMessageCallCount = 0;
			mockSessionHelper.sendMessage.mockImplementation(async () => {
				sendMessageCallCount++;
				// First call (project1 /directory add) succeeds
				// Subsequent calls for project2 all fail (3 retries)
				if (sendMessageCallCount > 1) {
					throw new Error('Failed for project2');
				}
			});

			const promise = service.addMultipleProjectsToAllowlist(sessionName, projectPaths);
			await jest.advanceTimersByTimeAsync(60000);
			const result = await promise;

			expect(result.success).toBe(true); // At least one succeeded
			expect(result.results[0].success).toBe(true);
			expect(result.results[1].success).toBe(false);
		});

		it('should return success false when no projects can be added', async () => {
			const sessionName = 'test-session';
			const projectPaths = ['/path/to/project1'];

			mockSessionHelper.sendMessage.mockRejectedValue(new Error('Connection failed'));

			const promise = service.addMultipleProjectsToAllowlist(sessionName, projectPaths);
			await jest.advanceTimersByTimeAsync(60000);
			const result = await promise;

			expect(result.success).toBe(false);
			expect(result.message).toBe('Added 0/1 projects to Gemini CLI allowlist');
		});
	});

	describe('getRuntimeExitPatterns', () => {
		it('should return Gemini-specific exit and failure patterns', () => {
			const patterns = service['getRuntimeExitPatterns']();
			expect(patterns).toHaveLength(7);
			// Clean exit patterns
			expect(patterns[0].test('Agent powering down')).toBe(true);
			expect(patterns[1].test('Interaction Summary')).toBe(true);
			// Gemini failure patterns
			expect(patterns.some(p => p.test('Request cancelled'))).toBe(true);
			expect(patterns.some(p => p.test('Error: something went wrong'))).toBe(true);
			expect(patterns.some(p => p.test('RESOURCE_EXHAUSTED'))).toBe(true);
			expect(patterns.some(p => p.test('UNAVAILABLE'))).toBe(true);
			expect(patterns.some(p => p.test('Connection error'))).toBe(true);
		});

		it('should not match unrelated text', () => {
			const patterns = service['getRuntimeExitPatterns']();
			expect(patterns.some(p => p.test('Type your message'))).toBe(false);
		});

		it('should match Error: only at start of line', () => {
			const patterns = service['getRuntimeExitPatterns']();
			// Should match at start of line
			expect(patterns.some(p => p.test('Error: API failed'))).toBe(true);
			// Should match at start of line within multiline string
			expect(patterns.some(p => p.test('some output\nError: something'))).toBe(true);
			// Should NOT match Error: in the middle of a line
			expect(patterns.some(p => p.test('Got an Error: in the middle'))).toBe(false);
		});
	});

	describe('getExitPatterns', () => {
		it('should expose exit patterns via public accessor', () => {
			const patterns = service.getExitPatterns();
			expect(patterns).toHaveLength(7);
		});
	});

	describe('checkGeminiInstallation', () => {
		it('should report Gemini CLI as available', async () => {
			const result = await service.checkGeminiInstallation();

			expect(result.isInstalled).toBe(true);
			expect(result.message).toBe('Gemini CLI is available');
		});
	});

	describe('initializeGeminiInSession', () => {
		it('should call executeRuntimeInitScript', async () => {
			const spy = jest.spyOn(service, 'executeRuntimeInitScript').mockResolvedValue(undefined);

			const result = await service.initializeGeminiInSession('test-session');

			expect(result.success).toBe(true);
			expect(spy).toHaveBeenCalledWith('test-session');
		});

		it('should handle initialization errors gracefully', async () => {
			jest.spyOn(service, 'executeRuntimeInitScript').mockRejectedValue(
				new Error('Init failed')
			);

			const result = await service.initializeGeminiInSession('test-session');

			expect(result.success).toBe(false);
			expect(result.message).toBe('Init failed');
		});
	});

	describe('ensureGeminiMcpConfig', () => {
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

		it('should create .gemini/settings.json with playwright when it does not exist', async () => {
			mockSafeReadJson.mockResolvedValue({});

			await service.ensureGeminiMcpConfig('/test/project');

			expect(mockMkdir).toHaveBeenCalledWith(
				path.join('/test/project', '.gemini'),
				{ recursive: true }
			);
			expect(mockAtomicWriteJson).toHaveBeenCalledWith(
				path.join('/test/project', '.gemini', 'settings.json'),
				{
					mcpServers: {
						playwright: {
							command: 'npx',
							args: ['@playwright/mcp@latest', '--headless'],
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

			await service.ensureGeminiMcpConfig('/test/project');

			expect(mockAtomicWriteJson).toHaveBeenCalledWith(
				path.join('/test/project', '.gemini', 'settings.json'),
				{
					mcpServers: {
						'my-custom-server': { command: 'node', args: ['server.js'] },
						playwright: {
							command: 'npx',
							args: ['@playwright/mcp@latest', '--headless'],
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

			await service.ensureGeminiMcpConfig('/test/project');

			expect(mockAtomicWriteJson).toHaveBeenCalledWith(
				path.join('/test/project', '.gemini', 'settings.json'),
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

			await service.ensureGeminiMcpConfig('/test/project');

			// Should not write anything since no servers are needed
			expect(mockAtomicWriteJson).not.toHaveBeenCalled();
			expect(mockMkdir).not.toHaveBeenCalled();
		});

		it('should default to enabled when settings service is unavailable', async () => {
			mockGetSettingsService.mockReturnValue({
				getSettings: jest.fn().mockRejectedValue(new Error('Settings unavailable')),
			} as any);

			await service.ensureGeminiMcpConfig('/test/project');

			// Should still add playwright (default to enabled)
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
			mockMkdir.mockRejectedValue(new Error('Permission denied'));

			// Should not throw — errors are handled gracefully
			await expect(service.ensureGeminiMcpConfig('/test/project')).resolves.not.toThrow();
		});
	});

	describe('ensureGeminiEnvFile', () => {
		const mockExistsSync = fsModule.existsSync as jest.MockedFunction<typeof fsModule.existsSync>;
		const mockReadFileSync = fsModule.readFileSync as jest.MockedFunction<typeof fsModule.readFileSync>;
		const mockWriteFileSync = fsModule.writeFileSync as jest.MockedFunction<typeof fsModule.writeFileSync>;
		const mockAppendFileSync = fsModule.appendFileSync as jest.MockedFunction<typeof fsModule.appendFileSync>;

		const projectPath = '/test/project';
		const envPath = path.join(projectPath, '.env');
		const gitignorePath = path.join(projectPath, '.gitignore');

		let originalEnv: string | undefined;

		beforeEach(() => {
			jest.clearAllMocks();
			originalEnv = process.env.GOOGLE_GENAI_API_KEY;
			// Default: set the env var so most tests can focus on file behavior
			process.env.GOOGLE_GENAI_API_KEY = 'test-api-key-123';

			// Default mocks: .env does not exist, .gitignore does not exist
			mockExistsSync.mockReturnValue(false);
			mockReadFileSync.mockReturnValue('');
			mockWriteFileSync.mockReturnValue(undefined);
			mockAppendFileSync.mockReturnValue(undefined);
		});

		afterEach(() => {
			// Restore original env
			if (originalEnv !== undefined) {
				process.env.GOOGLE_GENAI_API_KEY = originalEnv;
			} else {
				delete process.env.GOOGLE_GENAI_API_KEY;
			}
		});

		it('should skip when GOOGLE_GENAI_API_KEY is not in process.env', async () => {
			delete process.env.GOOGLE_GENAI_API_KEY;

			await service['ensureGeminiEnvFile'](projectPath);

			// Should not attempt any file operations
			expect(mockExistsSync).not.toHaveBeenCalled();
			expect(mockReadFileSync).not.toHaveBeenCalled();
			expect(mockWriteFileSync).not.toHaveBeenCalled();
			expect(mockAppendFileSync).not.toHaveBeenCalled();
		});

		it('should skip when .env already contains the key', async () => {
			mockExistsSync.mockImplementation((p) => {
				if (p === envPath) return true;
				return false;
			});
			mockReadFileSync.mockImplementation((p) => {
				if (p === envPath) return 'SOME_VAR=abc\nGOOGLE_GENAI_API_KEY=existing-key\n';
				return '';
			});

			await service['ensureGeminiEnvFile'](projectPath);

			// Should check existence and read the file but not write
			expect(mockExistsSync).toHaveBeenCalledWith(envPath);
			expect(mockReadFileSync).toHaveBeenCalledWith(envPath, 'utf8');
			expect(mockWriteFileSync).not.toHaveBeenCalled();
			expect(mockAppendFileSync).not.toHaveBeenCalled();
		});

		it('should append key to existing .env file that lacks it', async () => {
			mockExistsSync.mockImplementation((p) => {
				if (p === envPath) return true;
				if (p === gitignorePath) return false;
				return false;
			});
			mockReadFileSync.mockImplementation((p) => {
				if (p === envPath) return 'SOME_VAR=abc\n';
				return '';
			});

			await service['ensureGeminiEnvFile'](projectPath);

			// Should append to existing .env (content ends with newline, so no extra separator)
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				envPath,
				'GOOGLE_GENAI_API_KEY=test-api-key-123\n'
			);
			// Should not create a new file
			expect(mockWriteFileSync).not.toHaveBeenCalledWith(
				envPath,
				expect.anything()
			);
		});

		it('should append with newline separator when existing .env does not end with newline', async () => {
			mockExistsSync.mockImplementation((p) => {
				if (p === envPath) return true;
				if (p === gitignorePath) return false;
				return false;
			});
			mockReadFileSync.mockImplementation((p) => {
				if (p === envPath) return 'SOME_VAR=abc'; // no trailing newline
				return '';
			});

			await service['ensureGeminiEnvFile'](projectPath);

			// Should prepend a newline separator before the key
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				envPath,
				'\nGOOGLE_GENAI_API_KEY=test-api-key-123\n'
			);
		});

		it('should create new .env file when it does not exist', async () => {
			mockExistsSync.mockImplementation((p) => {
				if (p === envPath) return false;
				if (p === gitignorePath) return false;
				return false;
			});

			await service['ensureGeminiEnvFile'](projectPath);

			// Should create .env with writeFileSync
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				envPath,
				'GOOGLE_GENAI_API_KEY=test-api-key-123\n'
			);
			// Should not attempt to append
			expect(mockAppendFileSync).not.toHaveBeenCalledWith(
				envPath,
				expect.anything()
			);
		});

		it('should add .env to .gitignore if not present', async () => {
			mockExistsSync.mockImplementation((p) => {
				if (p === envPath) return false;
				if (p === gitignorePath) return true;
				return false;
			});
			mockReadFileSync.mockImplementation((p) => {
				if (p === gitignorePath) return 'node_modules/\ndist/\n';
				return '';
			});

			await service['ensureGeminiEnvFile'](projectPath);

			// Should create .env
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				envPath,
				'GOOGLE_GENAI_API_KEY=test-api-key-123\n'
			);

			// Should append .env entry to .gitignore
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				gitignorePath,
				'.env\n'
			);
		});

		it('should create .gitignore with .env entry when .gitignore does not exist', async () => {
			mockExistsSync.mockReturnValue(false);

			await service['ensureGeminiEnvFile'](projectPath);

			// Should create .gitignore with .env entry
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				gitignorePath,
				'.env\n'
			);
		});

		it('should not modify .gitignore if .env is already listed', async () => {
			mockExistsSync.mockImplementation((p) => {
				if (p === envPath) return false;
				if (p === gitignorePath) return true;
				return false;
			});
			mockReadFileSync.mockImplementation((p) => {
				if (p === gitignorePath) return 'node_modules/\n.env\ndist/\n';
				return '';
			});

			await service['ensureGeminiEnvFile'](projectPath);

			// Should create .env
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				envPath,
				'GOOGLE_GENAI_API_KEY=test-api-key-123\n'
			);

			// Should NOT append to .gitignore since .env is already there
			expect(mockAppendFileSync).not.toHaveBeenCalledWith(
				gitignorePath,
				expect.anything()
			);
			// Should NOT write a new .gitignore
			expect(mockWriteFileSync).not.toHaveBeenCalledWith(
				gitignorePath,
				expect.anything()
			);
		});

		it('should handle errors gracefully when writing .env fails', async () => {
			mockExistsSync.mockReturnValue(false);
			mockWriteFileSync.mockImplementation((p) => {
				if (p === envPath) {
					throw new Error('Permission denied');
				}
			});

			// Should not throw
			await expect(service['ensureGeminiEnvFile'](projectPath)).resolves.not.toThrow();

			// Should have attempted to write .env
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				envPath,
				'GOOGLE_GENAI_API_KEY=test-api-key-123\n'
			);
		});

		it('should handle errors gracefully when updating .gitignore fails', async () => {
			// .env does not exist, .gitignore exists but reading it throws
			mockExistsSync.mockImplementation((p) => {
				if (p === envPath) return false;
				if (p === gitignorePath) return true;
				return false;
			});
			mockReadFileSync.mockImplementation((p) => {
				if (p === gitignorePath) {
					throw new Error('Read error');
				}
				return '';
			});

			// Should not throw — gitignore errors are caught separately
			await expect(service['ensureGeminiEnvFile'](projectPath)).resolves.not.toThrow();

			// Should still have created the .env file
			expect(mockWriteFileSync).toHaveBeenCalledWith(
				envPath,
				'GOOGLE_GENAI_API_KEY=test-api-key-123\n'
			);
		});
	});

	describe('GEMINI_FAILURE_PATTERNS', () => {
		it('should export failure patterns as a constant array', () => {
			expect(GEMINI_FAILURE_PATTERNS).toBeInstanceOf(Array);
			expect(GEMINI_FAILURE_PATTERNS.length).toBe(5);
		});

		it('should contain expected failure patterns', () => {
			expect(GEMINI_FAILURE_PATTERNS.some(p => p.test('Request cancelled'))).toBe(true);
			expect(GEMINI_FAILURE_PATTERNS.some(p => p.test('RESOURCE_EXHAUSTED'))).toBe(true);
			expect(GEMINI_FAILURE_PATTERNS.some(p => p.test('UNAVAILABLE'))).toBe(true);
			expect(GEMINI_FAILURE_PATTERNS.some(p => p.test('Connection error'))).toBe(true);
			expect(GEMINI_FAILURE_PATTERNS.some(p => p.test('Error: something'))).toBe(true);
		});

		it('should not match normal output', () => {
			expect(GEMINI_FAILURE_PATTERNS.some(p => p.test('Working on task'))).toBe(false);
			expect(GEMINI_FAILURE_PATTERNS.some(p => p.test('Type your message'))).toBe(false);
		});
	});

});
