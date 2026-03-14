/**
 * Device Auto-Discovery Service
 *
 * Polls the Cloud device registry to discover other Crewly instances
 * belonging to the same user account. Enables automatic relay pairing
 * without manual configuration.
 *
 * Flow:
 * 1. On cloud login, register this device with the Cloud device API
 * 2. Poll GET /v1/devices to discover other online devices
 * 3. Auto-initiate relay connection to discovered peers
 * 4. Maintain heartbeat so other devices can discover us
 *
 * @see https://github.com/stevehuang0115/crewly/issues/relay-auto-discovery
 * @module services/cloud/device-auto-discovery.service
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import { CLOUD_CONSTANTS } from '../../constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A remote device discovered via the cloud registry */
export interface DiscoveredDevice {
	/** Unique device identifier (UUID) */
	deviceId: string;
	/** Human-readable device name (hostname) */
	deviceName: string;
	/** User ID who owns this device */
	userId: string;
	/** Whether the device is currently online */
	online: boolean;
	/** Device role (orchestrator or agent) */
	role: 'orchestrator' | 'agent';
	/** ISO timestamp of last heartbeat */
	lastHeartbeatAt: string;
	/** Relay pairing code for auto-connect */
	pairingCode?: string;
	/** Cloud relay server URL */
	relayUrl?: string;
}

/** Discovery service configuration */
export interface DiscoveryConfig {
	/** Cloud API base URL */
	cloudUrl: string;
	/** Auth token for cloud API calls */
	token: string;
	/** This device's ID */
	deviceId: string;
	/** This device's name */
	deviceName: string;
	/** This device's role */
	role: 'orchestrator' | 'agent';
	/** Polling interval in ms (default: 30s) */
	pollIntervalMs?: number;
	/** Heartbeat interval in ms (default: 30s) */
	heartbeatIntervalMs?: number;
}

/** Auto-discovery service state */
export type DiscoveryState = 'stopped' | 'registering' | 'polling' | 'error';

/** Discovery constants */
export const DISCOVERY_CONSTANTS = {
	/** Default polling interval for device discovery (30 seconds) */
	POLL_INTERVAL_MS: 30_000,
	/** Default heartbeat interval (30 seconds) */
	HEARTBEAT_INTERVAL_MS: 30_000,
	/** Device considered offline after this threshold (5 minutes) */
	OFFLINE_THRESHOLD_MS: 300_000,
	/** Maximum devices per user account */
	MAX_DEVICES_PER_USER: 10,
	/** Cloud device API path */
	DEVICES_PATH: '/v1/devices',
} as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * DeviceAutoDiscoveryService discovers other Crewly instances via Cloud.
 *
 * Emits events:
 * - 'deviceFound' — new device discovered
 * - 'deviceLost' — previously online device went offline
 * - 'devicesUpdated' — full device list refreshed
 */
export class DeviceAutoDiscoveryService extends EventEmitter {
	private static instance: DeviceAutoDiscoveryService | null = null;
	private readonly logger: ComponentLogger;
	private state: DiscoveryState = 'stopped';
	private config: DiscoveryConfig | null = null;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private knownDevices: Map<string, DiscoveredDevice> = new Map();

	private constructor() {
		super();
		this.logger = LoggerService.getInstance().createComponentLogger('DeviceAutoDiscovery');
	}

	static getInstance(): DeviceAutoDiscoveryService {
		if (!DeviceAutoDiscoveryService.instance) {
			DeviceAutoDiscoveryService.instance = new DeviceAutoDiscoveryService();
		}
		return DeviceAutoDiscoveryService.instance;
	}

	static resetInstance(): void {
		if (DeviceAutoDiscoveryService.instance) {
			DeviceAutoDiscoveryService.instance.stop();
		}
		DeviceAutoDiscoveryService.instance = null;
	}

	/**
	 * Get the current discovery state.
	 */
	getState(): DiscoveryState {
		return this.state;
	}

	/**
	 * Get all currently known devices.
	 */
	getDevices(): DiscoveredDevice[] {
		return Array.from(this.knownDevices.values());
	}

	/**
	 * Get only online devices (excluding self).
	 */
	getOnlineDevices(): DiscoveredDevice[] {
		return this.getDevices().filter(
			d => d.online && d.deviceId !== this.config?.deviceId
		);
	}

	/**
	 * Start auto-discovery: register this device, begin polling + heartbeat.
	 *
	 * @param config - Discovery configuration with cloud credentials
	 */
	async start(config: DiscoveryConfig): Promise<void> {
		if (this.state !== 'stopped') {
			this.logger.warn('Discovery already running, stopping first');
			this.stop();
		}

		this.config = config;
		this.state = 'registering';

		try {
			// Step 1: Register this device with the cloud
			await this.registerDevice();

			// Step 2: Do an initial discovery poll
			await this.pollDevices();

			// Step 3: Start periodic polling and heartbeat
			const pollInterval = config.pollIntervalMs || DISCOVERY_CONSTANTS.POLL_INTERVAL_MS;
			const heartbeatInterval = config.heartbeatIntervalMs || DISCOVERY_CONSTANTS.HEARTBEAT_INTERVAL_MS;

			this.pollTimer = setInterval(() => this.pollDevices(), pollInterval);
			this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), heartbeatInterval);

			this.state = 'polling';
			this.logger.info('Auto-discovery started', {
				deviceId: config.deviceId,
				deviceName: config.deviceName,
				role: config.role,
				pollInterval,
			});
		} catch (err) {
			this.state = 'error';
			this.logger.error('Failed to start auto-discovery', {
				error: err instanceof Error ? err.message : String(err),
			});
			throw err;
		}
	}

	/**
	 * Stop auto-discovery: clear timers and deregister.
	 */
	stop(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
		this.knownDevices.clear();
		this.state = 'stopped';
		this.logger.info('Auto-discovery stopped');
	}

	/**
	 * Register this device with the cloud device registry.
	 */
	private async registerDevice(): Promise<void> {
		if (!this.config) throw new Error('Discovery not configured');

		const url = `${this.config.cloudUrl}${DISCOVERY_CONSTANTS.DEVICES_PATH}/register`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.config.token}`,
			},
			body: JSON.stringify({
				deviceId: this.config.deviceId,
				deviceName: this.config.deviceName,
				role: this.config.role,
				platform: os.platform(),
				arch: os.arch(),
				hostname: os.hostname(),
			}),
		});

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			throw new Error(`Device registration failed: ${response.status} ${body.slice(0, 200)}`);
		}

		this.logger.info('Device registered with cloud', {
			deviceId: this.config.deviceId,
			deviceName: this.config.deviceName,
		});
	}

	/**
	 * Poll the cloud for other devices belonging to the same user.
	 */
	private async pollDevices(): Promise<void> {
		if (!this.config) return;

		try {
			const url = `${this.config.cloudUrl}${DISCOVERY_CONSTANTS.DEVICES_PATH}`;

			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.config.token}`,
				},
			});

			if (!response.ok) {
				this.logger.warn('Device poll failed', { status: response.status });
				return;
			}

			const data = (await response.json()) as { devices?: DiscoveredDevice[] };
			const devices = data.devices || [];

			// Track changes
			const previousIds = new Set(this.knownDevices.keys());
			const currentIds = new Set<string>();

			for (const device of devices) {
				currentIds.add(device.deviceId);

				if (!previousIds.has(device.deviceId) && device.deviceId !== this.config.deviceId) {
					this.emit('deviceFound', device);
					this.logger.info('New device discovered', {
						deviceId: device.deviceId,
						deviceName: device.deviceName,
						role: device.role,
					});
				}

				this.knownDevices.set(device.deviceId, device);
			}

			// Check for lost devices
			for (const prevId of previousIds) {
				if (!currentIds.has(prevId)) {
					const lost = this.knownDevices.get(prevId);
					this.knownDevices.delete(prevId);
					if (lost) {
						this.emit('deviceLost', lost);
						this.logger.info('Device went offline', {
							deviceId: lost.deviceId,
							deviceName: lost.deviceName,
						});
					}
				}
			}

			this.emit('devicesUpdated', this.getDevices());
		} catch (err) {
			this.logger.warn('Device poll error', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	/**
	 * Send a heartbeat to the cloud to keep this device marked as online.
	 */
	private async sendHeartbeat(): Promise<void> {
		if (!this.config) return;

		try {
			const url = `${this.config.cloudUrl}${DISCOVERY_CONSTANTS.DEVICES_PATH}/heartbeat`;

			await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.config.token}`,
				},
				body: JSON.stringify({
					deviceId: this.config.deviceId,
				}),
			});
		} catch (err) {
			this.logger.warn('Heartbeat failed', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}
}
