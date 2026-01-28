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
} as const;

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
    />
  );
};

export default JensenHuangNPC;
