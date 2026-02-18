/**
 * SteveHuangNPC - Steve Huang NPC character (builder/architect of Crewly).
 *
 * Uses the GenericNPC shared component with Steve-specific personality weights,
 * animations, and thoughts. As the builder and architect of Crewly, Steve
 * loves golf, outdoor activities, and checking on agents' progress.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { STEVE_HUANG_WEIGHTS } from './agentPlanTypes';
import { STEVE_HUANG_THOUGHTS } from './ThinkingBubble';
import { GenericNPC } from './GenericNPC';

// Preload the Steve Huang model
useGLTF.preload(MODEL_PATHS.STEVE_HUANG);

/**
 * Animation names available in the Steve Huang model.
 * Exported via Blender combine-animations.py from Mixamo FBX files.
 */
const STEVE_HUANG_ANIMATIONS = {
  WALKING: 'Walking',
  IDLE: 'Drinking',
} as const;

/**
 * SteveHuangNPC - Steve Huang (builder/architect of Crewly) character
 * that spawns near the golf green and wanders with an outdoor-focused personality.
 */
export const SteveHuangNPC: React.FC = () => {
  return (
    <GenericNPC
      modelPath={MODEL_PATHS.STEVE_HUANG}
      npcId={FACTORY_CONSTANTS.NPC_IDS.STEVE_HUANG}
      walkingAnimation={STEVE_HUANG_ANIMATIONS.WALKING}
      idleAnimation={STEVE_HUANG_ANIMATIONS.IDLE}
      weights={STEVE_HUANG_WEIGHTS}
      thoughts={STEVE_HUANG_THOUGHTS}
      initialPosition={{ x: 16, z: 44 }}
      circleColor={0xaaaa44}
      scale={3.5}
      modelYOffset={0}
    />
  );
};

export default SteveHuangNPC;
