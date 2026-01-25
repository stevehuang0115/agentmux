/**
 * Factory-specific TypeScript type definitions for the 3D factory visualization.
 * These types support the React Three Fiber migration of the AgentMux factory.
 */

import * as THREE from 'three';

// ====== AGENT TYPES ======

/**
 * Animal head types available for robot agents.
 * Determined by project name hash for consistent appearance.
 */
export type AnimalType = 'cow' | 'horse' | 'dragon' | 'tiger' | 'rabbit';

/**
 * Agent operational status levels
 */
export type AgentStatus = 'active' | 'idle' | 'dormant';

/**
 * Agent activity modes while working
 */
export type ActivityMode = 'typing' | 'thinking' | 'reading' | 'stretching';

/**
 * Agent coffee break activity modes
 */
export type CoffeeBreakMode = 'drinking' | 'walking';

/**
 * Agent interaction zone types
 */
export type InteractionZone = 'break_room' | 'poker_table';

/**
 * Represents an agent's state in the factory visualization
 */
export interface FactoryAgent {
  /** Unique identifier for the agent */
  id: string;
  /** Name of the project this agent belongs to */
  projectName: string;
  /** Current operational status */
  status: AgentStatus;
  /** CPU usage percentage (0-100) */
  cpuPercent: number;
  /** Current activity description for speech bubble */
  activity?: string;
  /** Token count for this session */
  sessionTokens: number;
  /** Index of the zone this agent is assigned to */
  zoneIndex: number;
  /** Index of the workstation within the zone */
  workstationIndex: number;
  /** Type of animal head displayed */
  animalType: AnimalType;
  /** Current interaction zone activity if in break area */
  interactionState?: AgentInteractionState;
  /** Base 3D position */
  basePosition: THREE.Vector3;
  /** Agent's tmux session name */
  sessionName?: string;
  /** Agent display name */
  name?: string;
}

/**
 * Agent interaction state when in break room or poker table
 */
export interface AgentInteractionState {
  /** Which zone the agent is interacting in */
  zone: InteractionZone;
  /** Current activity in the zone */
  activity: string;
  /** Seat index at the table/area */
  seatIndex: number;
  /** Timestamp when interaction started */
  startedAt: number;
}

// ====== ZONE TYPES ======

/**
 * Office zone colors for different projects
 */
export const ZONE_COLORS = [
  0x3a5f8a, // Blue
  0x8a3a5f, // Burgundy
  0x5f8a3a, // Green
  0x8a5f3a, // Orange
  0x5f3a8a, // Purple
  0x3a8a5f, // Teal
] as const;

/**
 * Represents an office zone (project area) in the factory
 */
export interface OfficeZone {
  /** Project name for this zone */
  projectName: string;
  /** Zone index for positioning and coloring */
  zoneIndex: number;
  /** X position of zone center */
  zoneX: number;
  /** Z position of zone center */
  zoneZ: number;
  /** Zone color from ZONE_COLORS */
  color: number;
  /** Workstations within this zone */
  workstations: Workstation[];
}

/**
 * Represents a workstation within a zone
 */
export interface Workstation {
  /** Workstation position */
  position: WorkstationPosition;
  /** Global workstation index */
  index: number;
  /** Assigned agent ID if occupied */
  assignedAgentId?: string;
  /** Whether the laptop screen is active */
  isActive: boolean;
}

/**
 * Position data for a workstation
 */
export interface WorkstationPosition {
  x: number;
  z: number;
}

// ====== CAMERA TYPES ======

/**
 * Camera control state
 */
export interface CameraState {
  /** Horizontal rotation angle in radians */
  yaw: number;
  /** Vertical rotation angle in radians */
  pitch: number;
  /** Current camera position */
  position: THREE.Vector3;
  /** Current look-at target */
  target: THREE.Vector3;
  /** Whether camera is animating to a target */
  isAnimating: boolean;
  /** Target for camera animation */
  animationTarget?: CameraAnimationTarget;
}

/**
 * Camera animation target for smooth transitions
 */
export interface CameraAnimationTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  duration: number;
  startTime: number;
  startPosition: THREE.Vector3;
  startLookAt: THREE.Vector3;
}

/**
 * Camera focus targets
 */
export type CameraFocusTarget = 'overview' | string; // string = project name

// ====== LIGHTING TYPES ======

/**
 * Lighting mode options
 */
export type LightingMode = 'day' | 'night' | 'auto';

/**
 * Lighting configuration for different modes
 */
export interface LightingConfig {
  background: number;
  fog: number;
  wallColor: number;
  floorColor: number;
  ambientIntensity: number;
  sunIntensity: number;
}

/**
 * Pre-defined lighting configurations
 */
export const LIGHTING_CONFIGS: Record<'day' | 'night', LightingConfig> = {
  day: {
    background: 0x87ceeb,
    fog: 0x87ceeb,
    wallColor: 0xe8e4de,
    floorColor: 0x5a5a6a,
    ambientIntensity: 0.6,
    sunIntensity: 1.5,
  },
  night: {
    background: 0x0a0a1a,
    fog: 0x0a0a1a,
    wallColor: 0x2a2a35,
    floorColor: 0x1a1a25,
    ambientIntensity: 0.1,
    sunIntensity: 0.0,
  },
} as const;

// ====== UI TYPES ======

/**
 * Info panel statistics
 */
export interface FactoryStats {
  activeCount: number;
  idleCount: number;
  dormantCount: number;
  totalTokens: number;
}

/**
 * Project button for camera focus
 */
export interface ProjectButton {
  projectName: string;
  zoneIndex: number;
  agentCount: number;
  color: number;
}

/**
 * Token distribution data for chart
 */
export interface TokenDistribution {
  projectName: string;
  tokens: number;
  color: number;
}

// ====== API RESPONSE TYPES ======

/**
 * Factory agent data from API
 */
export interface FactoryAgentResponse {
  id: string;
  sessionName: string;
  name: string;
  projectName: string;
  status: 'active' | 'idle' | 'dormant';
  cpuPercent: number;
  activity?: string;
  sessionTokens?: number;
}

/**
 * Factory usage stats from API
 */
export interface FactoryUsageResponse {
  today: {
    messages: number;
    tokens: number;
    toolCalls: number;
  };
  totals: {
    sessions: number;
    messages: number;
  };
  recentDays: Array<{
    date: string;
    tokens: number;
  }>;
}

/**
 * Factory state from API
 */
export interface FactoryStateResponse {
  agents: FactoryAgentResponse[];
  projects: string[];
  stats: FactoryStats;
}

// ====== ANIMATION TYPES ======

/**
 * Robot animation action names from GLTF
 */
export type RobotAnimation =
  | 'Dance'
  | 'Death'
  | 'Idle'
  | 'Jump'
  | 'No'
  | 'Punch'
  | 'Running'
  | 'Sitting'
  | 'Standing'
  | 'ThumbsUp'
  | 'Walking'
  | 'WalkJump'
  | 'Wave'
  | 'Yes';

/**
 * Agent animation state
 */
export interface AgentAnimationState {
  currentAction: RobotAnimation;
  activityMode: ActivityMode;
  modeStartTime: number;
  modeDuration: number;
  coffeeBreakState?: CoffeeBreakState;
  typingOffset: number;
}

/**
 * Coffee break state for walking animation
 */
export interface CoffeeBreakState {
  mode: CoffeeBreakMode;
  modeStartTime: number;
  modeDuration: number;
  walkAngle: number;
  walkRadius: number;
}

// ====== BOSS MODE TYPES ======

/**
 * Boss mode auto-tour state
 */
export interface BossModeState {
  isActive: boolean;
  currentTargetIndex: number;
  targets: CameraFocusTarget[];
  timeAtTarget: number;
  targetDuration: number;
}

// ====== INTERACTION ZONE TYPES ======

/**
 * Break room configuration
 */
export interface BreakRoomConfig {
  position: THREE.Vector3;
  seats: Array<{
    position: THREE.Vector3;
    rotation: number;
  }>;
}

/**
 * Poker table configuration
 */
export interface PokerTableConfig {
  position: THREE.Vector3;
  seats: Array<{
    position: THREE.Vector3;
    rotation: number;
  }>;
}

// ====== CONSTANTS ======

/**
 * Factory layout constants
 */
export const FACTORY_CONSTANTS = {
  /** Zone dimensions */
  ZONE: {
    WIDTH: 10,
    DEPTH: 7,
    ZONES_PER_ROW: 3,
    START_X: -14,
    START_Z: 8,
    GAP_X: 4,
    GAP_Z: 3,
  },
  /** Workstation positions within a zone (relative to zone center) */
  WORKSTATION_POSITIONS: [
    { x: -3, z: 1.5 },
    { x: 3, z: 1.5 },
    { x: -3, z: -1 },
    { x: 3, z: -1 },
  ] as const,
  /** Camera defaults */
  CAMERA: {
    DEFAULT_POSITION: { x: -22, y: 22, z: -22 },
    FOV: 60,
    NEAR: 0.1,
    FAR: 100,
    LOOK_SENSITIVITY: 0.002,
    MIN_PITCH: -Math.PI / 2 + 0.1,
    MAX_PITCH: Math.PI / 2 - 0.1,
    MOVE_SPEED: 15,
    ZOOM_SPEED: 0.5,
  },
  /** Wall dimensions */
  WALLS: {
    HEIGHT: 4,
    THICKNESS: 0.3,
    BACK_X: -26,
    LEFT_Z: -18,
    RIGHT_Z: 18,
    FRONT_X: 26,
  },
  /** Interaction zones */
  BREAK_ROOM: {
    POSITION: { x: -18, y: 0, z: 16 },
  },
  POKER_TABLE: {
    POSITION: { x: 18, y: 0, z: 16 },
  },
  /** Animation timing */
  ANIMATION: {
    FOCUS_DURATION: 1500,
    BOSS_MODE_INTERVAL: 8000,
  },
  /** API polling */
  API: {
    POLL_INTERVAL: 5000,
    USAGE_POLL_INTERVAL: 30000,
  },
} as const;

/**
 * Model paths
 */
export const MODEL_PATHS = {
  ROBOT: '/models/RobotExpressive.glb',
} as const;
