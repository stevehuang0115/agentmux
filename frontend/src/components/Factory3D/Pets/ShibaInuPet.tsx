/**
 * ShibaInuPet - Shiba Inu pet component.
 *
 * A playful Shiba Inu (doge) that roams the factory.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import { MODEL_PATHS, ANIMATION_NAMES } from '../../../types/factory.types';
import { BasePet, PetConfig, BasePetProps } from './BasePet';

// Preload the model
useGLTF.preload(MODEL_PATHS.SHIBA_INU);

/**
 * Configuration for Shiba Inu
 * Model has idle/sit animations but no walk/run - uses procedural for movement
 */
const SHIBA_INU_CONFIG: PetConfig = {
  modelPath: MODEL_PATHS.SHIBA_INU,
  scale: 0.5,
  walkSpeed: 1.3,
  runSpeed: 3.0,
  groundOffset: 0,
  animations: {
    idle: ANIMATION_NAMES.SHIBA_INU.IDLE,
    sit: ANIMATION_NAMES.SHIBA_INU.SITTING,
    // No walk/run animations - BasePet will use procedural animation for movement
  },
};

/**
 * Props for ShibaInuPet
 */
type ShibaInuPetProps = Omit<BasePetProps, 'petType' | 'config'>;

/**
 * ShibaInuPet - Playful Shiba Inu that roams the factory.
 */
export const ShibaInuPet: React.FC<ShibaInuPetProps> = (props) => {
  return <BasePet {...props} petType="shibainu" config={SHIBA_INU_CONFIG} />;
};

export default ShibaInuPet;
