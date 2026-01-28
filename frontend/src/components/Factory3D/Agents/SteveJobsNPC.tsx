/**
 * SteveJobsNPC - Steve Jobs NPC character that wanders around the factory.
 *
 * Uses the GenericNPC shared component with Steve-specific personality weights,
 * animations, and thoughts. Supervises the factory by checking on agents,
 * watching stage performances, visiting the kitchen, and wandering.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { STEVE_JOBS_WEIGHTS } from './agentPlanTypes';
import { STEVE_JOBS_THOUGHTS } from './ThinkingBubble';
import { GenericNPC } from './GenericNPC';

// Preload the Steve Jobs model
useGLTF.preload(MODEL_PATHS.STEVE_JOBS);

/**
 * Animation names available in the Steve Jobs model.
 * Exported via Blender combine-animations.py from Mixamo FBX files.
 */
const STEVE_ANIMATIONS = {
  WALKING: 'Walking',
  IDLE: 'Standing Clap',
} as const;

/**
 * SteveJobsNPC - Wandering NPC that supervises the factory.
 *
 * Uses the plan-based behavior system to generate multi-step plans
 * (check agents, visit kitchen, sit on couch, watch stage, wander).
 * Supports conversation interrupts and stage performance reactions.
 */
export const SteveJobsNPC: React.FC = () => {
  return (
    <GenericNPC
      modelPath={MODEL_PATHS.STEVE_JOBS}
      npcId={FACTORY_CONSTANTS.NPC_IDS.STEVE_JOBS}
      walkingAnimation={STEVE_ANIMATIONS.WALKING}
      idleAnimation={STEVE_ANIMATIONS.IDLE}
      weights={STEVE_JOBS_WEIGHTS}
      thoughts={STEVE_JOBS_THOUGHTS}
      initialPosition={{ x: 0, z: 5 }}
      circleColor={0x44aa44}
    />
  );
};

export default SteveJobsNPC;
