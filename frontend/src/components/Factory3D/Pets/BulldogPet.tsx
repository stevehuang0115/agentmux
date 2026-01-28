/**
 * BulldogPet - Bulldog pet component.
 *
 * A friendly bulldog that wanders around the factory.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import { MODEL_PATHS } from '../../../types/factory.types';
import { BasePet, PetConfig, BasePetProps } from './BasePet';

// Preload the model
useGLTF.preload(MODEL_PATHS.BULLDOG);

/**
 * Configuration for bulldog
 * Model has no animations - uses procedural animation fallback
 */
const BULLDOG_CONFIG: PetConfig = {
  modelPath: MODEL_PATHS.BULLDOG,
  scale: 0.5,
  walkSpeed: 1.0,
  runSpeed: 2.5,
  groundOffset: 0,
  // No animations config - uses procedural animation in BasePet
};

/**
 * Props for BulldogPet
 */
type BulldogPetProps = Omit<BasePetProps, 'petType' | 'config'>;

/**
 * BulldogPet - Bulldog that wanders the factory.
 */
export const BulldogPet: React.FC<BulldogPetProps> = (props) => {
  return <BasePet {...props} petType="bulldog" config={BULLDOG_CONFIG} />;
};

export default BulldogPet;
