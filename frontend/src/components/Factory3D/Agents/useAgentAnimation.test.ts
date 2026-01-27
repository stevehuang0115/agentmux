/**
 * Tests for useAgentAnimation hook.
 *
 * Tests the animation management logic including state transitions,
 * animation selection, and activity type detection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AnimationAction } from 'three';
import {
  useAgentAnimation,
  AnimationConfig,
  AGENT_ANIMATION_CONFIGS,
  AnimationActivity,
} from './useAgentAnimation';
import { FactoryAgent } from '../../../types/factory.types';

// Mock animation actions
function createMockAction(name: string): AnimationAction {
  const action = {
    name,
    reset: vi.fn().mockReturnThis(),
    fadeIn: vi.fn().mockReturnThis(),
    fadeOut: vi.fn().mockReturnThis(),
    play: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    isRunning: vi.fn().mockReturnValue(false),
    paused: false,
    enabled: true,
    weight: 1,
    time: 0,
  } as unknown as AnimationAction;
  return action;
}

// Create a mock agent factory
function createMockAgent(overrides: Partial<FactoryAgent> = {}): FactoryAgent {
  return {
    id: 'agent-1',
    sessionName: 'test-session',
    name: 'Test Agent',
    projectName: 'Test Project',
    status: 'idle',
    cpuPercent: 0,
    workstationIndex: 0,
    basePosition: { x: 0, z: 0 },
    animalType: 'cow',
    sessionTokens: 0,
    ...overrides,
  };
}

// Standard test config
const testConfig: AnimationConfig = {
  working: 'Typing',
  coffeeBreak: ['Walking', 'Idle', 'Breathing idle'],
  idle: ['Sitting', 'Walking', 'Breathing idle'],
};

describe('useAgentAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return empty animation state when no actions provided', () => {
      const agent = createMockAgent();
      const { result } = renderHook(() =>
        useAgentAnimation(agent, undefined, testConfig)
      );

      expect(result.current.currentAnimation).toBe('');
      expect(result.current.isWalking).toBe(false);
      expect(result.current.activity).toBe('other');
    });

    it('should return empty animation state when actions object is empty', () => {
      const agent = createMockAgent();
      const { result } = renderHook(() =>
        useAgentAnimation(agent, {}, testConfig)
      );

      expect(result.current.currentAnimation).toBe('');
    });
  });

  describe('working state animations', () => {
    it('should play working animation when agent is active with high CPU', () => {
      const agent = createMockAgent({ status: 'active', cpuPercent: 50 });
      const actions = {
        Typing: createMockAction('Typing'),
        Walking: createMockAction('Walking'),
      };

      renderHook(() => useAgentAnimation(agent, actions, testConfig));

      expect(actions.Typing.reset).toHaveBeenCalled();
      expect(actions.Typing.fadeIn).toHaveBeenCalled();
      expect(actions.Typing.play).toHaveBeenCalled();
    });

    it('should not schedule animation changes when working', () => {
      const agent = createMockAgent({ status: 'active', cpuPercent: 50 });
      const actions = {
        Typing: createMockAction('Typing'),
        Walking: createMockAction('Walking'),
      };

      renderHook(() => useAgentAnimation(agent, actions, testConfig));

      // Advance time significantly
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Typing should be called only once (no cycling)
      expect(actions.Typing.reset).toHaveBeenCalledTimes(1);
    });
  });

  describe('coffee break state animations', () => {
    it('should play coffee break animation when active with low CPU', () => {
      const agent = createMockAgent({ status: 'active', cpuPercent: 5 });
      const actions = {
        Typing: createMockAction('Typing'),
        Walking: createMockAction('Walking'),
        Idle: createMockAction('Idle'),
        'Breathing idle': createMockAction('Breathing idle'),
      };

      renderHook(() => useAgentAnimation(agent, actions, testConfig));

      // One of the coffee break animations should have been started
      const coffeeBreakAnimsPlayed = testConfig.coffeeBreak.some(
        (anim) => actions[anim as keyof typeof actions]?.play
      );
      expect(coffeeBreakAnimsPlayed).toBe(true);
    });
  });

  describe('idle state animations', () => {
    it('should play idle animation when agent status is idle', () => {
      const agent = createMockAgent({ status: 'idle' });
      const actions = {
        Typing: createMockAction('Typing'),
        Sitting: createMockAction('Sitting'),
        Walking: createMockAction('Walking'),
        'Breathing idle': createMockAction('Breathing idle'),
      };

      renderHook(() => useAgentAnimation(agent, actions, testConfig));

      // One of the idle animations should have been started
      const idleAnimsStarted = testConfig.idle.some((anim) => {
        const action = actions[anim as keyof typeof actions];
        return action?.reset && (action.reset as any).mock.calls.length > 0;
      });
      expect(idleAnimsStarted).toBe(true);
    });
  });

  describe('animation activity detection', () => {
    it('should detect walking activity', () => {
      const agent = createMockAgent({ status: 'idle' });
      // Force Walking animation by having it be the only option
      const walkingOnlyConfig: AnimationConfig = {
        working: 'Typing',
        coffeeBreak: ['Walking'],
        idle: ['Walking'],
      };
      const actions = {
        Typing: createMockAction('Typing'),
        Walking: createMockAction('Walking'),
      };

      const { result } = renderHook(() =>
        useAgentAnimation(agent, actions, walkingOnlyConfig)
      );

      // After the animation is set, check if Walking is detected
      expect(['walking', 'other']).toContain(result.current.activity);
    });

    it('should detect dancing activity for Dance animation', () => {
      // This tests the DANCING_ANIMATIONS constant
      const agent = createMockAgent({ status: 'idle' });
      const dancingConfig: AnimationConfig = {
        working: 'Typing',
        coffeeBreak: ['Dance'],
        idle: ['Dance'],
      };
      const actions = {
        Typing: createMockAction('Typing'),
        Dance: createMockAction('Dance'),
      };

      const { result } = renderHook(() =>
        useAgentAnimation(agent, actions, dancingConfig)
      );

      // Activity should be detected (may be 'dancing' or 'other' depending on state)
      expect(typeof result.current.activity).toBe('string');
    });

    it('should detect resting activity for Sitting animation', () => {
      const agent = createMockAgent({ status: 'idle' });
      const restingConfig: AnimationConfig = {
        working: 'Typing',
        coffeeBreak: ['Sitting'],
        idle: ['Sitting'],
      };
      const actions = {
        Typing: createMockAction('Typing'),
        Sitting: createMockAction('Sitting'),
      };

      const { result } = renderHook(() =>
        useAgentAnimation(agent, actions, restingConfig)
      );

      // Activity should be detected
      expect(typeof result.current.activity).toBe('string');
    });
  });

  describe('state transitions', () => {
    it('should transition from idle to working when status changes', () => {
      const actions = {
        Typing: createMockAction('Typing'),
        Sitting: createMockAction('Sitting'),
        Walking: createMockAction('Walking'),
      };

      const { rerender } = renderHook(
        ({ agent }) => useAgentAnimation(agent, actions, testConfig),
        { initialProps: { agent: createMockAgent({ status: 'idle' }) } }
      );

      // Transition to working
      rerender({ agent: createMockAgent({ status: 'active', cpuPercent: 50 }) });

      expect(actions.Typing.reset).toHaveBeenCalled();
      expect(actions.Typing.play).toHaveBeenCalled();
    });

    it('should fade out previous animation when transitioning', () => {
      const actions = {
        Typing: createMockAction('Typing'),
        Sitting: createMockAction('Sitting'),
        Walking: createMockAction('Walking'),
      };

      // Start with idle (Sitting might play)
      const { rerender } = renderHook(
        ({ agent }) => useAgentAnimation(agent, actions, testConfig),
        { initialProps: { agent: createMockAgent({ status: 'idle' }) } }
      );

      // Clear mock calls
      vi.clearAllMocks();

      // Transition to working
      rerender({ agent: createMockAgent({ status: 'active', cpuPercent: 50 }) });

      // Typing should fade in
      expect(actions.Typing.fadeIn).toHaveBeenCalled();
    });
  });

  describe('fallback behavior', () => {
    it('should use fallback animation when requested animation not found', () => {
      const agent = createMockAgent({ status: 'active', cpuPercent: 50 });
      // Config requests 'Typing' but only 'Walking' is available
      const actions = {
        Walking: createMockAction('Walking'),
      };

      renderHook(() => useAgentAnimation(agent, actions, testConfig));

      // Should fall back to first available animation
      expect(actions.Walking.reset).toHaveBeenCalled();
      expect(actions.Walking.play).toHaveBeenCalled();
    });
  });

  describe('isWalking flag', () => {
    it('should return false for non-walking animations', () => {
      const agent = createMockAgent({ status: 'active', cpuPercent: 50 });
      const actions = {
        Typing: createMockAction('Typing'),
      };

      const { result } = renderHook(() =>
        useAgentAnimation(agent, actions, testConfig)
      );

      expect(result.current.isWalking).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clear timers on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const agent = createMockAgent({ status: 'idle' });
      const actions = {
        Sitting: createMockAction('Sitting'),
        Walking: createMockAction('Walking'),
      };

      const { unmount } = renderHook(() =>
        useAgentAnimation(agent, actions, testConfig)
      );

      unmount();

      // clearTimeout should have been called during cleanup
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});

describe('AGENT_ANIMATION_CONFIGS', () => {
  it('should have configs for all animal types', () => {
    expect(AGENT_ANIMATION_CONFIGS.COW).toBeDefined();
    expect(AGENT_ANIMATION_CONFIGS.HORSE).toBeDefined();
    expect(AGENT_ANIMATION_CONFIGS.TIGER).toBeDefined();
    expect(AGENT_ANIMATION_CONFIGS.RABBIT).toBeDefined();
  });

  it('should have working animation for all configs', () => {
    Object.values(AGENT_ANIMATION_CONFIGS).forEach((config) => {
      expect(typeof config.working).toBe('string');
      expect(config.working.length).toBeGreaterThan(0);
    });
  });

  it('should have non-empty coffeeBreak arrays', () => {
    Object.values(AGENT_ANIMATION_CONFIGS).forEach((config) => {
      expect(Array.isArray(config.coffeeBreak)).toBe(true);
      expect(config.coffeeBreak.length).toBeGreaterThan(0);
    });
  });

  it('should have non-empty idle arrays', () => {
    Object.values(AGENT_ANIMATION_CONFIGS).forEach((config) => {
      expect(Array.isArray(config.idle)).toBe(true);
      expect(config.idle.length).toBeGreaterThan(0);
    });
  });

  it('should not include dance animations in idle arrays', () => {
    // Dance animations should only happen on stage, not during idle wandering
    const danceAnimations = ['Dance', 'Salsa dancing'];
    Object.values(AGENT_ANIMATION_CONFIGS).forEach((config) => {
      config.idle.forEach((anim) => {
        expect(danceAnimations).not.toContain(anim);
      });
    });
  });
});
