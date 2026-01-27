/**
 * useAgentAnimation - Custom hook for managing agent animations.
 *
 * Provides dynamic animation selection based on agent status with
 * random animation cycling for idle and coffee break states.
 */

import { useRef, useEffect, useCallback } from 'react';
import { AnimationAction } from 'three';
import { FactoryAgent } from '../../../types/factory.types';

/**
 * Animation configuration for different agent states
 */
export interface AnimationConfig {
  /** Animation to play when actively working (typing at desk) */
  readonly working: string;
  /** Animations to randomly cycle through during coffee break */
  readonly coffeeBreak: readonly string[];
  /** Animations to randomly cycle through when idle */
  readonly idle: readonly string[];
}

/**
 * Animation state tracking
 */
interface AnimationState {
  currentAnim: string;
  lastChangeTime: number;
  currentIdleIndex: number;
}

/**
 * Get a seeded random number based on agent ID for consistent randomness
 */
function seededRandom(seed: string, index: number): number {
  let hash = 0;
  const str = seed + index.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 1000) / 1000;
}

/**
 * Duration for each animation state before switching (in seconds)
 */
const ANIMATION_DURATIONS = {
  coffeeBreak: { min: 4, max: 8 },  // 4-8 seconds per animation during coffee break
  idle: { min: 6, max: 12 },        // 6-12 seconds per animation when idle
};

/**
 * Animations that should move the agent's position
 */
const WALKING_ANIMATIONS = ['Walking', 'Running', 'Jumping'];

/**
 * Animations that should direct agent to the stage
 */
const DANCING_ANIMATIONS = ['Dance', 'Salsa dancing'];

/**
 * Animations that should direct agent to the lounge
 */
const RESTING_ANIMATIONS = ['Sitting', 'Idle', 'Breathing idle'];

/**
 * Animation activity type for destination-based movement
 */
export type AnimationActivity = 'walking' | 'dancing' | 'resting' | 'other';

/**
 * useAgentAnimation - Hook for managing agent animation state.
 *
 * @param agent - The agent data
 * @param actions - Animation actions from useAnimations
 * @param config - Animation configuration for this agent type
 * @returns Object with current animation state
 */
export function useAgentAnimation(
  agent: FactoryAgent,
  actions: Record<string, AnimationAction | null> | undefined,
  config: AnimationConfig
): { currentAnimation: string; isWalking: boolean; activity: AnimationActivity } {
  const stateRef = useRef<AnimationState>({
    currentAnim: '',
    lastChangeTime: 0,
    currentIdleIndex: 0,
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Select a random animation from a list
   */
  const selectRandomAnimation = useCallback((
    animations: readonly string[],
    exclude?: string
  ): string => {
    if (animations.length === 0) return config.working;
    if (animations.length === 1) return animations[0];

    // Filter out the excluded animation to avoid repeats
    const available = exclude
      ? animations.filter(a => a !== exclude)
      : animations;

    if (available.length === 0) return animations[0];

    // Use agent ID for some randomness variation
    const randomIndex = Math.floor(
      seededRandom(agent.id, Date.now()) * available.length
    );
    return available[randomIndex];
  }, [agent.id, config.working]);

  /**
   * Transition to a new animation with fade
   */
  const transitionToAnimation = useCallback((
    targetAnim: string,
    fadeInDuration: number = 0.5,
    fadeOutDuration: number = 0.5
  ) => {
    if (!actions) return;

    const state = stateRef.current;

    // Skip if already playing this animation
    if (state.currentAnim === targetAnim) return;

    // Fade out current animation
    if (state.currentAnim && actions[state.currentAnim]) {
      actions[state.currentAnim]?.fadeOut(fadeOutDuration);
    }

    // Fade in new animation
    if (actions[targetAnim]) {
      actions[targetAnim]?.reset().fadeIn(fadeInDuration).play();
      state.currentAnim = targetAnim;
      state.lastChangeTime = Date.now();
    } else {
      // Fallback to first available animation
      const fallback = Object.keys(actions)[0];
      if (fallback && actions[fallback]) {
        actions[fallback]?.reset().fadeIn(fadeInDuration).play();
        state.currentAnim = fallback;
        state.lastChangeTime = Date.now();
      }
    }
  }, [actions]);

  /**
   * Schedule the next animation change for idle/coffee states
   */
  const scheduleNextAnimation = useCallback((
    animations: readonly string[],
    durations: { min: number; max: number }
  ) => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Calculate random duration
    const duration = durations.min +
      seededRandom(agent.id, Date.now()) * (durations.max - durations.min);

    timerRef.current = setTimeout(() => {
      const state = stateRef.current;
      const nextAnim = selectRandomAnimation(animations, state.currentAnim);
      transitionToAnimation(nextAnim, 0.8, 0.8);

      // Schedule next change
      scheduleNextAnimation(animations, durations);
    }, duration * 1000);
  }, [agent.id, selectRandomAnimation, transitionToAnimation]);

  // Main animation selection effect
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;

    const isActuallyWorking = agent.status === 'active' && agent.cpuPercent > 10;
    const isCoffeeBreak = agent.status === 'active' && agent.cpuPercent <= 10;
    const isIdle = agent.status === 'idle';

    // Clear any existing timer when state changes
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isActuallyWorking) {
      // Working - always typing
      transitionToAnimation(config.working);
    } else if (isCoffeeBreak) {
      // Coffee break - start with random animation and schedule changes
      const startAnim = selectRandomAnimation(config.coffeeBreak);
      transitionToAnimation(startAnim);
      scheduleNextAnimation(config.coffeeBreak, ANIMATION_DURATIONS.coffeeBreak);
    } else if (isIdle) {
      // Idle - start with random animation and schedule changes
      const startAnim = selectRandomAnimation(config.idle);
      transitionToAnimation(startAnim);
      scheduleNextAnimation(config.idle, ANIMATION_DURATIONS.idle);
    }

    // Cleanup timer on unmount or state change
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    actions,
    agent.status,
    agent.cpuPercent,
    config,
    transitionToAnimation,
    selectRandomAnimation,
    scheduleNextAnimation,
  ]);

  // Check if current animation is a walking/moving animation
  const currentAnim = stateRef.current.currentAnim;
  const isWalkingAnimation = WALKING_ANIMATIONS.includes(currentAnim);

  // Determine the animation activity type
  let activity: AnimationActivity = 'other';
  if (WALKING_ANIMATIONS.includes(currentAnim)) {
    activity = 'walking';
  } else if (DANCING_ANIMATIONS.includes(currentAnim)) {
    activity = 'dancing';
  } else if (RESTING_ANIMATIONS.includes(currentAnim)) {
    activity = 'resting';
  }

  return {
    currentAnimation: currentAnim,
    isWalking: isWalkingAnimation,
    activity,
  };
}

/**
 * Pre-defined animation configurations for each animal type
 * Note: Dance animations are excluded from idle states - dancing only happens on stage
 */
export const AGENT_ANIMATION_CONFIGS = {
  COW: {
    working: 'Typing',
    coffeeBreak: ['Idle', 'Walking', 'Breathing idle'],
    idle: ['Sitting', 'Idle', 'Walking', 'Breathing idle'],
  },
  HORSE: {
    working: 'Typing',
    coffeeBreak: ['Breathing idle', 'Walking', 'Idle'],
    idle: ['Sitting', 'Breathing idle', 'Walking', 'Idle'],
  },
  TIGER: {
    working: 'Typing',
    coffeeBreak: ['Breathing idle', 'Running', 'Walking'],
    idle: ['Sitting', 'Breathing idle', 'Walking', 'Running'],
  },
  RABBIT: {
    working: 'Pilot flips switches',
    coffeeBreak: ['Sitting', 'Walking', 'Jumping'],
    idle: ['Sitting', 'Breathing idle', 'Walking', 'Jumping'],
  },
} as const;
