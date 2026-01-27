/**
 * RabbitAgent - Rabbit character model using BaseAgent.
 *
 * Wraps BaseAgent with rabbit-specific configuration including
 * model path, animations, and movement speeds.
 * Rabbits hop quickly but have different working animation.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import { FactoryAgent, MODEL_PATHS } from '../../../types/factory.types';
import { BaseAgent, AgentConfig } from './BaseAgent';
import { AGENT_ANIMATION_CONFIGS } from './useAgentAnimation';

// Preload the rabbit model
useGLTF.preload(MODEL_PATHS.RABBIT);

/**
 * Configuration for rabbit agent
 */
const RABBIT_CONFIG: AgentConfig = {
  modelPath: MODEL_PATHS.RABBIT,
  animationConfig: AGENT_ANIMATION_CONFIGS.RABBIT,
  runSpeed: 2.8,
  walkSpeed: 1.0,
  runThreshold: 1.8,
  danceAnimation: 'Silly dancing',
  sitAnimation: 'Sitting',
};

/**
 * Props for RabbitAgent component
 */
interface RabbitAgentProps {
  /** Agent data including position, status, and animation state */
  agent: FactoryAgent;
}

/**
 * RabbitAgent - Rabbit character with animations.
 *
 * @param agent - Agent data from context
 */
export const RabbitAgent: React.FC<RabbitAgentProps> = ({ agent }) => {
  return <BaseAgent agent={agent} config={RABBIT_CONFIG} />;
};
