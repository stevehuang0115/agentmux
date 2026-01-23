/**
 * Factory Service Tests
 *
 * Tests for the Factory Service that provides data for 3D visualization
 *
 * @module services/factory.service.test
 */

import { FactoryService, ClaudeInstancesResponse, UsageStatsResponse } from './factory.service.js';

describe('FactoryService', () => {
	let factoryService: FactoryService;

	beforeEach(() => {
		factoryService = new FactoryService();
	});

	describe('getClaudeInstances', () => {
		it('should return a valid response structure', async () => {
			const result: ClaudeInstancesResponse = await factoryService.getClaudeInstances();

			expect(result).toHaveProperty('timestamp');
			expect(result).toHaveProperty('totalInstances');
			expect(result).toHaveProperty('activeCount');
			expect(result).toHaveProperty('idleCount');
			expect(result).toHaveProperty('dormantCount');
			expect(result).toHaveProperty('totalSessionTokens');
			expect(result).toHaveProperty('instances');
			expect(Array.isArray(result.instances)).toBe(true);
		});

		it('should have valid counts', async () => {
			const result = await factoryService.getClaudeInstances();

			expect(typeof result.totalInstances).toBe('number');
			expect(typeof result.activeCount).toBe('number');
			expect(typeof result.idleCount).toBe('number');
			expect(typeof result.dormantCount).toBe('number');
			expect(result.totalInstances).toBeGreaterThanOrEqual(0);
		});

		it('should have instance counts that match', async () => {
			const result = await factoryService.getClaudeInstances();

			// Active + Idle + Dormant should equal total
			const sum = result.activeCount + result.idleCount + result.dormantCount;
			expect(sum).toBe(result.totalInstances);
		});
	});

	describe('getUsageStats', () => {
		it('should return a valid response structure', async () => {
			const result: UsageStatsResponse = await factoryService.getUsageStats();

			expect(result).toHaveProperty('timestamp');
			expect(result).toHaveProperty('today');
			expect(result).toHaveProperty('totals');
			expect(result).toHaveProperty('modelUsage');
			expect(result).toHaveProperty('recentDays');
		});

		it('should have valid today structure', async () => {
			const result = await factoryService.getUsageStats();

			expect(result.today).toHaveProperty('date');
			expect(result.today).toHaveProperty('messages');
			expect(result.today).toHaveProperty('sessions');
			expect(result.today).toHaveProperty('toolCalls');
			expect(result.today).toHaveProperty('tokens');

			expect(typeof result.today.date).toBe('string');
			expect(typeof result.today.messages).toBe('number');
			expect(typeof result.today.sessions).toBe('number');
			expect(typeof result.today.toolCalls).toBe('number');
			expect(typeof result.today.tokens).toBe('number');
		});

		it('should have valid totals structure', async () => {
			const result = await factoryService.getUsageStats();

			expect(result.totals).toHaveProperty('sessions');
			expect(result.totals).toHaveProperty('messages');

			expect(typeof result.totals.sessions).toBe('number');
			expect(typeof result.totals.messages).toBe('number');
		});

		it('should have valid modelUsage array', async () => {
			const result = await factoryService.getUsageStats();

			expect(Array.isArray(result.modelUsage)).toBe(true);

			// If there are model usages, check structure
			if (result.modelUsage.length > 0) {
				const firstModel = result.modelUsage[0];
				expect(firstModel).toHaveProperty('model');
				expect(firstModel).toHaveProperty('inputTokens');
				expect(firstModel).toHaveProperty('outputTokens');
				expect(firstModel).toHaveProperty('cacheReadTokens');
				expect(firstModel).toHaveProperty('cacheWriteTokens');
			}
		});

		it('should have valid recentDays array', async () => {
			const result = await factoryService.getUsageStats();

			expect(Array.isArray(result.recentDays)).toBe(true);

			// If there are recent days, check structure
			if (result.recentDays.length > 0) {
				const firstDay = result.recentDays[0];
				expect(firstDay).toHaveProperty('date');
				expect(firstDay).toHaveProperty('tokens');
				expect(typeof firstDay.date).toBe('string');
				expect(typeof firstDay.tokens).toBe('number');
			}
		});
	});

	describe('Instance Status', () => {
		it('should have valid status values in instances', async () => {
			const result = await factoryService.getClaudeInstances();

			for (const instance of result.instances) {
				expect(['active', 'idle', 'dormant']).toContain(instance.status);
				expect(typeof instance.pid).toBe('string');
				expect(typeof instance.projectName).toBe('string');
				expect(typeof instance.cpuPercent).toBe('number');
				expect(typeof instance.color).toBe('string');
			}
		});

		it('should have valid token percentages', async () => {
			const result = await factoryService.getClaudeInstances();

			for (const instance of result.instances) {
				expect(instance.tokenPercent).toBeGreaterThanOrEqual(0);
				expect(instance.tokenPercent).toBeLessThanOrEqual(100);
			}
		});

		it('should have token percentages sum to ~100 if instances exist', async () => {
			const result = await factoryService.getClaudeInstances();

			if (result.instances.length > 0 && result.totalSessionTokens > 0) {
				const sum = result.instances.reduce((s, i) => s + i.tokenPercent, 0);
				// Allow for rounding errors
				expect(sum).toBeGreaterThanOrEqual(99);
				expect(sum).toBeLessThanOrEqual(101);
			}
		});
	});
});
