/**
 * useFactorySSE Hook Tests
 *
 * Tests for the SSE hook that provides real-time factory updates
 * with automatic reconnection and fallback to REST polling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFactorySSE } from './useFactorySSE';
import { factoryService } from '../services/factory.service';

// Mock the factory service
vi.mock('../services/factory.service', () => ({
	factoryService: {
		getFactoryState: vi.fn(),
	},
}));

/**
 * Mock EventSource class for testing
 */
class MockEventSource {
	static instances: MockEventSource[] = [];

	url: string;
	readyState: number = 0; // CONNECTING
	listeners: Map<string, ((event: unknown) => void)[]> = new Map();
	onerror: ((event: Event) => void) | null = null;

	constructor(url: string) {
		this.url = url;
		MockEventSource.instances.push(this);
	}

	addEventListener(type: string, listener: (event: unknown) => void): void {
		const existing = this.listeners.get(type) || [];
		existing.push(listener);
		this.listeners.set(type, existing);
	}

	removeEventListener(type: string, listener: (event: unknown) => void): void {
		const existing = this.listeners.get(type) || [];
		this.listeners.set(
			type,
			existing.filter((l) => l !== listener)
		);
	}

	close(): void {
		this.readyState = 2; // CLOSED
	}

	// Helper methods for testing
	emit(type: string, data?: unknown): void {
		const listeners = this.listeners.get(type) || [];
		const event = data ? { data: JSON.stringify(data) } : {};
		listeners.forEach((listener) => listener(event));
	}

	triggerError(): void {
		if (this.onerror) {
			this.onerror(new Event('error'));
		}
	}

	static reset(): void {
		MockEventSource.instances = [];
	}

	static getLastInstance(): MockEventSource | undefined {
		return MockEventSource.instances[MockEventSource.instances.length - 1];
	}
}

// Replace global EventSource with mock
const originalEventSource = globalThis.EventSource;

describe('useFactorySSE', () => {
	beforeEach(() => {
		MockEventSource.reset();
		globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
		vi.mocked(factoryService.getFactoryState).mockResolvedValue({
			agents: [],
			projects: [],
			stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
		});
	});

	afterEach(() => {
		globalThis.EventSource = originalEventSource;
		vi.clearAllMocks();
	});

	describe('initial connection', () => {
		it('should start in connecting state', () => {
			const { result } = renderHook(() => useFactorySSE());

			expect(result.current.connectionStatus).toBe('connecting');
			expect(result.current.isLoading).toBe(true);
			expect(result.current.data).toBeNull();
		});

		it('should create EventSource with correct endpoint', () => {
			renderHook(() => useFactorySSE());

			const eventSource = MockEventSource.getLastInstance();
			expect(eventSource).toBeDefined();
			expect(eventSource?.url).toBe('/api/factory/sse');
		});

		it('should use custom endpoint when provided', () => {
			renderHook(() =>
				useFactorySSE({
					sseEndpoint: '/custom/sse',
				})
			);

			const eventSource = MockEventSource.getLastInstance();
			expect(eventSource?.url).toBe('/custom/sse');
		});
	});

	describe('connected state', () => {
		it('should update status to connected on connected event', () => {
			const { result } = renderHook(() => useFactorySSE());

			act(() => {
				MockEventSource.getLastInstance()?.emit('connected', {
					type: 'connected',
					data: { clientId: 'test-client' },
					timestamp: new Date().toISOString(),
				});
			});

			expect(result.current.connectionStatus).toBe('connected');
		});

		it('should update data on instances event', () => {
			const { result } = renderHook(() => useFactorySSE());

			const sseData = {
				type: 'instances',
				data: {
					timestamp: new Date().toISOString(),
					agents: [
						{
							id: 'instance-1',
							sessionName: 'claude-12345',
							name: 'Claude Agent 1',
							projectName: 'ProjectA',
							cpuPercent: 50,
							status: 'active' as const,
							activity: 'Working...',
							sessionTokens: 500,
						},
						{
							id: 'instance-2',
							sessionName: 'claude-12346',
							name: 'Claude Agent 2',
							projectName: 'ProjectB',
							cpuPercent: 0,
							status: 'idle' as const,
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
				},
				timestamp: new Date().toISOString(),
			};

			act(() => {
				MockEventSource.getLastInstance()?.emit('instances', sseData);
			});

			expect(result.current.data).not.toBeNull();
			expect(result.current.data?.agents.length).toBe(2);
			expect(result.current.data?.stats.activeCount).toBe(1);
			expect(result.current.data?.stats.idleCount).toBe(1);
			expect(result.current.isLoading).toBe(false);
		});

		it('should transform SSE data to FactoryStateResponse format', () => {
			const { result } = renderHook(() => useFactorySSE());

			const sseData = {
				type: 'instances',
				data: {
					timestamp: new Date().toISOString(),
					agents: [
						{
							id: 'instance-1',
							sessionName: 'claude-12345',
							name: 'Claude Agent 1',
							projectName: 'MyProject',
							cpuPercent: 75,
							status: 'active' as const,
							activity: 'Edit: file.ts',
							sessionTokens: 500,
						},
					],
					projects: ['MyProject'],
					stats: {
						activeCount: 1,
						idleCount: 0,
						dormantCount: 0,
						totalTokens: 500,
					},
				},
				timestamp: new Date().toISOString(),
			};

			act(() => {
				MockEventSource.getLastInstance()?.emit('instances', sseData);
			});

			const agent = result.current.data?.agents[0];
			expect(agent?.id).toBe('instance-1');
			expect(agent?.sessionName).toBe('claude-12345');
			expect(agent?.projectName).toBe('MyProject');
			expect(agent?.status).toBe('active');
			expect(agent?.activity).toBe('Edit: file.ts');
		});

		it('should pass through projects from SSE data', () => {
			const { result } = renderHook(() => useFactorySSE());

			const sseData = {
				type: 'instances',
				data: {
					timestamp: new Date().toISOString(),
					agents: [
						{ id: 'i1', sessionName: 's1', name: 'Agent 1', projectName: 'ProjectA', cpuPercent: 0, status: 'active' as const, sessionTokens: 500 },
						{ id: 'i2', sessionName: 's2', name: 'Agent 2', projectName: 'ProjectB', cpuPercent: 0, status: 'active' as const, sessionTokens: 500 },
						{ id: 'i3', sessionName: 's3', name: 'Agent 3', projectName: 'ProjectA', cpuPercent: 0, status: 'active' as const, sessionTokens: 500 },
					],
					projects: ['ProjectA', 'ProjectB'],
					stats: {
						activeCount: 3,
						idleCount: 0,
						dormantCount: 0,
						totalTokens: 1500,
					},
				},
				timestamp: new Date().toISOString(),
			};

			act(() => {
				MockEventSource.getLastInstance()?.emit('instances', sseData);
			});

			expect(result.current.data?.projects).toEqual(['ProjectA', 'ProjectB']);
		});
	});

	describe('reconnection', () => {
		it('should attempt to reconnect on error', () => {
			const { result } = renderHook(() =>
				useFactorySSE({
					baseReconnectDelay: 100,
					maxReconnectAttempts: 3,
				})
			);

			const firstEventSource = MockEventSource.getLastInstance();
			expect(firstEventSource).toBeDefined();

			// Trigger error
			act(() => {
				firstEventSource?.triggerError();
			});

			expect(result.current.connectionStatus).toBe('reconnecting');
		});
	});

	describe('cleanup', () => {
		it('should close EventSource on unmount', () => {
			const { unmount } = renderHook(() => useFactorySSE());

			const eventSource = MockEventSource.getLastInstance();
			expect(eventSource?.readyState).toBe(0); // CONNECTING

			unmount();

			expect(eventSource?.readyState).toBe(2); // CLOSED
		});
	});

	describe('heartbeat handling', () => {
		it('should handle heartbeat events without error', () => {
			renderHook(() => useFactorySSE());

			// Should not throw
			act(() => {
				MockEventSource.getLastInstance()?.emit('heartbeat', {
					type: 'heartbeat',
					data: { timestamp: new Date().toISOString() },
					timestamp: new Date().toISOString(),
				});
			});
		});
	});

	describe('error handling', () => {
		it('should handle server error events', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			renderHook(() => useFactorySSE());

			act(() => {
				MockEventSource.getLastInstance()?.emit('error', {
					type: 'error',
					data: { message: 'Server error', code: 'INTERNAL_ERROR' },
					timestamp: new Date().toISOString(),
				});
			});

			expect(consoleSpy).toHaveBeenCalledWith('[useFactorySSE] Server error:', 'Server error');
			consoleSpy.mockRestore();
		});

		it('should handle malformed SSE data gracefully', () => {
			const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const { result } = renderHook(() => useFactorySSE());

			// Emit malformed data
			act(() => {
				const eventSource = MockEventSource.getLastInstance();
				const listeners = eventSource?.listeners.get('instances') || [];
				listeners.forEach((listener) => listener({ data: 'not valid json' }));
			});

			// Should not crash, data should remain null
			expect(result.current.data).toBeNull();
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe('reconnect function', () => {
		it('should be available and callable', () => {
			const { result } = renderHook(() => useFactorySSE());

			expect(typeof result.current.reconnect).toBe('function');

			// Should not throw when called
			act(() => {
				result.current.reconnect();
			});

			// Should create a new EventSource
			expect(MockEventSource.instances.length).toBeGreaterThan(1);
		});
	});
});
