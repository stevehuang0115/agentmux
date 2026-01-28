/**
 * Factory SSE Service Tests
 *
 * Tests for the Server-Sent Events service that provides real-time
 * Claude instance updates to connected clients.
 */

import { Response } from 'express';
import { FactorySSEService, SSEEvent } from './factory-sse.service.js';
import { FactoryService, FactoryStateResponse } from '../factory.service.js';

/** Extended Response type for testing */
interface MockSSEResponse extends Response {
	writtenData: string[];
	closeHandlers: Array<() => void>;
}

function createMockResponse(): MockSSEResponse {
	const writtenData: string[] = [];
	const closeHandlers: Array<() => void> = [];

	// Create mock response object with correct typing
	const mockRes: Partial<MockSSEResponse> = {
		writtenData,
		closeHandlers,
		write: jest.fn((data: string): boolean => {
			writtenData.push(data);
			return true;
		}) as unknown as MockSSEResponse['write'],
		end: jest.fn() as unknown as MockSSEResponse['end'],
	};

	// Add 'on' method that returns self for chaining
	mockRes.on = jest.fn((event: string, handler: () => void): MockSSEResponse => {
		if (event === 'close') {
			closeHandlers.push(handler);
		}
		return mockRes as MockSSEResponse;
	}) as unknown as MockSSEResponse['on'];

	return mockRes as MockSSEResponse;
}

/**
 * Creates a mock FactoryStateResponse
 */
function createMockFactoryStateResponse(overrides?: Partial<FactoryStateResponse>): FactoryStateResponse {
	return {
		timestamp: new Date().toISOString(),
		agents: [
			{
				id: 'instance-1',
				sessionName: 'claude-12345',
				name: 'Claude Agent 1',
				projectName: 'ProjectA',
				status: 'active',
				cpuPercent: 50,
				activity: 'Edit: file.ts',
				sessionTokens: 500,
			},
			{
				id: 'instance-2',
				sessionName: 'claude-12346',
				name: 'Claude Agent 2',
				projectName: 'ProjectB',
				status: 'idle',
				cpuPercent: 0,
				activity: '',
				sessionTokens: 500,
			},
		],
		projects: ['ProjectA', 'ProjectB'],
		stats: {
			activeCount: 1,
			idleCount: 1,
			dormantCount: 0,
			totalTokens: 1000,
		},
		...overrides,
	};
}

describe('FactorySSEService', () => {
	let mockFactoryService: jest.Mocked<FactoryService>;
	let service: FactorySSEService;

	beforeEach(() => {
		jest.useFakeTimers();

		// Create mock factory service
		mockFactoryService = {
			getFactoryState: jest.fn().mockResolvedValue(createMockFactoryStateResponse()),
		} as unknown as jest.Mocked<FactoryService>;

		// Create service with fast intervals for testing
		service = new FactorySSEService(mockFactoryService, {
			pollInterval: 100,
			heartbeatInterval: 500,
		});
	});

	afterEach(() => {
		service.shutdown();
		jest.useRealTimers();
	});

	describe('constructor', () => {
		it('should create service with default configuration', () => {
			const defaultService = new FactorySSEService();
			expect(defaultService.getClientCount()).toBe(0);
			expect(defaultService.isActive()).toBe(false);
			defaultService.shutdown();
		});

		it('should create service with custom configuration', () => {
			expect(service.getClientCount()).toBe(0);
			expect(service.isActive()).toBe(false);
		});
	});

	describe('addClient', () => {
		it('should add a client and send connected event', () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);

			expect(service.getClientCount()).toBe(1);
			expect(service.hasClient('client-1')).toBe(true);

			// Check that connected event was sent
			const connectedEvent = mockRes.writtenData.find((d) => d.includes('event: connected'));
			expect(connectedEvent).toBeDefined();
		});

		it('should start polling when first client connects', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);

			expect(service.isActive()).toBe(true);

			// Advance timer to trigger poll
			await jest.advanceTimersByTimeAsync(100);

			expect(mockFactoryService.getFactoryState).toHaveBeenCalled();
		});

		it('should send cached data immediately to new clients', async () => {
			const mockRes1 = createMockResponse();
			const mockRes2 = createMockResponse();

			// First client connects and triggers poll
			service.addClient('client-1', mockRes1);
			await jest.advanceTimersByTimeAsync(100);

			// Second client should receive cached data immediately
			service.addClient('client-2', mockRes2);

			const instancesEvent = mockRes2.writtenData.find((d) => d.includes('event: instances'));
			expect(instancesEvent).toBeDefined();
		});

		it('should register close handler for cleanup', () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);

			expect(mockRes.closeHandlers.length).toBeGreaterThan(0);
		});
	});

	describe('removeClient', () => {
		it('should remove client from tracking', () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);
			expect(service.hasClient('client-1')).toBe(true);

			service.removeClient('client-1');
			expect(service.hasClient('client-1')).toBe(false);
			expect(service.getClientCount()).toBe(0);
		});

		it('should stop polling when last client disconnects', () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);
			expect(service.isActive()).toBe(true);

			service.removeClient('client-1');
			expect(service.isActive()).toBe(false);
		});

		it('should continue polling if other clients remain', () => {
			const mockRes1 = createMockResponse();
			const mockRes2 = createMockResponse();

			service.addClient('client-1', mockRes1);
			service.addClient('client-2', mockRes2);

			service.removeClient('client-1');

			expect(service.isActive()).toBe(true);
			expect(service.getClientCount()).toBe(1);
		});
	});

	describe('polling and broadcasting', () => {
		it('should broadcast instances when data changes', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);

			// Clear initial writes
			mockRes.writtenData.length = 0;

			// Trigger poll
			await jest.advanceTimersByTimeAsync(100);

			// Should have received instances event
			const instancesEvent = mockRes.writtenData.find((d) => d.includes('event: instances'));
			expect(instancesEvent).toBeDefined();
		});

		it('should not broadcast if data has not changed', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);

			// First poll
			await jest.advanceTimersByTimeAsync(100);
			mockRes.writtenData.length = 0;

			// Second poll with same data
			await jest.advanceTimersByTimeAsync(100);

			// Should NOT have received another instances event (data unchanged)
			const instancesEvent = mockRes.writtenData.find((d) => d.includes('event: instances'));
			expect(instancesEvent).toBeUndefined();
		});

		it('should broadcast when significant data changes', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);

			// First poll
			await jest.advanceTimersByTimeAsync(100);
			mockRes.writtenData.length = 0;

			// Change the mock response - different stats to trigger change detection
			mockFactoryService.getFactoryState.mockResolvedValue(
				createMockFactoryStateResponse({
					stats: { activeCount: 2, idleCount: 0, dormantCount: 0, totalTokens: 2000 },
				})
			);

			// Second poll with changed data
			await jest.advanceTimersByTimeAsync(100);

			// Should have received new instances event
			const instancesEvent = mockRes.writtenData.find((d) => d.includes('event: instances'));
			expect(instancesEvent).toBeDefined();
		});

		it('should send heartbeat at configured interval', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);
			mockRes.writtenData.length = 0;

			// Advance past heartbeat interval
			await jest.advanceTimersByTimeAsync(500);

			const heartbeatEvent = mockRes.writtenData.find((d) => d.includes('event: heartbeat'));
			expect(heartbeatEvent).toBeDefined();
		});

		it('should broadcast error when polling fails', async () => {
			const mockRes = createMockResponse();

			mockFactoryService.getFactoryState.mockRejectedValue(new Error('Network error'));

			service.addClient('client-1', mockRes);
			mockRes.writtenData.length = 0;

			await jest.advanceTimersByTimeAsync(100);

			const errorEvent = mockRes.writtenData.find((d) => d.includes('event: error'));
			expect(errorEvent).toBeDefined();

			const dataLine = mockRes.writtenData.find((d) => d.includes('"POLL_ERROR"'));
			expect(dataLine).toBeDefined();
		});
	});

	describe('forcePoll', () => {
		it('should trigger an immediate poll', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);
			mockRes.writtenData.length = 0;

			// Change data - different stats to trigger change detection
			mockFactoryService.getFactoryState.mockResolvedValue(
				createMockFactoryStateResponse({ stats: { activeCount: 2, idleCount: 0, dormantCount: 0, totalTokens: 5000 } })
			);

			await service.forcePoll();

			const instancesEvent = mockRes.writtenData.find((d) => d.includes('event: instances'));
			expect(instancesEvent).toBeDefined();
		});
	});

	describe('shutdown', () => {
		it('should stop polling and clear clients', () => {
			const mockRes1 = createMockResponse();
			const mockRes2 = createMockResponse();

			service.addClient('client-1', mockRes1);
			service.addClient('client-2', mockRes2);

			expect(service.isActive()).toBe(true);
			expect(service.getClientCount()).toBe(2);

			service.shutdown();

			expect(service.isActive()).toBe(false);
			expect(service.getClientCount()).toBe(0);
			expect(service.getLastData()).toBeNull();
		});

		it('should call end on all client responses', () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);

			service.shutdown();

			expect(mockRes.end).toHaveBeenCalled();
		});
	});

	describe('getLastData', () => {
		it('should return null before any poll', () => {
			expect(service.getLastData()).toBeNull();
		});

		it('should return last polled data', async () => {
			const mockRes = createMockResponse();
			const expectedData = createMockFactoryStateResponse();
			mockFactoryService.getFactoryState.mockResolvedValue(expectedData);

			service.addClient('client-1', mockRes);
			await jest.advanceTimersByTimeAsync(100);

			const lastData = service.getLastData();
			expect(lastData).not.toBeNull();
			expect(lastData?.agents.length).toBe(expectedData.agents.length);
		});
	});

	describe('client disconnect handling', () => {
		it('should remove client when connection closes', () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);
			expect(service.hasClient('client-1')).toBe(true);

			// Simulate client disconnect
			mockRes.closeHandlers[0]();

			expect(service.hasClient('client-1')).toBe(false);
		});

		it('should handle write errors gracefully', async () => {
			const mockRes = createMockResponse();
			let writeCallCount = 0;

			// Fail write after initial connection
			(mockRes.write as jest.Mock).mockImplementation(() => {
				writeCallCount++;
				if (writeCallCount > 2) {
					throw new Error('Connection reset');
				}
				return true;
			});

			service.addClient('client-1', mockRes);

			// Change data to trigger broadcast - different stats
			mockFactoryService.getFactoryState.mockResolvedValue(
				createMockFactoryStateResponse({ stats: { activeCount: 2, idleCount: 0, dormantCount: 0, totalTokens: 10000 } })
			);

			await jest.advanceTimersByTimeAsync(100);

			// Client should have been removed due to write error
			expect(service.hasClient('client-1')).toBe(false);
		});
	});

	describe('SSE event format', () => {
		it('should send events in correct SSE format', () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);

			// Check SSE format: event: type\ndata: json\n\n
			expect(mockRes.writtenData[0]).toMatch(/^event: connected\n$/);
			expect(mockRes.writtenData[1]).toMatch(/^data: \{.*\}\n\n$/);
		});

		it('should include timestamp in event data', () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);

			const dataLine = mockRes.writtenData.find((d) => d.startsWith('data:'));
			expect(dataLine).toBeDefined();

			const eventData = JSON.parse(dataLine!.replace('data: ', '').replace('\n\n', '')) as SSEEvent;
			expect(eventData.timestamp).toBeDefined();
			expect(new Date(eventData.timestamp).getTime()).not.toBeNaN();
		});
	});

	describe('hash-based change detection', () => {
		it('should detect changes in instance count', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);
			await jest.advanceTimersByTimeAsync(100);
			mockRes.writtenData.length = 0;

			// Change agents array - adding more agents triggers change detection
			mockFactoryService.getFactoryState.mockResolvedValue(
				createMockFactoryStateResponse({
					agents: [
						{ id: 'i1', sessionName: 's1', name: 'Agent 1', projectName: 'ProjectA', status: 'active', cpuPercent: 50, sessionTokens: 500 },
						{ id: 'i2', sessionName: 's2', name: 'Agent 2', projectName: 'ProjectB', status: 'idle', cpuPercent: 0, sessionTokens: 500 },
						{ id: 'i3', sessionName: 's3', name: 'Agent 3', projectName: 'ProjectC', status: 'active', cpuPercent: 25, sessionTokens: 300 },
					],
				})
			);

			await jest.advanceTimersByTimeAsync(100);

			expect(mockRes.writtenData.find((d) => d.includes('event: instances'))).toBeDefined();
		});

		it('should detect changes in active count', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);
			await jest.advanceTimersByTimeAsync(100);
			mockRes.writtenData.length = 0;

			// Change active count
			mockFactoryService.getFactoryState.mockResolvedValue(
				createMockFactoryStateResponse({ stats: { activeCount: 5, idleCount: 0, dormantCount: 0, totalTokens: 1000 } })
			);

			await jest.advanceTimersByTimeAsync(100);

			expect(mockRes.writtenData.find((d) => d.includes('event: instances'))).toBeDefined();
		});

		it('should detect changes in instance status', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);
			await jest.advanceTimersByTimeAsync(100);
			mockRes.writtenData.length = 0;

			// Change an agent status
			const newResponse = createMockFactoryStateResponse();
			newResponse.agents[0].status = 'dormant';

			mockFactoryService.getFactoryState.mockResolvedValue(newResponse);

			await jest.advanceTimersByTimeAsync(100);

			expect(mockRes.writtenData.find((d) => d.includes('event: instances'))).toBeDefined();
		});

		it('should ignore minor CPU fluctuations', async () => {
			const mockRes = createMockResponse();

			service.addClient('client-1', mockRes);
			await jest.advanceTimersByTimeAsync(100);
			mockRes.writtenData.length = 0;

			// Small CPU change (0.4% difference, rounds to same value)
			const newResponse = createMockFactoryStateResponse();
			newResponse.agents[0].cpuPercent = 50.4;

			mockFactoryService.getFactoryState.mockResolvedValue(newResponse);

			await jest.advanceTimersByTimeAsync(100);

			// Should NOT broadcast (CPU rounds to same integer)
			expect(mockRes.writtenData.find((d) => d.includes('event: instances'))).toBeUndefined();
		});
	});
});
