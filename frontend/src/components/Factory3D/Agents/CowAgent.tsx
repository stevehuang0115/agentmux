/**
 * CowAgent - Cow character model using BaseAgent.
 *
 * Wraps BaseAgent with cow-specific configuration including
 * model path, animations, and movement speeds.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import { FactoryAgent, MODEL_PATHS } from '../../../types/factory.types';
import { BaseAgent, AgentConfig } from './BaseAgent';
import { AGENT_ANIMATION_CONFIGS } from './useAgentAnimation';

// Preload the cow model
useGLTF.preload(MODEL_PATHS.COW);

/**
 * Configuration for cow agent
 */
const COW_CONFIG: AgentConfig = {
  modelPath: MODEL_PATHS.COW,
  animationConfig: AGENT_ANIMATION_CONFIGS.COW,
  runSpeed: 3.0,
  walkSpeed: 1.2,
  runThreshold: 2.0,
  danceAnimation: 'Dance',
  sitAnimation: 'Sitting',
};

/**
 * Props for CowAgent component
 */
interface CowAgentProps {
  /** Agent data including position, status, and animation state */
  agent: FactoryAgent;
}

/**
 * CowAgent - Cow character with animations.
 *
 * @param agent - Agent data from context
 */
export const CowAgent: React.FC<CowAgentProps> = ({ agent }) => {
  return <BaseAgent agent={agent} config={COW_CONFIG} />;
};
