/**
 * Tests for slack-bridge-lazy module.
 * Verifies lazy import caching and delegation to getSlackOrchestratorBridge.
 */

const mockBridgeInstance = { send: jest.fn() };
const mockGetBridge = jest.fn().mockReturnValue(mockBridgeInstance);

jest.mock('../slack/slack-orchestrator-bridge.js', () => ({
	getSlackOrchestratorBridge: mockGetBridge,
}));

import { getSlackBridgeLazy } from './slack-bridge-lazy.js';

describe('getSlackBridgeLazy', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should return the bridge instance', async () => {
		const bridge = await getSlackBridgeLazy();
		expect(bridge).toBe(mockBridgeInstance);
		expect(mockGetBridge).toHaveBeenCalledTimes(1);
	});

	it('should cache the imported function across calls', async () => {
		await getSlackBridgeLazy();
		await getSlackBridgeLazy();

		// getSlackOrchestratorBridge is called each time (returns the bridge instance),
		// but the dynamic import() itself only happens once (module-level caching)
		expect(mockGetBridge).toHaveBeenCalledTimes(2);
	});
});
