import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { existsSync, rmSync } from 'fs';
import {
	AgentHeartbeatService,
	AgentStatusBatcher,
	updateAgentHeartbeat,
	type AgentHeartbeat,
	type TeamAgentStatusFile,
	type BatchedStatusUpdate
} from './agent-heartbeat.service.js';
import {
	CREWLY_CONSTANTS,
	AGENT_IDENTITY_CONSTANTS,
	TIMING_CONSTANTS
} from '../../constants.js';

// Mock the logger service
jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({
				debug: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn()
			})
		})
	}
}));

describe('AgentHeartbeatService', () => {
	let service: AgentHeartbeatService;
	let testDir: string;

	beforeEach(async () => {
		// Create a temporary directory for testing
		testDir = path.join(os.tmpdir(), `crewly-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
		await fs.mkdir(testDir, { recursive: true });

		// Clear singleton instance
		AgentHeartbeatService.clearInstance();

		// Create service with test directory
		service = AgentHeartbeatService.getInstance(testDir);
	});

	afterEach(async () => {
		// Clear singleton and clean up test directory
		AgentHeartbeatService.clearInstance();
		if (existsSync(testDir)) {
			// Restore permissions before cleanup in case a test made the dir read-only
			try {
				await fs.chmod(testDir, 0o755);
			} catch {
				// Ignore errors when restoring permissions
			}
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Singleton Pattern', () => {
		test('should return same instance for multiple calls', () => {
			const instance1 = AgentHeartbeatService.getInstance(testDir);
			const instance2 = AgentHeartbeatService.getInstance(testDir);
			expect(instance1).toBe(instance2);
		});

		test('should clear instance properly', () => {
			const instance1 = AgentHeartbeatService.getInstance(testDir);
			AgentHeartbeatService.clearInstance();
			const instance2 = AgentHeartbeatService.getInstance(testDir);
			expect(instance1).not.toBe(instance2);
		});
	});

	describe('updateAgentHeartbeat', () => {
		test('should update orchestrator heartbeat', async () => {
			const sessionName = AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.SESSION_NAME;

			await service.updateAgentHeartbeat(sessionName);

			// Flush pending updates
			await service.flushPendingUpdates();

			const heartbeat = await service.getAgentHeartbeat(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID);
			expect(heartbeat).not.toBeNull();
			expect(heartbeat!.agentId).toBe(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID);
			expect(heartbeat!.sessionName).toBe(sessionName);
			expect(heartbeat!.agentStatus).toBe(CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE);
			expect(heartbeat!.teamMemberId).toBeUndefined();
		});

		test('should update team member heartbeat with teamMemberId', async () => {
			const sessionName = 'dev-session-1';
			const teamMemberId = 'member_123';

			await service.updateAgentHeartbeat(sessionName, teamMemberId);

			// Flush pending updates
			await service.flushPendingUpdates();

			const heartbeat = await service.getAgentHeartbeat(teamMemberId);
			expect(heartbeat).not.toBeNull();
			expect(heartbeat!.agentId).toBe(teamMemberId);
			expect(heartbeat!.sessionName).toBe(sessionName);
			expect(heartbeat!.teamMemberId).toBe(teamMemberId);
			expect(heartbeat!.agentStatus).toBe(CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE);
		});

		test('should update team member heartbeat without teamMemberId', async () => {
			const sessionName = 'qa-session-2';

			await service.updateAgentHeartbeat(sessionName);

			// Flush pending updates
			await service.flushPendingUpdates();

			const heartbeat = await service.getAgentHeartbeat(sessionName);
			expect(heartbeat).not.toBeNull();
			expect(heartbeat!.agentId).toBe(sessionName);
			expect(heartbeat!.sessionName).toBe(sessionName);
			expect(heartbeat!.agentStatus).toBe(CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE);
		});

		test('should handle different agent statuses', async () => {
			const sessionName = 'test-session';
			const teamMemberId = 'member_456';

			// Test activating status
			await service.updateAgentHeartbeat(sessionName, teamMemberId, CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVATING);
			await service.flushPendingUpdates();

			let heartbeat = await service.getAgentHeartbeat(teamMemberId);
			expect(heartbeat!.agentStatus).toBe(CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVATING);

			// Test active status
			await service.updateAgentHeartbeat(sessionName, teamMemberId, CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE);
			await service.flushPendingUpdates();

			heartbeat = await service.getAgentHeartbeat(teamMemberId);
			expect(heartbeat!.agentStatus).toBe(CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE);
		});

		test('should not throw on errors', async () => {
			// Test with invalid inputs that might cause errors
			await expect(service.updateAgentHeartbeat('')).resolves.toBeUndefined();
			await expect(service.updateAgentHeartbeat('valid-session', '')).resolves.toBeUndefined();
		});
	});

	describe('File Management', () => {
		test('should create teamAgentStatus.json with proper structure', async () => {
			await service.updateAgentHeartbeat('test-session');
			await service.flushPendingUpdates();

			const statusFile = path.join(testDir, 'teamAgentStatus.json');
			expect(existsSync(statusFile)).toBe(true);

			const content = await fs.readFile(statusFile, 'utf-8');
			const data = JSON.parse(content) as TeamAgentStatusFile;

			expect(data).toHaveProperty('orchestrator');
			expect(data).toHaveProperty('teamMembers');
			expect(data).toHaveProperty('metadata');
			expect(data.metadata).toHaveProperty('lastUpdated');
			expect(data.metadata).toHaveProperty('version');
		});

		test('should handle corrupted file gracefully', async () => {
			const statusFile = path.join(testDir, 'teamAgentStatus.json');

			// Create corrupted file
			await fs.writeFile(statusFile, 'invalid json content');

			// Service should handle this gracefully
			await service.updateAgentHeartbeat('test-session');
			await service.flushPendingUpdates();

			// File should be recreated with valid structure
			const content = await fs.readFile(statusFile, 'utf-8');
			expect(() => JSON.parse(content)).not.toThrow();
		});

		test('should handle missing file gracefully', async () => {
			const statusFile = path.join(testDir, 'teamAgentStatus.json');
			expect(existsSync(statusFile)).toBe(false);

			await service.updateAgentHeartbeat('test-session');
			await service.flushPendingUpdates();

			expect(existsSync(statusFile)).toBe(true);
		});
	});

	describe('getAllAgentHeartbeats', () => {
		test('should return complete status data', async () => {
			// Add some test data
			await service.updateAgentHeartbeat(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.SESSION_NAME);
			await service.updateAgentHeartbeat('dev-session', 'member_1');
			await service.updateAgentHeartbeat('qa-session', 'member_2');
			await service.flushPendingUpdates();

			const allData = await service.getAllAgentHeartbeats();

			expect(allData.orchestrator).toBeDefined();
			expect(allData.teamMembers).toBeDefined();
			expect(Object.keys(allData.teamMembers)).toHaveLength(2);
			expect(allData.teamMembers).toHaveProperty('member_1');
			expect(allData.teamMembers).toHaveProperty('member_2');
		});
	});

	describe('detectStaleAgents', () => {
		test('should detect no stale agents when all are recent', async () => {
			await service.updateAgentHeartbeat(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.SESSION_NAME);
			await service.updateAgentHeartbeat('dev-session', 'member_1');
			await service.flushPendingUpdates();

			const staleAgents = await service.detectStaleAgents(30);
			expect(staleAgents).toHaveLength(0);
		});

		test('should detect stale agents correctly', async () => {
			// First add agents with recent activity
			await service.updateAgentHeartbeat(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.SESSION_NAME);
			await service.updateAgentHeartbeat('dev-session', 'member_1');
			await service.flushPendingUpdates();

			// Manually modify the status file to simulate old timestamps
			const statusData = await service.getAllAgentHeartbeats();
			const oldTime = new Date(Date.now() - 35 * 60 * 1000).toISOString(); // 35 minutes ago

			// Make orchestrator stale
			statusData.orchestrator.lastActiveTime = oldTime;
			statusData.orchestrator.agentStatus = CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE;

			// Make team member stale
			statusData.teamMembers['member_1'].lastActiveTime = oldTime;
			statusData.teamMembers['member_1'].agentStatus = CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE;

			// Save the modified data
			const statusFile = path.join(testDir, 'teamAgentStatus.json');
			await fs.writeFile(statusFile, JSON.stringify(statusData, null, 2));

			const staleAgents = await service.detectStaleAgents(30);
			expect(staleAgents).toContain(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID);
			expect(staleAgents).toContain('member_1');
		});

		test('should not detect inactive agents as stale', async () => {
			await service.updateAgentHeartbeat('dev-session', 'member_1', CREWLY_CONSTANTS.AGENT_STATUSES.INACTIVE);
			await service.flushPendingUpdates();

			// Manually set old timestamp but keep inactive status
			const statusData = await service.getAllAgentHeartbeats();
			const oldTime = new Date(Date.now() - 35 * 60 * 1000).toISOString();
			statusData.teamMembers['member_1'].lastActiveTime = oldTime;

			const statusFile = path.join(testDir, 'teamAgentStatus.json');
			await fs.writeFile(statusFile, JSON.stringify(statusData, null, 2));

			const staleAgents = await service.detectStaleAgents(30);
			expect(staleAgents).not.toContain('member_1');
		});
	});
});

describe('AgentStatusBatcher', () => {
	let heartbeatService: AgentHeartbeatService;
	let batcher: AgentStatusBatcher;
	let testDir: string;

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `crewly-batcher-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
		await fs.mkdir(testDir, { recursive: true });

		AgentHeartbeatService.clearInstance();
		heartbeatService = AgentHeartbeatService.getInstance(testDir);
		batcher = new (AgentStatusBatcher as any)(heartbeatService);
	});

	afterEach(async () => {
		AgentHeartbeatService.clearInstance();
		batcher.clear();
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Batching Logic', () => {
		test('should batch multiple updates', () => {
			batcher.addUpdate('agent1', 'session1', CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE, 'member1');
			batcher.addUpdate('agent2', 'session2', CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE, 'member2');

			expect(batcher.getBatchSize()).toBe(2);
		});

		test('should replace existing updates for same agent', () => {
			batcher.addUpdate('agent1', 'session1', CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVATING, 'member1');
			batcher.addUpdate('agent1', 'session1', CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE, 'member1');

			expect(batcher.getBatchSize()).toBe(1);
		});

		test('should clear batch after flush', async () => {
			batcher.addUpdate('agent1', 'session1', CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE, 'member1');
			expect(batcher.getBatchSize()).toBe(1);

			await batcher.flushImmediately();
			expect(batcher.getBatchSize()).toBe(0);
		});

		test('should clear pending updates', () => {
			batcher.addUpdate('agent1', 'session1', CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE, 'member1');
			batcher.addUpdate('agent2', 'session2', CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE, 'member2');

			expect(batcher.getBatchSize()).toBe(2);
			batcher.clear();
			expect(batcher.getBatchSize()).toBe(0);
		});
	});

	describe('Automatic Flushing', () => {
		test('should flush when batch size reaches maximum', async () => {
			// Mock the processBatchedUpdates method to track calls
			const processBatchedUpdatesSpy = jest.spyOn(heartbeatService, 'processBatchedUpdates');
			processBatchedUpdatesSpy.mockResolvedValue();

			// Add 50 updates (the max batch size)
			for (let i = 0; i < 50; i++) {
				batcher.addUpdate(`agent${i}`, `session${i}`, CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE, `member${i}`);
			}

			// Should trigger immediate flush
			expect(processBatchedUpdatesSpy).toHaveBeenCalledWith(expect.any(Array));
			expect(batcher.getBatchSize()).toBe(0);

			processBatchedUpdatesSpy.mockRestore();
		});

		test('should handle flush timeout', async () => {
			jest.useFakeTimers();

			const processBatchedUpdatesSpy = jest.spyOn(heartbeatService, 'processBatchedUpdates');
			processBatchedUpdatesSpy.mockResolvedValue();

			batcher.addUpdate('agent1', 'session1', CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE, 'member1');
			expect(batcher.getBatchSize()).toBe(1);

			// Fast-forward time to trigger timeout
			jest.advanceTimersByTime(TIMING_CONSTANTS.TIMEOUTS.TASK_MONITOR_POLL + 100);

			// Wait for async operations
			await jest.runAllTimersAsync();

			expect(processBatchedUpdatesSpy).toHaveBeenCalledWith(expect.any(Array));
			expect(batcher.getBatchSize()).toBe(0);

			processBatchedUpdatesSpy.mockRestore();
			jest.useRealTimers();
		});
	});
});

describe('updateAgentHeartbeat convenience function', () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `crewly-convenience-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
		await fs.mkdir(testDir, { recursive: true });
		AgentHeartbeatService.clearInstance();
	});

	afterEach(async () => {
		AgentHeartbeatService.clearInstance();
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test('should work with convenience function', async () => {
		// Mock the service to use our test directory
		const service = AgentHeartbeatService.getInstance(testDir);

		await updateAgentHeartbeat('test-session', 'member_123');
		await service.flushPendingUpdates();

		const heartbeat = await service.getAgentHeartbeat('member_123');
		expect(heartbeat).not.toBeNull();
		expect(heartbeat!.sessionName).toBe('test-session');
		expect(heartbeat!.teamMemberId).toBe('member_123');
	});

	test('should handle convenience function with different parameters', async () => {
		const service = AgentHeartbeatService.getInstance(testDir);

		// Test with orchestrator
		await updateAgentHeartbeat(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.SESSION_NAME);
		await service.flushPendingUpdates();

		const orchHeartbeat = await service.getAgentHeartbeat(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID);
		expect(orchHeartbeat).not.toBeNull();
		expect(orchHeartbeat!.agentId).toBe(AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID);

		// Test with custom status
		await updateAgentHeartbeat('custom-session', 'member_789', CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVATING);
		await service.flushPendingUpdates();

		const customHeartbeat = await service.getAgentHeartbeat('member_789');
		expect(customHeartbeat).not.toBeNull();
		expect(customHeartbeat!.agentStatus).toBe(CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVATING);
	});
});

describe('Error Handling', () => {
	let service: AgentHeartbeatService;
	let testDir: string;

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `crewly-error-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
		await fs.mkdir(testDir, { recursive: true });
		AgentHeartbeatService.clearInstance();
		service = AgentHeartbeatService.getInstance(testDir);
	});

	afterEach(async () => {
		AgentHeartbeatService.clearInstance();
		if (existsSync(testDir)) {
			// Restore permissions before cleanup
			try {
				await fs.chmod(testDir, 0o755);
			} catch {
				// Ignore errors when restoring permissions
			}
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test('should handle filesystem errors gracefully', async () => {
		// Remove write permissions to simulate filesystem error
		const statusFile = path.join(testDir, 'teamAgentStatus.json');
		await fs.writeFile(statusFile, '{}');
		await fs.chmod(testDir, 0o444); // Read-only

		// Should not throw, but log error
		await expect(service.updateAgentHeartbeat('test-session')).resolves.toBeUndefined();

		// flushPendingUpdates calls batcher.flushImmediately() which catches errors internally
		// and logs them rather than re-throwing, so it resolves successfully
		await expect(service.flushPendingUpdates()).resolves.toBeUndefined();

		// Restore permissions for cleanup
		await fs.chmod(testDir, 0o755);
	});

	test('should handle null/undefined inputs gracefully', async () => {
		await expect(service.updateAgentHeartbeat('')).resolves.toBeUndefined();
		await expect(service.getAgentHeartbeat('')).resolves.toBeNull();
		await expect(service.detectStaleAgents()).resolves.toEqual([]);
	});
});

describe('Performance and Concurrency', () => {
	let service: AgentHeartbeatService;
	let testDir: string;

	beforeEach(async () => {
		testDir = path.join(os.tmpdir(), `crewly-perf-test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
		await fs.mkdir(testDir, { recursive: true });
		AgentHeartbeatService.clearInstance();
		service = AgentHeartbeatService.getInstance(testDir);
	});

	afterEach(async () => {
		AgentHeartbeatService.clearInstance();
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	test('should handle concurrent updates efficiently', async () => {
		const promises: Promise<void>[] = [];

		// Create many concurrent updates
		for (let i = 0; i < 20; i++) {
			promises.push(service.updateAgentHeartbeat(`session-${i}`, `member-${i}`));
		}

		await Promise.all(promises);
		await service.flushPendingUpdates();

		const allData = await service.getAllAgentHeartbeats();
		expect(Object.keys(allData.teamMembers)).toHaveLength(20);
	});

	test('should maintain data consistency under concurrent access', async () => {
		const sessionName = 'concurrent-session';
		const teamMemberId = 'concurrent-member';

		// Multiple concurrent updates to same agent
		const promises = [
			service.updateAgentHeartbeat(sessionName, teamMemberId, CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVATING),
			service.updateAgentHeartbeat(sessionName, teamMemberId, CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE),
			service.updateAgentHeartbeat(sessionName, teamMemberId, CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE),
		];

		await Promise.all(promises);
		await service.flushPendingUpdates();

		const heartbeat = await service.getAgentHeartbeat(teamMemberId);
		expect(heartbeat).not.toBeNull();
		expect(heartbeat!.agentStatus).toBe(CREWLY_CONSTANTS.AGENT_STATUSES.ACTIVE);
	});
});
