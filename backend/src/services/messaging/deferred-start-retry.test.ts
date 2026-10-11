jest.mock('../core/logger.service.js', () => ({
	LoggerService: { getInstance: () => ({ createComponentLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }) }) },
}));

import { DEFERRED_START_RETRY_CONSTANTS, resetDeferredStartRetries, scheduleDeferredStartRetry } from './deferred-start-retry.js';

const sleep = async (): Promise<void> => undefined;

beforeEach(() => resetDeferredStartRetries());

describe('scheduleDeferredStartRetry', () => {
	it('retries until the start goes through', async () => {
		const results = [{ success: false, deferred: true }, { success: false, deferred: true }, { success: true }];
		const activate = jest.fn(async () => results.shift()!);
		await scheduleDeferredStartRetry('ella', { activate, hasPending: () => true, sleep });
		expect(activate).toHaveBeenCalledTimes(3);
	});

	it('stops when the queue has emptied', async () => {
		const activate = jest.fn(async () => ({ success: true }));
		await scheduleDeferredStartRetry('ella', { activate, hasPending: () => false, sleep });
		expect(activate).not.toHaveBeenCalled();
	});

	it('stops on a failure that is not a deferral', async () => {
		const activate = jest.fn(async () => ({ success: false }));
		await scheduleDeferredStartRetry('ella', { activate, hasPending: () => true, sleep });
		expect(activate).toHaveBeenCalledTimes(1);
	});

	it('is bounded', async () => {
		const activate = jest.fn(async () => ({ success: false, deferred: true }));
		await scheduleDeferredStartRetry('ella', { activate, hasPending: () => true, sleep });
		expect(activate).toHaveBeenCalledTimes(DEFERRED_START_RETRY_CONSTANTS.MAX_ROUNDS);
	});

	it('runs one loop per agent', async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => { release = r; });
		const activate = jest.fn(async () => { await gate; return { success: true }; });
		const first = scheduleDeferredStartRetry('ella', { activate, hasPending: () => true, sleep });
		await scheduleDeferredStartRetry('ella', { activate, hasPending: () => true, sleep });
		release();
		await first;
		expect(activate).toHaveBeenCalledTimes(1);
	});
});
