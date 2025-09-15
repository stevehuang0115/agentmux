import { RuntimeAgentService } from './runtime-agent.service.abstract.js';
import { TmuxCommandService } from './tmux-command.service.js';
import { RUNTIME_TYPES, type RuntimeType } from '../../constants.js';

// Test implementation of abstract class
class TestRuntimeService extends RuntimeAgentService {
	constructor(tmuxCommandService: TmuxCommandService, projectRoot: string) {
		super(tmuxCommandService, projectRoot);
	}

	protected getRuntimeType(): RuntimeType {
		return RUNTIME_TYPES.CLAUDE_CODE;
	}

	protected async detectRuntimeSpecific(sessionName: string): Promise<boolean> {
		return sessionName === 'test-session-running';
	}

	protected getRuntimeReadyPatterns(): string[] {
		return ['Ready', 'Welcome'];
	}

	protected getRuntimeErrorPatterns(): string[] {
		return ['Error', 'Failed'];
	}
}

describe('RuntimeAgentService (Abstract)', () => {
	let service: TestRuntimeService;
	let mockTmuxCommandService: jest.Mocked<TmuxCommandService>;

	beforeEach(() => {
		mockTmuxCommandService = {
			capturePane: jest.fn(),
			sendKey: jest.fn(),
			sendEnter: jest.fn(),
			sendCtrlC: jest.fn(),
			executeScript: jest.fn(),
		} as any;

		service = new TestRuntimeService(mockTmuxCommandService, '/test/project');
	});

	describe('constructor', () => {
		it('should initialize with tmux command service and project root', () => {
			expect(service['tmuxCommand']).toBe(mockTmuxCommandService);
			expect(service['projectRoot']).toBe('/test/project');
			expect(service['logger']).toBeDefined();
		});

		it('should initialize detection state maps', () => {
			expect(service['detectionInProgress']).toBeInstanceOf(Map);
			expect(service['detectionResults']).toBeInstanceOf(Map);
		});
	});

	describe('detectRuntimeWithCommand', () => {
		it('should return true for running runtime session', async () => {
			const result = await service.detectRuntimeWithCommand('test-session-running');
			expect(result).toBe(true);
		});

		it('should return false for non-running runtime session', async () => {
			const result = await service.detectRuntimeWithCommand('test-session-stopped');
			expect(result).toBe(false);
		});

		it('should use cached results within cache timeout', async () => {
			// First call
			await service.detectRuntimeWithCommand('test-session-running');
			
			// Mock the concrete implementation to return different value
			const spy = jest.spyOn(service as any, 'detectRuntimeSpecific');
			spy.mockResolvedValue(false);

			// Second call should use cache (not call detectRuntimeSpecific again)
			const result = await service.detectRuntimeWithCommand('test-session-running');
			
			expect(result).toBe(true); // Should still be true from cache
		});

		it('should not run concurrent detections for same session', async () => {
			const spy = jest.spyOn(service as any, 'detectRuntimeSpecific');
			spy.mockImplementation(async () => {
				await new Promise(resolve => setTimeout(resolve, 100));
				return true;
			});

			// Start two concurrent detections
			const promise1 = service.detectRuntimeWithCommand('test-session');
			const promise2 = service.detectRuntimeWithCommand('test-session');

			const [result1, result2] = await Promise.all([promise1, promise2]);

			// Should only call detectRuntimeSpecific once due to concurrency protection
			expect(spy).toHaveBeenCalledTimes(1);
			expect(result1).toBe(true);
			expect(result2).toBe(true);
		});
	});

	describe('clearDetectionCache', () => {
		it('should clear cached detection result for session', async () => {
			// First call to cache result
			await service.detectRuntimeWithCommand('test-session-running');
			
			// Clear cache
			service.clearDetectionCache('test-session-running');
			
			// Mock to return different value
			const spy = jest.spyOn(service as any, 'detectRuntimeSpecific');
			spy.mockResolvedValue(false);

			// Should call detectRuntimeSpecific again since cache was cleared
			const result = await service.detectRuntimeWithCommand('test-session-running');
			expect(result).toBe(false);
			expect(spy).toHaveBeenCalled();
		});
	});

	describe('waitForRuntimeReady', () => {
		it('should return true when ready pattern is found', async () => {
			mockTmuxCommandService.capturePane.mockResolvedValue('Welcome to the system');

			const result = await service['waitForRuntimeReady']('test-session', 1000);
			
			expect(result).toBe(true);
		});

		it('should return false when error pattern is found', async () => {
			mockTmuxCommandService.capturePane.mockResolvedValue('Error: Failed to start');

			const result = await service['waitForRuntimeReady']('test-session', 1000);
			
			expect(result).toBe(false);
		});

		it('should return false when timeout is reached', async () => {
			mockTmuxCommandService.capturePane.mockResolvedValue('Loading...');

			const result = await service['waitForRuntimeReady']('test-session', 100);
			
			expect(result).toBe(false);
		});
	});

	describe('executeRuntimeInitScript', () => {
		it('should handle script execution method existence', async () => {
			// Test that the method exists and can be called
			expect(typeof service.executeRuntimeInitScript).toBe('function');
		});

		it('should handle script execution with different target paths', async () => {
			// Test that the method exists and can be called with different parameters
			const result = service.executeRuntimeInitScript('test-session', '/target/path');
			expect(result).toBeDefined();
		});
	});

	describe('runtime configuration', () => {
		it('should have access to runtime configuration', () => {
			// Test that the service has runtime configuration properties
			expect(service['getRuntimeType']()).toBe(RUNTIME_TYPES.CLAUDE_CODE);
		});

		it('should handle runtime configuration initialization', () => {
			// Test that runtime type is properly set during construction
			const runtimeType = service['getRuntimeType']();
			expect(runtimeType).toBeDefined();
			expect(typeof runtimeType).toBe('string');
		});
	});

	describe('script path resolution', () => {
		const mockReadFile = jest.fn();

		beforeEach(() => {
			jest.doMock('fs/promises', () => ({
				readFile: mockReadFile
			}));
		});

		afterEach(() => {
			mockReadFile.mockReset();
			jest.resetModules();
		});

		it('should construct correct path for initialization scripts in runtime_scripts directory', async () => {
			const scriptContent = 'echo "test command"\necho "another command"';
			mockReadFile.mockResolvedValue(scriptContent);

			const projectRoot = '/test/project';
			const testService = new TestRuntimeService(mockTmuxCommandService, projectRoot);

			const commands = await testService['loadInitScript']('initialize_gemini.sh');

			// Verify readFile was called with correct path including runtime_scripts directory
			expect(mockReadFile).toHaveBeenCalledWith(
				'/test/project/config/runtime_scripts/initialize_gemini.sh',
				'utf8'
			);
			expect(commands).toEqual(['echo "test command"', 'echo "another command"']);
		});

		it('should construct correct path for claude initialization script', async () => {
			const scriptContent = 'claude --version\necho "Claude ready"';
			mockReadFile.mockResolvedValue(scriptContent);

			const projectRoot = '/test/project';
			const testService = new TestRuntimeService(mockTmuxCommandService, projectRoot);

			await testService['loadInitScript']('initialize_claude.sh');

			expect(mockReadFile).toHaveBeenCalledWith(
				'/test/project/config/runtime_scripts/initialize_claude.sh',
				'utf8'
			);
		});

		it('should construct correct path for codex initialization script', async () => {
			const scriptContent = 'codex --help';
			mockReadFile.mockResolvedValue(scriptContent);

			const projectRoot = '/test/project';
			const testService = new TestRuntimeService(mockTmuxCommandService, projectRoot);

			await testService['loadInitScript']('initialize_codex.sh');

			expect(mockReadFile).toHaveBeenCalledWith(
				'/test/project/config/runtime_scripts/initialize_codex.sh',
				'utf8'
			);
		});

		it('should filter out empty lines and comments from script', async () => {
			const scriptContent = `
# This is a comment
echo "first command"

# Another comment
echo "second command"

`;
			mockReadFile.mockResolvedValue(scriptContent);

			const projectRoot = '/test/project';
			const testService = new TestRuntimeService(mockTmuxCommandService, projectRoot);

			const commands = await testService['loadInitScript']('test_script.sh');

			expect(commands).toEqual(['echo "first command"', 'echo "second command"']);
		});
	});

	describe('abstract method implementations', () => {
		it('getRuntimeType should return correct runtime type', () => {
			expect(service['getRuntimeType']()).toBe(RUNTIME_TYPES.CLAUDE_CODE);
		});

		it('getRuntimeReadyPatterns should return array of patterns', () => {
			const patterns = service['getRuntimeReadyPatterns']();
			expect(patterns).toEqual(['Ready', 'Welcome']);
		});

		it('getRuntimeErrorPatterns should return array of error patterns', () => {
			const patterns = service['getRuntimeErrorPatterns']();
			expect(patterns).toEqual(['Error', 'Failed']);
		});
	});
});