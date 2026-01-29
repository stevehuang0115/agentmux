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
export type AnimalType = 'cow' | 'horse' | 'tiger' | 'rabbit';

/**
 * Pet types available in the factory.
 * These are companion animals that wander around the factory.
 */
export type PetType = 'bulldog' | 'puppy' | 'roboticdog' | 'shibainu';

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
  /** Base 3D position (workstation) */
  basePosition: THREE.Vector3;
  /** Current 3D position (updated as agent moves) */
  currentPosition?: THREE.Vector3;
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
    background: 0xe8f4fc,    // Light blue sky - Apple style
    fog: 0xe8f4fc,
    wallColor: 0xf5f5f7,     // Apple's signature light gray
    floorColor: 0x8a8a8a,    // Modern concrete gray
    ambientIntensity: 0.7,
    sunIntensity: 1.2,
  },
  night: {
    background: 0x0a0a12,
    fog: 0x0a0a12,
    wallColor: 0x1a1a1f,
    floorColor: 0x1a1a20,
    ambientIntensity: 0.15,
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
  /** Per-project token distribution (computed client-side) */
  tokensByProject?: TokenDistribution[];
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
 * Boss mode navigation mode
 */
export type BossModeType = 'auto' | 'manual';

/**
 * Boss mode target - agent or special location
 */
export interface BossModeTarget {
  id: string;
  name: string;
  type: 'agent' | 'npc' | 'location';
  position: { x: number; y: number; z: number };
}

/**
 * Boss mode auto-tour state
 */
export interface BossModeState {
  isActive: boolean;
  mode: BossModeType;
  currentTargetIndex: number;
  targets: BossModeTarget[];
  timeAtTarget: number;
  targetDuration: number;
  /** Current orbit angle in radians for 360-degree rotation */
  orbitAngle: number;
  /** Orbit radius around target */
  orbitRadius: number;
  /** Orbit height above target */
  orbitHeight: number;
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
    DEFAULT_POSITION: { x: -28, y: 22, z: -18 },  // CCTV-style from upper floor corner (Overview mode)
    FOV: 60,
    NEAR: 0.1,
    FAR: 150,  // Increased for taller building
    LOOK_SENSITIVITY: 0.002,
    MIN_PITCH: -Math.PI / 2 + 0.1,
    MAX_PITCH: Math.PI / 2 - 0.1,
    MOVE_SPEED: 15,
    ZOOM_SPEED: 0.5,
    MOUSE_SENSITIVITY: 0.005,
    TOUCH_SENSITIVITY: 0.008,
  },
  /** Agent/robot configuration */
  AGENT: {
    ROBOT_SCALE: 0.5,
    WORKSTATION_OFFSET: 0.8,  // Matches chair position at z=0.8 relative to workstation
    ANIMATION_FADE_DURATION: 0.5,
  },
  /** Wall dimensions - expanded factory with tall ceiling (2-3 floors) */
  WALLS: {
    HEIGHT: 12,     // Tall ceiling like Apple store (3 floors)
    THICKNESS: 0.3,
    BACK_X: -32,    // Expanded from -26
    LEFT_Z: -22,    // Expanded from -18
    RIGHT_Z: 22,    // Expanded from 18
    FRONT_X: 32,    // Expanded from 26
  },
  /** Interaction zones - positioned at edges with clearance from walls and office zones */
  BREAK_ROOM: {
    POSITION: { x: -26, y: 0, z: -14 },  // Far left, back area
  },
  POKER_TABLE: {
    POSITION: { x: 26, y: 0, z: -14 },  // Far right, back area
  },
  /** Stage for dancing/singing - right side, facing agents */
  STAGE: {
    POSITION: { x: 26, y: 0, z: 4 },  // Right side, facing left towards agents
    WIDTH: 8,
    DEPTH: 5,
    HEIGHT: 0.4,
    ROTATION: -Math.PI / 2,  // Rotated to face left (towards agents)
    /** Audience viewing positions in front of stage */
    AUDIENCE_POSITIONS: [
      { x: 18, z: 2 },
      { x: 18, z: 6 },
      { x: 20, z: 0 },
      { x: 20, z: 4 },
      { x: 20, z: 8 },
    ],
  },
  /** Lounge with couches for sleeping/sitting - left front corner */
  LOUNGE: {
    POSITION: { x: -26, y: 0, z: 14 },  // Far left, front area
    COUCH_POSITIONS: [
      { x: -2, z: 0, rotation: Math.PI / 2 },
      { x: 2, z: 0, rotation: -Math.PI / 2 },
    ],
  },
  /** Mini kitchen with snacks/food - left corridor, between lounge (couches) and break room (circle table) */
  KITCHEN: {
    POSITION: { x: -27, y: 0, z: 3 },  // By the window, left wall corridor between lounge and break room
    /** Seat positions relative to kitchen center (bar stools facing counter) */
    SEAT_POSITIONS: [
      { x: -1, z: 1.8, rotation: Math.PI },
      { x: 0, z: 1.8, rotation: Math.PI },
      { x: 1, z: 1.8, rotation: Math.PI },
      { x: -0.5, z: -1.8, rotation: 0 },
      { x: 0.5, z: -1.8, rotation: 0 },
    ],
  },
  /** Animation timing */
  ANIMATION: {
    FOCUS_DURATION: 1500,
    BOSS_MODE_INTERVAL: 8000,
    BOSS_MODE_TRANSITION: 2000, // Camera transition duration in ms
  },
  /** Pet timing and movement */
  PET: {
    TIMING: {
      INITIAL_IDLE_DURATION: 2,    // seconds - first idle is longer
      IDLE_DURATION: 1.5,          // seconds - subsequent idles
      WALK_DURATION: 2.5,          // seconds - walking between waypoints
    },
    MOVEMENT: {
      STUCK_CHECK_ATTEMPTS: 10,    // Max attempts to find valid wander target
    },
  },
  /** Speech bubble configuration */
  SPEECH_BUBBLE: {
    CHAR_WIDTH: 0.12,
    MIN_WIDTH: 2.0,
    MAX_WIDTH: 5.0,
    PADDING: 0.6,
    HEIGHT: 0.7,
    BORDER_RADIUS: 0.12,
    FLOAT_AMPLITUDE: 0.03,
    FLOAT_FREQUENCY: 1.5,
  },
  /** API polling */
  API: {
    POLL_INTERVAL: 5000,
    USAGE_POLL_INTERVAL: 30000,
  },
  /** Movement and interaction constants shared across agent/NPC components */
  MOVEMENT: {
    /** Distance at which a character is considered to have arrived at target */
    ARRIVAL_DISTANCE: 0.5,
    /** Movement distance below this threshold per tick means the entity is stuck */
    STUCK_THRESHOLD: 0.01,
    /** Minimum distance from target to consider stuck (avoids false positives near target) */
    STUCK_MIN_DISTANCE: 2,
    /** Interpolation speed for smooth Y-axis rotation */
    ROTATION_LERP_SPEED: 5,
    /** Default crossfade duration for animation transitions (seconds) */
    ANIMATION_FADE_DURATION: 0.3,
    /** Y offset for seated position on couches */
    COUCH_SEAT_HEIGHT: 0.35,
  },
  /** Circle indicator under entities for hover/select feedback */
  CIRCLE_INDICATOR: {
    RADIUS_DEFAULT: 0.7,
    RADIUS_ACTIVE: 0.85,
    SEGMENTS: 32,
    Y_OFFSET: 0.1,
  },
  /** Outdoor recreation - pickleball court position (in front of building, left side) */
  PICKLEBALL: {
    POSITION: { x: -18, y: 0, z: 42 },
  },
  /** Outdoor recreation - golf putting green position (in front of building, right side) */
  GOLF: {
    POSITION: { x: 18, y: 0, z: 42 },
  },
  /** Outdoor recreation - park bench positions along walkway */
  OUTDOOR_BENCH: {
    POSITIONS: [
      { x: -4, z: 30, rotation: Math.PI / 2 },
      { x: 4, z: 30, rotation: -Math.PI / 2 },
      { x: -4, z: 36, rotation: Math.PI / 2 },
      { x: 4, z: 36, rotation: -Math.PI / 2 },
    ],
  },
  /** NPC entity IDs */
  NPC_IDS: {
    STEVE_JOBS: 'steve-jobs-npc',
    SUNDAR_PICHAI: 'sundar-pichai-npc',
    ELON_MUSK: 'elon-musk-npc',
    MARK_ZUCKERBERG: 'mark-zuckerberg-npc',
    JENSEN_HUANG: 'jensen-huang-npc',
    STEVE_HUANG: 'steve-huang-npc',
  },
  /** Conveyor belt and proximity settings */
  CONVEYOR: {
    /** Z-coordinate of the conveyor belt */
    BELT_Z: -14,
    /** Distance threshold for conveyor proximity reaction */
    PROXIMITY_THRESHOLD: 4,
  },
} as const;

// ====== SPEECH BUBBLE THEMES ======

/**
 * Speech bubble visual themes for different contexts.
 */
export const SPEECH_BUBBLE_THEMES = {
  work: {
    bgColor: 0x1a1a2e,
    borderColor: 0x4a90d9,
    textColor: '#ffffff',
    dotColor: 0x4ade80,
    bgOpacity: 0.92,
    borderOpacity: 0.3,
  },
  conversation: {
    bgColor: 0xffffff,
    borderColor: 0xcccccc,
    textColor: '#222222',
    dotColor: 0x4a90d9,
    bgOpacity: 0.92,
    borderOpacity: 0.3,
  },
} as const;

export type SpeechBubbleVariant = keyof typeof SPEECH_BUBBLE_THEMES;

// ====== PET CONFIGURATION TYPES ======

/**
 * Wander area bounds for a pet.
 */
export interface WanderBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Configuration for a pet type.
 */
export interface PetConfig {
  /** Path to the GLB model */
  modelPath: string;
  /** Scale factor for the model */
  scale: number;
  /** Walking speed (units per second) */
  walkSpeed: number;
  /** Running speed (units per second) */
  runSpeed: number;
  /** Y offset for ground placement */
  groundOffset: number;
  /** Model rotation [x, y, z] in radians (for fixing model orientation) */
  modelRotation?: [number, number, number];
  /** Custom wander bounds (optional - uses factory bounds if not set) */
  wanderBounds?: WanderBounds;
  /** Animation names (optional - uses procedural if not available) */
  animations?: {
    idle?: string;
    walk?: string;
    run?: string;
    sit?: string;
  };
}

/**
 * Model paths - Local models in public/models/
 *
 * Organized into categories:
 * - employees/  - Animal agents (workstation workers)
 * - guests/     - NPC visitors
 * - pets/       - Pet animals (dogs, etc.)
 * - objects/    - Non-character items
 */
export const MODEL_PATHS = {
  // Employees - Animal agents
  ROBOT: '/models/employees/robot/RobotExpressive.glb',
  COW: '/models/employees/cow/cow-fixed.glb?v=3',
  HORSE: '/models/employees/horse/horse-fixed.glb',
  TIGER: '/models/employees/tiger/tiger-fixed.glb',
  RABBIT: '/models/employees/rabbit/rabbit-fixed.glb',
  // Guests - NPC visitors
  STEVE_JOBS: '/models/guests/stevejobs/model.glb',
  SUNDAR_PICHAI: '/models/guests/sundarpichai/model.glb',
  ELON_MUSK: '/models/guests/elonmusk/model.glb',
  MARK_ZUCKERBERG: '/models/guests/markzuckerberg/model.glb',
  JENSEN_HUANG: '/models/guests/jensenhuang/model.glb?v=2',
  STEVE_HUANG: '/models/guests/stevehuang/model.glb?v=2',
  // Pets - Dog companions
  BULLDOG: '/models/pets/bulldog/model.glb',
  PUPPY: '/models/pets/puppy/model.glb',
  ROBOTIC_DOG: '/models/pets/roboticdog/original.glb',
  SHIBA_INU: '/models/pets/shibainu/model.glb',
  // Objects
  CYBERTRUCK: '/models/objects/cybertruck/model.glb',
} as const;

/**
 * Animation name mappings for different models
 */
export const ANIMATION_NAMES = {
  /** Cow model animation names from Mixamo */
  COW: {
    IDLE: 'Idle',
    WALKING: 'Walking',
    TYPING: 'Typing',
    SITTING: 'Sitting',
    DANCE: 'Dance',
  },
  /** Horse model animation names from Mixamo */
  HORSE: {
    IDLE: 'Breathing idle',
    WALKING: 'Walking',
    TYPING: 'Typing',
    SITTING: 'Sitting',
    TALKING: 'Talking',
  },
  /** Tiger model animation names from Mixamo */
  TIGER: {
    IDLE: 'Breathing idle',
    WALKING: 'Running',
    TYPING: 'Typing',
    SITTING: 'Sitting',
    DANCE: 'Salsa dancing',
  },
  /** Rabbit model animation names from Mixamo */
  RABBIT: {
    IDLE: 'Sitting',
    WALKING: 'Walking',
    TYPING: 'Pilot flips switches',
    SITTING: 'Sitting',
    DANCE: 'Salsa dancing',
    JUMP: 'Jumping',
  },
  /** Robot model animation names */
  ROBOT: {
    IDLE: 'Idle',
    WALKING: 'Walking',
    DANCE: 'Dance',
    WAVE: 'Wave',
    YES: 'Yes',
    NO: 'No',
  },
  /**
   * Pet animation names - actual GLB animation names
   * Models without animations use procedural animation fallback in BasePet.tsx
   */
  BULLDOG: {
    // No animations in model - uses procedural animation
    HAS_ANIMATIONS: false,
  },
  PUPPY: {
    // Actual animation names from Armature|PuppyALL_* set
    HAS_ANIMATIONS: true,
    IDLE: 'Armature|PuppyALL_IdleEnergetic',
    WALKING: 'Armature|PuppyALL_Walk',
    RUNNING: 'Armature|PuppyALL_Run',
    SITTING: 'Armature|PuppyALL_IdleLayDown',
  },
  ROBOTIC_DOG: {
    // C4D camera/object animations only - uses procedural animation
    HAS_ANIMATIONS: false,
  },
  SHIBA_INU: {
    // Actual animation names from 0|0|* set (no walk/run animations)
    HAS_ANIMATIONS: true,
    IDLE: '0|0|standing_0',
    SITTING: '0|0|sitting_0',
    SHAKE: '0|0|shake_0',
    ROLLOVER: '0|0|rollover_0',
    PLAY_DEAD: '0|0|play_dead_0',
  },
} as const;
