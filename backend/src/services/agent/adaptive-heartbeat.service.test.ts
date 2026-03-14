/**
 * Tests for AdaptiveHeartbeatService (#172)
 *
 * Validates adaptive heartbeat state transitions, interval computation,
 * and the pending work check integration.
 */

import {
	AdaptiveHeartbeatService,
	ADAPTIVE_HEARTBEAT_DEFAULTS,
	type PendingWorkSummary,
	type HeartbeatState,
} from './adaptive-heartbeat.service.js';

// Mock LoggerService
jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			}),
		}),
	},
}));

describe('AdaptiveHeartbeatService', () => {
	let service: AdaptiveHeartbeatService;

	beforeEach(() => {
		jest.useFakeTimers();
		service = new AdaptiveHeartbeatService('test-session');
	});

	afterEach(() => {
		service.stop();
		jest.useRealTimers();
	});

	describe('constructor', () => {
		it('should initialize with idle state', () => {
			expect(service.getState()).toBe('idle');
		});

		it('should accept custom config', () => {
			const custom = new AdaptiveHeartbeatService('test', { busyIntervalMs: 1000 });
			expect(custom.getIntervalForState('busy')).toBe(1000);
		});

		it('should use defaults for unspecified config', () => {
			expect(service.getIntervalForState('busy')).toBe(ADAPTIVE_HEARTBEAT_DEFAULTS.busyIntervalMs);
			expect(service.getIntervalForState('idle')).toBe(ADAPTIVE_HEARTBEAT_DEFAULTS.idleIntervalMs);
			expect(service.getIntervalForState('dormant')).toBe(ADAPTIVE_HEARTBEAT_DEFAULTS.dormantIntervalMs);
		});
	});

	describe('determineState', () => {
		it('should return busy when there is pending work', () => {
			const summary: PendingWorkSummary = {
				hasPendingWork: true,
				pendingTasks: [{ id: 't1', taskName: 'test', assignedAt: '' }],
				pendingMessages: [],
				teamActive: true,
				recommendedState: 'busy',
				recommendedIntervalMs: ADAPTIVE_HEARTBEAT_DEFAULTS.busyIntervalMs,
			};
			expect(service.determineState(summary)).toBe('busy');
		});

		it('should return idle when no work but team is active', () => {
			const summary: PendingWorkSummary = {
				hasPendingWork: false,
				pendingTasks: [],
				pendingMessages: [],
				teamActive: true,
				recommendedState: 'idle',
				recommendedIntervalMs: ADAPTIVE_HEARTBEAT_DEFAULTS.idleIntervalMs,
			};
			expect(service.determineState(summary)).toBe('idle');
		});

		it('should return dormant when team is inactive', () => {
			const summary: PendingWorkSummary = {
				hasPendingWork: false,
				pendingTasks: [],
				pendingMessages: [],
				teamActive: false,
				recommendedState: 'dormant',
				recommendedIntervalMs: ADAPTIVE_HEARTBEAT_DEFAULTS.dormantIntervalMs,
			};
			expect(service.determineState(summary)).toBe('dormant');
		});

		it('should transition from idle to dormant after threshold', () => {
			const idleSummary: PendingWorkSummary = {
				hasPendingWork: false,
				pendingTasks: [],
				pendingMessages: [],
				teamActive: true,
				recommendedState: 'idle',
				recommendedIntervalMs: ADAPTIVE_HEARTBEAT_DEFAULTS.idleIntervalMs,
			};

			// First 2 checks should stay idle (threshold is 3)
			expect(service.determineState(idleSummary)).toBe('idle');
			expect(service.determineState(idleSummary)).toBe('idle');
			// Third check should transition to dormant
			expect(service.determineState(idleSummary)).toBe('dormant');
		});

		it('should reset idle counter when work arrives', () => {
			const idleSummary: PendingWorkSummary = {
				hasPendingWork: false,
				pendingTasks: [],
				pendingMessages: [],
				teamActive: true,
				recommendedState: 'idle',
				recommendedIntervalMs: ADAPTIVE_HEARTBEAT_DEFAULTS.idleIntervalMs,
			};

			const busySummary: PendingWorkSummary = {
				hasPendingWork: true,
				pendingTasks: [{ id: 't1', taskName: 'test', assignedAt: '' }],
				pendingMessages: [],
				teamActive: true,
				recommendedState: 'busy',
				recommendedIntervalMs: ADAPTIVE_HEARTBEAT_DEFAULTS.busyIntervalMs,
			};

			service.determineState(idleSummary); // idle count = 1
			service.determineState(idleSummary); // idle count = 2
			service.determineState(busySummary);  // resets count
			expect(service.determineState(idleSummary)).toBe('idle'); // count = 1 again
		});
	});

	describe('getIntervalForState', () => {
		it('should return correct intervals', () => {
			expect(service.getIntervalForState('busy')).toBe(5 * 60 * 1000);
			expect(service.getIntervalForState('idle')).toBe(4 * 60 * 60 * 1000);
			expect(service.getIntervalForState('dormant')).toBe(24 * 60 * 60 * 1000);
		});
	});

	describe('start and stop', () => {
		it('should start and fire first heartbeat immediately', async () => {
			const onHeartbeat = jest.fn();
			service.setOnHeartbeat(onHeartbeat);
			service.setCheckPendingWork(async () => ({
				hasPendingWork: false,
				pendingTasks: [],
				pendingMessages: [],
				teamActive: true,
				recommendedState: 'idle' as HeartbeatState,
				recommendedIntervalMs: ADAPTIVE_HEARTBEAT_DEFAULTS.idleIntervalMs,
			}));

			service.start();

			// Flush the immediate tick (microtask/promise)
			await jest.advanceTimersByTimeAsync(0);

			expect(onHeartbeat).toHaveBeenCalledTimes(1);
			expect(service.getLastResult()).not.toBeNull();
			expect(service.getLastResult()!.state).toBe('idle');
		});

		it('should stop the heartbeat loop', () => {
			service.start();
			service.stop();
			// No error thrown, timer cleared
			expect(service.getState()).toBe('idle');
		});

		it('should not start twice', () => {
			service.start();
			service.start(); // Should log warning but not throw
		});
	});

	describe('ADAPTIVE_HEARTBEAT_DEFAULTS', () => {
		it('should have correct default values', () => {
			expect(ADAPTIVE_HEARTBEAT_DEFAULTS.busyIntervalMs).toBe(300_000);      // 5 min
			expect(ADAPTIVE_HEARTBEAT_DEFAULTS.idleIntervalMs).toBe(14_400_000);   // 4 hours
			expect(ADAPTIVE_HEARTBEAT_DEFAULTS.dormantIntervalMs).toBe(86_400_000); // 24 hours
			expect(ADAPTIVE_HEARTBEAT_DEFAULTS.idleToDormantThreshold).toBe(3);
		});
	});
});
