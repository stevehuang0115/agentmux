/**
 * Device Identity Service
 *
 * Manages a persistent device identity stored in ~/.crewly/device.json.
 * Used by the relay auto-discovery system to uniquely identify this
 * Crewly installation across sessions and restarts.
 *
 * @module services/cloud/device-identity.service
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir, hostname } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';

/**
 * Persistent device identity stored in ~/.crewly/device.json.
 */
export interface DeviceIdentity {
  /** Unique device identifier (UUID v4) */
  deviceId: string;
  /** Human-readable device name (defaults to OS hostname) */
  deviceName: string;
  /** ISO timestamp when the identity was first created */
  createdAt: string;
  /** ISO timestamp of last activity */
  lastSeenAt: string;
}

/** Path to device identity file relative to ~/.crewly/ */
const DEVICE_FILE = 'device.json';

/**
 * Singleton service that manages device identity for relay auto-discovery.
 *
 * On first run, generates a UUID and captures the OS hostname, persisting
 * both to ~/.crewly/device.json. Subsequent calls read from disk.
 *
 * @example
 * ```typescript
 * const identity = DeviceIdentityService.getInstance();
 * const id = await identity.getOrCreateIdentity();
 * console.log(id.deviceId, id.deviceName);
 * ```
 */
export class DeviceIdentityService {
  private static instance: DeviceIdentityService | null = null;
  private readonly logger: ComponentLogger;
  private readonly crewlyHome: string;
  private readonly deviceFilePath: string;
  private cachedIdentity: DeviceIdentity | null = null;

  /**
   * Creates a DeviceIdentityService instance.
   *
   * @param crewlyHome - Override ~/.crewly path (for testing)
   */
  constructor(crewlyHome?: string) {
    this.logger = LoggerService.getInstance().createComponentLogger('DeviceIdentityService');
    this.crewlyHome = crewlyHome || join(homedir(), '.crewly');
    this.deviceFilePath = join(this.crewlyHome, DEVICE_FILE);
  }

  /**
   * Get the singleton instance.
   *
   * @returns DeviceIdentityService instance
   */
  static getInstance(): DeviceIdentityService {
    if (!DeviceIdentityService.instance) {
      DeviceIdentityService.instance = new DeviceIdentityService();
    }
    return DeviceIdentityService.instance;
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    DeviceIdentityService.instance = null;
  }

  /**
   * Get or create the device identity.
   * Reads from ~/.crewly/device.json if it exists, otherwise creates
   * a new identity with a fresh UUID and the OS hostname.
   *
   * @returns The device identity
   */
  async getOrCreateIdentity(): Promise<DeviceIdentity> {
    if (this.cachedIdentity) {
      return this.cachedIdentity;
    }

    try {
      if (existsSync(this.deviceFilePath)) {
        const content = await readFile(this.deviceFilePath, 'utf-8');
        const identity = JSON.parse(content) as DeviceIdentity;
        this.cachedIdentity = identity;
        this.logger.debug('Loaded device identity from disk', { deviceId: identity.deviceId });
        return identity;
      }
    } catch (error) {
      this.logger.warn('Failed to read device identity, creating new one', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Create new identity
    const identity: DeviceIdentity = {
      deviceId: uuidv4(),
      deviceName: hostname(),
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    await this.persistIdentity(identity);
    this.cachedIdentity = identity;
    this.logger.info('Created new device identity', { deviceId: identity.deviceId, deviceName: identity.deviceName });
    return identity;
  }

  /**
   * Update the lastSeenAt timestamp on the persisted identity.
   */
  async updateLastSeen(): Promise<void> {
    const identity = await this.getOrCreateIdentity();
    identity.lastSeenAt = new Date().toISOString();
    await this.persistIdentity(identity);
    this.logger.debug('Updated lastSeenAt', { deviceId: identity.deviceId });
  }

  /**
   * Get the device ID string.
   *
   * @returns The device UUID
   */
  async getDeviceId(): Promise<string> {
    const identity = await this.getOrCreateIdentity();
    return identity.deviceId;
  }

  /**
   * Get the device name string.
   *
   * @returns The device hostname
   */
  async getDeviceName(): Promise<string> {
    const identity = await this.getOrCreateIdentity();
    return identity.deviceName;
  }

  /**
   * Write identity to disk, ensuring the directory exists.
   *
   * @param identity - The identity to persist
   */
  private async persistIdentity(identity: DeviceIdentity): Promise<void> {
    try {
      if (!existsSync(this.crewlyHome)) {
        await mkdir(this.crewlyHome, { recursive: true });
      }
      await writeFile(this.deviceFilePath, JSON.stringify(identity, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error('Failed to persist device identity', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
