/**
 * SpeechBubble - Floating text bubble showing agent activity.
 *
 * Displays the current activity text above the agent's head
 * with a modern dark tooltip-style appearance.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

interface SpeechBubbleProps {
  /** Activity text to display */
  text: string;
  /** Vertical offset from agent */
  yOffset?: number;
  /** Maximum characters before truncation */
  maxChars?: number;
}

/**
 * SpeechBubble - Modern billboarded text bubble.
 *
 * Features:
 * - Always faces camera (billboard)
 * - Dark semi-transparent background
 * - Rounded corners
 * - Clean pointer/tail
 * - Text truncation for long messages
 * - Gentle floating animation
 *
 * @param text - Activity text to display
 * @param yOffset - Vertical offset from agent center
 * @param maxChars - Maximum characters before truncation
 * @returns JSX element with speech bubble
 */
export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  yOffset = 3.0,
  maxChars = 50,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // Truncate long text
  const displayText = useMemo(() => {
    if (!text) return '';
    // Clean up the text - remove extra whitespace
    const cleaned = text.trim().replace(/\s+/g, ' ');
    if (cleaned.length > maxChars) {
      return cleaned.substring(0, maxChars - 3) + '...';
    }
    return cleaned;
  }, [text, maxChars]);

  // Calculate bubble dimensions based on text
  const dimensions = useMemo(() => {
    const charWidth = 0.12;
    const minWidth = 2.0;
    const maxWidth = 5.0;
    const padding = 0.6;

    const textWidth = displayText.length * charWidth;
    const width = Math.min(Math.max(textWidth + padding, minWidth), maxWidth);
    const height = 0.7;

    return { width, height };
  }, [displayText]);

  // Gentle floating animation
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = yOffset + Math.sin(t * 1.5) * 0.03;
    }
  });

  if (!text) return null;

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <group ref={groupRef} position={[0, yOffset, 0]}>
        {/* Main bubble - dark semi-transparent */}
        <RoundedBox
          args={[dimensions.width, dimensions.height, 0.08]}
          radius={0.12}
          smoothness={4}
          position={[0, 0, 0]}
        >
          <meshBasicMaterial
            color={0x1a1a2e}
            transparent
            opacity={0.92}
          />
        </RoundedBox>

        {/* Subtle border glow */}
        <RoundedBox
          args={[dimensions.width + 0.04, dimensions.height + 0.04, 0.06]}
          radius={0.14}
          smoothness={4}
          position={[0, 0, -0.02]}
        >
          <meshBasicMaterial
            color={0x4a90d9}
            transparent
            opacity={0.3}
          />
        </RoundedBox>

        {/* Pointer/tail - triangle pointing down */}
        <mesh position={[0, -dimensions.height / 2 - 0.15, 0]}>
          <bufferGeometry>
            <float32BufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  -0.15, 0.18, 0,
                  0.15, 0.18, 0,
                  0, -0.08, 0,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <meshBasicMaterial
            color={0x1a1a2e}
            transparent
            opacity={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Pointer glow */}
        <mesh position={[0, -dimensions.height / 2 - 0.15, -0.02]}>
          <bufferGeometry>
            <float32BufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  -0.18, 0.20, 0,
                  0.18, 0.20, 0,
                  0, -0.12, 0,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <meshBasicMaterial
            color={0x4a90d9}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Activity indicator dot */}
        <mesh position={[-dimensions.width / 2 + 0.25, 0, 0.05]}>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color={0x4ade80} />
        </mesh>

        {/* Text - light color for contrast */}
        <Text
          position={[0.1, 0, 0.05]}
          fontSize={0.18}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={dimensions.width - 0.8}
          outlineWidth={0}
        >
          {displayText}
        </Text>
      </group>
    </Billboard>
  );
};

export default SpeechBubble;
