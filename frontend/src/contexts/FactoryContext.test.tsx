/**
 * Tests for FactoryContext.
 *
 * Tests the factory state management, hooks, and provider behavior.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { FactoryProvider, useFactory } from './FactoryContext';

// Mock factory state response type
interface MockFactoryState {
  agents: Array<{
    id: string;
    sessionName: string;
    name: string;
    projectName: string;
    status: 'active' | 'idle' | 'dormant';
    cpuPercent: number;
    activity?: string;
    sessionTokens?: number;
  }>;
  projects: string[];
  stats: { activeCount: number; idleCount: number; dormantCount: number; totalTokens: number };
}

// SSE hook mock state - mutable object so the mock can read updated values
const mockSSEState = {
  data: null as MockFactoryState | null,
  error: null as string | null,
  isLoading: true,
};

// Mock the useFactorySSE hook - must read from mockSSEState object
vi.mock('../hooks/useFactorySSE', () => ({
  useFactorySSE: () => ({
    get data() { return mockSSEState.data; },
    get isLoading() { return mockSSEState.isLoading; },
    get connectionStatus() { return mockSSEState.data ? 'connected' : 'connecting'; },
    get error() { return mockSSEState.error; },
    reconnect: vi.fn(),
  }),
}));

// Mock the factory service (still needed for fallback)
vi.mock('../services/factory.service', () => ({
  factoryService: {
    getFactoryState: vi.fn(),
    getUsageStats: vi.fn(),
  },
}));

describe('FactoryContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset SSE mock state
    mockSSEState.data = null;
    mockSSEState.error = null;
    mockSSEState.isLoading = true;
  });

  describe('useFactory hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useFactory());
      }).toThrow('useFactory must be used within a FactoryProvider');

      spy.mockRestore();
    });

    it('should return context when used inside provider', async () => {
      // Set up SSE mock data
      mockSSEState.data = {
        agents: [],
        projects: [],
        stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
      };
      mockSSEState.isLoading = false;

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.agents).toBeInstanceOf(Map);
      expect(result.current.zones).toBeInstanceOf(Map);
      expect(result.current.lightingMode).toBe('day');
      expect(result.current.stats).toBeDefined();
    });
  });

  describe('FactoryProvider', () => {
    it('should initialize with default values', async () => {
      // Set up SSE mock data
      mockSSEState.data = {
        agents: [],
        projects: [],
        stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
      };
      mockSSEState.isLoading = false;

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lightingMode).toBe('day');
      expect(result.current.bossModeState.isActive).toBe(false);
      expect(result.current.projects).toHaveLength(0);
    });

    it('should receive factory state from SSE', async () => {
      // Set up SSE mock data with an agent
      mockSSEState.data = {
        agents: [
          {
            id: 'agent-1',
            sessionName: 'test-session',
            name: 'Test Agent',
            projectName: 'Test Project',
            status: 'active' as const,
            cpuPercent: 50,
            activity: 'Working...',
          },
        ],
        projects: ['Test Project'],
        stats: { activeCount: 1, idleCount: 0, dormantCount: 0, totalTokens: 100 },
      };
      mockSSEState.isLoading = false;

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.agents.size).toBe(1);
      expect(result.current.projects).toContain('Test Project');
    });

    it('should compute stats from agents', async () => {
      // Set up SSE mock data with multiple agents
      mockSSEState.data = {
        agents: [
          { id: '1', sessionName: 's1', name: 'A1', projectName: 'P1', status: 'active' as const, cpuPercent: 50 },
          { id: '2', sessionName: 's2', name: 'A2', projectName: 'P1', status: 'active' as const, cpuPercent: 30 },
          { id: '3', sessionName: 's3', name: 'A3', projectName: 'P1', status: 'idle' as const, cpuPercent: 0 },
          { id: '4', sessionName: 's4', name: 'A4', projectName: 'P1', status: 'dormant' as const, cpuPercent: 0 },
        ],
        projects: ['P1'],
        stats: { activeCount: 2, idleCount: 1, dormantCount: 1, totalTokens: 0 },
      };
      mockSSEState.isLoading = false;

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats.activeCount).toBe(2);
      expect(result.current.stats.idleCount).toBe(1);
      expect(result.current.stats.dormantCount).toBe(1);
    });

    it('should toggle lighting mode', async () => {
      // Set up SSE mock data
      mockSSEState.data = {
        agents: [],
        projects: [],
        stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
      };
      mockSSEState.isLoading = false;

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.lightingMode).toBe('day');

      act(() => {
        result.current.setLightingMode('auto');
      });

      expect(result.current.lightingMode).toBe('auto');

      act(() => {
        result.current.setLightingMode('night');
      });

      expect(result.current.lightingMode).toBe('night');
    });

    it('should toggle boss mode', async () => {
      // Set up SSE mock data
      mockSSEState.data = {
        agents: [],
        projects: ['Project A', 'Project B'],
        stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
      };
      mockSSEState.isLoading = false;

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.bossModeState.isActive).toBe(false);

      act(() => {
        result.current.toggleBossMode();
      });

      expect(result.current.bossModeState.isActive).toBe(true);

      act(() => {
        result.current.toggleBossMode();
      });

      expect(result.current.bossModeState.isActive).toBe(false);
    });

    it('should handle SSE errors gracefully', async () => {
      // Set up SSE error state
      mockSSEState.error = 'Network error';
      mockSSEState.isLoading = false;
      mockSSEState.data = null;

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <FactoryProvider>{children}</FactoryProvider>
      );

      const { result } = renderHook(() => useFactory(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });
  });
});

// ====== UNIT TESTS FOR CORE LOGIC PATTERNS ======

/**
 * Tests for entity command system patterns.
 * These test the core patterns without full React context rendering.
 */
describe('FactoryContext Core Logic Patterns', () => {
  describe('Entity Command Queue Pattern', () => {
    // Simulates the ref-based command queue pattern
    const createCommandQueue = () => {
      const queue = new Map<string, { stepType: string }>();
      return {
        send: (entityId: string, command: { stepType: string }) => {
          queue.set(entityId, command);
        },
        consume: (entityId: string) => {
          const cmd = queue.get(entityId) ?? null;
          if (cmd) queue.delete(entityId);
          return cmd;
        },
        has: (entityId: string) => queue.has(entityId),
      };
    };

    it('should store command when sent', () => {
      const queue = createCommandQueue();
      queue.send('agent-1', { stepType: 'go_to_kitchen' });
      expect(queue.has('agent-1')).toBe(true);
    });

    it('should return and delete command when consumed', () => {
      const queue = createCommandQueue();
      queue.send('agent-1', { stepType: 'go_to_stage' });

      const cmd = queue.consume('agent-1');
      expect(cmd).toEqual({ stepType: 'go_to_stage' });
      expect(queue.has('agent-1')).toBe(false);
    });

    it('should return null when no command exists', () => {
      const queue = createCommandQueue();
      expect(queue.consume('nonexistent')).toBeNull();
    });

    it('should prevent double consumption', () => {
      const queue = createCommandQueue();
      queue.send('agent-1', { stepType: 'wander' });

      const first = queue.consume('agent-1');
      const second = queue.consume('agent-1');

      expect(first).toEqual({ stepType: 'wander' });
      expect(second).toBeNull();
    });

    it('should allow last command to take precedence', () => {
      const queue = createCommandQueue();
      queue.send('agent-1', { stepType: 'go_to_kitchen' });
      queue.send('agent-1', { stepType: 'go_to_stage' });

      expect(queue.consume('agent-1')).toEqual({ stepType: 'go_to_stage' });
    });
  });

  describe('Active Entity Action Tracking Pattern', () => {
    const createActiveTracker = () => {
      let activeActions = new Map<string, string>();
      return {
        setActive: (entityId: string, stepType: string) => {
          activeActions = new Map(activeActions);
          activeActions.set(entityId, stepType);
        },
        getActive: (entityId: string) => activeActions.get(entityId) ?? null,
        clearActive: (entityId: string) => {
          activeActions = new Map(activeActions);
          activeActions.delete(entityId);
        },
      };
    };

    it('should set and retrieve active action', () => {
      const tracker = createActiveTracker();
      tracker.setActive('npc-1', 'go_to_kitchen');
      expect(tracker.getActive('npc-1')).toBe('go_to_kitchen');
    });

    it('should return null for inactive entity', () => {
      const tracker = createActiveTracker();
      expect(tracker.getActive('nonexistent')).toBeNull();
    });

    it('should clear active action', () => {
      const tracker = createActiveTracker();
      tracker.setActive('npc-1', 'go_to_stage');
      tracker.clearActive('npc-1');
      expect(tracker.getActive('npc-1')).toBeNull();
    });

    it('should track multiple entities independently', () => {
      const tracker = createActiveTracker();
      tracker.setActive('npc-1', 'go_to_kitchen');
      tracker.setActive('npc-2', 'go_to_stage');

      expect(tracker.getActive('npc-1')).toBe('go_to_kitchen');
      expect(tracker.getActive('npc-2')).toBe('go_to_stage');

      tracker.clearActive('npc-1');
      expect(tracker.getActive('npc-1')).toBeNull();
      expect(tracker.getActive('npc-2')).toBe('go_to_stage');
    });
  });

  describe('Freestyle Mode Pattern', () => {
    const createFreestyleMode = () => {
      let freestyleMode = false;
      let moveTargetRef: { x: number; z: number } | null = null;

      return {
        setMode: (active: boolean) => {
          freestyleMode = active;
          if (!active) {
            moveTargetRef = null;
          }
        },
        getMode: () => freestyleMode,
        setTarget: (target: { x: number; z: number } | null) => {
          moveTargetRef = target;
        },
        consumeTarget: () => {
          const target = moveTargetRef;
          if (target) {
            moveTargetRef = null;
          }
          return target;
        },
      };
    };

    it('should enable freestyle mode', () => {
      const mode = createFreestyleMode();
      mode.setMode(true);
      expect(mode.getMode()).toBe(true);
    });

    it('should disable freestyle mode and clear target', () => {
      const mode = createFreestyleMode();
      mode.setMode(true);
      mode.setTarget({ x: 10, z: 20 });
      mode.setMode(false);

      expect(mode.getMode()).toBe(false);
      expect(mode.consumeTarget()).toBeNull();
    });

    it('should set and consume move target', () => {
      const mode = createFreestyleMode();
      mode.setTarget({ x: 5, z: 15 });

      const target = mode.consumeTarget();
      expect(target).toEqual({ x: 5, z: 15 });
      expect(mode.consumeTarget()).toBeNull();
    });

    it('should prevent double consumption of target', () => {
      const mode = createFreestyleMode();
      mode.setTarget({ x: 1, z: 2 });

      const first = mode.consumeTarget();
      const second = mode.consumeTarget();

      expect(first).toEqual({ x: 1, z: 2 });
      expect(second).toBeNull();
    });
  });

  describe('Boss Mode Navigation Pattern', () => {
    const createBossNavigation = (initialTargets: string[]) => {
      let currentIndex = 0;
      let isActive = true;
      const targets = [...initialTargets];

      return {
        setActive: (active: boolean) => { isActive = active; },
        next: () => {
          if (!isActive || targets.length === 0) return;
          currentIndex = (currentIndex + 1) % targets.length;
        },
        prev: () => {
          if (!isActive || targets.length === 0) return;
          currentIndex = currentIndex === 0 ? targets.length - 1 : currentIndex - 1;
        },
        getCurrentName: () => {
          if (!isActive || targets.length === 0) return '';
          return targets[currentIndex] ?? '';
        },
        getCurrentIndex: () => currentIndex,
      };
    };

    it('should advance to next target', () => {
      const nav = createBossNavigation(['A', 'B', 'C']);
      expect(nav.getCurrentName()).toBe('A');
      nav.next();
      expect(nav.getCurrentName()).toBe('B');
    });

    it('should wrap around at end', () => {
      const nav = createBossNavigation(['A', 'B', 'C']);
      nav.next(); nav.next(); nav.next();
      expect(nav.getCurrentName()).toBe('A');
    });

    it('should go to previous target', () => {
      const nav = createBossNavigation(['A', 'B', 'C']);
      nav.next();
      nav.prev();
      expect(nav.getCurrentName()).toBe('A');
    });

    it('should wrap to last when going previous from first', () => {
      const nav = createBossNavigation(['A', 'B', 'C']);
      nav.prev();
      expect(nav.getCurrentName()).toBe('C');
    });

    it('should return empty string when inactive', () => {
      const nav = createBossNavigation(['A', 'B']);
      nav.setActive(false);
      expect(nav.getCurrentName()).toBe('');
    });

    it('should handle empty targets array', () => {
      const nav = createBossNavigation([]);
      expect(nav.getCurrentName()).toBe('');
    });

    it('should handle single element array', () => {
      const nav = createBossNavigation(['Only']);
      nav.next();
      expect(nav.getCurrentName()).toBe('Only');
      nav.prev();
      expect(nav.getCurrentName()).toBe('Only');
    });
  });

  describe('Exponential Backoff Calculation', () => {
    const getReconnectDelay = (
      attempts: number,
      baseDelay = 1000,
      maxDelay = 30000
    ): number => {
      return Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
    };

    it('should return base delay for first attempt', () => {
      expect(getReconnectDelay(0, 1000)).toBe(1000);
    });

    it('should double delay for each attempt', () => {
      expect(getReconnectDelay(1, 1000)).toBe(2000);
      expect(getReconnectDelay(2, 1000)).toBe(4000);
      expect(getReconnectDelay(3, 1000)).toBe(8000);
    });

    it('should cap at max delay', () => {
      expect(getReconnectDelay(10, 1000, 30000)).toBe(30000);
    });
  });

  describe('Visibility Toggle Pattern', () => {
    const createVisibilityToggles = () => {
      let showNPC = true;
      let showGuest = true;
      let showObjects = true;

      return {
        setShowNPC: (show: boolean) => { showNPC = show; },
        setShowGuest: (show: boolean) => { showGuest = show; },
        setShowObjects: (show: boolean) => { showObjects = show; },
        getState: () => ({ showNPC, showGuest, showObjects }),
        getHiddenCount: () => {
          let count = 0;
          if (!showNPC) count++;
          if (!showGuest) count++;
          if (!showObjects) count++;
          return count;
        },
      };
    };

    it('should start with all visible', () => {
      const toggles = createVisibilityToggles();
      expect(toggles.getState()).toEqual({
        showNPC: true,
        showGuest: true,
        showObjects: true,
      });
    });

    it('should count hidden items correctly', () => {
      const toggles = createVisibilityToggles();
      expect(toggles.getHiddenCount()).toBe(0);

      toggles.setShowNPC(false);
      expect(toggles.getHiddenCount()).toBe(1);

      toggles.setShowGuest(false);
      expect(toggles.getHiddenCount()).toBe(2);

      toggles.setShowObjects(false);
      expect(toggles.getHiddenCount()).toBe(3);
    });
  });
});

/**
 * Tests for animation transition fallback logic.
 * Mirrors the transitionToAnimation function in GenericNPC.
 */
describe('Animation Transition Fallback Logic', () => {
  /**
   * Simulates the fallback logic from transitionToAnimation
   */
  function findBestAnimation(
    targetAnim: string,
    availableAnimations: string[]
  ): string | null {
    // Direct match
    if (availableAnimations.includes(targetAnim)) {
      return targetAnim;
    }

    // Walking fallbacks
    if (targetAnim.toLowerCase().includes('walk') || targetAnim.toLowerCase().includes('run')) {
      const walkingFallbacks = ['Walking', 'Talking', 'Brutal to happy walking'];
      for (const fallback of walkingFallbacks) {
        if (availableAnimations.includes(fallback)) {
          return fallback;
        }
      }
    }

    // Generic idle fallbacks
    const idleFallbacks = ['Idle', 'Breathing idle', 'Talking', 'Look around'];
    for (const fallback of idleFallbacks) {
      if (availableAnimations.includes(fallback)) {
        return fallback;
      }
    }

    return null;
  }

  it('should use exact match when available', () => {
    expect(findBestAnimation('Walking', ['Walking', 'Idle'])).toBe('Walking');
  });

  it('should fallback to Walking for walk animations', () => {
    expect(findBestAnimation('WalkForward', ['Walking', 'Idle'])).toBe('Walking');
  });

  it('should fallback to Talking for walk when Walking unavailable', () => {
    expect(findBestAnimation('WalkFast', ['Talking', 'Idle'])).toBe('Talking');
  });

  it('should use Idle for missing non-walk animation', () => {
    expect(findBestAnimation('MissingAnim', ['Idle', 'Breathing idle'])).toBe('Idle');
  });

  it('should use Breathing idle when Idle unavailable', () => {
    expect(findBestAnimation('Unknown', ['Breathing idle', 'Look around'])).toBe('Breathing idle');
  });

  it('should return null when no animations available', () => {
    expect(findBestAnimation('Anything', [])).toBeNull();
  });

  it('should be case insensitive for walk detection', () => {
    expect(findBestAnimation('WALKING', ['Walking'])).toBe('Walking');
    expect(findBestAnimation('running', ['Walking'])).toBe('Walking');
  });
});

/**
 * Tests for circular seat arrangement calculation.
 */
describe('Circular Seat Arrangement Calculation', () => {
  const computeCircularSeatPosition = (
    centerX: number,
    centerZ: number,
    radius: number,
    seatIndex: number,
    totalSeats: number
  ) => {
    const angle = (seatIndex / totalSeats) * Math.PI * 2;
    return {
      x: centerX + Math.cos(angle) * radius,
      z: centerZ + Math.sin(angle) * radius,
      rotation: angle + Math.PI,
    };
  };

  it('should compute correct position for first seat', () => {
    const pos = computeCircularSeatPosition(0, 0, 2, 0, 4);
    expect(pos.x).toBeCloseTo(2);
    expect(pos.z).toBeCloseTo(0);
  });

  it('should compute correct position for second seat (90 degrees)', () => {
    const pos = computeCircularSeatPosition(0, 0, 2, 1, 4);
    expect(pos.x).toBeCloseTo(0);
    expect(pos.z).toBeCloseTo(2);
  });

  it('should offset from center correctly', () => {
    const pos = computeCircularSeatPosition(10, 5, 2, 0, 4);
    expect(pos.x).toBeCloseTo(12);
    expect(pos.z).toBeCloseTo(5);
  });
});
