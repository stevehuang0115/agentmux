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
} from '../../../types/factory.types';
import { CowHead, HorseHead, DragonHead, TigerHead, RabbitHead } from './AnimalHeads';
import { SpeechBubble } from './SpeechBubble';
import { ZzzIndicator } from './ZzzIndicator';

// Preload the robot model
useGLTF.preload(MODEL_PATHS.ROBOT);

// ====== SINGLE ROBOT AGENT ======

interface SingleAgentProps {
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
  const { camera } = useFactory();

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
  const animationState = useRef({
    currentAction: 'Idle' as RobotAnimation,
    activityMode: 'typing',
    modeStartTime: 0,
    modeDuration: 5 + Math.random() * 10,
    typingOffset: Math.random() * Math.PI * 2,
    coffeeBreakState: {
      mode: 'drinking' as 'drinking' | 'walking',
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
      <primitive object={clonedScene} scale={0.5} />

      {/* Animal head */}
      <group ref={headGroupRef} position={[0, 1.0, 0]}>
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
 */
function updateWorkingAnimation(
  group: THREE.Group,
  headGroup: THREE.Group | null,
  workstation: any,
  anim: any,
  t: number,
  delta: number,
  actions: any
) {
  const fastT = t * 4;
  const medT = t * 1.5;

  // Switch activity modes
  if (t - anim.modeStartTime > anim.modeDuration) {
    const modes = ['typing', 'typing', 'typing', 'thinking', 'reading'];
    anim.activityMode = modes[Math.floor(Math.random() * modes.length)];
    anim.modeStartTime = t;
    anim.modeDuration = 3 + Math.random() * 8;
  }

  // Position with subtle movement
  const breathSway = Math.sin(medT) * 0.01;
  const typingBob = anim.activityMode === 'typing' ? Math.sin(fastT * 2) * 0.005 : 0;
  group.position.x = workstation.position.x + breathSway;
  group.position.y = typingBob;
  group.position.z = workstation.position.z + 0.45;
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
 */
function updateCoffeeBreakAnimation(
  group: THREE.Group,
  headGroup: THREE.Group | null,
  workstation: any,
  anim: any,
  t: number,
  delta: number,
  actions: any
) {
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
 */
function updateSleepingAnimation(
  group: THREE.Group,
  headGroup: THREE.Group | null,
  workstation: any,
  anim: any,
  t: number,
  actions: any
) {
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
 */
function switchAnimation(
  actions: any,
  anim: any,
  targetAction: RobotAnimation
) {
  if (anim.currentAction !== targetAction && actions[targetAction]) {
    const prevAction = actions[anim.currentAction];
    const nextAction = actions[targetAction];

    if (prevAction) prevAction.fadeOut(0.5);
    if (nextAction) {
      nextAction.reset().fadeIn(0.5).play();
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

  return (
    <group>
      <Suspense fallback={null}>
        {agentArray.map((agent) => (
          <SingleAgent key={agent.id} agent={agent} />
        ))}
      </Suspense>
    </group>
  );
};

export default Agents;
