/**
 * RoboticDogPet - Robotic dog pet component.
 *
 * A futuristic robot dog that patrols the factory.
 */

import React from 'react';
import { useGLTF } from '@react-three/drei';
import { MODEL_PATHS } from '../../../types/factory.types';
import { BasePet, PetConfig, BasePetProps } from './BasePet';

// Preload the model
useGLTF.preload(MODEL_PATHS.ROBOTIC_DOG);

/**
 * Configuration for robotic dog (Boston Dynamics Spot)
 * Uses original.glb which has correct upright orientation
 * At scale=0.6, model is ~0.9m tall (realistic Spot robot size)
 * Has "Animation" for walking - used for both walk and run
 */
const ROBOTIC_DOG_CONFIG: PetConfig = {
  modelPath: MODEL_PATHS.ROBOTIC_DOG,
  scale: 0.6, // Realistic Spot robot size (~0.9m tall)
  walkSpeed: 2.0,
  runSpeed: 4.5,
  groundOffset: 0,
  // original.glb has correct orientation - no rotation needed
  animations: {
    walk: 'Animation', // Walking animation from original.glb
    run: 'Animation',  // Use same animation for running (faster speed)
  },
};

/**
 * Props for RoboticDogPet
 */
type RoboticDogPetProps = Omit<BasePetProps, 'petType' | 'config'>;

/**
 * RoboticDogPet - Robotic dog that patrols the factory.
 */
export const RoboticDogPet: React.FC<RoboticDogPetProps> = (props) => {
  return <BasePet {...props} petType="roboticdog" config={ROBOTIC_DOG_CONFIG} />;
};

export default RoboticDogPet;
