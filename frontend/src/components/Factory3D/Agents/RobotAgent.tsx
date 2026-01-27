/**
 * RobotAgent - Animated robot with animal head.
 *
 * Loads the RobotExpressive GLTF model and attaches custom animal heads.
 * Manages animations based on agent status (working, idle, coffee break).
 */

import React, { useRef, useEffect, useMemo, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Clone } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useFactory } from '../../../contexts/FactoryContext';
import {
  FactoryAgent,
  AnimalType,
  MODEL_PATHS,
  RobotAnimation,
  Workstation,
  ActivityMode,
  CoffeeBreakMode,
  FACTORY_CONSTANTS,
} from '../../../types/factory.types';
import { CowHead, HorseHead, DragonHead, TigerHead, RabbitHead } from './AnimalHeads';
import { SpeechBubble } from './SpeechBubble';
import { ZzzIndicator } from './ZzzIndicator';
import { CowAgent } from './CowAgent';
import { HorseAgent } from './HorseAgent';
import { TigerAgent } from './TigerAgent';
import { RabbitAgent } from './RabbitAgent';

// Module load confirmation
console.log('[RobotAgent.tsx] Module loaded');

// Preload the robot and animal models
useGLTF.preload(MODEL_PATHS.ROBOT);
useGLTF.preload(MODEL_PATHS.HORSE);
useGLTF.preload(MODEL_PATHS.TIGER);
useGLTF.preload(MODEL_PATHS.RABBIT);

// ====== ANIMATION TYPES ======

/**
 * Local animation state for a single robot agent.
 * Tracks current animation, activity mode, and timing.
 */
interface LocalAnimationState {
  currentAction: RobotAnimation;
  activityMode: ActivityMode;
  modeStartTime: number;
  modeDuration: number;
  typingOffset: number;
  coffeeBreakState: LocalCoffeeBreakState;
}

/**
 * Coffee break sub-state for walking animation.
 */
interface LocalCoffeeBreakState {
  mode: CoffeeBreakMode;
  modeStartTime: number;
  modeDuration: number;
  walkAngle: number;
  walkRadius: number;
}

/**
 * Type for animation actions from useAnimations hook.
 * Maps animation names to THREE.AnimationAction objects.
 */
type AnimationActions = Record<string, THREE.AnimationAction | null>;

// ====== SINGLE ROBOT AGENT ======

/**
 * Props for SingleAgent component.
 */
interface SingleAgentProps {
  /** Agent data including position, status, and animation state */
  agent: FactoryAgent;
}

/**
 * SingleAgent - Individual robot agent with animations.
 *
 * @param agent - Agent data from context
 */
const SingleAgent: React.FC<SingleAgentProps> = ({ agent }) => {
  const groupRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);

  // Load robot model
  const { scene, animations } = useGLTF(MODEL_PATHS.ROBOT);

  // Clone scene for this instance
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    // Remove the original head
    clone.traverse((child) => {
      if (child.name === 'Head' || child.name.includes('head')) {
        child.visible = false;
      }
    });
    return clone;
  }, [scene]);

  // Setup animations
  const { actions, mixer } = useAnimations(animations, clonedScene);

  // Animation state
  const animationState = useRef<LocalAnimationState>({
    currentAction: 'Idle',
    activityMode: 'typing',
    modeStartTime: 0,
    modeDuration: 5 + Math.random() * 10,
    typingOffset: Math.random() * Math.PI * 2,
    coffeeBreakState: {
      mode: 'drinking',
      modeStartTime: 0,
      modeDuration: 8 + Math.random() * 12,
      walkAngle: 0,
      walkRadius: 1.5 + Math.random() * 0.5,
    },
  });

  // Get workstation reference for positioning
  const { zones } = useFactory();
  const zone = useMemo(() => {
    return zones.get(agent.projectName);
  }, [zones, agent.projectName]);

  const workstation = useMemo(() => {
    if (!zone) return null;
    return zone.workstations[agent.workstationIndex];
  }, [zone, agent.workstationIndex]);

  // Play initial animation
  useEffect(() => {
    if (actions.Idle) {
      actions.Idle.play();
    }
  }, [actions]);

  // Cleanup animation mixer and cloned scene resources on unmount
  useEffect(() => {
    return () => {
      // Stop all animations and dispose mixer
      if (mixer) {
        mixer.stopAllAction();
      }

      // Dispose cloned scene resources to prevent memory leaks
      clonedScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    };
  }, [mixer, clonedScene]);

  // Main animation loop
  useFrame((state, delta) => {
    if (!groupRef.current || !workstation) return;

    const t = state.clock.elapsedTime;
    const anim = animationState.current;
    const isActuallyWorking = agent.status === 'active' && agent.cpuPercent > 10;

    // Update animation mixer
    mixer?.update(delta);

    if (agent.status === 'active' && isActuallyWorking) {
      // Working at desk
      updateWorkingAnimation(
        groupRef.current,
        headGroupRef.current,
        workstation,
        anim,
        t,
        delta,
        actions
      );
    } else if (agent.status === 'active' && !isActuallyWorking) {
      // Coffee break
      updateCoffeeBreakAnimation(
        groupRef.current,
        headGroupRef.current,
        workstation,
        anim,
        t,
        delta,
        actions
      );
    } else if (agent.status === 'idle') {
      // Sleeping
      updateSleepingAnimation(
        groupRef.current,
        headGroupRef.current,
        workstation,
        anim,
        t,
        actions
      );
    }
  });

  if (!workstation) return null;

  return (
    <group
      ref={groupRef}
      position={[agent.basePosition.x, 0, agent.basePosition.z]}
      rotation={[0, Math.PI, 0]}
    >
      {/* Robot body */}
      <primitive object={clonedScene} scale={FACTORY_CONSTANTS.AGENT.ROBOT_SCALE} />

      {/* Animal head - positioned on top of robot, scaled up to match legacy */}
      <group ref={headGroupRef} position={[0, 1.4, 0]} scale={3.5}>
        <AnimalHead type={agent.animalType} />
      </group>

      {/* Speech bubble */}
      {agent.status === 'active' && agent.cpuPercent > 10 && agent.activity && (
        <SpeechBubble text={agent.activity} />
      )}

      {/* Sleeping indicator */}
      {agent.status === 'idle' && <ZzzIndicator />}
    </group>
  );
};

// ====== ANIMAL HEAD SELECTOR ======

interface AnimalHeadProps {
  type: AnimalType;
}

/**
 * AnimalHead - Renders the appropriate animal head based on type.
 *
 * @param type - Type of animal head to render
 * @returns JSX element with the appropriate animal head
 */
const AnimalHead: React.FC<AnimalHeadProps> = ({ type }) => {
  switch (type) {
    case 'cow':
      return <CowHead />;
    case 'horse':
      return <HorseHead />;
    case 'dragon':
      return <DragonHead />;
    case 'tiger':
      return <TigerHead />;
    case 'rabbit':
      return <RabbitHead />;
    default:
      return <CowHead />;
  }
};

// ====== ANIMATION HELPERS ======

/**
 * Updates animation for actively working agent.
 *
 * @param group - The agent's main group
 * @param headGroup - The head group for rotation
 * @param workstation - Workstation data with position
 * @param anim - Local animation state
 * @param t - Current elapsed time
 * @param delta - Time since last frame
 * @param actions - Animation actions from useAnimations
 */
function updateWorkingAnimation(
  group: THREE.Group,
  headGroup: THREE.Group | null,
  workstation: Workstation,
  anim: LocalAnimationState,
  t: number,
  delta: number,
  actions: AnimationActions
): void {
  const fastT = t * 4;
  const medT = t * 1.5;

  // Switch activity modes
  if (t - anim.modeStartTime > anim.modeDuration) {
    const modes: ActivityMode[] = ['typing', 'typing', 'typing', 'thinking', 'reading'];
    anim.activityMode = modes[Math.floor(Math.random() * modes.length)];
    anim.modeStartTime = t;
    anim.modeDuration = 3 + Math.random() * 8;
  }

  // Position with subtle movement
  const breathSway = Math.sin(medT) * 0.01;
  const typingBob = anim.activityMode === 'typing' ? Math.sin(fastT * 2) * 0.005 : 0;
  group.position.x = workstation.position.x + breathSway;
  group.position.y = typingBob;
  group.position.z = workstation.position.z + FACTORY_CONSTANTS.AGENT.WORKSTATION_OFFSET;
  group.rotation.y = Math.PI;

  // Head movement
  if (headGroup) {
    if (anim.activityMode === 'typing') {
      const scanX = Math.sin(fastT * 0.8) * 0.15;
      const scanY = Math.sin(fastT * 1.2) * 0.08;
      headGroup.rotation.x = -0.25 + scanY;
      headGroup.rotation.y = scanX;
    } else if (anim.activityMode === 'thinking') {
      const thinkCycle = Math.sin(t * 0.6);
      headGroup.rotation.x = -0.1 + thinkCycle * 0.15;
      headGroup.rotation.y = Math.sin(medT) * 0.2;
    } else {
      headGroup.rotation.x = -0.3;
      headGroup.rotation.y = Math.sin(medT * 0.7) * 0.1;
    }
  }

  // Animation switching
  switchAnimation(actions, anim, 'Idle');
}

/**
 * Updates animation for coffee break.
 *
 * @param group - The agent's main group
 * @param headGroup - The head group for rotation
 * @param workstation - Workstation data with position
 * @param anim - Local animation state
 * @param t - Current elapsed time
 * @param delta - Time since last frame
 * @param actions - Animation actions from useAnimations
 */
function updateCoffeeBreakAnimation(
  group: THREE.Group,
  headGroup: THREE.Group | null,
  workstation: Workstation,
  anim: LocalAnimationState,
  t: number,
  delta: number,
  actions: AnimationActions
): void {
  const coffee = anim.coffeeBreakState;

  // Switch between drinking and walking
  if (t - coffee.modeStartTime > coffee.modeDuration) {
    coffee.mode = coffee.mode === 'drinking' ? 'walking' : 'drinking';
    coffee.modeStartTime = t;
    coffee.modeDuration = 8 + Math.random() * 12;
  }

  if (coffee.mode === 'drinking') {
    // Sitting at desk drinking coffee
    group.position.set(
      workstation.position.x,
      0,
      workstation.position.z + 0.5
    );
    group.rotation.set(-0.08, Math.PI + 0.2, 0);

    if (headGroup) {
      const slowT = t * 0.4;
      const lookAround = Math.sin(slowT * 0.5) * 0.25;
      headGroup.rotation.x = -0.15 + Math.sin(slowT * 0.3) * 0.05;
      headGroup.rotation.y = lookAround;
    }

    switchAnimation(actions, anim, 'Idle');
  } else {
    // Walking around
    coffee.walkAngle += delta * 0.3;

    const centerX = workstation.position.x;
    const centerZ = workstation.position.z + 2.0;
    const walkX = centerX + Math.sin(coffee.walkAngle) * coffee.walkRadius;
    const walkZ = centerZ + Math.abs(Math.cos(coffee.walkAngle)) * coffee.walkRadius * 0.5;

    group.position.set(walkX, 0, walkZ);

    // Face movement direction
    const facingAngle = Math.atan2(
      Math.cos(coffee.walkAngle) * coffee.walkRadius,
      Math.abs(Math.sin(coffee.walkAngle)) * coffee.walkRadius * 0.5
    );
    group.rotation.set(0, facingAngle, 0);

    if (headGroup) {
      headGroup.rotation.x = -0.1;
      headGroup.rotation.y = Math.sin(t * 0.3) * 0.3;
    }

    switchAnimation(actions, anim, 'Walking');
  }
}

/**
 * Updates animation for sleeping agent.
 *
 * @param group - The agent's main group
 * @param headGroup - The head group for rotation
 * @param workstation - Workstation data with position
 * @param anim - Local animation state
 * @param t - Current elapsed time
 * @param actions - Animation actions from useAnimations
 */
function updateSleepingAnimation(
  group: THREE.Group,
  headGroup: THREE.Group | null,
  workstation: Workstation,
  anim: LocalAnimationState,
  t: number,
  actions: AnimationActions
): void {
  // Lying on floor
  const restX = workstation.position.x + 1.5;
  const restZ = workstation.position.z + 1.0;

  group.rotation.order = 'YXZ';
  group.rotation.set(-Math.PI / 2, 0, 0);
  group.position.set(restX, 0.3, restZ);

  // Breathing animation on head
  if (headGroup) {
    const breathCycle = Math.sin(t * 0.5 + anim.typingOffset) * 0.5 + 0.5;
    headGroup.rotation.x = breathCycle * 0.05;
    headGroup.rotation.z = breathCycle * 0.03;
  }

  switchAnimation(actions, anim, 'Idle');
  if (actions.Idle) {
    actions.Idle.timeScale = 0.3;
  }
}

/**
 * Helper to switch between animations smoothly.
 *
 * @param actions - Animation actions from useAnimations
 * @param anim - Local animation state to update
 * @param targetAction - Target animation to switch to
 */
function switchAnimation(
  actions: AnimationActions,
  anim: LocalAnimationState,
  targetAction: RobotAnimation
): void {
  if (anim.currentAction !== targetAction && actions[targetAction]) {
    const prevAction = actions[anim.currentAction];
    const nextAction = actions[targetAction];

    const fadeDuration = FACTORY_CONSTANTS.AGENT.ANIMATION_FADE_DURATION;
    if (prevAction) prevAction.fadeOut(fadeDuration);
    if (nextAction) {
      nextAction.reset().fadeIn(fadeDuration).play();
    }
    anim.currentAction = targetAction;
  }
}

// ====== AGENTS GROUP ======

/**
 * Agents - Renders all agents from context.
 *
 * Maps over agents and renders each with appropriate animations
 * and positioning based on their status.
 *
 * @returns JSX element with all agent meshes
 */
export const Agents: React.FC = () => {
  const { agents } = useFactory();

  const agentArray = useMemo(() => Array.from(agents.values()), [agents]);

  // Immediate render-time logging
  console.log('[Agents RENDER] agents size:', agents.size, 'agentArray length:', agentArray.length);

  // Debug logging
  useEffect(() => {
    console.log('[Agents] === DEBUG START ===');
    console.log('[Agents] Total agents:', agentArray.length);
    console.log('[Agents] Agents map size:', agents.size);
    agentArray.forEach((agent) => {
      console.log(`[Agents] Agent: ${agent.id}, type: ${agent.animalType}, status: ${agent.status}, project: "${agent.projectName}", wsIndex: ${agent.workstationIndex}, zoneIndex: ${agent.zoneIndex}, pos: (${agent.basePosition.x.toFixed(1)}, ${agent.basePosition.z.toFixed(1)})`);
    });
    console.log('[Agents] === DEBUG END ===');
  }, [agentArray, agents]);

  return (
    <group>
      {agentArray.map((agent) => {
        // Wrap each agent in its own Suspense so one agent's issue doesn't affect others
        const AgentComponent = (() => {
          switch (agent.animalType) {
            case 'cow':
              return <CowAgent agent={agent} />;
            case 'horse':
              return <HorseAgent agent={agent} />;
            case 'tiger':
              return <TigerAgent agent={agent} />;
            case 'rabbit':
              return <RabbitAgent agent={agent} />;
            default:
              return <SingleAgent agent={agent} />;
          }
        })();

        return (
          <Suspense key={agent.id} fallback={null}>
            {AgentComponent}
          </Suspense>
        );
      })}
    </group>
  );
};
