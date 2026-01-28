/**
 * MarkZuckerbergNPC - Mark Zuckerberg NPC character placed near the golf court.
 *
 * Uses the GenericNPC shared component with Mark-specific personality weights,
 * animations, and thoughts. Spawns near the golf putting green and wanders
 * between outdoor and indoor areas with a tech-focused personality.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { MARK_ZUCKERBERG_WEIGHTS } from './agentPlanTypes';
import { MARK_ZUCKERBERG_THOUGHTS } from './ThinkingBubble';
import { GenericNPC } from './GenericNPC';

// Preload the Mark Zuckerberg model
useGLTF.preload(MODEL_PATHS.MARK_ZUCKERBERG);

/**
 * Animation names available in the Mark Zuckerberg model.
 * Exported via Blender combine-animations.py from Mixamo FBX files.
 * No dedicated walking animation available; uses Talking for both.
 */
const MARK_ANIMATIONS = {
  WALKING: 'Talking',
  IDLE: 'Look around',
} as const;

/**
 * MarkZuckerbergNPC - Mark Zuckerberg character that spawns near the golf court
 * and wanders around with a tech-focused personality.
 */
export const MarkZuckerbergNPC: React.FC = () => {
  return (
    <GenericNPC
      modelPath={MODEL_PATHS.MARK_ZUCKERBERG}
      npcId={FACTORY_CONSTANTS.NPC_IDS.MARK_ZUCKERBERG}
      walkingAnimation={MARK_ANIMATIONS.WALKING}
      idleAnimation={MARK_ANIMATIONS.IDLE}
      weights={MARK_ZUCKERBERG_WEIGHTS}
      thoughts={MARK_ZUCKERBERG_THOUGHTS}
      initialPosition={{ x: 18, z: 38 }}
      circleColor={0x4444aa}
      scale={3.6}
      modelYOffset={2.0}
    />
  );
};

export default MarkZuckerbergNPC;
