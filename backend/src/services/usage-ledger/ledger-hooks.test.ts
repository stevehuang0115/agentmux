import { notifyRequest, notifyUsage, setRequestObserver, setUsageObserver } from './ledger-hooks.js';

describe('ledger hooks', () => {
	afterEach(() => {
		setUsageObserver(null);
		setRequestObserver(null);
	});

	it('does nothing without an observer', () => {
		expect(() => notifyUsage('s', { timestamp: 't', agentId: 's', input: 1, output: 1, model: 'm' })).not.toThrow();
		expect(() => notifyRequest({ traceId: 't', requestId: 'r', title: 't' })).not.toThrow();
	});

	it('never lets an observer break the caller', () => {
		setUsageObserver(() => {
			throw new Error('boom');
		});
		setRequestObserver(() => {
			throw new Error('boom');
		});
		expect(() => notifyUsage('s', { timestamp: 't', agentId: 's', input: 1, output: 1, model: 'm' })).not.toThrow();
		expect(() => notifyRequest({ traceId: 't', requestId: 'r', title: 't' })).not.toThrow();
	});
});
