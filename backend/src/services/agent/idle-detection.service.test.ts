/**
 * Tests for IdleDetectionService
 */

import { IdleDetectionService } from './idle-detection.service.js';
import { PtyActivityTrackerService } from './pty-activity-tracker.service.js';
import { AgentSuspendService } from './agent-suspend.service.js';
import { AGENT_SUSPEND_CONSTANTS } from '../../constants.js';

// Mock LoggerService
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

// Mock settings service
const mockGetSettings = jest.fn().mockResolvedValue({
	general: { agentIdleTimeoutMinutes: 10 },
});

jest.mock('../settings/index.js', () => ({
	getSettingsService: () => ({
		getSettings: mockGetSettings,
	}),
}));

// Mock storage service
const mockGetTeams = jest.fn();
jest.mock('../core/storage.service.js', () => ({
	StorageService: {
		getInstance: () => ({
			getTeams: mockGetTeams,
		}),
	},
}));

// Mock AgentSuspendService
const mockSuspendAgent = jest.fn().mockResolvedValue(true);
const mockIsSuspended = jest.fn().mockReturnValue(false);
const mockIsRehydrating = jest.fn().mockReturnValue(false);

jest.mock('./agent-suspend.service.js', () => ({
	AgentSuspendService: {
		getInstance: () => ({
			suspendAgent: mockSuspendAgent,
			isSuspended: mockIsSuspended,
			isRehydrating: mockIsRehydrating,
		}),
		resetInstance: jest.fn(),
	},
}));

// Mock PtyActivityTrackerService
const mockIsIdleFor = jest.fn();

jest.mock('./pty-activity-tracker.service.js', () => ({
	PtyActivityTrackerService: {
		getInstance: () => ({
			isIdleFor: mockIsIdleFor,
		}),
		resetInstance: jest.fn(),
	},
}));

describe('IdleDetectionService', () => {
	beforeEach(() => {
		IdleDetectionService.resetInstance();
		jest.clearAllMocks();
		// Reset implementations that may linger from previous tests
		mockGetSettings.mockResolvedValue({ general: { agentIdleTimeoutMinutes: 10 } });
		mockIsSuspended.mockReturnValue(false);
		mockIsRehydrating.mockReturnValue(false);
		jest.useFakeTimers();
	});

	afterEach(() => {
		IdleDetectionService.resetInstance();
		jest.useRealTimers();
	});

	describe('getInstance', () => {
		it('should return a singleton instance', () => {
			const a = IdleDetectionService.getInstance();
			const b = IdleDetectionService.getInstance();
			expect(a).toBe(b);
		});
	});

	describe('start/stop', () => {
		it('should start the check cycle', () => {
			const service = IdleDetectionService.getInstance();
			service.start();
			expect(service.isRunning()).toBe(true);
			service.stop();
		});

		it('should stop the check cycle', () => {
			const service = IdleDetectionService.getInstance();
			service.start();
			service.stop();
			expect(service.isRunning()).toBe(false);
		});

		it('should not start twice', () => {
			const service = IdleDetectionService.getInstance();
			service.start();
			service.start(); // Should warn, not create second timer
			expect(service.isRunning()).toBe(true);
			service.stop();
		});
	});

	describe('performCheck', () => {
		it('should skip when timeout is 0 (disabled)', async () => {
			mockGetSettings.mockResolvedValueOnce({
				general: { agentIdleTimeoutMinutes: 0 },
			});

			const service = IdleDetectionService.getInstance();
			await service.performCheck();

			expect(mockGetTeams).not.toHaveBeenCalled();
		});

		it('should skip orchestrator role agents', async () => {
			mockGetTeams.mockResolvedValue([
				{
					id: 'team1',
					members: [
						{
							id: 'orc1',
							sessionName: 'crewly-orc',
							role: 'orchestrator',
							agentStatus: 'active',
						},
					],
				},
			]);

			const service = IdleDetectionService.getInstance();
			await service.performCheck();

			expect(mockSuspendAgent).not.toHaveBeenCalled();
		});

		it('should skip non-active agents', async () => {
			mockGetTeams.mockResolvedValue([
				{
					id: 'team1',
					members: [
						{
							id: 'dev1',
							sessionName: 'agent-dev',
							role: 'developer',
							agentStatus: 'inactive',
						},
					],
				},
			]);

			const service = IdleDetectionService.getInstance();
			await service.performCheck();

			expect(mockIsIdleFor).not.toHaveBeenCalled();
		});

		it('should suspend idle agents', async () => {
			mockGetTeams.mockResolvedValue([
				{
					id: 'team1',
					members: [
						{
							id: 'dev1',
							sessionName: 'agent-dev',
							role: 'developer',
							agentStatus: 'active',
						},
					],
				},
			]);
			mockIsIdleFor.mockReturnValue(true);

			const service = IdleDetectionService.getInstance();
			await service.performCheck();

			expect(mockSuspendAgent).toHaveBeenCalledWith('agent-dev', 'team1', 'dev1', 'developer');
		});

		it('should not suspend non-idle agents', async () => {
			mockGetTeams.mockResolvedValue([
				{
					id: 'team1',
					members: [
						{
							id: 'dev1',
							sessionName: 'agent-dev',
							role: 'developer',
							agentStatus: 'active',
						},
					],
				},
			]);
			mockIsIdleFor.mockReturnValue(false);

			const service = IdleDetectionService.getInstance();
			await service.performCheck();

			expect(mockSuspendAgent).not.toHaveBeenCalled();
		});

		it('should skip already suspended agents', async () => {
			mockGetTeams.mockResolvedValue([
				{
					id: 'team1',
					members: [
						{
							id: 'dev1',
							sessionName: 'agent-dev',
							role: 'developer',
							agentStatus: 'active',
						},
					],
				},
			]);
			mockIsSuspended.mockReturnValue(true);
			mockIsIdleFor.mockReturnValue(true);

			const service = IdleDetectionService.getInstance();
			await service.performCheck();

			expect(mockSuspendAgent).not.toHaveBeenCalled();
		});

		it('should handle getTeams failure gracefully', async () => {
			mockGetTeams.mockRejectedValue(new Error('Storage error'));

			const service = IdleDetectionService.getInstance();
			await expect(service.performCheck()).resolves.not.toThrow();
		});

		it('should check agents with started status', async () => {
			mockGetTeams.mockResolvedValue([
				{
					id: 'team1',
					members: [
						{
							id: 'dev1',
							sessionName: 'agent-dev',
							role: 'developer',
							agentStatus: 'started',
						},
					],
				},
			]);
			mockIsIdleFor.mockReturnValue(true);

			const service = IdleDetectionService.getInstance();
			await service.performCheck();

			// Should use the longer started agent timeout
			expect(mockIsIdleFor).toHaveBeenCalledWith(
				'agent-dev',
				AGENT_SUSPEND_CONSTANTS.STARTED_AGENT_IDLE_TIMEOUT_MINUTES * 60 * 1000
			);
			expect(mockSuspendAgent).toHaveBeenCalledWith('agent-dev', 'team1', 'dev1', 'developer');
		});

		it('should not check agents with activating status', async () => {
			mockGetTeams.mockResolvedValue([
				{
					id: 'team1',
					members: [
						{
							id: 'dev1',
							sessionName: 'agent-dev',
							role: 'developer',
							agentStatus: 'activating',
						},
					],
				},
			]);

			const service = IdleDetectionService.getInstance();
			await service.performCheck();

			expect(mockIsIdleFor).not.toHaveBeenCalled();
		});

		it('should use default timeout when settings read fails', async () => {
			mockGetSettings.mockRejectedValueOnce(new Error('Settings error'));
			mockGetTeams.mockResolvedValueOnce([
				{
					id: 'team1',
					members: [
						{
							id: 'dev1',
							sessionName: 'agent-dev',
							role: 'developer',
							agentStatus: 'active',
						},
					],
				},
			]);
			mockIsIdleFor.mockReturnValueOnce(true);

			const service = IdleDetectionService.getInstance();
			await service.performCheck();

			// Should still call isIdleFor with default timeout (10 min = 600000ms)
			expect(mockIsIdleFor).toHaveBeenCalledWith('agent-dev', 600000);
			expect(mockSuspendAgent).toHaveBeenCalled();
		});
	});
});
