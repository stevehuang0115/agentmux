/**
 * Tests for async utilities
 */

import { delay, withTimeout, withTimeoutError } from './async.utils.js';

describe('async.utils', () => {
	describe('delay', () => {
		it('should resolve after specified time', async () => {
			const start = Date.now();
			await delay(100);
			const elapsed = Date.now() - start;

			// Allow some tolerance for timing
			expect(elapsed).toBeGreaterThanOrEqual(90);
			expect(elapsed).toBeLessThan(200);
		});

		it('should return void', async () => {
			const result = await delay(10);
			expect(result).toBeUndefined();
		});

		it('should handle zero delay', async () => {
			const start = Date.now();
			await delay(0);
			const elapsed = Date.now() - start;

			expect(elapsed).toBeLessThan(50);
		});
	});

	describe('withTimeout', () => {
		it('should return function result when it completes before timeout', async () => {
			const fn = async () => {
				await delay(50);
				return 'success';
			};

			const result = await withTimeout(fn, 500, 'default');
			expect(result).toBe('success');
		});

		it('should return default value when function times out', async () => {
			const fn = async () => {
				await delay(500);
				return 'success';
			};

			const result = await withTimeout(fn, 50, 'default');
			expect(result).toBe('default');
		});

		it('should work with null default value', async () => {
			const fn = async () => {
				await delay(500);
				return 'success';
			};

			const result = await withTimeout(fn, 50, null);
			expect(result).toBeNull();
		});

		it('should work with boolean default value', async () => {
			const fn = async () => {
				await delay(500);
				return true;
			};

			const result = await withTimeout(fn, 50, false);
			expect(result).toBe(false);
		});
	});

	describe('withTimeoutError', () => {
		it('should return function result when it completes before timeout', async () => {
			const fn = async () => {
				await delay(50);
				return 'success';
			};

			const result = await withTimeoutError(fn, 500, 'Timeout error');
			expect(result).toBe('success');
		});

		it('should throw error when function times out', async () => {
			const fn = async () => {
				await delay(500);
				return 'success';
			};

			await expect(
				withTimeoutError(fn, 50, 'Operation timed out')
			).rejects.toThrow('Operation timed out');
		});

		it('should propagate errors from the function', async () => {
			const fn = async () => {
				throw new Error('Function error');
			};

			await expect(
				withTimeoutError(fn, 500, 'Timeout error')
			).rejects.toThrow('Function error');
		});
	});
});
