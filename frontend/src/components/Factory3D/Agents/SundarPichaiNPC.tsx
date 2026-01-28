/**
 * SundarPichaiNPC - Sundar Pichai NPC character that wanders around the factory.
 *
 * Uses the GenericNPC shared component with Sundar-specific personality weights,
 * animations, and thoughts. Manages the factory floor by checking agents,
 * giving presentations, walking in circles, and visiting the kitchen.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import {
  MODEL_PATHS,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { SUNDAR_PICHAI_WEIGHTS } from './agentPlanTypes';
import { SUNDAR_PICHAI_THOUGHTS } from './ThinkingBubble';
import { GenericNPC } from './GenericNPC';

// Preload the Sundar Pichai model
useGLTF.preload(MODEL_PATHS.SUNDAR_PICHAI);

/**
 * Animation names available in the Sundar Pichai model.
 * Exported via Blender combine-animations.py from Mixamo FBX files.
 */
const SUNDAR_ANIMATIONS = {
  WALKING: 'Walking',
  IDLE: 'Talking',
  WALK_IN_CIRCLE: 'Walk In Circle',
} as const;

/**
 * SundarPichaiNPC - Wandering NPC that manages the factory using
 * a plan-based multi-step behavior system.
 *
 * Behavior is driven by SUNDAR_PICHAI_WEIGHTS personality profile,
 * which favors check_agent and wander steps with occasional presentations
 * and kitchen visits. Conversations pause the plan, and stage events
 * may trigger a watch_stage interrupt.
 */
export const SundarPichaiNPC: React.FC = () => {
  return (
    <GenericNPC
      modelPath={MODEL_PATHS.SUNDAR_PICHAI}
      npcId={FACTORY_CONSTANTS.NPC_IDS.SUNDAR_PICHAI}
      walkingAnimation={SUNDAR_ANIMATIONS.WALKING}
      idleAnimation={SUNDAR_ANIMATIONS.IDLE}
      weights={SUNDAR_PICHAI_WEIGHTS}
      thoughts={SUNDAR_PICHAI_THOUGHTS}
      initialPosition={{ x: 10, z: 0 }}
      circleColor={0x44aa44}
      walkCircleAnimation={SUNDAR_ANIMATIONS.WALK_IN_CIRCLE}
    />
  );
};

export default SundarPichaiNPC;
