/**
 * Factory SSE Service
 *
 * Manages Server-Sent Events connections for real-time factory state updates.
 * Broadcasts combined data from Crewly teams AND Claude Code processes.
 *
 * Instead of each client polling, this service:
 * - Maintains a single internal poll loop (3s interval)
 * - Broadcasts updates only when data changes (hash-based diff)
 * - Sends heartbeats every 30s to keep connections alive
 *
 * @module services/factory/factory-sse
 */

import { Response } from 'express';
import { FactoryService, FactoryStateResponse } from '../factory.service.js';
import { createHash } from 'crypto';

/**
 * SSE event types sent to clients
 */
export type SSEEventType = 'connected' | 'instances' | 'heartbeat' | 'error';

/**
 * Connected SSE client data
 */
interface SSEClient {
	/** Unique client identifier */
	id: string;
	/** Express Response object for streaming */
	res: Response;
	/** Connection timestamp */
	connectedAt: number;
}

/**
 * SSE event payload structure
 */
export interface SSEEvent<T = unknown> {
	/** Event type */
	type: SSEEventType;
	/** Event payload */
	data: T;
	/** Timestamp of the event */
	timestamp: string;
}

/**
 * Factory SSE Service configuration
 */
export interface FactorySSEConfig {
	/** Polling interval in milliseconds (default: 3000) */
	pollInterval?: number;
	/** Heartbeat interval in milliseconds (default: 30000) */
	heartbeatInterval?: number;
}

/** Default polling interval (3 seconds) */
const DEFAULT_POLL_INTERVAL = 3000;

/** Default heartbeat interval (30 seconds) */
const DEFAULT_HEARTBEAT_INTERVAL = 30000;

/**
 * Factory SSE Service for managing real-time client connections
 */
export class FactorySSEService {
	/** Connected SSE clients */
	private clients: Map<string, SSEClient> = new Map();

	/** Factory service for fetching combined factory state */
	private factoryService: FactoryService;

	/** Current data hash for change detection */
	private lastDataHash: string = '';

	/** Last cached response data */
	private lastData: FactoryStateResponse | null = null;

	/** Poll interval timer */
	private pollTimer: NodeJS.Timeout | null = null;

	/** Heartbeat interval timer */
	private heartbeatTimer: NodeJS.Timeout | null = null;

	/** Polling interval in milliseconds */
	private pollInterval: number;

	/** Heartbeat interval in milliseconds */
	private heartbeatInterval: number;

	/** Whether the service is currently polling */
	private isPolling: boolean = false;

	/**
	 * Creates a new FactorySSEService instance
	 *
	 * @param factoryService - Factory service for data fetching (injectable for testing)
	 * @param config - Optional configuration overrides
	 */
	constructor(factoryService?: FactoryService, config?: FactorySSEConfig) {
		this.factoryService = factoryService || new FactoryService();
		this.pollInterval = config?.pollInterval ?? DEFAULT_POLL_INTERVAL;
		this.heartbeatInterval = config?.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL;
	}

	/**
	 * Adds a new SSE client connection
	 *
	 * @param clientId - Unique identifier for the client
	 * @param res - Express Response object configured for SSE
	 */
	addClient(clientId: string, res: Response): void {
		const client: SSEClient = {
			id: clientId,
			res,
			connectedAt: Date.now(),
		};

		this.clients.set(clientId, client);

		// Send connected event
		this.sendEvent(client, 'connected', { clientId });

		// Send cached data immediately if available
		if (this.lastData) {
			this.sendEvent(client, 'instances', this.lastData);
		}

		// Handle client disconnect
		res.on('close', () => {
			this.removeClient(clientId);
		});

		// Start polling if this is the first client
		if (this.clients.size === 1) {
			this.startPolling();
		}
	}

	/**
	 * Removes a client connection
	 *
	 * @param clientId - Client identifier to remove
	 */
	removeClient(clientId: string): void {
		this.clients.delete(clientId);

		// Stop polling if no clients are connected
		if (this.clients.size === 0) {
			this.stopPolling();
		}
	}

	/**
	 * Gets the current number of connected clients
	 *
	 * @returns Number of connected clients
	 */
	getClientCount(): number {
		return this.clients.size;
	}

	/**
	 * Checks if a specific client is connected
	 *
	 * @param clientId - Client identifier to check
	 * @returns True if client is connected
	 */
	hasClient(clientId: string): boolean {
		return this.clients.has(clientId);
	}

	/**
	 * Starts the internal polling loop
	 */
	private startPolling(): void {
		if (this.isPolling) return;
		this.isPolling = true;

		// Initial fetch
		this.poll();

		// Set up recurring poll
		this.pollTimer = setInterval(() => {
			this.poll();
		}, this.pollInterval);

		// Set up heartbeat
		this.heartbeatTimer = setInterval(() => {
			this.broadcastHeartbeat();
		}, this.heartbeatInterval);
	}

	/**
	 * Stops the internal polling loop
	 */
	private stopPolling(): void {
		if (!this.isPolling) return;
		this.isPolling = false;

		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}

		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	/**
	 * Performs a single poll and broadcasts if data changed
	 */
	private async poll(): Promise<void> {
		try {
			const data = await this.factoryService.getFactoryState();
			const hash = this.computeDataHash(data);

			// Only broadcast if data has changed
			if (hash !== this.lastDataHash) {
				this.lastDataHash = hash;
				this.lastData = data;
				this.broadcastInstances(data);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown polling error';
			this.broadcastError(errorMessage, 'POLL_ERROR');
		}
	}

	/**
	 * Computes a hash of the data for change detection
	 * Only includes significant fields to avoid false positives
	 *
	 * @param data - Factory state response (teams + Claude instances)
	 * @returns Hash string for comparison
	 */
	private computeDataHash(data: FactoryStateResponse): string {
		// Build a string from significant fields only
		const significantData = `${data.agents.length}:${data.stats.activeCount}:${data.agents
			.map((a) => `${a.id}:${a.status}:${Math.round(a.cpuPercent)}`)
			.sort()
			.join('|')}`;

		return createHash('md5').update(significantData).digest('hex');
	}

	/**
	 * Broadcasts factory state data to all connected clients
	 *
	 * @param data - Factory state response (teams + Claude instances)
	 */
	private broadcastInstances(data: FactoryStateResponse): void {
		this.clients.forEach((client) => {
			this.sendEvent(client, 'instances', data);
		});
	}

	/**
	 * Broadcasts a heartbeat to all connected clients
	 */
	private broadcastHeartbeat(): void {
		const timestamp = new Date().toISOString();
		this.clients.forEach((client) => {
			this.sendEvent(client, 'heartbeat', { timestamp });
		});
	}

	/**
	 * Broadcasts an error to all connected clients
	 *
	 * @param message - Error message
	 * @param code - Error code
	 */
	private broadcastError(message: string, code: string): void {
		this.clients.forEach((client) => {
			this.sendEvent(client, 'error', { message, code });
		});
	}

	/**
	 * Sends an SSE event to a specific client
	 *
	 * @param client - Client to send to
	 * @param type - Event type
	 * @param data - Event data payload
	 */
	private sendEvent<T>(client: SSEClient, type: SSEEventType, data: T): void {
		const event: SSEEvent<T> = {
			type,
			data,
			timestamp: new Date().toISOString(),
		};

		try {
			// SSE format: event: type\ndata: json\n\n
			client.res.write(`event: ${type}\n`);
			client.res.write(`data: ${JSON.stringify(event)}\n\n`);
		} catch {
			// Client disconnected, remove them
			this.removeClient(client.id);
		}
	}

	/**
	 * Force triggers a poll and broadcast (for testing)
	 */
	async forcePoll(): Promise<void> {
		await this.poll();
	}

	/**
	 * Cleans up all resources (for graceful shutdown)
	 */
	shutdown(): void {
		this.stopPolling();

		// Close all client connections
		this.clients.forEach((client) => {
			try {
				client.res.end();
			} catch {
				// Ignore errors during shutdown
			}
		});

		this.clients.clear();
		this.lastData = null;
		this.lastDataHash = '';
	}

	/**
	 * Returns whether the service is currently polling
	 *
	 * @returns True if polling is active
	 */
	isActive(): boolean {
		return this.isPolling;
	}

	/**
	 * Gets the last cached data (for fallback/debugging)
	 *
	 * @returns Last cached factory state response or null
	 */
	getLastData(): FactoryStateResponse | null {
		return this.lastData;
	}
}

/** Singleton instance for use across the application */
export const factorySSEService = new FactorySSEService();
