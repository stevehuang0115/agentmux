/**
 * Tests for ContextFlushService (#153)
 */

import { ContextFlushService } from './context-flush.service.js';

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

describe('ContextFlushService (#153)', () => {
	let service: ContextFlushService;

	beforeEach(() => {
		ContextFlushService.resetInstance();
		service = ContextFlushService.getInstance();
	});

	describe('singleton', () => {
		it('should return the same instance', () => {
			expect(ContextFlushService.getInstance()).toBe(service);
		});

		it('should create new instance after reset', () => {
			ContextFlushService.resetInstance();
			expect(ContextFlushService.getInstance()).not.toBe(service);
		});
	});

	describe('extract', () => {
		it('should extract task progress from text', () => {
			const text = 'I am currently working on the authentication service refactoring.';
			const items = service.extract(text);
			expect(items.length).toBeGreaterThan(0);
			expect(items[0].category).toBe('task_progress');
		});

		it('should extract decisions', () => {
			const text = 'We decided to use PostgreSQL instead of MongoDB for the user data.';
			const items = service.extract(text);
			const decisions = items.filter(i => i.category === 'decision');
			expect(decisions.length).toBeGreaterThan(0);
		});

		it('should extract technical details', () => {
			const text = 'The API endpoint is http://localhost:3000/api/health';
			const items = service.extract(text);
			const techDetails = items.filter(i => i.category === 'technical_detail');
			expect(techDetails.length).toBeGreaterThan(0);
		});

		it('should extract blockers', () => {
			const text = 'We are blocked on the CI/CD pipeline configuration issue';
			const items = service.extract(text);
			const blockers = items.filter(i => i.category === 'blocker');
			expect(blockers.length).toBeGreaterThan(0);
		});

		it('should extract preferences', () => {
			const text = 'The user wants detailed error messages in the response body';
			const items = service.extract(text);
			const prefs = items.filter(i => i.category === 'preference');
			expect(prefs.length).toBeGreaterThan(0);
		});

		it('should return empty array for irrelevant text', () => {
			const text = 'Hello world';
			const items = service.extract(text);
			expect(items).toEqual([]);
		});

		it('should deduplicate similar extractions', () => {
			const text = 'Currently working on auth. I am currently working on auth service.';
			const items = service.extract(text);
			// Should not have duplicate "auth" entries
			const contents = items.map(i => i.content.toLowerCase());
			const unique = new Set(contents);
			expect(contents.length).toBe(unique.size);
		});

		it('should cap at 20 items', () => {
			const text = Array.from({ length: 30 }, (_, i) =>
				`Currently working on feature ${i}. The port is ${3000 + i}. Decided to use tool ${i}.`
			).join('\n');
			const items = service.extract(text);
			expect(items.length).toBeLessThanOrEqual(20);
		});

		it('should respect minimum confidence threshold', () => {
			const text = 'Currently working on the migration. The port is 8080.';
			const highConfidence = service.extract(text, 0.9);
			const lowConfidence = service.extract(text, 0.5);
			expect(lowConfidence.length).toBeGreaterThanOrEqual(highConfidence.length);
		});
	});

	describe('flush', () => {
		it('should extract and save items via rememberFn', async () => {
			const rememberFn = jest.fn().mockResolvedValue(undefined);
			const text = 'Currently working on the auth service. The API port is 3000.';

			const result = await service.flush(text, 'agent-1', '/project', rememberFn);

			expect(result.extractedCount).toBeGreaterThan(0);
			expect(result.savedCount).toBe(result.extractedCount);
			expect(rememberFn).toHaveBeenCalledTimes(result.savedCount);
		});

		it('should continue on save failure', async () => {
			const rememberFn = jest.fn()
				.mockRejectedValueOnce(new Error('save failed'))
				.mockResolvedValue(undefined);

			const text = 'Working on feature X. The port is 8080.';
			const result = await service.flush(text, 'agent-1', '/project', rememberFn);

			// Should still attempt all items, just savedCount < extractedCount
			expect(result.extractedCount).toBeGreaterThan(0);
		});

		it('should return zero counts for irrelevant text', async () => {
			const rememberFn = jest.fn();
			const result = await service.flush('Hello', 'agent-1', '/project', rememberFn);

			expect(result.extractedCount).toBe(0);
			expect(result.savedCount).toBe(0);
			expect(rememberFn).not.toHaveBeenCalled();
		});
	});
});
