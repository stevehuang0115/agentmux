/**
 * MiniKitchen - Break area with food, snacks, and a counter for agents.
 *
 * A cozy kitchen space with a refrigerator, counter island, snack shelves,
 * microwave, fruit bowl, pizza boxes, donuts, and bar stools.
 */

import React from 'react';
import * as THREE from 'three';
import { FACTORY_CONSTANTS } from '../../../types/factory.types';
import { useFactory } from '../../../contexts/FactoryContext';

const { KITCHEN } = FACTORY_CONSTANTS;

// ====== REFRIGERATOR ======

/**
 * Refrigerator - Stainless steel double-door fridge.
 */
const Refrigerator: React.FC = () => {
  const { isNightMode } = useFactory();

  return (
    <group position={[-4, 0, -1.5]}>
      {/* Main body */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[1.2, 2.2, 0.8]} />
        <meshStandardMaterial color={0xc0c0c0} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Door split line */}
      <mesh position={[0, 1.1, 0.41]}>
        <boxGeometry args={[0.02, 2.0, 0.01]} />
        <meshStandardMaterial color={0x888888} metalness={0.5} />
      </mesh>

      {/* Left door handle */}
      <mesh position={[-0.15, 1.3, 0.42]}>
        <boxGeometry args={[0.03, 0.4, 0.04]} />
        <meshStandardMaterial color={0x999999} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Right door handle */}
      <mesh position={[0.15, 1.3, 0.42]}>
        <boxGeometry args={[0.03, 0.4, 0.04]} />
        <meshStandardMaterial color={0x999999} metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Freezer divider line */}
      <mesh position={[0, 1.7, 0.41]}>
        <boxGeometry args={[1.1, 0.02, 0.01]} />
        <meshStandardMaterial color={0x888888} metalness={0.5} />
      </mesh>

      {/* Display/indicator light */}
      <mesh position={[0.4, 1.9, 0.42]}>
        <boxGeometry args={[0.15, 0.08, 0.01]} />
        <meshStandardMaterial
          color={0x111111}
          emissive={isNightMode ? 0x00aaff : 0x003355}
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
};

// ====== KITCHEN COUNTER / ISLAND ======

/**
 * KitchenCounter - Central island counter with a stone top.
 */
const KitchenCounter: React.FC = () => {
  return (
    <group position={[0, 0, 0]}>
      {/* Counter base (cabinet) */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[3.5, 0.9, 1.2]} />
        <meshStandardMaterial color={0x3a3a3a} roughness={0.5} />
      </mesh>

      {/* Counter top (stone/marble) */}
      <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.7, 0.06, 1.4]} />
        <meshStandardMaterial color={0xd4c9b8} roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Cabinet doors (front) */}
      {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
        <group key={`door-f-${i}`}>
          <mesh position={[x, 0.45, 0.61]}>
            <boxGeometry args={[0.7, 0.75, 0.02]} />
            <meshStandardMaterial color={0x444444} roughness={0.4} />
          </mesh>
          {/* Door knob */}
          <mesh position={[x + 0.25, 0.45, 0.63]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color={0xaaaaaa} metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Cabinet doors (back) */}
      {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
        <group key={`door-b-${i}`}>
          <mesh position={[x, 0.45, -0.61]}>
            <boxGeometry args={[0.7, 0.75, 0.02]} />
            <meshStandardMaterial color={0x444444} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ====== MICROWAVE ======

/**
 * Microwave - Sitting on the counter.
 */
const Microwave: React.FC = () => {
  const { isNightMode } = useFactory();

  return (
    <group position={[1.2, 0.95, 0]}>
      {/* Body */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[0.5, 0.3, 0.35]} />
        <meshStandardMaterial color={0x222222} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Door window */}
      <mesh position={[-0.05, 0.15, 0.18]}>
        <boxGeometry args={[0.3, 0.2, 0.01]} />
        <meshStandardMaterial
          color={0x111111}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* Control panel */}
      <mesh position={[0.2, 0.15, 0.18]}>
        <boxGeometry args={[0.08, 0.2, 0.01]} />
        <meshStandardMaterial
          color={0x111111}
          emissive={isNightMode ? 0x00ff00 : 0x003300}
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Handle */}
      <mesh position={[0.12, 0.15, 0.19]}>
        <boxGeometry args={[0.02, 0.15, 0.02]} />
        <meshStandardMaterial color={0x888888} metalness={0.7} />
      </mesh>
    </group>
  );
};

// ====== SNACK SHELF ======

/**
 * SnackShelf - Open shelving unit with colorful snack packages.
 */
const SnackShelf: React.FC = () => {
  return (
    <group position={[4, 0, -1.5]}>
      {/* Shelf frame */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[1.2, 2.0, 0.5]} />
        <meshStandardMaterial color={0x5c4033} roughness={0.6} />
      </mesh>

      {/* Shelf levels */}
      {[0.4, 0.8, 1.2, 1.6].map((y, level) => (
        <group key={`shelf-${level}`}>
          {/* Shelf board */}
          <mesh position={[0, y, 0.05]}>
            <boxGeometry args={[1.1, 0.04, 0.45]} />
            <meshStandardMaterial color={0x6b4226} roughness={0.5} />
          </mesh>

          {/* Snack items on shelf */}
          {[-0.35, -0.1, 0.15, 0.35].map((x, item) => (
            <mesh
              key={`snack-${level}-${item}`}
              position={[x, y + 0.1, 0.05]}
            >
              <boxGeometry args={[0.15, 0.14, 0.08]} />
              <meshStandardMaterial
                color={
                  [0xff4444, 0x44aa44, 0xffaa22, 0x4488ff, 0xff66cc, 0xaadd44][
                    (level * 4 + item) % 6
                  ]
                }
                roughness={0.5}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

// ====== FRUIT BOWL ======

/**
 * FruitBowl - Wooden bowl with fruits on the counter.
 */
const FruitBowl: React.FC = () => {
  return (
    <group position={[-0.5, 0.95, 0.2]}>
      {/* Bowl */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.22, 0.15, 0.12, 16]} />
        <meshStandardMaterial color={0x8b6914} roughness={0.7} />
      </mesh>

      {/* Apple (red) */}
      <mesh position={[-0.06, 0.16, 0.02]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={0xcc2222} roughness={0.6} />
      </mesh>

      {/* Orange */}
      <mesh position={[0.07, 0.15, -0.04]}>
        <sphereGeometry args={[0.065, 8, 8]} />
        <meshStandardMaterial color={0xff8c00} roughness={0.7} />
      </mesh>

      {/* Green apple */}
      <mesh position={[0, 0.18, 0.08]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshStandardMaterial color={0x44bb22} roughness={0.6} />
      </mesh>

      {/* Banana (elongated sphere) */}
      <mesh position={[0.05, 0.2, 0]} rotation={[0, 0, 0.4]}>
        <capsuleGeometry args={[0.025, 0.1, 4, 8]} />
        <meshStandardMaterial color={0xffe135} roughness={0.5} />
      </mesh>
    </group>
  );
};

// ====== PIZZA BOX ======

/**
 * PizzaBox - Stacked pizza boxes on the counter.
 */
const PizzaBoxes: React.FC = () => {
  return (
    <group position={[-1.3, 0.95, -0.1]}>
      {/* Bottom box */}
      <mesh position={[0, 0.04, 0]} rotation={[0, 0.1, 0]}>
        <boxGeometry args={[0.45, 0.06, 0.45]} />
        <meshStandardMaterial color={0xd4a76a} roughness={0.8} />
      </mesh>

      {/* Top box */}
      <mesh position={[0.02, 0.1, -0.01]} rotation={[0, -0.15, 0]}>
        <boxGeometry args={[0.45, 0.06, 0.45]} />
        <meshStandardMaterial color={0xd4a76a} roughness={0.8} />
      </mesh>

      {/* Logo on top box (red circle) */}
      <mesh position={[0.02, 0.135, -0.01]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 16]} />
        <meshStandardMaterial color={0xcc3333} roughness={0.6} />
      </mesh>
    </group>
  );
};

// ====== DONUT PLATE ======

/**
 * DonutPlate - Plate of donuts on the counter.
 */
const DonutPlate: React.FC = () => {
  return (
    <group position={[0.4, 0.95, -0.25]}>
      {/* Plate */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
        <meshStandardMaterial color={0xffffff} roughness={0.3} />
      </mesh>

      {/* Donuts */}
      {[
        { x: -0.06, z: 0.04, color: 0xd4875e },
        { x: 0.06, z: -0.04, color: 0xff69b4 },
        { x: 0, z: 0.07, color: 0x8b4513 },
      ].map((d, i) => (
        <mesh
          key={`donut-${i}`}
          position={[d.x, 0.06, d.z]}
          rotation={[Math.PI / 2, 0, i * 0.5]}
        >
          <torusGeometry args={[0.04, 0.02, 8, 12]} />
          <meshStandardMaterial color={d.color} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// ====== COFFEE MAKER ======

/**
 * CoffeeMaker - Drip coffee maker on the counter.
 */
const CoffeeMaker: React.FC = () => {
  const { isNightMode } = useFactory();

  return (
    <group position={[-0.1, 0.95, -0.35]}>
      {/* Base */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.25, 0.06, 0.2]} />
        <meshStandardMaterial color={0x222222} roughness={0.4} />
      </mesh>

      {/* Carafe */}
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.16, 12]} />
        <meshStandardMaterial
          color={0x333333}
          transparent
          opacity={0.6}
          roughness={0.1}
        />
      </mesh>

      {/* Coffee inside */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.08, 12]} />
        <meshStandardMaterial color={0x3d1c02} roughness={0.3} />
      </mesh>

      {/* Reservoir tower */}
      <mesh position={[0, 0.3, -0.06]}>
        <boxGeometry args={[0.2, 0.25, 0.08]} />
        <meshStandardMaterial color={0x222222} roughness={0.4} />
      </mesh>

      {/* Indicator light */}
      <mesh position={[0.08, 0.04, 0.11]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial
          color={0x00ff00}
          emissive={isNightMode ? 0x00ff00 : 0x006600}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
};

// ====== BAR STOOL ======

interface BarStoolProps {
  position: [number, number, number];
  rotation?: number;
}

/**
 * BarStool - Tall stool for sitting at the counter.
 */
const BarStool: React.FC<BarStoolProps> = ({ position, rotation = 0 }) => {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Seat (round cushion) */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.06, 16]} />
        <meshStandardMaterial color={0x333333} roughness={0.7} />
      </mesh>

      {/* Seat cushion top */}
      <mesh position={[0, 0.79, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.03, 16]} />
        <meshStandardMaterial color={0xcc4444} roughness={0.8} />
      </mesh>

      {/* Center pole */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.72, 8]} />
        <meshStandardMaterial color={0x888888} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Base ring */}
      <mesh position={[0, 0.03, 0]}>
        <torusGeometry args={[0.18, 0.02, 8, 16]} />
        <meshStandardMaterial color={0x888888} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Footrest ring */}
      <mesh position={[0, 0.3, 0]}>
        <torusGeometry args={[0.15, 0.015, 8, 16]} />
        <meshStandardMaterial color={0x888888} metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
};

// ====== WATER COOLER ======

/**
 * WaterCooler - Water dispenser with bottle on top.
 */
const WaterCooler: React.FC = () => {
  return (
    <group position={[-4, 0, 1]}>
      {/* Base cabinet */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.45, 0.8, 0.4]} />
        <meshStandardMaterial color={0xeeeeee} roughness={0.3} />
      </mesh>

      {/* Spout area */}
      <mesh position={[0, 0.65, 0.18]}>
        <boxGeometry args={[0.2, 0.15, 0.08]} />
        <meshStandardMaterial color={0xdddddd} roughness={0.3} />
      </mesh>

      {/* Hot/cold taps */}
      <mesh position={[-0.05, 0.65, 0.23]}>
        <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
        <meshStandardMaterial color={0xff3333} metalness={0.5} />
      </mesh>
      <mesh position={[0.05, 0.65, 0.23]}>
        <cylinderGeometry args={[0.015, 0.015, 0.03, 8]} />
        <meshStandardMaterial color={0x3333ff} metalness={0.5} />
      </mesh>

      {/* Water bottle */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.55, 12]} />
        <meshStandardMaterial
          color={0x88ccff}
          transparent
          opacity={0.4}
          roughness={0.1}
        />
      </mesh>

      {/* Water inside bottle */}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.35, 12]} />
        <meshStandardMaterial
          color={0x4488cc}
          transparent
          opacity={0.3}
          roughness={0.1}
        />
      </mesh>

      {/* Bottle cap */}
      <mesh position={[0, 1.38, 0]}>
        <cylinderGeometry args={[0.05, 0.14, 0.04, 12]} />
        <meshStandardMaterial color={0x88ccff} transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

// ====== KITCHEN FLOOR ======

/**
 * KitchenFloor - Distinctive tiled floor area.
 */
const KitchenFloor: React.FC = () => {
  return (
    <group>
      {/* Main floor area */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial
          color={0x8fbc8f}
          roughness={0.6}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Tile grid lines (decorative) */}
      {[-4, -2, 0, 2, 4].map((x) => (
        <mesh
          key={`tile-x-${x}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[x, 0.025, 0]}
        >
          <planeGeometry args={[0.03, 5]} />
          <meshStandardMaterial
            color={0x7aaa7a}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}
      {[-2, 0, 2].map((z) => (
        <mesh
          key={`tile-z-${z}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.025, z]}
        >
          <planeGeometry args={[10, 0.03]} />
          <meshStandardMaterial
            color={0x7aaa7a}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      ))}
    </group>
  );
};

// ====== OVERHEAD LAMP ======

/**
 * KitchenLamp - Pendant lamp over the counter.
 */
const KitchenLamp: React.FC<{ position: [number, number, number] }> = ({
  position,
}) => {
  const { isNightMode } = useFactory();

  return (
    <group position={position}>
      {/* Cord */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.8, 6]} />
        <meshStandardMaterial color={0x222222} />
      </mesh>

      {/* Shade */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.2, 0.15, 16, 1, true]} />
        <meshStandardMaterial
          color={0x2a2a2a}
          roughness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bulb */}
      <mesh position={[0, 0.02, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial
          color={0xffffee}
          emissive={isNightMode ? 0xffdd88 : 0x554400}
          emissiveIntensity={isNightMode ? 1.0 : 0.3}
        />
      </mesh>

      {/* Warm light */}
      {isNightMode && (
        <pointLight
          position={[0, -0.1, 0]}
          color={0xffdd88}
          intensity={0.5}
          distance={5}
          decay={2}
        />
      )}
    </group>
  );
};

// ====== MINI KITCHEN ======

/**
 * MiniKitchen - Complete kitchen area with food and snacks.
 *
 * Includes a kitchen island counter, refrigerator, microwave,
 * snack shelves, fruit bowl, pizza boxes, donuts, coffee maker,
 * water cooler, bar stools, and pendant lighting.
 *
 * @returns JSX element with mini kitchen setup
 */
export const MiniKitchen: React.FC = () => {
  const { x, z } = KITCHEN.POSITION;

  return (
    <group position={[x, 0, z]} rotation={[0, -Math.PI / 2, 0]}>
      {/* Tiled floor */}
      <KitchenFloor />

      {/* Central counter island */}
      <KitchenCounter />

      {/* Refrigerator - back left */}
      <Refrigerator />

      {/* Snack shelf - back right */}
      <SnackShelf />

      {/* Microwave on counter */}
      <Microwave />

      {/* Coffee maker on counter */}
      <CoffeeMaker />

      {/* Fruit bowl on counter */}
      <FruitBowl />

      {/* Pizza boxes on counter */}
      <PizzaBoxes />

      {/* Donut plate on counter */}
      <DonutPlate />

      {/* Water cooler - left side */}
      <WaterCooler />

      {/* Bar stools around the counter (front side) */}
      <BarStool position={[-1, 0, 1.2]} />
      <BarStool position={[0, 0, 1.2]} />
      <BarStool position={[1, 0, 1.2]} />

      {/* Bar stools (back side) */}
      <BarStool position={[-0.5, 0, -1.2]} rotation={Math.PI} />
      <BarStool position={[0.5, 0, -1.2]} rotation={Math.PI} />

      {/* Pendant lamps over counter */}
      <KitchenLamp position={[-1, 3.5, 0]} />
      <KitchenLamp position={[1, 3.5, 0]} />

      {/* Kitchen sign */}
      <group position={[0, 3, -2.5]}>
        <mesh>
          <boxGeometry args={[2.2, 0.4, 0.1]} />
          <meshStandardMaterial color={0x8fbc8f} />
        </mesh>
      </group>
    </group>
  );
};

export default MiniKitchen;
