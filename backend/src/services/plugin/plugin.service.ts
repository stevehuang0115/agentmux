/**
 * Plugin Service
 *
 * Manages plugin registration and hook execution for the Crewly
 * extensibility system. Plugins (like Crewly Pro) register handlers
 * for specific hook points, and the core system invokes them at the
 * appropriate moments.
 *
 * Singleton pattern matching other Crewly services.
 *
 * @module services/plugin/plugin.service
 */

import type {
  HookName,
  HookHandler,
  HookPayloadMap,
  CrewlyPlugin,
} from './plugin.types.js';
import { HOOK_NAMES } from './plugin.types.js';

// =============================================================================
// Types
// =============================================================================

/** Internal registry entry for a hook handler */
interface RegisteredHandler {
  /** Plugin that registered this handler */
  pluginId: string;
  /** The handler function */
  handler: HookHandler<unknown>;
}

// =============================================================================
// Service
// =============================================================================

/**
 * PluginService manages the plugin lifecycle and hook dispatch.
 *
 * Plugins register via `registerPlugin()` and the core system
 * calls `executeHook()` at defined extension points. Handlers
 * are executed in registration order and errors in one handler
 * do not prevent others from running.
 */
export class PluginService {
  private static instance: PluginService | null = null;

  /** Registered plugins indexed by ID */
  private plugins: Map<string, CrewlyPlugin> = new Map();

  /** Hook handlers grouped by hook name */
  private hooks: Map<HookName, RegisteredHandler[]> = new Map();

  private constructor() {
    // Initialize empty handler arrays for all hooks
    for (const name of HOOK_NAMES) {
      this.hooks.set(name, []);
    }
  }

  /**
   * Get the singleton instance.
   *
   * @returns The singleton instance
   */
  static getInstance(): PluginService {
    if (!PluginService.instance) {
      PluginService.instance = new PluginService();
    }
    return PluginService.instance;
  }

  /**
   * Clear the singleton instance (for testing).
   */
  static clearInstance(): void {
    PluginService.instance = null;
  }

  // ===========================================================================
  // Plugin Registration
  // ===========================================================================

  /**
   * Register a plugin with the system.
   *
   * Extracts hook handlers from the plugin and adds them to the
   * internal registry. If a plugin with the same ID is already
   * registered, it is replaced.
   *
   * @param plugin - The plugin to register
   */
  registerPlugin(plugin: CrewlyPlugin): void {
    // Unregister existing plugin with same ID if present
    if (this.plugins.has(plugin.id)) {
      this.unregisterPlugin(plugin.id);
    }

    this.plugins.set(plugin.id, plugin);

    // Register hook handlers
    if (plugin.hooks) {
      for (const hookName of HOOK_NAMES) {
        const handler = plugin.hooks[hookName];
        if (handler) {
          const handlers = this.hooks.get(hookName)!;
          handlers.push({
            pluginId: plugin.id,
            handler: handler as HookHandler<unknown>,
          });
        }
      }
    }
  }

  /**
   * Unregister a plugin and remove all its hook handlers.
   *
   * @param pluginId - The plugin ID to remove
   * @returns True if the plugin was found and removed
   */
  unregisterPlugin(pluginId: string): boolean {
    const existed = this.plugins.delete(pluginId);

    if (existed) {
      // Remove all handlers from this plugin
      for (const hookName of HOOK_NAMES) {
        const handlers = this.hooks.get(hookName)!;
        const filtered = handlers.filter(h => h.pluginId !== pluginId);
        this.hooks.set(hookName, filtered);
      }
    }

    return existed;
  }

  /**
   * Get a registered plugin by ID.
   *
   * @param pluginId - The plugin ID
   * @returns The plugin, or undefined if not found
   */
  getPlugin(pluginId: string): CrewlyPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * List all registered plugins.
   *
   * @returns Array of registered plugins
   */
  listPlugins(): CrewlyPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get the number of registered plugins.
   *
   * @returns Plugin count
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  // ===========================================================================
  // Hook Execution
  // ===========================================================================

  /**
   * Execute all handlers registered for a hook.
   *
   * Handlers are called in registration order. Errors in one handler
   * are caught and do not prevent subsequent handlers from running.
   * Async handlers are awaited sequentially.
   *
   * @param hookName - The hook to execute
   * @param payload - The payload to pass to each handler
   * @returns Array of errors from failed handlers (empty if all succeeded)
   */
  async executeHook<K extends HookName>(
    hookName: K,
    payload: HookPayloadMap[K],
  ): Promise<Error[]> {
    const handlers = this.hooks.get(hookName) ?? [];
    const errors: Error[] = [];

    const HOOK_TIMEOUT_MS = 30_000;

    for (const { handler } of handlers) {
      try {
        await Promise.race([
          handler(payload),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Hook handler timed out after ${HOOK_TIMEOUT_MS}ms`)), HOOK_TIMEOUT_MS)
          ),
        ]);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return errors;
  }

  /**
   * Get the number of handlers registered for a specific hook.
   *
   * @param hookName - The hook name
   * @returns Number of registered handlers
   */
  getHandlerCount(hookName: HookName): number {
    return this.hooks.get(hookName)?.length ?? 0;
  }

  /**
   * Check if any handlers are registered for a hook.
   *
   * @param hookName - The hook name
   * @returns True if at least one handler is registered
   */
  hasHandlers(hookName: HookName): boolean {
    return this.getHandlerCount(hookName) > 0;
  }
}
