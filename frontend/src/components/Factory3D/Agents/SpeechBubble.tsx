/**
 * SpeechBubble - Floating text bubble showing agent activity.
 *
 * Displays the current activity text above the agent's head
 * with a comic-style speech bubble appearance.
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

interface SpeechBubbleProps {
  /** Activity text to display */
  text: string;
  /** Vertical offset from agent */
  yOffset?: number;
}

/**
 * SpeechBubble - Billboarded text bubble.
 *
 * Features:
 * - Always faces camera (billboard)
 * - Rounded bubble background
 * - Pointer/tail
 * - Text truncation for long messages
 * - Gentle floating animation
 *
 * @param text - Activity text to display
 * @param yOffset - Vertical offset from agent center
 * @returns JSX element with speech bubble
 */
export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  yOffset = 2.5,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // Truncate long text
  const displayText = useMemo(() => {
    if (!text) return '';
    if (text.length > 40) {
      return text.substring(0, 37) + '...';
    }
    return text;
  }, [text]);

  // Calculate bubble width based on text
  const bubbleWidth = useMemo(() => {
    return Math.min(Math.max(displayText.length * 0.08 + 0.5, 1.5), 4);
  }, [displayText]);

  // Gentle floating animation
  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime;
      groupRef.current.position.y = yOffset + Math.sin(t * 2) * 0.05;
    }
  });

  if (!text) return null;

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <group ref={groupRef} position={[0, yOffset, 0]}>
        {/* Bubble background */}
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[bubbleWidth, 0.6]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>

        {/* Bubble border */}
        <BubbleBorder width={bubbleWidth} height={0.6} />

        {/* Pointer/tail */}
        <mesh position={[0, -0.4, -0.01]} rotation={[0, 0, Math.PI]}>
          <bufferGeometry>
            <float32BufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  -0.1, 0, 0,
                  0.1, 0, 0,
                  0, 0.2, 0,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <meshBasicMaterial color={0xffffff} side={THREE.DoubleSide} />
        </mesh>

        {/* Text */}
        <Text
          position={[0, 0, 0]}
          fontSize={0.15}
          color="#333333"
          anchorX="center"
          anchorY="middle"
          maxWidth={bubbleWidth - 0.3}
        >
          {displayText}
        </Text>
      </group>
    </Billboard>
  );
};

/**
 * BubbleBorder - Rounded border for speech bubble.
 */
const BubbleBorder: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const points = useMemo(() => {
    const hw = width / 2;
    const hh = height / 2;
    const r = 0.15; // Corner radius

    // Create rounded rectangle path
    const pts: THREE.Vector3[] = [];
    const segments = 8;

    // Top right corner
    for (let i = 0; i <= segments; i++) {
      const angle = (Math.PI / 2) * (i / segments);
      pts.push(new THREE.Vector3(
        hw - r + Math.cos(angle) * r,
        hh - r + Math.sin(angle) * r,
        0
      ));
    }

    // Top left corner
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI / 2 + (Math.PI / 2) * (i / segments);
      pts.push(new THREE.Vector3(
        -hw + r + Math.cos(angle) * r,
        hh - r + Math.sin(angle) * r,
        0
      ));
    }

    // Bottom left corner
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI + (Math.PI / 2) * (i / segments);
      pts.push(new THREE.Vector3(
        -hw + r + Math.cos(angle) * r,
        -hh + r + Math.sin(angle) * r,
        0
      ));
    }

    // Bottom right corner
    for (let i = 0; i <= segments; i++) {
      const angle = 3 * Math.PI / 2 + (Math.PI / 2) * (i / segments);
      pts.push(new THREE.Vector3(
        hw - r + Math.cos(angle) * r,
        -hh + r + Math.sin(angle) * r,
        0
      ));
    }

    // Close the path
    pts.push(pts[0].clone());

    return pts;
  }, [width, height]);

  return (
    <line>
      <bufferGeometry>
        <float32BufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array(points.flatMap((p) => [p.x, p.y, p.z])),
            3,
          ]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={0x333333} linewidth={2} />
    </line>
  );
};

export default SpeechBubble;
