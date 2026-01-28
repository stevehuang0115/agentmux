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
  /** Callback when the displayed thought changes */
  onThoughtChange?: (thought: string) => void;
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
  onThoughtChange,
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

  // Notify parent when thought changes
  useEffect(() => {
    if (displayText && onThoughtChange) {
      onThoughtChange(displayText);
    }
  }, [displayText, onThoughtChange]);

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
  conveyor: [
    'Wow, great production!',
    'Look at those deliveries!',
    'Shipping code so fast!',
    'Amazing output today!',
    'The factory is humming!',
    'Production is on fire!',
    'Great momentum here!',
    'We are crushing it!',
    'Tokens flying by!',
    'Such good velocity!',
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
  pickleball: [
    'Pickleball time!',
    'Nice serve!',
    'Dink shot!',
    'Game on!',
    'Love the outdoors',
    'Kitchen line rally!',
  ],
  golf: [
    'Putting practice!',
    'Read the green...',
    'Fore!',
    'Birdie putt!',
    'Nice chip!',
    'Almost a hole-in-one!',
  ],
  sit_outdoor: [
    'Fresh air is nice',
    'Enjoying the sunshine',
    'Peaceful out here',
    'Good to be outside',
    'Nice breeze today',
    'Taking in the view',
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
  conveyor: [
    'Now this is production!',
    'Insanely great output!',
    'Ship it, ship it all!',
    'Beautiful execution',
    'This is what we do',
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
    'How can Gemini improve?',
    'Gemini 2.5 is coming!',
    'Deep thinking about AI...',
    'Planning Gemini roadmap',
    'What if Gemini could...',
    'Processing Gemini feedback',
    'Strategic Gemini moves',
    'Gemini Pro needs work',
  ],
  conveyor: [
    'Great momentum here!',
    'Production is flowing',
    'AI at scale!',
    'This is the Google way',
    'Impressive throughput',
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

/**
 * Thoughts for Elon Musk NPC based on behavior state
 */
export const ELON_MUSK_THOUGHTS: Record<string, string[]> = {
  wandering: [
    'TSLA up 5% today!',
    'Tesla stock is mooning!',
    'Starship launch soon...',
    'SpaceX landing failed...',
    'Ugh, rapid unscheduled',
    'Mars colony by 2030!',
    'Need more Starlinks',
    'Full self driving soon',
    'The Cybertruck sells!',
    'X is the everything app',
    'First principles only',
    'Boring tunnel progress?',
    'Neuralink update...',
    'TSLA to the moon!',
    'SpaceX booster caught!',
    'Stock looking good today',
    'Starship blew up again!',
    'Rocket exploded... again',
    'Ugh, another RUD today',
    'Booster failed to land',
  ],
  conveyor: [
    'Ship it 10x faster!',
    'This is the future!',
    'Production machine!',
    'Exponential output!',
    'First principles shipping',
  ],
  talking_to_agent: [
    'Ship it yesterday!',
    'Is this 10x better?',
    'Move faster, come on!',
    'This needs more urgency',
    'First principles, think!',
    'Are we on Mars yet?',
    'Tesla needs this done',
    'SpaceX pace, people!',
  ],
  visiting_kitchen: [
    'Quick Diet Coke break',
    'No time, grabbing coffee',
    'Back to the factory',
    'Fuel up, ship more',
  ],
  watching_stage: [
    'This could help Tesla',
    'SpaceX could use this!',
    'Interesting tech demo',
    'Think bigger though!',
    'Not disruptive enough',
  ],
};

/**
 * Thoughts for Mark Zuckerberg NPC based on behavior state
 */
export const MARK_ZUCKERBERG_THOUGHTS: Record<string, string[]> = {
  wandering: [
    'Is this VR or real?',
    'Where are my glasses?',
    'The metaverse is real!',
    'Llama 4 training soon',
    'Meta Quest is the future',
    "Can't see without headset",
    'VR world looks better',
    'Reality is overrated',
    'Llama beats GPT now!',
    'Open source AI wins!',
    'Meta AI is shipping!',
    'Need better VR lenses',
    'The glasses are blurry',
    'Metaverse rendering...',
    'Is this AR or VR?',
    'Horizon Worlds update',
    'Llama needs more GPUs',
    'Zuck mode: activated',
    'Llama not accepted yet...',
    'Why is Llama losing?',
    'Claude is behind us, right?',
    'Llama rejected again...',
    'Struggling against ChatGPT',
    'Why is GPT still winning?',
  ],
  conveyor: [
    'Great engagement metrics!',
    'Look at that throughput',
    'Meta scale production!',
    'Open source shipping!',
    'This could be in VR',
  ],
  talking_to_agent: [
    'Try the Quest headset!',
    'Have you used Llama?',
    'VR meeting instead?',
    "What's the Llama score?",
    'Build for the metaverse',
    'Open source this!',
    'Meta AI can help here',
    'Put this in VR!',
  ],
  visiting_kitchen: [
    'Sweet Baby Rays time!',
    'BBQ sauce on everything',
    'Smoking some meats',
    'Refueling for VR',
  ],
  watching_stage: [
    'This needs VR mode!',
    'Put this in metaverse',
    'Llama could do this',
    'Ship it on Quest!',
    'Great engagement!',
  ],
};

/**
 * Thoughts for Jensen Huang NPC based on behavior state
 */
export const JENSEN_HUANG_THOUGHTS: Record<string, string[]> = {
  wandering: [
    'Everyone buys my GPUs!',
    'NVDA up again today!',
    'The more you buy...',
    '...the more you save!',
    'CUDA runs the world!',
    'H100s sold out again!',
    'Blackwell is crushing it',
    'AI needs more GPUs!',
    'Stock at all time high!',
    'Every company needs us',
    'Leather jacket: on',
    'GPU shortage = demand!',
    'Training runs need me',
    'Inference at scale baby!',
    'They all use my chips',
    'NVIDIA is the platform',
    'Data centers love us!',
    'Cloud needs more GPUs!',
  ],
  conveyor: [
    'All running on NVIDIA!',
    'GPU-accelerated shipping!',
    'CUDA powered production',
    'This needs more H100s!',
    'Tensor cores at work!',
  ],
  talking_to_agent: [
    'Using CUDA, right?',
    'Need more H100s?',
    'GPU utilization good?',
    'Buy more GPUs!',
    'NVIDIA powers this!',
    'Tensor cores maxed?',
    'More compute = better',
    'Accelerate everything!',
  ],
  presenting: [
    'One more GPU reveal!',
    'NVIDIA is the future!',
    'AI runs on our chips',
    'Blackwell architecture!',
    'The roadmap is amazing',
  ],
  visiting_kitchen: [
    'Even the oven has GPUs',
    'Quick fuel, more GPUs',
    'Cooking with CUDA cores',
    'Kitchen break, stock up',
  ],
  watching_stage: [
    'Bet that runs on NVIDIA',
    'Needs more GPU power!',
    'Great demo, our chips?',
    'Standing ovation!',
    'I love this industry!',
  ],
};

/**
 * Thoughts for Steve Huang NPC (builder/architect) based on behavior state
 */
export const STEVE_HUANG_THOUGHTS: Record<string, string[]> = {
  wandering: [
    'Wow, look at AgentMux go!',
    'I created all of this...',
    'What a beautiful creation',
    'My vision, brought to life',
    'AgentMux is my masterpiece',
    'This factory is incredible',
    'Look at what we built!',
    'Every agent, every detail...',
    'From idea to reality',
    'This is beyond what I imagined',
    'AgentMux changes everything',
    'I can\'t believe how far we\'ve come',
    'This is just the beginning',
    'What a great company',
  ],
  conveyor: [
    'My factory in action!',
    'AgentMux is shipping!',
    'Beautiful production',
    'Just as I imagined',
    'The dream is real!',
  ],
  talking_to_agent: [
    'I made you, you know',
    'How\'s my creation doing?',
    'You make me proud!',
    'Keep building great things',
    'This is what I envisioned',
    'You\'re the heart of AgentMux',
    'Amazing work, keep going!',
    'Built with love, running with purpose',
  ],
  visiting_kitchen: [
    'Even creators need coffee',
    'Quick break, then more building',
    'Fueling the vision',
    'Grabbing a bite',
  ],
  watching_stage: [
    'Look at them perform!',
    'AgentMux talent on display',
    'This is what it\'s all about',
    'Incredible team!',
  ],
  playing_golf: [
    'Fore!',
    'Nice putt!',
    'Even founders need a break',
    'Golf clears the mind',
    'Back to building after this',
    'Love this putting green',
    'Great day for golf',
  ],
};

export default ThinkingBubble;
