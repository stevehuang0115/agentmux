import { TmuxCommandService } from './tmux-command.service.js';
import { LoggerService } from '../core/logger.service.js';

// Mock LoggerService and its methods
jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: jest.fn().mockReturnValue({
			createComponentLogger: jest.fn().mockReturnValue({
				info: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			}),
		}),
	},
}));

// Mock child_process spawn
jest.mock('child_process', () => ({
	spawn: jest.fn(),
}));

describe('TmuxCommandService', () => {
	let service: TmuxCommandService;
	let mockSpawn: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		service = new TmuxCommandService();
		mockSpawn = require('child_process').spawn;
	});

	describe('constructor', () => {
		it('should create logger instance', () => {
			expect(LoggerService.getInstance).toHaveBeenCalled();
		});
	});

	describe('sessionExists', () => {
		it('should return true when session exists', async () => {
			// Mock list-sessions command to return session data including test-session
			mockSpawn.mockImplementation((command, args) => {
				if (args[0] === '-c' && args[1].includes('list-sessions')) {
					return {
						stdout: { 
							on: jest.fn().mockImplementation((event, callback) => {
								if (event === 'data') {
									callback('test-session:1234567890:1:2\nother-session:1234567891:0:1\n');
								}
							})
						},
						stderr: { on: jest.fn() },
						on: jest.fn().mockImplementation((event, callback) => {
							if (event === 'close') {
								callback(0); // Success exit code
							}
						}),
					};
				}
				return {
					stdout: { on: jest.fn() },
					stderr: { on: jest.fn() },
					on: jest.fn().mockImplementation((event, callback) => {
						if (event === 'close') {
							callback(0);
						}
					}),
				};
			});

			const result = await service.sessionExists('test-session');
			expect(result).toBe(true);
		});

		it('should return false when session does not exist', async () => {
			// Mock list-sessions command to return session data without nonexistent-session
			mockSpawn.mockImplementation((command, args) => {
				if (args[0] === '-c' && args[1].includes('list-sessions')) {
					return {
						stdout: { 
							on: jest.fn().mockImplementation((event, callback) => {
								if (event === 'data') {
									callback('other-session:1234567891:0:1\n');
								}
							})
						},
						stderr: { on: jest.fn() },
						on: jest.fn().mockImplementation((event, callback) => {
							if (event === 'close') {
								callback(0); // Success exit code
							}
						}),
					};
				}
				return {
					stdout: { on: jest.fn() },
					stderr: { on: jest.fn() },
					on: jest.fn().mockImplementation((event, callback) => {
						if (event === 'close') {
							callback(0);
						}
					}),
				};
			});

			const result = await service.sessionExists('nonexistent-session');
			expect(result).toBe(false);
		});
	});

	describe('sendKey', () => {
		it('should send key successfully', async () => {
			mockSpawn.mockImplementation(() => ({
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'close') {
						callback(0); // Success exit code
					}
				}),
			}));

			await expect(service.sendKey('test-session', 'Enter')).resolves.not.toThrow();
		});

		it('should handle errors when sending key fails', async () => {
			mockSpawn.mockImplementation(() => ({
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'data') {
						callback('Error message');
					}
				}) },
				on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'close') {
						callback(1); // Error exit code
					}
				}),
			}));

			await expect(service.sendKey('test-session', 'Enter')).rejects.toThrow();
		});
	});

	describe('capturePane', () => {
		it('should return captured output', async () => {
			const mockOutput = 'test output\nmore output';
			mockSpawn.mockImplementation((command, args) => {
				if (args[0] === '-c' && args[1].includes('list-sessions')) {
					// Mock list-sessions to show test-session exists
					return {
						stdout: { 
							on: jest.fn().mockImplementation((event, callback) => {
								if (event === 'data') {
									callback('test-session:1234567890:1:2\n');
								}
							})
						},
						stderr: { on: jest.fn() },
						on: jest.fn().mockImplementation((event, callback) => {
							if (event === 'close') {
								callback(0);
							}
						}),
					};
				} else if (args[0] === '-c' && args[1].includes('capture-pane')) {
					// Mock capture-pane output
					return {
						stdout: { 
							on: jest.fn().mockImplementation((event, callback) => {
								if (event === 'data') {
									callback(mockOutput);
								}
							})
						},
						stderr: { on: jest.fn() },
						on: jest.fn().mockImplementation((event, callback) => {
							if (event === 'close') {
								callback(0);
							}
						}),
					};
				}
				return {
					stdout: { on: jest.fn() },
					stderr: { on: jest.fn() },
					on: jest.fn().mockImplementation((event, callback) => {
						if (event === 'close') {
							callback(0);
						}
					}),
				};
			});

			const result = await service.capturePane('test-session', 10);
			expect(result).toBe(mockOutput);
		});

		it('should return empty string for non-existent session', async () => {
			// Mock list-sessions to return empty result (session doesn't exist)
			mockSpawn.mockImplementation((command, args) => {
				if (args[0] === '-c' && args[1].includes('list-sessions')) {
					return {
						stdout: { 
							on: jest.fn().mockImplementation((event, callback) => {
								if (event === 'data') {
									callback(''); // No sessions
								}
							})
						},
						stderr: { on: jest.fn() },
						on: jest.fn().mockImplementation((event, callback) => {
							if (event === 'close') {
								callback(0);
							}
						}),
					};
				}
				return {
					stdout: { on: jest.fn() },
					stderr: { on: jest.fn() },
					on: jest.fn().mockImplementation((event, callback) => {
						if (event === 'close') {
							callback(0);
						}
					}),
				};
			});

			const result = await service.capturePane('nonexistent-session', 10);
			expect(result).toBe('');
		});
	});

	describe('createSession', () => {
		it('should create session successfully', async () => {
			mockSpawn.mockImplementation(() => ({
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'close') {
						callback(0); // Success exit code
					}
				}),
			}));

			await expect(
				service.createSession('test-session', '/tmp', 'test-window')
			).resolves.not.toThrow();
		});

		it('should include configured shell in tmux command', async () => {
			mockSpawn.mockImplementation(() => ({
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'close') {
						callback(0); // Success exit code
					}
				}),
			}));

			await service.createSession('test-session', '/tmp');

			// Verify tmux was called with the configured shell
			expect(mockSpawn).toHaveBeenCalledWith('tmux', [
				'new-session',
				'-d',
				'-s',
				'test-session',
				'-c',
				'/tmp',
				'bash' // Should use the configured DEFAULT_SHELL
			]);
		});
	});

	describe('setEnvironmentVariable', () => {
		it('should set environment variable successfully', async () => {
			mockSpawn.mockImplementation(() => ({
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				on: jest.fn().mockImplementation((event, callback) => {
					if (event === 'close') {
						callback(0); // Success exit code
					}
				}),
			}));

			await expect(
				service.setEnvironmentVariable('test-session', 'TEST_VAR', 'test-value')
			).resolves.not.toThrow();
		});
	});
});