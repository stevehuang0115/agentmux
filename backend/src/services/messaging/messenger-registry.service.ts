import { MessengerAdapter, MessengerPlatform } from './messenger-adapter.interface.js';

/**
 * Singleton registry for messenger platform adapters.
 *
 * Stores one adapter per platform and exposes lookup, registration,
 * and status listing operations.
 */
export class MessengerRegistryService {
  private static instance: MessengerRegistryService | null = null;
  private adapters = new Map<MessengerPlatform, MessengerAdapter>();

  /**
   * Get the singleton instance.
   *
   * @returns The MessengerRegistryService instance
   */
  static getInstance(): MessengerRegistryService {
    if (!MessengerRegistryService.instance) {
      MessengerRegistryService.instance = new MessengerRegistryService();
    }
    return MessengerRegistryService.instance;
  }

  /**
   * Reset the singleton instance (for testing).
   */
  static resetInstance(): void {
    MessengerRegistryService.instance = null;
  }

  /**
   * Register an adapter for its platform, replacing any existing one.
   *
   * @param adapter - The messenger adapter to register
   */
  register(adapter: MessengerAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  /**
   * Retrieve the adapter for the given platform.
   *
   * @param platform - The messenger platform identifier
   * @returns The adapter, or undefined if not registered
   */
  get(platform: MessengerPlatform): MessengerAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * List the connection status of all registered adapters.
   *
   * @returns Array of adapter status objects
   */
  list(): Array<{ connected: boolean; platform: MessengerPlatform; details?: Record<string, unknown> }> {
    return [...this.adapters.values()].map((a) => a.getStatus());
  }
}
