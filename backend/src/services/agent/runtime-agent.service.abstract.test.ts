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
		it('should execute initialization script', async () => {
			mockTmuxCommandService.executeScript.mockResolvedValue();
			
			await service.executeRuntimeInitScript('test-session', '/target/path');
			
			expect(mockTmuxCommandService.executeScript).toHaveBeenCalled();
		});

		it('should handle script execution with default path', async () => {
			mockTmuxCommandService.executeScript.mockResolvedValue();
			
			await service.executeRuntimeInitScript('test-session');
			
			expect(mockTmuxCommandService.executeScript).toHaveBeenCalled();
		});
	});

	describe('loadRuntimeConfig', () => {
		it('should load runtime config from file system', async () => {
			// Mock fs.readFile to return config
			jest.doMock('fs/promises', () => ({
				readFile: jest.fn().mockResolvedValue(JSON.stringify({
					displayName: 'Test Runtime',
					initScript: 'test-init.sh',
					welcomeMessage: 'Welcome to Test',
					timeout: 30000,
					description: 'Test runtime description'
				}))
			}));

			const config = await service['loadRuntimeConfig']();
			
			expect(config).toEqual({
				displayName: 'Test Runtime',
				initScript: 'test-init.sh',
				welcomeMessage: 'Welcome to Test',
				timeout: 30000,
				description: 'Test runtime description'
			});
		});

		it('should return default config when file not found', async () => {
			jest.doMock('fs/promises', () => ({
				readFile: jest.fn().mockRejectedValue(new Error('File not found'))
			}));

			const config = await service['loadRuntimeConfig']();
			
			expect(config.displayName).toContain('claude-code'); // Should contain runtime type
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