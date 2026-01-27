/**
 * HorseAgent - Horse character model using BaseAgent.
 *
 * Wraps BaseAgent with horse-specific configuration including
 * model path, animations, and movement speeds.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import { FactoryAgent, MODEL_PATHS } from '../../../types/factory.types';
import { BaseAgent, AgentConfig } from './BaseAgent';
import { AGENT_ANIMATION_CONFIGS } from './useAgentAnimation';

// Preload the horse model
useGLTF.preload(MODEL_PATHS.HORSE);

/**
 * Configuration for horse agent
 */
const HORSE_CONFIG: AgentConfig = {
  modelPath: MODEL_PATHS.HORSE,
  animationConfig: AGENT_ANIMATION_CONFIGS.HORSE,
  runSpeed: 3.0,
  walkSpeed: 1.2,
  runThreshold: 2.0,
  danceAnimation: 'Talking',
  sitAnimation: 'Sitting',
};

/**
 * Props for HorseAgent component
 */
interface HorseAgentProps {
  /** Agent data including position, status, and animation state */
  agent: FactoryAgent;
}

/**
 * HorseAgent - Horse character with animations.
 *
 * @param agent - Agent data from context
 */
export const HorseAgent: React.FC<HorseAgentProps> = ({ agent }) => {
  return <BaseAgent agent={agent} config={HORSE_CONFIG} />;
};
