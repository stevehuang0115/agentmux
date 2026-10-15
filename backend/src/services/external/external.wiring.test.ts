/**
 * Tests for the external layer wiring: shared parts, env switch, start/stop.
 */

const mockRecord = jest.fn();
jest.mock('../people/acting-for.service.js', () => ({ getActingFor: () => ({ record: mockRecord }) }));
const mockClient = { isAvailable: jest.fn(() => false), request: jest.fn() };
jest.mock('../apps/apps.wiring.js', () => ({ getAppsParts: () => ({ client: mockClient }) }));
jest.mock('../core/logger.service.js', () => ({
	LoggerService: { getInstance: () => ({ createComponentLogger: () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() }) }) },
}));

import { getExternalParts, setExternalParts, startExternalLayer, stopExternalLayer } from './external.wiring.js';

describe('external wiring', () => {
	afterEach(() => {
		stopExternalLayer();
		setExternalParts(null);
		delete process.env.CREWLY_EXTERNAL;
	});

	it('builds one set of parts', () => {
		expect(getExternalParts()).toBe(getExternalParts());
	});

	it('does not start when CREWLY_EXTERNAL=0', () => {
		process.env.CREWLY_EXTERNAL = '0';
		expect(startExternalLayer({ skillsPath: '/sk', sendToAgent: async () => true, getTeams: async () => [] })).toBe(false);
	});

	it('starts the poller otherwise', () => {
		const start = jest.fn();
		setExternalParts({ ...getExternalParts(), poller: { start, stop: jest.fn() } as never });
		expect(startExternalLayer({ skillsPath: '/sk', sendToAgent: async () => true, getTeams: async () => [] })).toBe(true);
		expect(start).toHaveBeenCalled();
	});
});
