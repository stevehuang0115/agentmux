/**
 * MessengerRegistryService Tests
 *
 * Tests for the singleton messenger adapter registry.
 *
 * @module messenger-registry-service.test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MessengerRegistryService } from './messenger-registry.service.js';
import type { MessengerAdapter, MessengerPlatform } from './messenger-adapter.interface.js';

function makeMockAdapter(platform: MessengerPlatform, connected = true): MessengerAdapter {
  return {
    platform,
    initialize: async () => {},
    sendMessage: async () => {},
    getStatus: () => ({ connected, platform }),
    disconnect: async () => {},
  };
}

describe('MessengerRegistryService', () => {
  let registry: MessengerRegistryService;

  beforeEach(() => {
    // Access fresh instance via singleton - clear internal state
    registry = MessengerRegistryService.getInstance();
    // Unregister all by re-creating (we'll test via public API)
    (registry as any).adapters = new Map();
  });

  it('should return undefined for unregistered platform', () => {
    expect(registry.get('discord')).toBeUndefined();
  });

  it('should register and retrieve an adapter', () => {
    const adapter = makeMockAdapter('slack');
    registry.register(adapter);
    expect(registry.get('slack')).toBe(adapter);
  });

  it('should overwrite adapter when registering same platform twice', () => {
    const first = makeMockAdapter('telegram');
    const second = makeMockAdapter('telegram');
    registry.register(first);
    registry.register(second);
    expect(registry.get('telegram')).toBe(second);
  });

  it('should list statuses of all registered adapters', () => {
    registry.register(makeMockAdapter('slack', true));
    registry.register(makeMockAdapter('discord', false));
    const statuses = registry.list();
    expect(statuses).toHaveLength(2);
    expect(statuses).toEqual(
      expect.arrayContaining([
        { connected: true, platform: 'slack' },
        { connected: false, platform: 'discord' },
      ])
    );
  });

  it('should return empty list when no adapters registered', () => {
    expect(registry.list()).toEqual([]);
  });

  it('should return same instance via getInstance', () => {
    const a = MessengerRegistryService.getInstance();
    const b = MessengerRegistryService.getInstance();
    expect(a).toBe(b);
  });
});
