import { RuntimeExitMonitorService } from './runtime-exit-monitor.service.js';
import { CREWLY_CONSTANTS, RUNTIME_EXIT_CONSTANTS, RUNTIME_TYPES } from '../../constants.js';

// Mock dependencies
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

const mockUpdateAgentStatus = jest.fn();
jest.mock('../core/storage.service.js', () => ({
	StorageService: {
		getInstance: () => ({
			updateAgentStatus: mockUpdateAgentStatus,
		}),
	},
}));

const mockOnSessionEnd = jest.fn();
jest.mock('../memory/session-memory.service.js', () => ({
	SessionMemoryService: {
		getInstance: () => ({
			onSessionEnd: mockOnSessionEnd,
		}),
	},
}));

const mockBroadcastOrchestratorStatus = jest.fn();
const mockBroadcastTeamMemberStatus = jest.fn();
jest.mock('../../websocket/terminal.gateway.js', () => ({
	getTerminalGateway: () => ({
		broadcastOrchestratorStatus: mockBroadcastOrchestratorStatus,
		broadcastTeamMemberStatus: mockBroadcastTeamMemberStatus,
	}),
}));

// Mock session/PTY infrastructure
const mockOnData = jest.fn();
const mockWrite = jest.fn();
const mockCapturePane = jest.fn().mockReturnValue('user@host:~$');
const mockGetSession = jest.fn().mockReturnValue({
	onData: mockOnData,
	write: mockWrite,
});
const mockSessionExists = jest.fn().mockReturnValue(true);
const mockKillSession = jest.fn().mockResolvedValue(undefined);

jest.mock('../session/index.js', () => ({
	getSessionBackendSync: () => ({
		getSession: mockGetSession,
		sessionExists: mockSessionExists,
		killSession: mockKillSession,
	}),
	createSessionCommandHelper: () => ({
		getSession: mockGetSession,
		capturePane: mockCapturePane,
	}),
}));

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

const mockClearSession = jest.fn();
jest.mock('./pty-activity-tracker.service.js', () => ({
	PtyActivityTrackerService: {
		getInstance: () => ({
			clearSession: mockClearSession,
		}),
	},
}));

const mockGetTasksForTeamMember = jest.fn().mockResolvedValue([]);
jest.mock('../project/task-tracking.service.js', () => ({
	TaskTrackingService: {
		getInstance: () => ({
			getTasksForTeamMember: mockGetTasksForTeamMember,
		}),
	},
}));

jest.mock('fs/promises', () => ({
	readFile: jest.fn().mockResolvedValue('Task content here'),
}));

const mockGetExitPatterns = jest.fn().mockReturnValue([
	/Agent powering down/i,
	/Interaction Summary/,
]);

jest.mock('./runtime-service.factory.js', () => ({
	RuntimeServiceFactory: {
		create: () => ({
			getExitPatterns: mockGetExitPatterns,
		}),
	},
}));

describe('RuntimeExitMonitorService', () => {
	let service: RuntimeExitMonitorService;

	beforeEach(() => {
		jest.clearAllMocks();
		RuntimeExitMonitorService.resetInstance();
		service = RuntimeExitMonitorService.getInstance();

		// Default: onData returns an unsubscribe function
		mockOnData.mockReturnValue(jest.fn());
	});

	afterEach(() => {
		RuntimeExitMonitorService.resetInstance();
	});

	describe('getInstance', () => {
		it('should return singleton instance', () => {
			const instance1 = RuntimeExitMonitorService.getInstance();
			const instance2 = RuntimeExitMonitorService.getInstance();
			expect(instance1).toBe(instance2);
		});
	});

	describe('resetInstance', () => {
		it('should create new instance after reset', () => {
			const instance1 = RuntimeExitMonitorService.getInstance();
			RuntimeExitMonitorService.resetInstance();
			const instance2 = RuntimeExitMonitorService.getInstance();
			expect(instance1).not.toBe(instance2);
		});
	});

	describe('startMonitoring', () => {
		it('should subscribe to PTY session output', () => {
			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			expect(mockGetSession).toHaveBeenCalledWith('test-agent');
			expect(mockOnData).toHaveBeenCalledWith(expect.any(Function));
			expect(service.isMonitoring('test-agent')).toBe(true);
		});

		it('should stop existing monitoring before starting new one', () => {
			const unsubscribe1 = jest.fn();
			mockOnData.mockReturnValueOnce(unsubscribe1);

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			const unsubscribe2 = jest.fn();
			mockOnData.mockReturnValueOnce(unsubscribe2);

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			expect(unsubscribe1).toHaveBeenCalled();
		});

		it('should skip monitoring if no exit patterns are available', () => {
			mockGetExitPatterns.mockReturnValueOnce([]);

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			expect(service.isMonitoring('test-agent')).toBe(false);
		});

		it('should handle missing session gracefully', () => {
			mockGetSession.mockReturnValueOnce(undefined);

			service.startMonitoring('missing-session', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			expect(service.isMonitoring('missing-session')).toBe(false);
		});
	});

	describe('stopMonitoring', () => {
		it('should unsubscribe from PTY output', () => {
			const unsubscribe = jest.fn();
			mockOnData.mockReturnValueOnce(unsubscribe);

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			service.stopMonitoring('test-agent');

			expect(unsubscribe).toHaveBeenCalled();
			expect(service.isMonitoring('test-agent')).toBe(false);
		});

		it('should be a no-op for non-monitored sessions', () => {
			expect(() => service.stopMonitoring('non-existent')).not.toThrow();
		});
	});

	describe('isMonitoring', () => {
		it('should return true for monitored sessions', () => {
			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			expect(service.isMonitoring('test-agent')).toBe(true);
		});

		it('should return false for non-monitored sessions', () => {
			expect(service.isMonitoring('non-existent')).toBe(false);
		});
	});

	describe('destroy', () => {
		it('should stop all monitoring', () => {
			const unsub1 = jest.fn();
			const unsub2 = jest.fn();
			mockOnData.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

			service.startMonitoring('agent-1', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			service.startMonitoring('agent-2', RUNTIME_TYPES.CLAUDE_CODE, 'reviewer');

			service.destroy();

			expect(unsub1).toHaveBeenCalled();
			expect(unsub2).toHaveBeenCalled();
			expect(service.isMonitoring('agent-1')).toBe(false);
			expect(service.isMonitoring('agent-2')).toBe(false);
		});
	});

	describe('exit detection', () => {
		it('should detect exit pattern immediately (grace period is 0)', async () => {
			jest.useFakeTimers();

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			// Get the onData callback
			const onDataCallback = mockOnData.mock.calls[0][0];

			// Send exit pattern immediately — no grace period to block it
			onDataCallback('Agent powering down');

			// Advance past debounce
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			// Status SHOULD be updated (grace period is 0, so no delay)
			expect(mockUpdateAgentStatus).toHaveBeenCalledWith(
				'test-agent',
				CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE
			);

			jest.useRealTimers();
		});

		it('should detect exit pattern after grace period', async () => {
			jest.useFakeTimers();

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			const onDataCallback = mockOnData.mock.calls[0][0];

			// Advance past the grace period
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);

			// Send exit pattern
			onDataCallback('Agent powering down\nbye!');

			// Advance past debounce
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);

			// Need to flush the async confirmAndReact
			await jest.runAllTimersAsync();

			expect(mockUpdateAgentStatus).toHaveBeenCalledWith(
				'test-agent',
				CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE
			);

			jest.useRealTimers();
		});

		it('should not react to unrelated text', () => {
			jest.useFakeTimers();

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			const onDataCallback = mockOnData.mock.calls[0][0];

			// Advance past grace
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);

			// Send unrelated output
			onDataCallback('Working on task...');

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);

			expect(mockUpdateAgentStatus).not.toHaveBeenCalled();

			jest.useRealTimers();
		});

		it('should cap rolling buffer to MAX_BUFFER_SIZE', () => {
			jest.useFakeTimers();

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			const onDataCallback = mockOnData.mock.calls[0][0];

			// Advance past grace
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);

			// Send data larger than max buffer
			const largeData = 'x'.repeat(RUNTIME_EXIT_CONSTANTS.MAX_BUFFER_SIZE + 1000);
			onDataCallback(largeData);

			// Buffer should be capped — accessing via private field
			const monitored = (service as any).sessions.get('test-agent');
			expect(monitored.buffer.length).toBeLessThanOrEqual(RUNTIME_EXIT_CONSTANTS.MAX_BUFFER_SIZE);

			jest.useRealTimers();
		});

		it('should fire onExitDetected callback', async () => {
			jest.useFakeTimers();

			const exitCallback = jest.fn();
			service.setOnExitDetectedCallback(exitCallback);

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			const onDataCallback = mockOnData.mock.calls[0][0];

			// Advance past grace
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);

			// Trigger exit
			onDataCallback('Agent powering down');
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			expect(exitCallback).toHaveBeenCalledWith('test-agent');

			jest.useRealTimers();
		});

		it('should broadcast team member status for non-orchestrator sessions', async () => {
			jest.useFakeTimers();

			service.startMonitoring('dev-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			const onDataCallback = mockOnData.mock.calls[0][0];

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);
			onDataCallback('Agent powering down');
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			expect(mockBroadcastTeamMemberStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionName: 'dev-agent',
					agentStatus: CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE,
					reason: 'runtime_exited',
				})
			);

			jest.useRealTimers();
		});

		it('should broadcast orchestrator status for orchestrator session', async () => {
			jest.useFakeTimers();

			// ORCHESTRATOR_SESSION_NAME is 'crewly-orc'
			service.startMonitoring('crewly-orc', RUNTIME_TYPES.CLAUDE_CODE, 'orchestrator');
			const onDataCallback = mockOnData.mock.calls[0][0];

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);
			onDataCallback('Agent powering down');
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			expect(mockBroadcastOrchestratorStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionName: 'crewly-orc',
					agentStatus: CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE,
					reason: 'runtime_exited',
				})
			);

			jest.useRealTimers();
		});

		it('should capture session memory on exit', async () => {
			jest.useFakeTimers();

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			const onDataCallback = mockOnData.mock.calls[0][0];

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);
			onDataCallback('Agent powering down');
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			expect(mockOnSessionEnd).toHaveBeenCalledWith('test-agent', 'developer', expect.any(String));

			jest.useRealTimers();
		});

		it('should not double-process exit detection', async () => {
			jest.useFakeTimers();

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');
			const onDataCallback = mockOnData.mock.calls[0][0];

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);

			// Send exit pattern twice
			onDataCallback('Agent powering down');
			onDataCallback('Agent powering down again');

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			// Should only update status once
			expect(mockUpdateAgentStatus).toHaveBeenCalledTimes(1);

			jest.useRealTimers();
		});
	});

	describe('setOnExitDetectedCallback', () => {
		it('should store the callback', () => {
			const callback = jest.fn();
			service.setOnExitDetectedCallback(callback);
			expect((service as any).onExitDetectedCallback).toBe(callback);
		});
	});

	describe('process-based exit detection', () => {
		let mockIsChildProcessAlive: jest.Mock;

		beforeEach(() => {
			mockIsChildProcessAlive = jest.fn().mockReturnValue(true);
			// Patch the session backend mock to include isChildProcessAlive
			const sessionModule = jest.requireMock('../session/index.js');
			sessionModule.getSessionBackendSync = () => ({
				getSession: mockGetSession,
				sessionExists: mockSessionExists,
				killSession: mockKillSession,
				isChildProcessAlive: mockIsChildProcessAlive,
			});
			sessionModule.createSessionCommandHelper = () => ({
				getSession: mockGetSession,
				capturePane: mockCapturePane,
			});

			// Re-create the service so it picks up the patched mocks
			RuntimeExitMonitorService.resetInstance();
			service = RuntimeExitMonitorService.getInstance();
		});

		it('should detect exit when child process is not alive', async () => {
			jest.useFakeTimers();

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			// Advance past the process poll grace period
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.PROCESS_POLL_GRACE_PERIOD_MS);

			// Child process dies
			mockIsChildProcessAlive.mockReturnValue(false);

			// Advance to next poll interval tick
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.PROCESS_POLL_INTERVAL_MS);

			// Flush async confirmAndReact
			await Promise.resolve();
			await Promise.resolve();

			expect(mockUpdateAgentStatus).toHaveBeenCalledWith(
				'test-agent',
				CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE
			);

			service.stopMonitoring('test-agent');
			jest.useRealTimers();
		});

		it('should not detect exit during grace period', () => {
			jest.useFakeTimers();

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			// Child process not alive, but still in grace period
			mockIsChildProcessAlive.mockReturnValue(false);

			// Only advance one poll interval (within 30s grace)
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.PROCESS_POLL_INTERVAL_MS);

			expect(mockUpdateAgentStatus).not.toHaveBeenCalled();

			service.stopMonitoring('test-agent');
			jest.useRealTimers();
		});

		it('should not fire when child process is alive', () => {
			jest.useFakeTimers();

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			mockIsChildProcessAlive.mockReturnValue(true);

			// Advance past grace period + one poll
			jest.advanceTimersByTime(
				RUNTIME_EXIT_CONSTANTS.PROCESS_POLL_GRACE_PERIOD_MS +
				RUNTIME_EXIT_CONSTANTS.PROCESS_POLL_INTERVAL_MS
			);

			expect(mockUpdateAgentStatus).not.toHaveBeenCalled();

			service.stopMonitoring('test-agent');
			jest.useRealTimers();
		});

		it('should clear process polling interval on stopMonitoring', () => {
			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer');

			const monitored = (service as any).sessions.get('test-agent');
			expect(monitored.processPollingInterval).toBeDefined();

			service.stopMonitoring('test-agent');

			expect(service.isMonitoring('test-agent')).toBe(false);
		});
	});

	describe('task-aware restart on exit', () => {
		const mockCreateAgentSession = jest.fn().mockResolvedValue({ success: true, sessionName: 'test-agent' });
		const mockAgentRegistrationService = {
			createAgentSession: mockCreateAgentSession,
		};
		const mockTaskTrackingServiceInstance = {
			getTasksForTeamMember: mockGetTasksForTeamMember,
		};

		beforeEach(() => {
			mockCreateAgentSession.mockClear();
			mockGetTasksForTeamMember.mockReset();
			mockClearSession.mockClear();
			mockKillSession.mockClear();
			mockWrite.mockClear();
			mockSessionExists.mockReturnValue(true);
			// Inject both dependencies so the restart path activates
			service.setAgentRegistrationService(mockAgentRegistrationService as any);
			service.setTaskTrackingService(mockTaskTrackingServiceInstance as any);
		});

		it('should restart agent when exit detected with in-progress tasks', async () => {
			jest.useFakeTimers();

			mockGetTasksForTeamMember.mockResolvedValue([
				{ id: 'task-1', taskName: 'Fix bug', taskFilePath: '/tmp/task.md', status: 'assigned', assignedTeamMemberId: 'member-1' },
			]);

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer', 'team-1', 'member-1');
			const onDataCallback = mockOnData.mock.calls[0][0];

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);
			onDataCallback('Agent powering down');
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			// Should have triggered restart instead of setting inactive
			expect(mockCreateAgentSession).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionName: 'test-agent',
					role: 'developer',
					teamId: 'team-1',
					memberId: 'member-1',
				})
			);
			// Should NOT have set status to inactive (restart took over)
			expect(mockUpdateAgentStatus).not.toHaveBeenCalled();

			jest.useRealTimers();
		});

		it('should set inactive when exit detected with no in-progress tasks', async () => {
			jest.useFakeTimers();

			mockGetTasksForTeamMember.mockResolvedValue([]);

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer', 'team-1', 'member-1');
			const onDataCallback = mockOnData.mock.calls[0][0];

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);
			onDataCallback('Agent powering down');
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			// Should have set status to inactive (no tasks to restart for)
			expect(mockUpdateAgentStatus).toHaveBeenCalledWith(
				'test-agent',
				CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE
			);
			expect(mockCreateAgentSession).not.toHaveBeenCalled();

			jest.useRealTimers();
		});

		it('should always set orchestrator to inactive even with tasks', async () => {
			jest.useFakeTimers();

			mockGetTasksForTeamMember.mockResolvedValue([
				{ id: 'task-1', taskName: 'Fix bug', taskFilePath: '/tmp/task.md', status: 'assigned', assignedTeamMemberId: 'orc-1' },
			]);

			service.startMonitoring('crewly-orc', RUNTIME_TYPES.CLAUDE_CODE, 'orchestrator', undefined, 'orc-1');
			const onDataCallback = mockOnData.mock.calls[0][0];

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);
			onDataCallback('Agent powering down');
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			// Should NOT restart orchestrator, should set inactive
			expect(mockCreateAgentSession).not.toHaveBeenCalled();
			expect(mockUpdateAgentStatus).toHaveBeenCalledWith(
				'crewly-orc',
				CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE
			);

			jest.useRealTimers();
		});

		it('should fall back to inactive when restart fails', async () => {
			jest.useFakeTimers();

			mockCreateAgentSession.mockResolvedValueOnce({ success: false, error: 'Session creation failed' });
			mockGetTasksForTeamMember.mockResolvedValue([
				{ id: 'task-1', taskName: 'Fix bug', taskFilePath: '/tmp/task.md', status: 'active', assignedTeamMemberId: 'member-1' },
			]);

			service.startMonitoring('test-agent', RUNTIME_TYPES.GEMINI_CLI, 'developer', 'team-1', 'member-1');
			const onDataCallback = mockOnData.mock.calls[0][0];

			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 100);
			onDataCallback('Agent powering down');
			jest.advanceTimersByTime(RUNTIME_EXIT_CONSTANTS.CONFIRMATION_DELAY_MS + 100);
			await jest.runAllTimersAsync();

			// Restart was attempted
			expect(mockCreateAgentSession).toHaveBeenCalled();
			// Restart failed, so should fall back to setting inactive
			expect(mockUpdateAgentStatus).toHaveBeenCalledWith(
				'test-agent',
				CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE
			);

			jest.useRealTimers();
		});
	});
});
