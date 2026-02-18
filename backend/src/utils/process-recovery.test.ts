import { ProcessRecovery } from './process-recovery.js';
import { EventEmitter } from 'events';

// Mock child_process to prevent real process spawning
// Use require inside factory since jest.mock is hoisted above imports
jest.mock('child_process', () => {
	const { EventEmitter } = require('events');
	return {
		spawn: jest.fn().mockReturnValue({
			pid: 12345,
			stdout: new EventEmitter(),
			stderr: new EventEmitter(),
			on: jest.fn(),
			kill: jest.fn(),
			killed: false,
		}),
	};
});

// Prevent process.exit from killing the test runner
const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

describe('ProcessRecovery', () => {
	let recovery: ProcessRecovery;

	beforeEach(() => {
		jest.clearAllMocks();
		recovery = new ProcessRecovery();
	});

	afterEach(() => {
		// Don't call recovery.shutdown() as it triggers process.exit
	});

	describe('constructor', () => {
		test('should create a ProcessRecovery instance', () => {
			expect(recovery).toBeInstanceOf(ProcessRecovery);
			expect(recovery).toBeInstanceOf(EventEmitter);
		});
	});

	describe('getStatus', () => {
		test('should return initial status with all expected properties', () => {
			const status = recovery.getStatus();

			expect(status).toHaveProperty('isRunning');
			expect(status).toHaveProperty('pid');
			expect(status).toHaveProperty('restartCount');
			expect(status).toHaveProperty('runtime');
			expect(status.isRunning).toBe(false);
			expect(status.restartCount).toBe(0);
		});
	});

	describe('shutdown', () => {
		test('should call process.exit', async () => {
			await recovery.shutdown();
			expect(mockExit).toHaveBeenCalledWith(0);
		});
	});

	describe('event emitter', () => {
		test('should be an EventEmitter', () => {
			expect(typeof recovery.on).toBe('function');
			expect(typeof recovery.emit).toBe('function');
			expect(typeof recovery.removeListener).toBe('function');
		});

		test('should allow registering event handlers', () => {
			const handler = jest.fn();
			recovery.on('process_started', handler);
			recovery.emit('process_started');
			expect(handler).toHaveBeenCalled();
		});
	});
});

/**
 * Mock utilities for testing
 */
export class MockChildProcess extends EventEmitter {
	pid: number;
	killed: boolean = false;
	exitCode: number | null = null;
	stdout = new EventEmitter();
	stderr = new EventEmitter();

	constructor(pid: number = Math.floor(Math.random() * 10000)) {
		super();
		this.pid = pid;
	}

	kill(signal?: string): void {
		this.killed = true;
		this.exitCode = signal === 'SIGKILL' ? null : 0;
		this.emit('exit', this.exitCode, signal);
	}

	simulateOutput(message: string): void {
		this.stdout.emit('data', Buffer.from(message));
	}

	simulateError(error: string): void {
		this.stderr.emit('data', Buffer.from(error));
	}
}
