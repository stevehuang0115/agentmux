/**
 * PuppyPet - Cute puppy pet component.
 *
 * An energetic puppy that follows agents around.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import { MODEL_PATHS, ANIMATION_NAMES } from '../../../types/factory.types';
import { BasePet, PetConfig, BasePetProps } from './BasePet';

// Preload the model
useGLTF.preload(MODEL_PATHS.PUPPY);

/**
 * Configuration for puppy
 */
const PUPPY_CONFIG: PetConfig = {
  modelPath: MODEL_PATHS.PUPPY,
  scale: 0.4,
  walkSpeed: 1.5,
  runSpeed: 3.5,
  groundOffset: 0,
  animations: {
    idle: ANIMATION_NAMES.PUPPY.IDLE,
    walk: ANIMATION_NAMES.PUPPY.WALKING,
    run: ANIMATION_NAMES.PUPPY.RUNNING,
    sit: ANIMATION_NAMES.PUPPY.SITTING,
  },
};

/**
 * Props for PuppyPet
 */
type PuppyPetProps = Omit<BasePetProps, 'petType' | 'config'>;

/**
 * PuppyPet - Energetic puppy that explores the factory.
 */
export const PuppyPet: React.FC<PuppyPetProps> = (props) => {
  return <BasePet {...props} petType="puppy" config={PUPPY_CONFIG} />;
};

export default PuppyPet;
