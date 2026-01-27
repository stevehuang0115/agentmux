/**
 * ThinkingBubble - Cloud-shaped thought bubble showing what a character is thinking.
 *
 * Uses classic thought bubble style with small circles (dots) leading
 * up to a cloud-shaped main bubble. White background with black text.
 * Cycles through a list of thoughts at a configurable interval.
 */

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Props for ThinkingBubble component
 */
interface ThinkingBubbleProps {
  /** Array of possible thoughts to cycle through */
  thoughts: string[];
  /** Vertical offset from character origin */
  yOffset?: number;
  /** Milliseconds between thought changes */
  changeInterval?: number;
}

/** White color for cloud elements */
const CLOUD_COLOR = 0xffffff;
/** Light grey for cloud outline/shadow */
const CLOUD_OUTLINE = 0xdddddd;

/**
 * ThinkingBubble - Billboarded cloud-shaped thought bubble with cycling text.
 *
 * Features:
 * - Cloud-shaped white bubble with bumps along the top
 * - Classic thought dots (3 descending white circles)
 * - Black text on white background
 * - Randomly cycles through provided thoughts
 * - Gentle floating animation
 * - Always faces camera (billboard)
 *
 * @param thoughts - Array of thought strings to display
 * @param yOffset - Vertical offset from character center
 * @param changeInterval - Time in ms between thought changes
 */
export const ThinkingBubble: React.FC<ThinkingBubbleProps> = ({
  thoughts,
  yOffset = 3.5,
  changeInterval = 5000,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [currentIndex, setCurrentIndex] = useState(
    () => Math.floor(Math.random() * thoughts.length)
  );

  // Cycle through thoughts at random intervals
  useEffect(() => {
    if (thoughts.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        let next = Math.floor(Math.random() * thoughts.length);
        // Avoid repeating the same thought
        while (next === prev && thoughts.length > 1) {
          next = Math.floor(Math.random() * thoughts.length);
        }
        return next;
      });
    }, changeInterval + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [thoughts.length, changeInterval]);

  const displayText = thoughts[currentIndex] || '';

  // Calculate bubble dimensions based on text length
  const dimensions = useMemo(() => {
    const charWidth = 0.11;
    const minWidth = 2.0;
    const maxWidth = 4.5;
    const padding = 0.6;

    const textWidth = displayText.length * charWidth;
    const width = Math.min(Math.max(textWidth + padding, minWidth), maxWidth);
    const height = 0.6;

    return { width, height };
  }, [displayText]);

  // Gentle floating animation
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = yOffset + Math.sin(t * 1.2) * 0.05;
    }
  });

  if (thoughts.length === 0) return null;

  const hw = dimensions.width / 2;
  const hh = dimensions.height / 2;

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <group ref={groupRef} position={[0, yOffset, 0]}>
        {/* Cloud outline/shadow (slightly larger, behind) */}
        <RoundedBox
          args={[dimensions.width + 0.08, dimensions.height + 0.08, 0.04]}
          radius={hh + 0.02}
          smoothness={4}
          position={[0, 0, -0.03]}
        >
          <meshBasicMaterial color={CLOUD_OUTLINE} transparent opacity={0.5} />
        </RoundedBox>

        {/* Main cloud body */}
        <RoundedBox
          args={[dimensions.width, dimensions.height, 0.06]}
          radius={hh}
          smoothness={4}
        >
          <meshBasicMaterial color={CLOUD_COLOR} transparent opacity={0.95} />
        </RoundedBox>

        {/* Cloud bumps along the top - creates puffy cloud silhouette */}
        {/* Left bump */}
        <mesh position={[-hw * 0.45, hh * 0.55, -0.01]}>
          <circleGeometry args={[0.28, 24]} />
          <meshBasicMaterial color={CLOUD_COLOR} transparent opacity={0.95} />
        </mesh>
        {/* Center-left bump */}
        <mesh position={[-hw * 0.1, hh * 0.7, -0.01]}>
          <circleGeometry args={[0.32, 24]} />
          <meshBasicMaterial color={CLOUD_COLOR} transparent opacity={0.95} />
        </mesh>
        {/* Center bump (tallest) */}
        <mesh position={[hw * 0.2, hh * 0.75, -0.01]}>
          <circleGeometry args={[0.35, 24]} />
          <meshBasicMaterial color={CLOUD_COLOR} transparent opacity={0.95} />
        </mesh>
        {/* Right bump */}
        <mesh position={[hw * 0.5, hh * 0.5, -0.01]}>
          <circleGeometry args={[0.25, 24]} />
          <meshBasicMaterial color={CLOUD_COLOR} transparent opacity={0.95} />
        </mesh>

        {/* Cloud bump outlines (behind main bumps) */}
        <mesh position={[-hw * 0.45, hh * 0.55, -0.04]}>
          <circleGeometry args={[0.32, 24]} />
          <meshBasicMaterial color={CLOUD_OUTLINE} transparent opacity={0.4} />
        </mesh>
        <mesh position={[-hw * 0.1, hh * 0.7, -0.04]}>
          <circleGeometry args={[0.36, 24]} />
          <meshBasicMaterial color={CLOUD_OUTLINE} transparent opacity={0.4} />
        </mesh>
        <mesh position={[hw * 0.2, hh * 0.75, -0.04]}>
          <circleGeometry args={[0.39, 24]} />
          <meshBasicMaterial color={CLOUD_OUTLINE} transparent opacity={0.4} />
        </mesh>
        <mesh position={[hw * 0.5, hh * 0.5, -0.04]}>
          <circleGeometry args={[0.29, 24]} />
          <meshBasicMaterial color={CLOUD_OUTLINE} transparent opacity={0.4} />
        </mesh>

        {/* Thought dots - 3 descending white circles (classic thought bubble) */}
        <mesh position={[-0.1, -hh - 0.22, 0]}>
          <circleGeometry args={[0.12, 16]} />
          <meshBasicMaterial color={CLOUD_COLOR} />
        </mesh>
        <mesh position={[-0.28, -hh - 0.48, 0]}>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color={CLOUD_COLOR} />
        </mesh>
        <mesh position={[-0.4, -hh - 0.66, 0]}>
          <circleGeometry args={[0.055, 12]} />
          <meshBasicMaterial color={CLOUD_COLOR} />
        </mesh>

        {/* Dot outlines */}
        <mesh position={[-0.1, -hh - 0.22, -0.02]}>
          <circleGeometry args={[0.15, 16]} />
          <meshBasicMaterial color={CLOUD_OUTLINE} transparent opacity={0.4} />
        </mesh>
        <mesh position={[-0.28, -hh - 0.48, -0.02]}>
          <circleGeometry args={[0.11, 16]} />
          <meshBasicMaterial color={CLOUD_OUTLINE} transparent opacity={0.4} />
        </mesh>
        <mesh position={[-0.4, -hh - 0.66, -0.02]}>
          <circleGeometry args={[0.075, 12]} />
          <meshBasicMaterial color={CLOUD_OUTLINE} transparent opacity={0.4} />
        </mesh>

        {/* Text - black on white */}
        <Text
          position={[0, 0, 0.05]}
          fontSize={0.16}
          color="#222222"
          anchorX="center"
          anchorY="middle"
          maxWidth={dimensions.width - 0.4}
          outlineWidth={0}
        >
          {displayText}
        </Text>
      </group>
    </Billboard>
  );
};

// ====== THOUGHT LISTS ======

/**
 * Thoughts for idle agents based on their current activity
 */
export const AGENT_THOUGHTS: Record<string, string[]> = {
  wander: [
    'Taking a short break',
    'Stretching my legs...',
    'Nice day for a walk',
    'Just wandering around',
    'Looking around the office',
    'Enjoying the break',
  ],
  couch: [
    'Time to relax...',
    'The couch looks comfy',
    'Need a quick rest',
    'Recharging batteries...',
    'A short nap sounds nice',
    'So cozy...',
  ],
  stage: [
    'Time to perform!',
    'Let me show my moves',
    'My turn on stage!',
    'Dance time!',
    'Here goes nothing!',
    'Watch this!',
  ],
  break_room: [
    'Coffee break!',
    'Need some caffeine',
    'Grabbing a coffee',
    'Time for a snack',
    'Chatting over coffee',
    'This coffee is good',
  ],
  poker_table: [
    'All in!',
    'Read my poker face',
    'Feeling lucky!',
    'Good hand...',
    'I call!',
    'Bluffing time!',
  ],
  kitchen: [
    'Mmm, pizza!',
    'Grabbing a snack',
    'Anyone want a donut?',
    'I love fruit!',
    'Making some coffee',
    'Snack time!',
  ],
};

/**
 * Thoughts for Steve Jobs NPC based on behavior state
 */
export const STEVE_JOBS_THOUGHTS: Record<string, string[]> = {
  wandering: [
    'One more thing...',
    'Innovation never sleeps',
    'Think different',
    'Stay hungry, stay foolish',
    'Simplicity is genius',
  ],
  checking_agent: [
    "How's the project?",
    'Show me the progress',
    "Let's ship it!",
    'Is it insanely great?',
    'Focus on quality',
  ],
  watching_stage: [
    'Great performance!',
    'Impressive work!',
    'Bravo!',
    'Now that is innovation!',
  ],
  resting: [
    'Creative thinking...',
    'Recharging ideas',
    'Next big thing...',
    'Connecting the dots',
  ],
  visiting_kitchen: [
    'Need some fuel...',
    'Coffee powers innovation',
    'Mmm, smells good!',
    'A snack break',
    'Grabbing an apple',
  ],
  walking_to_target: [
    'On my way...',
    'Places to be',
    "Let's go check",
    'Heading over',
  ],
};

/**
 * Thoughts for Sundar Pichai NPC based on behavior state
 */
export const SUNDAR_PICHAI_THOUGHTS: Record<string, string[]> = {
  wandering: [
    'Making the rounds',
    'AI-first approach',
    'Cloud strategy...',
    'Organizing the world',
    'Open source matters',
  ],
  talking_to_agent: [
    "Let's discuss this",
    'How can I help?',
    'Collaboration time',
    'Great teamwork!',
    'Keep it up!',
  ],
  presenting: [
    "Here's our vision",
    'AI for everyone',
    'Let me present this',
    'Exciting updates!',
  ],
  walking_circle: [
    'Deep thinking...',
    'Strategic planning',
    'Processing ideas',
    'What if we...',
  ],
  visiting_kitchen: [
    'Time for chai!',
    'Grabbing a coffee',
    'Snack break!',
    'Need some energy',
    'Mmm, looks good!',
  ],
  walking_to_target: [
    'On my way...',
    "Let's see what's next",
    'Heading over',
    'Time to check in',
  ],
};

export default ThinkingBubble;
