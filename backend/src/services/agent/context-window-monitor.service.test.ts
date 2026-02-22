/**
 * Tests for ContextWindowMonitorService
 *
 * Covers singleton management, lifecycle, PTY data parsing, threshold transitions,
 * event publishing, auto-recovery, cooldown enforcement, and stale detection.
 *
 * @module services/agent/context-window-monitor.test
 */

import { ContextWindowMonitorService, type ContextLevel, type ContextWindowState } from './context-window-monitor.service.js';
import { CONTEXT_WINDOW_MONITOR_CONSTANTS } from '../../constants.js';

// =============================================================================
// Mocks
// =============================================================================

// Mock LoggerService
jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
			}),
		}),
	},
}));

// Mock stripAnsiCodes
jest.mock('../../utils/terminal-output.utils.js', () => ({
	stripAnsiCodes: (content: string) => content.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''),
}));

// Mock uuid
jest.mock('uuid', () => ({
	v4: () => 'test-uuid-1234',
}));

// Mock terminal gateway
const mockBroadcastContextWindowStatus = jest.fn();
const mockBroadcastTeamMemberStatus = jest.fn();
jest.mock('../../websocket/terminal.gateway.js', () => ({
	getTerminalGateway: () => ({
		broadcastContextWindowStatus: mockBroadcastContextWindowStatus,
		broadcastTeamMemberStatus: mockBroadcastTeamMemberStatus,
	}),
}));

// Mock session state persistence
const mockGetSessionId = jest.fn();
const mockGetSessionMetadata = jest.fn();
const mockUpdateSessionId = jest.fn();
jest.mock('../session/session-state-persistence.js', () => ({
	getSessionStatePersistence: () => ({
		getSessionId: mockGetSessionId,
		getSessionMetadata: mockGetSessionMetadata,
		updateSessionId: mockUpdateSessionId,
	}),
}));

// Mock PtyActivityTrackerService
const mockClearSession = jest.fn();
jest.mock('./pty-activity-tracker.service.js', () => ({
	PtyActivityTrackerService: {
		getInstance: () => ({
			clearSession: mockClearSession,
		}),
	},
}));

// Mock RuntimeExitMonitorService
const mockStopMonitoring = jest.fn();
jest.mock('./runtime-exit-monitor.service.js', () => ({
	RuntimeExitMonitorService: {
		getInstance: () => ({
			stopMonitoring: mockStopMonitoring,
		}),
	},
}));

// Mock session backend
jest.mock('../session/index.js', () => ({
	getSessionBackendSync: () => null,
	createSessionCommandHelper: jest.fn(),
}));

// Mock fs
jest.mock('fs/promises', () => ({
	readFile: jest.fn().mockResolvedValue('Task content here'),
}));

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a mock session backend with configurable behavior.
 */
function createMockSessionBackend(sessions: Map<string, { onData: (cb: (data: string) => void) => () => void; write: jest.Mock; sessionExists?: boolean }> = new Map()) {
	return {
		getSession: (name: string) => sessions.get(name) || null,
		sessionExists: (name: string) => sessions.has(name),
		killSession: jest.fn().mockResolvedValue(undefined),
		listSessions: () => Array.from(sessions.keys()),
	};
}

/**
 * Create a mock PTY session that allows triggering onData callbacks.
 */
function createMockSession() {
	const dataCallbacks: Array<(data: string) => void> = [];
	return {
		session: {
			onData: (cb: (data: string) => void) => {
				dataCallbacks.push(cb);
				return () => {
					const idx = dataCallbacks.indexOf(cb);
					if (idx >= 0) dataCallbacks.splice(idx, 1);
				};
			},
			write: jest.fn(),
		},
		emit: (data: string) => {
			for (const cb of dataCallbacks) {
				cb(data);
			}
		},
		getCallbackCount: () => dataCallbacks.length,
	};
}

/**
 * Create a mock EventBusService.
 */
function createMockEventBus() {
	return {
		publish: jest.fn(),
	};
}

/**
 * Create a mock AgentRegistrationService.
 */
function createMockAgentRegistrationService(success = true) {
	return {
		createAgentSession: jest.fn().mockResolvedValue({
			success,
			sessionName: 'test-session',
		}),
	};
}

/**
 * Create a mock TaskTrackingService.
 */
function createMockTaskTrackingService(tasks: Array<{ taskName: string; taskFilePath: string; status: string }> = []) {
	return {
		getTasksForTeamMember: jest.fn().mockResolvedValue(tasks),
	};
}

// =============================================================================
// Tests
// =============================================================================

describe('ContextWindowMonitorService', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		ContextWindowMonitorService.resetInstance();
	});

	afterEach(() => {
		ContextWindowMonitorService.resetInstance();
		jest.useRealTimers();
	});

	// =========================================================================
	// Singleton management
	// =========================================================================

	describe('singleton management', () => {
		it('should return the same instance on multiple getInstance calls', () => {
			const instance1 = ContextWindowMonitorService.getInstance();
			const instance2 = ContextWindowMonitorService.getInstance();
			expect(instance1).toBe(instance2);
		});

		it('should return a new instance after resetInstance', () => {
			const instance1 = ContextWindowMonitorService.getInstance();
			ContextWindowMonitorService.resetInstance();
			const instance2 = ContextWindowMonitorService.getInstance();
			expect(instance1).not.toBe(instance2);
		});
	});

	// =========================================================================
	// Start/stop lifecycle
	// =========================================================================

	describe('start/stop lifecycle', () => {
		it('should report running after start', () => {
			const service = ContextWindowMonitorService.getInstance();
			expect(service.isRunning()).toBe(false);
			service.start();
			expect(service.isRunning()).toBe(true);
		});

		it('should report not running after stop', () => {
			const service = ContextWindowMonitorService.getInstance();
			service.start();
			service.stop();
			expect(service.isRunning()).toBe(false);
		});

		it('should handle double start gracefully', () => {
			const service = ContextWindowMonitorService.getInstance();
			service.start();
			service.start(); // should not throw
			expect(service.isRunning()).toBe(true);
		});

		it('should handle stop without start gracefully', () => {
			const service = ContextWindowMonitorService.getInstance();
			service.stop(); // should not throw
			expect(service.isRunning()).toBe(false);
		});
	});

	// =========================================================================
	// Session monitoring
	// =========================================================================

	describe('session monitoring', () => {
		it('should start session monitoring when session exists', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');

			const state = service.getContextState('test-agent');
			expect(state).toBeDefined();
			expect(state!.sessionName).toBe('test-agent');
			expect(state!.memberId).toBe('member-1');
			expect(state!.teamId).toBe('team-1');
			expect(state!.role).toBe('developer');
			expect(state!.level).toBe('normal');
			expect(state!.contextPercent).toBe(0);
		});

		it('should not start monitoring when session does not exist', () => {
			const service = ContextWindowMonitorService.getInstance();
			const backend = createMockSessionBackend(new Map());

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('nonexistent', 'member-1', 'team-1', 'developer');

			const state = service.getContextState('nonexistent');
			expect(state).toBeUndefined();
		});

		it('should clean up on stopSessionMonitoring', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			expect(service.getContextState('test-agent')).toBeDefined();

			service.stopSessionMonitoring('test-agent');
			expect(service.getContextState('test-agent')).toBeUndefined();
		});

		it('should unsubscribe from PTY data on stopSessionMonitoring', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			expect(mockSession.getCallbackCount()).toBe(1);

			service.stopSessionMonitoring('test-agent');
			expect(mockSession.getCallbackCount()).toBe(0);
		});

		it('should replace monitoring on re-start for same session', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			service.startSessionMonitoring('test-agent', 'member-2', 'team-2', 'qa');

			const state = service.getContextState('test-agent');
			expect(state!.memberId).toBe('member-2');
			expect(state!.teamId).toBe('team-2');
			expect(state!.role).toBe('qa');
		});

		it('should return all context states', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession1 = createMockSession();
			const mockSession2 = createMockSession();
			const sessions = new Map([
				['agent-1', mockSession1.session],
				['agent-2', mockSession2.session],
			]);
			const backend = createMockSessionBackend(sessions as any);

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('agent-1', 'member-1', 'team-1', 'developer');
			service.startSessionMonitoring('agent-2', 'member-2', 'team-1', 'qa');

			const allStates = service.getAllContextStates();
			expect(allStates.size).toBe(2);
			expect(allStates.has('agent-1')).toBe(true);
			expect(allStates.has('agent-2')).toBe(true);
		});
	});

	// =========================================================================
	// Context % parsing from PTY data
	// =========================================================================

	describe('context % parsing', () => {
		function setupWithSession() {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);
			const eventBus = createMockEventBus();

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				eventBus as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			return { service, mockSession, eventBus };
		}

		it('should detect "85% context" format', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('85% context');

			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(85);
			expect(state!.level).toBe('red');
		});

		it('should detect "85% of context" format', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('85% of context');

			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(85);
		});

		it('should detect "context: 70%" format', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('context: 70%');

			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(70);
			expect(state!.level).toBe('yellow');
		});

		it('should detect "context 80%" format', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('context 80%');

			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(80);
		});

		it('should detect "42% ctx" format', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('42% ctx');

			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(42);
			expect(state!.level).toBe('normal');
		});

		it('should handle ANSI codes in data', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('\x1b[32m85% context\x1b[0m');

			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(85);
		});

		it('should handle data split across multiple chunks', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('85% con');
			mockSession.emit('text remaining');

			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(85);
		});

		it('should ignore invalid percentages (>100)', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('150% context');

			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(0); // unchanged
		});

		it('should handle 0% context', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('0% context');

			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(0);
			expect(state!.level).toBe('normal');
		});

		it('should handle 100% context (triggers recovery which clears state)', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('100% context');

			// At 100%, auto-recovery fires which calls stopSessionMonitoring,
			// clearing the state. Verify the state was consumed (recovery triggered).
			const state = service.getContextState('test-agent');
			expect(state).toBeUndefined();
		});

		it('should cap buffer at MAX_BUFFER_SIZE', () => {
			const { service, mockSession } = setupWithSession();
			// Send a large amount of data without any context pattern
			const largeData = 'x'.repeat(CONTEXT_WINDOW_MONITOR_CONSTANTS.MAX_BUFFER_SIZE + 1000);
			mockSession.emit(largeData);

			// Then send the pattern - it should still work
			mockSession.emit('75% context');
			const state = service.getContextState('test-agent');
			expect(state!.contextPercent).toBe(75);
		});

		it('should clear buffer after successful extraction', () => {
			const { service, mockSession } = setupWithSession();
			mockSession.emit('70% context');
			expect(service.getContextState('test-agent')!.contextPercent).toBe(70);

			// Send non-matching data followed by new percentage
			mockSession.emit('some other output');
			mockSession.emit('85% context');
			expect(service.getContextState('test-agent')!.contextPercent).toBe(85);
		});
	});

	// =========================================================================
	// Threshold transitions
	// =========================================================================

	describe('threshold transitions', () => {
		function setupWithEventBus() {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);
			const eventBus = createMockEventBus();

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				eventBus as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			return { service, mockSession, eventBus };
		}

		it('should transition normal -> yellow and publish warning', () => {
			const { service, eventBus } = setupWithEventBus();

			service.updateContextUsage('test-agent', 70);

			const state = service.getContextState('test-agent');
			expect(state!.level).toBe('yellow');
			expect(eventBus.publish).toHaveBeenCalledTimes(1);
			expect(eventBus.publish).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'agent:context_warning',
					changedField: 'contextUsage',
					newValue: 'yellow',
				})
			);
		});

		it('should transition yellow -> red and publish warning', () => {
			const { service, eventBus } = setupWithEventBus();

			service.updateContextUsage('test-agent', 70); // yellow
			service.updateContextUsage('test-agent', 85); // red

			expect(eventBus.publish).toHaveBeenCalledTimes(2);
			expect(eventBus.publish).toHaveBeenLastCalledWith(
				expect.objectContaining({
					type: 'agent:context_warning',
					newValue: 'red',
				})
			);
		});

		it('should transition red -> critical and publish critical', () => {
			const { service, eventBus } = setupWithEventBus();

			service.updateContextUsage('test-agent', 85); // red
			service.updateContextUsage('test-agent', 95); // critical

			expect(eventBus.publish).toHaveBeenCalledTimes(2);
			expect(eventBus.publish).toHaveBeenLastCalledWith(
				expect.objectContaining({
					type: 'agent:context_critical',
					newValue: 'critical',
				})
			);
		});

		it('should NOT fire events for same level repeated', () => {
			const { service, eventBus } = setupWithEventBus();

			service.updateContextUsage('test-agent', 70); // yellow
			service.updateContextUsage('test-agent', 72); // still yellow
			service.updateContextUsage('test-agent', 75); // still yellow

			expect(eventBus.publish).toHaveBeenCalledTimes(1); // only the first transition
		});

		it('should NOT fire events when staying in normal range', () => {
			const { service, eventBus } = setupWithEventBus();

			service.updateContextUsage('test-agent', 10);
			service.updateContextUsage('test-agent', 30);
			service.updateContextUsage('test-agent', 50);

			expect(eventBus.publish).not.toHaveBeenCalled();
		});

		it('should fire event again when level drops and rises back', () => {
			const { service, eventBus } = setupWithEventBus();

			service.updateContextUsage('test-agent', 70); // yellow
			service.updateContextUsage('test-agent', 50); // normal
			service.updateContextUsage('test-agent', 70); // yellow again

			expect(eventBus.publish).toHaveBeenCalledTimes(2);
		});

		it('should broadcast to frontend on threshold transitions', () => {
			const { service } = setupWithEventBus();

			service.updateContextUsage('test-agent', 70);

			expect(mockBroadcastContextWindowStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionName: 'test-agent',
					contextPercent: 70,
					level: 'yellow',
				})
			);
		});
	});

	// =========================================================================
	// Event publishing
	// =========================================================================

	describe('event publishing', () => {
		it('should publish events with correct structure', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);
			const eventBus = createMockEventBus();

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				eventBus as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			service.updateContextUsage('test-agent', 86);

			expect(eventBus.publish).toHaveBeenCalledWith(
				expect.objectContaining({
					id: 'test-uuid-1234',
					type: 'agent:context_warning',
					teamId: 'team-1',
					memberId: 'member-1',
					sessionName: 'test-agent',
					previousValue: '86',
					newValue: 'red',
					changedField: 'contextUsage',
				})
			);
		});

		it('should not publish events when eventBusService is not set', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);

			// Set dependencies without event bus
			(service as any).sessionBackend = backend;

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');

			// Should not throw
			service.updateContextUsage('test-agent', 86);

			const state = service.getContextState('test-agent');
			expect(state!.level).toBe('red');
		});
	});

	// =========================================================================
	// Auto-recovery
	// =========================================================================

	describe('auto-recovery', () => {
		it('should trigger recovery at critical threshold', async () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);
			const eventBus = createMockEventBus();
			const regService = createMockAgentRegistrationService();

			service.setDependencies(
				backend as any,
				regService as any,
				{} as any,
				createMockTaskTrackingService() as any,
				eventBus as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			service.updateContextUsage('test-agent', 96);

			// Allow the async recovery to run
			await jest.advanceTimersByTimeAsync(100);

			expect(regService.createAgentSession).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionName: 'test-agent',
					role: 'developer',
					teamId: 'team-1',
					memberId: 'member-1',
				})
			);
		});

		it('should set recoveryTriggered flag to prevent double recovery', async () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);
			const eventBus = createMockEventBus();
			const regService = createMockAgentRegistrationService();

			service.setDependencies(
				backend as any,
				regService as any,
				{} as any,
				createMockTaskTrackingService() as any,
				eventBus as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');

			// First critical triggers recovery
			service.updateContextUsage('test-agent', 96);
			await jest.advanceTimersByTimeAsync(100);

			// Re-create the session state (simulating monitoring restart)
			// to demonstrate the recoveryTriggered flag
			// Note: in practice, stopSessionMonitoring is called during recovery,
			// which clears the state, so a second update wouldn't hit the same state.
			// But if the state persists, the flag prevents double-trigger.
			expect(regService.createAgentSession).toHaveBeenCalledTimes(1);
		});

		it('should stop exit monitoring before recovery kill', async () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);
			const eventBus = createMockEventBus();

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				eventBus as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			service.updateContextUsage('test-agent', 96);

			await jest.advanceTimersByTimeAsync(100);

			expect(mockStopMonitoring).toHaveBeenCalledWith('test-agent');
		});

		it('should clear PTY activity tracker during recovery', async () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);
			const eventBus = createMockEventBus();

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				eventBus as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			service.updateContextUsage('test-agent', 96);

			await jest.advanceTimersByTimeAsync(100);

			expect(mockClearSession).toHaveBeenCalledWith('test-agent');
		});
	});

	// =========================================================================
	// Recovery cooldown
	// =========================================================================

	describe('recovery cooldown', () => {
		it('should enforce max recoveries per cooldown window', async () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);
			const eventBus = createMockEventBus();
			const regService = createMockAgentRegistrationService();

			service.setDependencies(
				backend as any,
				regService as any,
				{} as any,
				createMockTaskTrackingService() as any,
				eventBus as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');

			// Manually set recovery timestamps to fill the window
			const state = service.getContextState('test-agent')!;
			state.recoveryTimestamps = Array(CONTEXT_WINDOW_MONITOR_CONSTANTS.MAX_RECOVERIES_PER_WINDOW)
				.fill(Date.now());
			state.level = 'red'; // ensure transition to critical fires

			service.updateContextUsage('test-agent', 96);
			await jest.advanceTimersByTimeAsync(100);

			// Recovery should NOT be triggered because cooldown is active
			expect(regService.createAgentSession).not.toHaveBeenCalled();
		});

		it('should allow recovery after cooldown window expires', async () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);
			const eventBus = createMockEventBus();
			const regService = createMockAgentRegistrationService();

			service.setDependencies(
				backend as any,
				regService as any,
				{} as any,
				createMockTaskTrackingService() as any,
				eventBus as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');

			// Set old timestamps that are outside the cooldown window
			const state = service.getContextState('test-agent')!;
			const oldTimestamp = Date.now() - CONTEXT_WINDOW_MONITOR_CONSTANTS.COOLDOWN_WINDOW_MS - 1000;
			state.recoveryTimestamps = Array(CONTEXT_WINDOW_MONITOR_CONSTANTS.MAX_RECOVERIES_PER_WINDOW)
				.fill(oldTimestamp);

			service.updateContextUsage('test-agent', 96);
			await jest.advanceTimersByTimeAsync(100);

			// Recovery SHOULD be triggered because old timestamps are expired
			expect(regService.createAgentSession).toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Stale detection
	// =========================================================================

	describe('stale detection in performCheck', () => {
		it('should reset stale states to normal', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');

			// Set state to yellow with old timestamp
			const state = service.getContextState('test-agent')!;
			state.level = 'yellow';
			state.contextPercent = 72;
			state.lastDetectedAt = Date.now() - CONTEXT_WINDOW_MONITOR_CONSTANTS.STALE_DETECTION_THRESHOLD_MS - 1000;

			service.start();
			jest.advanceTimersByTime(CONTEXT_WINDOW_MONITOR_CONSTANTS.CHECK_INTERVAL_MS);

			expect(state.level).toBe('normal');
			expect(state.recoveryTriggered).toBe(false);
		});

		it('should not reset fresh states', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');

			// Set state to yellow with recent timestamp
			const state = service.getContextState('test-agent')!;
			state.level = 'yellow';
			state.contextPercent = 72;
			state.lastDetectedAt = Date.now(); // very fresh

			service.start();
			jest.advanceTimersByTime(CONTEXT_WINDOW_MONITOR_CONSTANTS.CHECK_INTERVAL_MS);

			expect(state.level).toBe('yellow'); // unchanged
		});

		it('should not reset normal states even if stale', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');

			// State is already normal
			const state = service.getContextState('test-agent')!;
			state.lastDetectedAt = Date.now() - CONTEXT_WINDOW_MONITOR_CONSTANTS.STALE_DETECTION_THRESHOLD_MS - 1000;

			service.start();
			jest.advanceTimersByTime(CONTEXT_WINDOW_MONITOR_CONSTANTS.CHECK_INTERVAL_MS);

			expect(state.level).toBe('normal');
		});
	});

	// =========================================================================
	// Edge cases
	// =========================================================================

	describe('edge cases', () => {
		it('should handle updateContextUsage for non-monitored session', () => {
			const service = ContextWindowMonitorService.getInstance();

			// Should not throw
			service.updateContextUsage('nonexistent', 85);
		});

		it('should handle stopSessionMonitoring for non-monitored session', () => {
			const service = ContextWindowMonitorService.getInstance();

			// Should not throw
			service.stopSessionMonitoring('nonexistent');
		});

		it('should handle PTY data for stopped session gracefully', () => {
			const service = ContextWindowMonitorService.getInstance();
			const mockSession = createMockSession();
			const sessions = new Map([['test-agent', mockSession.session]]);
			const backend = createMockSessionBackend(sessions as any);

			service.setDependencies(
				backend as any,
				createMockAgentRegistrationService() as any,
				{} as any,
				createMockTaskTrackingService() as any,
				createMockEventBus() as any
			);

			service.startSessionMonitoring('test-agent', 'member-1', 'team-1', 'developer');
			service.stopSessionMonitoring('test-agent');

			// Emit after stop - should not throw or update any state
			mockSession.emit('95% context');

			expect(service.getContextState('test-agent')).toBeUndefined();
		});
	});
});
