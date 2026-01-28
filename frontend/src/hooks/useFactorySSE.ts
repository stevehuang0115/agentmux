/**
 * useFactorySSE Hook
 *
 * React hook for consuming Server-Sent Events from the factory SSE endpoint.
 * Provides real-time Claude instance updates with automatic reconnection
 * and fallback to REST polling.
 *
 * @module hooks/useFactorySSE
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { FactoryStateResponse, FactoryAgentResponse } from '../types';
import { factoryService } from '../services/factory.service';

/**
 * SSE connection status
 */
export type SSEConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'fallback';

/**
 * SSE event data structure from the server
 */
interface SSEEventData<T = unknown> {
	type: string;
	data: T;
	timestamp: string;
}

/**
 * Factory state data from SSE (combines teams and Claude instances)
 */
interface FactoryStateSSEData {
	timestamp: string;
	agents: Array<{
		id: string;
		sessionName: string;
		name: string;
		projectName: string;
		status: 'active' | 'idle' | 'dormant';
		cpuPercent: number;
		activity?: string;
		sessionTokens: number;
	}>;
	projects: string[];
	stats: {
		activeCount: number;
		idleCount: number;
		dormantCount: number;
		totalTokens: number;
	};
}

/**
 * Return type for useFactorySSE hook
 */
export interface UseFactorySSEResult {
	/** Current factory state data */
	data: FactoryStateResponse | null;
	/** Whether initial data is loading */
	isLoading: boolean;
	/** Current connection status */
	connectionStatus: SSEConnectionStatus;
	/** Error message if any */
	error: string | null;
	/** Manual reconnect function */
	reconnect: () => void;
}

/**
 * Configuration options for useFactorySSE
 */
export interface UseFactorySSEOptions {
	/** Maximum reconnection attempts before fallback (default: 5) */
	maxReconnectAttempts?: number;
	/** Base delay between reconnection attempts in ms (default: 1000) */
	baseReconnectDelay?: number;
	/** Maximum reconnection delay in ms (default: 30000) */
	maxReconnectDelay?: number;
	/** Fallback polling interval in ms (default: 5000) */
	fallbackPollInterval?: number;
	/** SSE endpoint URL (default: /api/factory/sse) */
	sseEndpoint?: string;
}

/** Default options */
const DEFAULT_OPTIONS: Required<UseFactorySSEOptions> = {
	maxReconnectAttempts: 5,
	baseReconnectDelay: 1000,
	maxReconnectDelay: 30000,
	fallbackPollInterval: 5000,
	sseEndpoint: '/api/factory/sse',
};

/**
 * Hook for consuming factory SSE updates with automatic reconnection and fallback
 *
 * @param options - Configuration options
 * @returns SSE connection state and data
 *
 * @example
 * ```typescript
 * const { data, isLoading, connectionStatus, error, reconnect } = useFactorySSE();
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error} onRetry={reconnect} />;
 *
 * return <Factory data={data} status={connectionStatus} />;
 * ```
 */
export function useFactorySSE(options?: UseFactorySSEOptions): UseFactorySSEResult {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	const [data, setData] = useState<FactoryStateResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [connectionStatus, setConnectionStatus] = useState<SSEConnectionStatus>('connecting');
	const [error, setError] = useState<string | null>(null);

	// Refs for mutable state that shouldn't trigger re-renders
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const isMountedRef = useRef(true);

	/**
	 * Transforms SSE factory state data to FactoryStateResponse format.
	 * The backend now sends combined data (teams + Claude instances) directly,
	 * so this is mostly a type mapping.
	 */
	const transformSSEData = useCallback((sseData: FactoryStateSSEData): FactoryStateResponse => {
		// Map SSE agents to FactoryAgentResponse format
		const agents: FactoryAgentResponse[] = sseData.agents.map((agent) => ({
			id: agent.id,
			sessionName: agent.sessionName,
			name: agent.name,
			projectName: agent.projectName,
			status: agent.status,
			cpuPercent: agent.cpuPercent,
			activity: agent.activity,
			sessionTokens: agent.sessionTokens,
		}));

		return {
			agents,
			projects: sseData.projects,
			stats: sseData.stats,
		};
	}, []);

	/**
	 * Cleans up SSE connection
	 */
	const cleanupSSE = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
	}, []);

	/**
	 * Cleans up reconnect timeout
	 */
	const cleanupReconnectTimeout = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
	}, []);

	/**
	 * Cleans up fallback polling
	 */
	const cleanupFallbackPolling = useCallback(() => {
		if (fallbackIntervalRef.current) {
			clearInterval(fallbackIntervalRef.current);
			fallbackIntervalRef.current = null;
		}
	}, []);

	/**
	 * Starts fallback REST polling
	 */
	const startFallbackPolling = useCallback(async () => {
		cleanupSSE();
		cleanupReconnectTimeout();
		setConnectionStatus('fallback');

		// Initial fetch
		try {
			const state = await factoryService.getFactoryState();
			if (isMountedRef.current) {
				setData(state);
				setIsLoading(false);
				setError(null);
			}
		} catch (err) {
			if (isMountedRef.current) {
				setError(err instanceof Error ? err.message : 'Failed to fetch factory state');
				setIsLoading(false);
			}
		}

		// Set up polling interval
		fallbackIntervalRef.current = setInterval(async () => {
			try {
				const state = await factoryService.getFactoryState();
				if (isMountedRef.current) {
					setData(state);
					setError(null);
				}
			} catch (err) {
				if (isMountedRef.current) {
					setError(err instanceof Error ? err.message : 'Polling error');
				}
			}
		}, opts.fallbackPollInterval);
	}, [cleanupSSE, cleanupReconnectTimeout, opts.fallbackPollInterval]);

	/**
	 * Calculates reconnection delay with exponential backoff
	 */
	const getReconnectDelay = useCallback((): number => {
		const delay = opts.baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
		return Math.min(delay, opts.maxReconnectDelay);
	}, [opts.baseReconnectDelay, opts.maxReconnectDelay]);

	/**
	 * Connects to SSE endpoint
	 */
	const connect = useCallback(() => {
		if (!isMountedRef.current) return;

		cleanupSSE();
		cleanupFallbackPolling();

		const isReconnecting = reconnectAttemptsRef.current > 0;
		setConnectionStatus(isReconnecting ? 'reconnecting' : 'connecting');

		try {
			const eventSource = new EventSource(opts.sseEndpoint);
			eventSourceRef.current = eventSource;

			eventSource.addEventListener('connected', () => {
				if (!isMountedRef.current) return;
				reconnectAttemptsRef.current = 0;
				setConnectionStatus('connected');
				setError(null);
			});

			eventSource.addEventListener('instances', (event) => {
				if (!isMountedRef.current) return;
				try {
					const eventData = JSON.parse(event.data) as SSEEventData<FactoryStateSSEData>;
					const transformedData = transformSSEData(eventData.data);
					setData(transformedData);
					setIsLoading(false);
					setError(null);
				} catch (parseError) {
					console.error('[useFactorySSE] Failed to parse instances event:', parseError);
				}
			});

			eventSource.addEventListener('heartbeat', () => {
				// Heartbeat received - connection is healthy
				// Could update a lastHeartbeat timestamp if needed
			});

			eventSource.addEventListener('error', (event) => {
				if (!isMountedRef.current) return;
				try {
					const eventData = JSON.parse((event as MessageEvent).data) as SSEEventData<{ message: string }>;
					console.error('[useFactorySSE] Server error:', eventData.data.message);
				} catch {
					// Generic error event (not a data error)
				}
			});

			eventSource.onerror = () => {
				if (!isMountedRef.current) return;

				cleanupSSE();
				reconnectAttemptsRef.current++;

				if (reconnectAttemptsRef.current >= opts.maxReconnectAttempts) {
					console.warn('[useFactorySSE] Max reconnection attempts reached, falling back to polling');
					startFallbackPolling();
				} else {
					const delay = getReconnectDelay();
					console.log(`[useFactorySSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
					setConnectionStatus('reconnecting');
					reconnectTimeoutRef.current = setTimeout(connect, delay);
				}
			};
		} catch (err) {
			console.error('[useFactorySSE] Failed to create EventSource:', err);
			startFallbackPolling();
		}
	}, [
		opts.sseEndpoint,
		opts.maxReconnectAttempts,
		cleanupSSE,
		cleanupFallbackPolling,
		transformSSEData,
		getReconnectDelay,
		startFallbackPolling,
	]);

	/**
	 * Manual reconnect function
	 */
	const reconnect = useCallback(() => {
		reconnectAttemptsRef.current = 0;
		cleanupFallbackPolling();
		cleanupReconnectTimeout();
		connect();
	}, [connect, cleanupFallbackPolling, cleanupReconnectTimeout]);

	// Effect to manage SSE connection lifecycle
	useEffect(() => {
		isMountedRef.current = true;
		connect();

		return () => {
			isMountedRef.current = false;
			cleanupSSE();
			cleanupReconnectTimeout();
			cleanupFallbackPolling();
		};
	}, [connect, cleanupSSE, cleanupReconnectTimeout, cleanupFallbackPolling]);

	return {
		data,
		isLoading,
		connectionStatus,
		error,
		reconnect,
	};
}

export default useFactorySSE;
