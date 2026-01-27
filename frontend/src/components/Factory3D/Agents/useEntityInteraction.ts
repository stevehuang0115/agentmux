/**
 * useEntityInteraction - Shared hook for hover/click interactions on 3D entities.
 *
 * Provides pointer event handlers, hover/select state, and cursor management
 * for agents, NPCs, and audience members in the factory scene.
 */

import { useCallback } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { useFactory } from '../../../contexts/FactoryContext';

/**
 * Return type of useEntityInteraction hook
 */
export interface EntityInteractionResult {
  /** Whether this entity is currently hovered */
  isHovered: boolean;
  /** Whether this entity is currently selected */
  isSelected: boolean;
  /** Pointer enter handler — call from onPointerOver */
  handlePointerOver: (e: ThreeEvent<PointerEvent>) => void;
  /** Pointer leave handler — call from onPointerOut */
  handlePointerOut: () => void;
  /** Click handler — call from onClick */
  handleClick: (e: ThreeEvent<MouseEvent>) => void;
}

/**
 * Hook for entity hover/select interactions in the 3D factory.
 *
 * Reads hoveredEntityId and selectedEntityId from FactoryContext
 * and provides memoized event handlers that set hover state,
 * manage cursor style, and trigger entity selection (boss mode).
 *
 * @param entityId - Unique identifier for this entity
 * @returns Interaction state and event handlers
 *
 * @example
 * ```tsx
 * const { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick } =
 *   useEntityInteraction('steve-jobs-npc');
 *
 * return (
 *   <group
 *     onPointerOver={handlePointerOver}
 *     onPointerOut={handlePointerOut}
 *     onClick={handleClick}
 *   >
 *     ...
 *   </group>
 * );
 * ```
 */
export function useEntityInteraction(entityId: string): EntityInteractionResult {
  const {
    hoveredEntityId,
    selectedEntityId,
    setHoveredEntity,
    selectEntity,
  } = useFactory();

  const isHovered = hoveredEntityId === entityId;
  const isSelected = selectedEntityId === entityId;

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHoveredEntity(entityId);
      document.body.style.cursor = 'pointer';
    },
    [entityId, setHoveredEntity]
  );

  const handlePointerOut = useCallback(() => {
    setHoveredEntity(null);
    document.body.style.cursor = 'default';
  }, [setHoveredEntity]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      selectEntity(entityId);
    },
    [entityId, selectEntity]
  );

  return { isHovered, isSelected, handlePointerOver, handlePointerOut, handleClick };
}
