/**
 * Tests for Plugin Service
 *
 * @module services/plugin/plugin.service.test
 */

import { PluginService } from './plugin.service.js';
import type { CrewlyPlugin, AgentBootPayload, TaskVerifyPayload } from './plugin.types.js';

// =============================================================================
// Test helpers
// =============================================================================

function createTestPlugin(overrides: Partial<CrewlyPlugin> = {}): CrewlyPlugin {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('PluginService', () => {
  beforeEach(() => {
    PluginService.clearInstance();
  });

  // ========================= Singleton =========================

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = PluginService.getInstance();
      const b = PluginService.getInstance();
      expect(a).toBe(b);
    });

    it('should return new instance after clearInstance', () => {
      const a = PluginService.getInstance();
      PluginService.clearInstance();
      const b = PluginService.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // ========================= Registration =========================

  describe('registerPlugin', () => {
    it('should register a plugin', () => {
      const service = PluginService.getInstance();
      const plugin = createTestPlugin();
      service.registerPlugin(plugin);

      expect(service.getPluginCount()).toBe(1);
      expect(service.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should register multiple plugins', () => {
      const service = PluginService.getInstance();
      service.registerPlugin(createTestPlugin({ id: 'plugin-a', name: 'A' }));
      service.registerPlugin(createTestPlugin({ id: 'plugin-b', name: 'B' }));

      expect(service.getPluginCount()).toBe(2);
    });

    it('should replace plugin with same ID', () => {
      const service = PluginService.getInstance();
      service.registerPlugin(createTestPlugin({ name: 'Original' }));
      service.registerPlugin(createTestPlugin({ name: 'Replacement' }));

      expect(service.getPluginCount()).toBe(1);
      expect(service.getPlugin('test-plugin')!.name).toBe('Replacement');
    });

    it('should register hook handlers from plugin', () => {
      const service = PluginService.getInstance();
      const handler = jest.fn();
      service.registerPlugin(createTestPlugin({
        hooks: { onAgentBoot: handler },
      }));

      expect(service.getHandlerCount('onAgentBoot')).toBe(1);
    });

    it('should register handlers for multiple hooks', () => {
      const service = PluginService.getInstance();
      service.registerPlugin(createTestPlugin({
        hooks: {
          onAgentBoot: jest.fn(),
          onTaskVerify: jest.fn(),
        },
      }));

      expect(service.getHandlerCount('onAgentBoot')).toBe(1);
      expect(service.getHandlerCount('onTaskVerify')).toBe(1);
      expect(service.getHandlerCount('onSkillExecute')).toBe(0);
    });
  });

  // ========================= Unregistration =========================

  describe('unregisterPlugin', () => {
    it('should remove a registered plugin', () => {
      const service = PluginService.getInstance();
      service.registerPlugin(createTestPlugin());
      const removed = service.unregisterPlugin('test-plugin');

      expect(removed).toBe(true);
      expect(service.getPluginCount()).toBe(0);
    });

    it('should return false for non-existent plugin', () => {
      const service = PluginService.getInstance();
      expect(service.unregisterPlugin('nonexistent')).toBe(false);
    });

    it('should remove hook handlers when plugin is unregistered', () => {
      const service = PluginService.getInstance();
      service.registerPlugin(createTestPlugin({
        hooks: { onAgentBoot: jest.fn() },
      }));
      expect(service.getHandlerCount('onAgentBoot')).toBe(1);

      service.unregisterPlugin('test-plugin');
      expect(service.getHandlerCount('onAgentBoot')).toBe(0);
    });

    it('should not affect other plugins when unregistering one', () => {
      const service = PluginService.getInstance();
      service.registerPlugin(createTestPlugin({
        id: 'plugin-a',
        hooks: { onAgentBoot: jest.fn() },
      }));
      service.registerPlugin(createTestPlugin({
        id: 'plugin-b',
        hooks: { onAgentBoot: jest.fn() },
      }));

      service.unregisterPlugin('plugin-a');
      expect(service.getPluginCount()).toBe(1);
      expect(service.getHandlerCount('onAgentBoot')).toBe(1);
    });
  });

  // ========================= Listing =========================

  describe('listPlugins', () => {
    it('should return empty array with no plugins', () => {
      const service = PluginService.getInstance();
      expect(service.listPlugins()).toEqual([]);
    });

    it('should return all registered plugins', () => {
      const service = PluginService.getInstance();
      service.registerPlugin(createTestPlugin({ id: 'a' }));
      service.registerPlugin(createTestPlugin({ id: 'b' }));

      const list = service.listPlugins();
      expect(list).toHaveLength(2);
      expect(list.map(p => p.id)).toContain('a');
      expect(list.map(p => p.id)).toContain('b');
    });
  });

  // ========================= Hook Execution =========================

  describe('executeHook', () => {
    it('should call registered handler with payload', async () => {
      const service = PluginService.getInstance();
      const handler = jest.fn();
      service.registerPlugin(createTestPlugin({
        hooks: { onAgentBoot: handler },
      }));

      const payload: AgentBootPayload = {
        sessionName: 'test-session',
        memberId: 'member-1',
        teamId: 'team-1',
        role: 'developer',
        runtimeType: 'claude-code',
      };

      await service.executeHook('onAgentBoot', payload);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should call multiple handlers in order', async () => {
      const service = PluginService.getInstance();
      const callOrder: string[] = [];

      service.registerPlugin(createTestPlugin({
        id: 'plugin-a',
        hooks: { onAgentBoot: () => { callOrder.push('a'); } },
      }));
      service.registerPlugin(createTestPlugin({
        id: 'plugin-b',
        hooks: { onAgentBoot: () => { callOrder.push('b'); } },
      }));

      await service.executeHook('onAgentBoot', {
        sessionName: 's', memberId: 'm', teamId: 't', role: 'r', runtimeType: 'rt',
      });

      expect(callOrder).toEqual(['a', 'b']);
    });

    it('should handle async handlers', async () => {
      const service = PluginService.getInstance();
      const handler = jest.fn().mockResolvedValue(undefined);
      service.registerPlugin(createTestPlugin({
        hooks: { onAgentBoot: handler },
      }));

      await service.executeHook('onAgentBoot', {
        sessionName: 's', memberId: 'm', teamId: 't', role: 'r', runtimeType: 'rt',
      });
      expect(handler).toHaveBeenCalled();
    });

    it('should catch handler errors without stopping other handlers', async () => {
      const service = PluginService.getInstance();
      const handlerB = jest.fn();

      service.registerPlugin(createTestPlugin({
        id: 'plugin-a',
        hooks: { onAgentBoot: () => { throw new Error('Plugin A crashed'); } },
      }));
      service.registerPlugin(createTestPlugin({
        id: 'plugin-b',
        hooks: { onAgentBoot: handlerB },
      }));

      const errors = await service.executeHook('onAgentBoot', {
        sessionName: 's', memberId: 'm', teamId: 't', role: 'r', runtimeType: 'rt',
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Plugin A crashed');
      expect(handlerB).toHaveBeenCalled();
    });

    it('should return empty errors array when all handlers succeed', async () => {
      const service = PluginService.getInstance();
      service.registerPlugin(createTestPlugin({
        hooks: { onAgentBoot: jest.fn() },
      }));

      const errors = await service.executeHook('onAgentBoot', {
        sessionName: 's', memberId: 'm', teamId: 't', role: 'r', runtimeType: 'rt',
      });
      expect(errors).toEqual([]);
    });

    it('should return empty errors when no handlers registered', async () => {
      const service = PluginService.getInstance();
      const errors = await service.executeHook('onAgentBoot', {
        sessionName: 's', memberId: 'm', teamId: 't', role: 'r', runtimeType: 'rt',
      });
      expect(errors).toEqual([]);
    });

    it('should work with onTaskVerify hook', async () => {
      const service = PluginService.getInstance();
      const handler = jest.fn();
      service.registerPlugin(createTestPlugin({
        hooks: { onTaskVerify: handler },
      }));

      const payload: TaskVerifyPayload = {
        taskId: 'task-1',
        workerId: 'worker-1',
        teamId: 'team-1',
        results: [{ name: 'build', passed: true }],
        passed: true,
        score: 100,
      };

      await service.executeHook('onTaskVerify', payload);
      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  // ========================= hasHandlers =========================

  describe('hasHandlers', () => {
    it('should return false when no handlers', () => {
      const service = PluginService.getInstance();
      expect(service.hasHandlers('onAgentBoot')).toBe(false);
    });

    it('should return true when handlers exist', () => {
      const service = PluginService.getInstance();
      service.registerPlugin(createTestPlugin({
        hooks: { onAgentBoot: jest.fn() },
      }));
      expect(service.hasHandlers('onAgentBoot')).toBe(true);
    });
  });
});
