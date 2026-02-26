/**
 * Tests for OrchestratorRestartService
 */

// Mock external dependencies
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

jest.mock('../memory/memory.service.js', () => ({
	MemoryService: {
		getInstance: () => ({
			initializeForSession: jest.fn().mockResolvedValue(undefined),
		}),
	},
}));

jest.mock('../../websocket/terminal.gateway.js', () => ({
	getTerminalGateway: () => ({
		startOrchestratorChatMonitoring: jest.fn(),
	}),
}));

jest.mock('../slack/slack.service.js', () => ({
	getSlackService: () => ({
		sendNotification: jest.fn().mockResolvedValue(undefined),
	}),
}));

const mockGetOrchestratorStatus = jest.fn();
jest.mock('../core/storage.service.js', () => ({
	StorageService: {
		getInstance: () => ({
			getOrchestratorStatus: mockGetOrchestratorStatus,
		}),
	},
}));

import { OrchestratorRestartService } from './orchestrator-restart.service.js';
import { ORCHESTRATOR_RESTART_CONSTANTS, RUNTIME_TYPES } from '../../constants.js';

describe('OrchestratorRestartService', () => {
	let service: OrchestratorRestartService;
	let mockAgentRegistrationService: {
		createAgentSession: jest.Mock;
	};
	let mockSessionBackend: {
		sessionExists: jest.Mock;
		killSession: jest.Mock;
	};
	let mockSocketIO: {
		emit: jest.Mock;
	};

	beforeEach(() => {
		OrchestratorRestartService.resetInstance();
		service = OrchestratorRestartService.getInstance();

		mockAgentRegistrationService = {
			createAgentSession: jest.fn().mockResolvedValue({ success: true }),
		};
		mockSessionBackend = {
			sessionExists: jest.fn().mockReturnValue(true),
			killSession: jest.fn().mockResolvedValue(undefined),
		};
		mockSocketIO = {
			emit: jest.fn(),
		};

		service.setDependencies(
			mockAgentRegistrationService as any,
			mockSessionBackend as any,
			mockSocketIO
		);

		mockGetOrchestratorStatus.mockResolvedValue({
			runtimeType: RUNTIME_TYPES.CLAUDE_CODE,
		});
	});

	afterEach(() => {
		OrchestratorRestartService.resetInstance();
	});

	describe('singleton', () => {
		it('should return the same instance', () => {
			const instance1 = OrchestratorRestartService.getInstance();
			const instance2 = OrchestratorRestartService.getInstance();
			expect(instance1).toBe(instance2);
		});
	});

	describe('isRestartAllowed', () => {
		it('should allow restart when no restarts have occurred', () => {
			expect(service.isRestartAllowed()).toBe(true);
		});

		it('should deny restart after max restarts in window', async () => {
			// Exhaust restart allowance
			for (let i = 0; i < ORCHESTRATOR_RESTART_CONSTANTS.MAX_RESTARTS_PER_WINDOW; i++) {
				await service.attemptRestart();
			}

			expect(service.isRestartAllowed()).toBe(false);
		});
	});

	describe('attemptRestart', () => {
		it('should successfully restart the orchestrator', async () => {
			const result = await service.attemptRestart();

			expect(result).toBe(true);
			expect(mockSessionBackend.killSession).toHaveBeenCalled();
			expect(mockAgentRegistrationService.createAgentSession).toHaveBeenCalled();
			expect(mockSocketIO.emit).toHaveBeenCalledWith('orchestrator:restarted', expect.any(Object));
		});

		it('should return false when dependencies are not set', async () => {
			OrchestratorRestartService.resetInstance();
			const freshService = OrchestratorRestartService.getInstance();
			// Don't set dependencies

			const result = await freshService.attemptRestart();

			expect(result).toBe(false);
		});

		it('should return false when createAgentSession fails', async () => {
			mockAgentRegistrationService.createAgentSession.mockResolvedValueOnce({
				success: false,
				error: 'session creation failed',
			});

			const result = await service.attemptRestart();

			expect(result).toBe(false);
		});

		it('should return false when cooldown is active', async () => {
			// Exhaust restarts
			for (let i = 0; i < ORCHESTRATOR_RESTART_CONSTANTS.MAX_RESTARTS_PER_WINDOW; i++) {
				await service.attemptRestart();
			}

			const result = await service.attemptRestart();

			expect(result).toBe(false);
		});

		it('should prevent concurrent restarts', async () => {
			// Start two restarts simultaneously
			const promise1 = service.attemptRestart();
			const promise2 = service.attemptRestart();

			const [result1, result2] = await Promise.all([promise1, promise2]);

			// One should succeed, the other should be rejected as concurrent
			expect([result1, result2]).toContain(true);
			expect([result1, result2]).toContain(false);
		});

		it('should handle killSession error gracefully', async () => {
			mockSessionBackend.killSession.mockRejectedValueOnce(new Error('kill failed'));

			const result = await service.attemptRestart();

			// Should still succeed even if kill fails
			expect(result).toBe(true);
		});

		it('should continue when session does not exist', async () => {
			mockSessionBackend.sessionExists.mockReturnValue(false);

			const result = await service.attemptRestart();

			expect(result).toBe(true);
			expect(mockSessionBackend.killSession).not.toHaveBeenCalled();
		});

		it('should restart orchestrator with stored runtime type', async () => {
			mockGetOrchestratorStatus.mockResolvedValueOnce({
				runtimeType: RUNTIME_TYPES.GEMINI_CLI,
			});

			const result = await service.attemptRestart();

			expect(result).toBe(true);
			expect(mockAgentRegistrationService.createAgentSession).toHaveBeenCalledWith(
				expect.objectContaining({ runtimeType: RUNTIME_TYPES.GEMINI_CLI })
			);
		});
	});

	describe('getRestartStats', () => {
		it('should return initial stats with zero restarts', () => {
			const stats = service.getRestartStats();

			expect(stats.totalRestarts).toBe(0);
			expect(stats.restartsInWindow).toBe(0);
			expect(stats.isRestarting).toBe(false);
			expect(stats.lastRestartAt).toBeNull();
			expect(stats.restartAllowed).toBe(true);
		});

		it('should track restart count after successful restart', async () => {
			await service.attemptRestart();

			const stats = service.getRestartStats();

			expect(stats.totalRestarts).toBe(1);
			expect(stats.restartsInWindow).toBe(1);
			expect(stats.lastRestartAt).not.toBeNull();
		});
	});
});
