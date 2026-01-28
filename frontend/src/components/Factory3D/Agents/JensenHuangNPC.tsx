/**
 * JensenHuangNPC - Jensen Huang NPC character placed inside the building.
 *
 * Uses the GenericNPC shared component with Jensen-specific personality weights,
 * animations, and thoughts. Spawns inside the factory building and focuses on
 * checking agents, presenting, and indoor activities.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { JENSEN_HUANG_WEIGHTS } from './agentPlanTypes';
import { JENSEN_HUANG_THOUGHTS } from './ThinkingBubble';
import { GenericNPC } from './GenericNPC';

// Preload the Jensen Huang model
useGLTF.preload(MODEL_PATHS.JENSEN_HUANG);

/**
 * Animation names available in the Jensen Huang model.
 * Exported via Blender combine-animations.py from Mixamo FBX files.
 */
const JENSEN_ANIMATIONS = {
  WALKING: 'Brutal to happy walking',
  IDLE: 'Talking',
  DANCE: 'Dancing',
  SITTING: 'Sitting',
} as const;

/**
 * Map thought patterns to specific animations.
 * When a thought contains any of these patterns, the corresponding animation plays.
 */
const JENSEN_THOUGHT_ANIMATIONS: Record<string, string[]> = {
  [JENSEN_ANIMATIONS.DANCE]: [
    'stock',
    'nvda',
    'buys',
    'buying',
    'sold out',
    'crushing',
    'all time high',
    'up again',
    'everyone buys',
    'they all',
  ],
};

/**
 * JensenHuangNPC - Jensen Huang character that spawns inside the building
 * and wanders around with a presenter/compute-focused personality.
 */
export const JensenHuangNPC: React.FC = () => {
  return (
    <GenericNPC
      modelPath={MODEL_PATHS.JENSEN_HUANG}
      npcId={FACTORY_CONSTANTS.NPC_IDS.JENSEN_HUANG}
      walkingAnimation={JENSEN_ANIMATIONS.WALKING}
      idleAnimation={JENSEN_ANIMATIONS.IDLE}
      weights={JENSEN_HUANG_WEIGHTS}
      thoughts={JENSEN_HUANG_THOUGHTS}
      initialPosition={{ x: -5, z: 5 }}
      circleColor={0x44aa44}
      scale={3.25}
      modelYOffset={0}
      thoughtAnimationMap={JENSEN_THOUGHT_ANIMATIONS}
    />
  );
};

export default JensenHuangNPC;
