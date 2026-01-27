/**
 * TigerAgent - Tiger character model using BaseAgent.
 *
 * Wraps BaseAgent with tiger-specific configuration including
 * model path, animations, and movement speeds.
 * Tigers are faster runners than other animals.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import { FactoryAgent, MODEL_PATHS } from '../../../types/factory.types';
import { BaseAgent, AgentConfig } from './BaseAgent';
import { AGENT_ANIMATION_CONFIGS } from './useAgentAnimation';

// Preload the tiger model
useGLTF.preload(MODEL_PATHS.TIGER);

/**
 * Configuration for tiger agent
 */
const TIGER_CONFIG: AgentConfig = {
  modelPath: MODEL_PATHS.TIGER,
  animationConfig: AGENT_ANIMATION_CONFIGS.TIGER,
  runSpeed: 3.5,
  walkSpeed: 1.5,
  runThreshold: 1.5,
  danceAnimation: 'Salsa dancing',
  sitAnimation: 'Sitting',
};

/**
 * Props for TigerAgent component
 */
interface TigerAgentProps {
  /** Agent data including position, status, and animation state */
  agent: FactoryAgent;
}

/**
 * TigerAgent - Tiger character with animations.
 *
 * @param agent - Agent data from context
 */
export const TigerAgent: React.FC<TigerAgentProps> = ({ agent }) => {
  return <BaseAgent agent={agent} config={TIGER_CONFIG} />;
};
