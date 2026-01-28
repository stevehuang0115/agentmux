/**
 * Factory3D Component Exports
 *
 * Main entry point for the React Three Fiber factory visualization.
 */

// Main scene component
export { FactoryScene } from './FactoryScene';

// Environment components
export { Lighting } from './Environment/Lighting';
export { Floor } from './Environment/Floor';
export { Walls } from './Environment/Walls';
export { OutdoorScenery } from './Environment/OutdoorScenery';

// Office components
export { OfficeZones } from './Office/OfficeZone';
export { Workstation } from './Office/Workstation';
export { ConveyorBelt } from './Office/ConveyorBelt';
export { TokenCubePile } from './Office/TokenCubePile';
export { Decorations } from './Office/Decorations';

// Interaction zones
export { BreakRoom } from './InteractionZones/BreakRoom';
export { PokerTable } from './InteractionZones/PokerTable';

// Agent components
export { Agents } from './Agents/RobotAgent';
export { CowHead } from './Agents/AnimalHeads/CowHead';
export { HorseHead } from './Agents/AnimalHeads/HorseHead';
export { SpeechBubble } from './Agents/SpeechBubble';
export { ZzzIndicator } from './Agents/ZzzIndicator';

// Camera components
export { CameraController } from './Camera/CameraController';

// UI components
export { InfoPanel } from './UI/InfoPanel';
export { ProjectButtons } from './UI/ProjectButtons';
export { LightingToggle } from './UI/LightingToggle';
