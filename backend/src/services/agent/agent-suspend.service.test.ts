/**
 * Tests for AgentSuspendService
 */

import { AgentSuspendService } from './agent-suspend.service.js';
import { PtyActivityTrackerService } from './pty-activity-tracker.service.js';
import { DiskCleanupService } from './disk-cleanup.service.js';

// Mock dependencies
jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({
				info: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			}),
		}),
	},
}));

const mockKillSession = jest.fn().mockResolvedValue(undefined);
const mockSessionExists = jest.fn().mockReturnValue(true);

jest.mock('../session/index.js', () => ({
	getSessionBackendSync: () => ({
		killSession: mockKillSession,
		sessionExists: mockSessionExists,
	}),
	getSessionStatePersistence: () => ({
		getSessionId: jest.fn().mockReturnValue('claude-session-123'),
		getSessionMetadata: jest.fn().mockReturnValue({ name: 'test-session' }),
		updateSessionId: jest.fn(),
	}),
}));

const mockUpdateAgentStatus = jest.fn().mockResolvedValue(undefined);
const mockFindMemberBySessionName = jest.fn();

jest.mock('../core/storage.service.js', () => ({
	StorageService: {
		getInstance: () => ({
			updateAgentStatus: mockUpdateAgentStatus,
			findMemberBySessionName: mockFindMemberBySessionName,
		}),
	},
}));

const mockStopMonitoring = jest.fn();
jest.mock('./runtime-exit-monitor.service.js', () => ({
	RuntimeExitMonitorService: {
		getInstance: () => ({
			stopMonitoring: mockStopMonitoring,
		}),
	},
}));

const mockBroadcastTeamMemberStatus = jest.fn();
jest.mock('../../websocket/terminal.gateway.js', () => ({
	getTerminalGateway: () => ({
		broadcastTeamMemberStatus: mockBroadcastTeamMemberStatus,
	}),
}));

const mockCreateAgentSession = jest.fn().mockResolvedValue({ success: true });
const mockRegistrationService = {
	createAgentSession: mockCreateAgentSession,
};

describe('AgentSuspendService', () => {
	beforeEach(() => {
		AgentSuspendService.resetInstance();
		PtyActivityTrackerService.resetInstance();
		DiskCleanupService.resetInstance();
		jest.clearAllMocks();
	});

	describe('getInstance', () => {
		it('should return a singleton instance', () => {
			const a = AgentSuspendService.getInstance();
			const b = AgentSuspendService.getInstance();
			expect(a).toBe(b);
		});
	});

	describe('suspendAgent', () => {
		it('should refuse to suspend orchestrator role', async () => {
			const service = AgentSuspendService.getInstance();
			const result = await service.suspendAgent('crewly-orc', 'team1', 'member1', 'orchestrator');
			expect(result).toBe(false);
			expect(mockKillSession).not.toHaveBeenCalled();
		});

		it('should refuse to suspend already suspended agent', async () => {
			const service = AgentSuspendService.getInstance();
			// First suspend succeeds
			await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');
			// Second suspend is rejected
			const result = await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');
			expect(result).toBe(false);
		});

		it('should kill PTY session and update status', async () => {
			const service = AgentSuspendService.getInstance();
			const result = await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');

			expect(result).toBe(true);
			expect(mockStopMonitoring).toHaveBeenCalledWith('agent-dev');
			expect(mockKillSession).toHaveBeenCalledWith('agent-dev');
			expect(mockUpdateAgentStatus).toHaveBeenCalledWith('agent-dev', 'suspended');
		});

		it('should broadcast status change to frontend', async () => {
			const service = AgentSuspendService.getInstance();
			await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');

			expect(mockBroadcastTeamMemberStatus).toHaveBeenCalledWith(
				expect.objectContaining({
					sessionName: 'agent-dev',
					agentStatus: 'suspended',
				})
			);
		});

		it('should save suspend info for later rehydration', async () => {
			const service = AgentSuspendService.getInstance();
			await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');

			expect(service.isSuspended('agent-dev')).toBe(true);
			const info = service.getSuspendInfo('agent-dev');
			expect(info).not.toBeNull();
			expect(info!.sessionName).toBe('agent-dev');
			expect(info!.teamId).toBe('team1');
			expect(info!.memberId).toBe('member1');
			expect(info!.claudeSessionId).toBe('claude-session-123');
		});
	});

	describe('rehydrateAgent', () => {
		it('should return false if agent is not suspended', async () => {
			const service = AgentSuspendService.getInstance();
			service.setDependencies(mockRegistrationService as any);
			const result = await service.rehydrateAgent('unknown-agent');
			expect(result).toBe(false);
		});

		it('should return false if dependencies not set', async () => {
			const service = AgentSuspendService.getInstance();
			await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');
			// Don't call setDependencies
			const result = await service.rehydrateAgent('agent-dev');
			expect(result).toBe(false);
		});

		it('should deduplicate concurrent rehydration calls', async () => {
			const service = AgentSuspendService.getInstance();
			service.setDependencies(mockRegistrationService as any);
			// Setup: suspend agent first, then configure mock for polling
			mockFindMemberBySessionName.mockResolvedValue({
				member: { agentStatus: 'active' },
			});
			await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');

			// Start two concurrent rehydrations
			const p1 = service.rehydrateAgent('agent-dev');
			const p2 = service.rehydrateAgent('agent-dev');

			const [r1, r2] = await Promise.all([p1, p2]);
			// One should proceed, the other should get early-return true
			expect(r1 || r2).toBe(true);
		});

		it('should update status to starting during rehydration', async () => {
			const service = AgentSuspendService.getInstance();
			service.setDependencies(mockRegistrationService as any);
			mockFindMemberBySessionName.mockResolvedValue({
				member: { agentStatus: 'active' },
			});
			await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');

			await service.rehydrateAgent('agent-dev');

			// Should have been called with 'starting' at some point
			expect(mockUpdateAgentStatus).toHaveBeenCalledWith('agent-dev', 'starting');
		});

		it('should remove from suspended map on successful rehydration', async () => {
			const service = AgentSuspendService.getInstance();
			service.setDependencies(mockRegistrationService as any);
			mockFindMemberBySessionName.mockResolvedValue({
				member: { agentStatus: 'active' },
			});
			await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');

			await service.rehydrateAgent('agent-dev');

			expect(service.isSuspended('agent-dev')).toBe(false);
		});
	});

	describe('isSuspended', () => {
		it('should return false for unknown sessions', () => {
			const service = AgentSuspendService.getInstance();
			expect(service.isSuspended('unknown')).toBe(false);
		});

		it('should return true for suspended agents', async () => {
			const service = AgentSuspendService.getInstance();
			await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');
			expect(service.isSuspended('agent-dev')).toBe(true);
		});
	});

	describe('isRehydrating', () => {
		it('should return false when no rehydration is in progress', () => {
			const service = AgentSuspendService.getInstance();
			expect(service.isRehydrating('agent-dev')).toBe(false);
		});
	});

	describe('removeSuspended', () => {
		it('should remove an agent from the suspended map', async () => {
			const service = AgentSuspendService.getInstance();
			await service.suspendAgent('agent-dev', 'team1', 'member1', 'developer');
			expect(service.isSuspended('agent-dev')).toBe(true);

			service.removeSuspended('agent-dev');
			expect(service.isSuspended('agent-dev')).toBe(false);
		});

		it('should not throw for unknown sessions', () => {
			const service = AgentSuspendService.getInstance();
			expect(() => service.removeSuspended('unknown')).not.toThrow();
		});
	});

	describe('getSuspendedCount', () => {
		it('should return 0 initially', () => {
			const service = AgentSuspendService.getInstance();
			expect(service.getSuspendedCount()).toBe(0);
		});

		it('should reflect suspended agents', async () => {
			const service = AgentSuspendService.getInstance();
			await service.suspendAgent('agent-1', 'team1', 'member1', 'developer');
			await service.suspendAgent('agent-2', 'team1', 'member2', 'qa');
			expect(service.getSuspendedCount()).toBe(2);
		});
	});
});
