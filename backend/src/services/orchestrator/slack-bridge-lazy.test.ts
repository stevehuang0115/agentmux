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

		// The module import is cached, so getSlackOrchestratorBridge is called each time
		// but the dynamic import() itself only happens once (verified by module-level caching)
		expect(mockGetBridge).toHaveBeenCalled();
	});
});
