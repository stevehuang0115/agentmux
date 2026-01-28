/**
 * ElonMuskNPC - Elon Musk NPC character placed near the cybertruck outdoors.
 *
 * Uses the GenericNPC shared component with Elon-specific personality weights,
 * animations, and thoughts. Spawns near the cybertruck at the end of the
 * main walkway and wanders between outdoor and indoor areas.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { ELON_MUSK_WEIGHTS } from './agentPlanTypes';
import { ELON_MUSK_THOUGHTS } from './ThinkingBubble';
import { GenericNPC } from './GenericNPC';

// Preload the Elon Musk model
useGLTF.preload(MODEL_PATHS.ELON_MUSK);

/**
 * Animation names available in the Elon Musk model.
 * Exported via Blender combine-animations.py from Mixamo FBX files.
 */
const ELON_ANIMATIONS = {
  WALKING: 'Walking',
  IDLE: 'Yelling',
  SAD: 'Disappointed',
  DANCE: 'Dancing',
} as const;

/**
 * Map thought patterns to specific animations.
 * When a thought contains any of these patterns, the corresponding animation plays.
 */
const ELON_THOUGHT_ANIMATIONS: Record<string, string[]> = {
  [ELON_ANIMATIONS.SAD]: [
    'failed',
    'blew up',
    'exploded',
    'rapid unscheduled',
    'ugh',
  ],
};

/**
 * ElonMuskNPC - Elon Musk character that spawns near the cybertruck
 * and wanders around the factory with outdoor-focused personality.
 */
export const ElonMuskNPC: React.FC = () => {
  return (
    <GenericNPC
      modelPath={MODEL_PATHS.ELON_MUSK}
      npcId={FACTORY_CONSTANTS.NPC_IDS.ELON_MUSK}
      walkingAnimation={ELON_ANIMATIONS.WALKING}
      idleAnimation={ELON_ANIMATIONS.IDLE}
      weights={ELON_MUSK_WEIGHTS}
      thoughts={ELON_MUSK_THOUGHTS}
      initialPosition={{ x: 4, z: 50 }}
      circleColor={0xaa4444}
      scale={3.4}
      modelYOffset={2.0}
      thoughtAnimationMap={ELON_THOUGHT_ANIMATIONS}
    />
  );
};

export default ElonMuskNPC;
