/**
 * Factory Context - State management for the 3D factory visualization.
 *
 * Provides centralized state for agents, zones, camera, lighting, and boss mode.
 * Follows the same pattern as SidebarContext for consistency.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import * as THREE from 'three';
import {
  FactoryAgent,
  OfficeZone,
  CameraState,
  LightingMode,
  BossModeState,
  BossModeTarget,
  BossModeType,
  FactoryStats,
  CameraFocusTarget,
  FACTORY_CONSTANTS,
  ZONE_COLORS,
} from '../types/factory.types';
import type { EntityCommand } from '../components/Factory3D/Agents/agentPlanTypes';
import { factoryService } from '../services/factory.service';
import {
  getAnimalTypeForProject,
  isNightTime,
  createInitialCameraState,
} from '../utils/factory.utils';
import { buildEntityPositionMap } from '../utils/factoryCollision';

// ====== PROXIMITY CONVERSATION CONSTANTS ======

/** Distance threshold for triggering conversations */
const PROXIMITY_THRESHOLD = 5.0;
/** Duration before switching from greetings to small talk */
const GREETING_PHASE_MS = 5000;
/** Duration of each speaking turn during greetings */
const GREETING_TURN_MS = 2000;
/** Duration of each speaking turn during small talk */
const TALK_TURN_MS = 3500;
/** How often to check proximity */
const PROXIMITY_CHECK_MS = 500;
/** Maximum conversation turns before entities move on */
const MAX_CONVERSATION_TURNS = 10;
/** Cooldown after a conversation ends before the same pair can chat again */
const CONVERSATION_COOLDOWN_MS = 30000;

/** Quick greetings for short encounters */
const GREETINGS = [
  'Hey!', 'Hi!', 'Hello!', "What's up?", 'Hey there!',
  'Yo!', 'Hi there!', 'Howdy!', 'Sup!', "What's good?",
];

/** Office small talk conversation pairs [speaker A, speaker B] */
const SMALL_TALK_PAIRS: ReadonlyArray<[string, string]> = [
  ["How's your project going?", "Pretty good, making progress!"],
  ["Taking a break?", "Yeah, needed one!"],
  ["The boss seems happy today", "Ha, let's hope it lasts!"],
  ["Did you see that demo?", "Yeah, it was impressive!"],
  ["Coffee break?", "Always down for coffee!"],
  ["Any blockers?", "Nah, smooth sailing!"],
  ["Working late tonight?", "Hope not!"],
  ["Nice code review earlier", "Thanks, yours too!"],
  ["Tried the new API yet?", "Yeah, it's way faster!"],
  ["Stand-up was short today", "Best kind of stand-up!"],
  ["PR looks good to me", "Thanks for reviewing!"],
  ["Lunch plans?", "Thinking tacos, you in?"],
];

// ====== NPC-SPECIFIC CONVERSATION LINES ======

/** Steve Jobs greetings (used when Steve is the speaker) */
const STEVE_JOBS_GREETINGS = [
  'One more thing...', 'Hey, got a minute?', 'Think different!',
  'You know what...', "Let's talk!",
];

/** Steve Jobs small talk [Steve's line, partner's response] */
const STEVE_JOBS_SMALL_TALK: ReadonlyArray<[string, string]> = [
  ["Is it insanely great yet?", "Getting close!"],
  ["Simplicity is the ultimate sophistication", "Totally agree!"],
  ["Focus on what truly matters", "Good advice!"],
  ["Design is how it works", "So true!"],
  ["Let's put a dent in the universe", "I'm in!"],
  ["Real artists ship", "Shipping soon!"],
  ["Innovation needs courage", "You're right!"],
  ["Stay hungry, stay foolish", "Always!"],
  ["The journey is the reward", "Love that!"],
  ["Quality over quantity, always", "Agreed!"],
];

/** Sundar Pichai greetings (used when Sundar is the speaker) */
const SUNDAR_PICHAI_GREETINGS = [
  'Hey team!', 'Good to see you!', "How's everything?",
  'Quick sync?', "Let's connect!",
];

/** Sundar Pichai small talk [Sundar's line, partner's response] */
const SUNDAR_PICHAI_SMALL_TALK: ReadonlyArray<[string, string]> = [
  ["AI is reshaping everything", "It really is!"],
  ["Let's think about scale", "Good point!"],
  ["User trust is our foundation", "Absolutely!"],
  ["Have you tried Gemini yet?", "It's impressive!"],
  ["Cloud-first, always", "Makes sense!"],
  ["Openness drives innovation", "So true!"],
  ["Let's make tech accessible to all", "Great vision!"],
  ["Data tells the real story", "Facts!"],
  ["10x thinking, not 10%", "Love that mindset!"],
  ["What's the user impact?", "Significant!"],
];

/** Elon Musk greetings */
const ELON_MUSK_GREETINGS = [
  'TSLA to the moon!', 'Hey, quick question!', 'First principles!',
  'Yo, got a sec?', 'Let me tell you...',
];

/** Elon Musk small talk [Elon's line, partner's response] */
const ELON_MUSK_SMALL_TALK: ReadonlyArray<[string, string]> = [
  ["Tesla stock is up today!", "Nice, congrats!"],
  ["SpaceX launch was amazing!", "That was incredible!"],
  ["Starship blew up again...", "Oh no! Next time!"],
  ["Rapid unscheduled disassembly", "Ha, classic!"],
  ["Full self driving, almost there", "Can't wait to try it!"],
  ["We're going to Mars!", "When do we leave?"],
  ["The Cybertruck is selling!", "It's wild looking!"],
  ["X is the everything app now", "That's ambitious!"],
  ["Need to ship this 10x faster", "On it!"],
  ["Boring tunnels under the factory?", "That'd be cool!"],
];

/** Mark Zuckerberg greetings */
const MARK_ZUCKERBERG_GREETINGS = [
  'Hey, try this headset!', 'Is this VR or real?', 'Meta connect!',
  'Quick, put on Quest!', 'Open source everything!',
];

/** Mark Zuckerberg small talk [Mark's line, partner's response] */
const MARK_ZUCKERBERG_SMALL_TALK: ReadonlyArray<[string, string]> = [
  ["Have you tried Meta Quest?", "Not yet, is it good?"],
  ["The metaverse is the future!", "Interesting vision!"],
  ["Llama 4 is crushing benchmarks", "That's impressive!"],
  ["I can't see clearly, VR blur", "Maybe take the headset off?"],
  ["Everything should be in VR", "Even this meeting?"],
  ["Wait, is this real or virtual?", "It's real, Zuck!"],
  ["Open source AI wins every time", "Agreed!"],
  ["Sweet Baby Rays is the best", "Ha, you and BBQ sauce!"],
  ["Llama beats the competition", "The benchmarks look great!"],
  ["We should do this in the metaverse", "Let's stay in reality!"],
];

/** Jensen Huang greetings */
const JENSEN_HUANG_GREETINGS = [
  'GPU goes brrr!', 'Hey, need compute?', 'CUDA powers all!',
  'The more you buy...', 'Accelerated computing!',
];

/** Jensen Huang small talk [Jensen's line, partner's response] */
const JENSEN_HUANG_SMALL_TALK: ReadonlyArray<[string, string]> = [
  ["Everyone's buying our GPUs!", "Business is booming!"],
  ["NVDA stock, all time high!", "Incredible run!"],
  ["H100s are sold out again!", "The demand is insane!"],
  ["You using CUDA for this?", "Of course!"],
  ["The more you buy, more you save!", "Great sales pitch!"],
  ["AI needs more compute power", "Always more GPUs!"],
  ["Blackwell is our best chip yet", "The benchmarks are wild!"],
  ["Every data center needs us", "You're not wrong!"],
  ["Leather jacket weather today", "Looking sharp, Jensen!"],
  ["Inference at scale is everything", "Totally agree!"],
];

/** Steve Huang greetings */
const STEVE_HUANG_GREETINGS = [
  'Hey, how are things?', "What's going on?", 'Just checking in!',
  'Hey there!', 'How goes it?',
];

/** Steve Huang small talk [Steve's line, partner's response] */
const STEVE_HUANG_SMALL_TALK: ReadonlyArray<[string, string]> = [
  ["How's everything going?", "Going great, thanks!"],
  ["I built this whole factory", "It's amazing!"],
  ["AgentMux is coming along", "Looks awesome!"],
  ["Need anything from me?", "We're good, thanks!"],
  ["Just making the rounds", "Good to see you!"],
  ["The codebase is looking clean", "Thanks for the review!"],
  ["Nice weather for golf later", "Sounds fun!"],
  ["Keep up the great work", "Will do!"],
  ["Any feedback for me?", "Everything's solid!"],
  ["Love seeing the progress", "Team's crushing it!"],
];

/** Map NPC IDs to their specific conversation data */
const NPC_CONVERSATION_DATA: Record<string, { greetings: string[]; smallTalk: ReadonlyArray<[string, string]> }> = {
  'steve-jobs-npc': { greetings: STEVE_JOBS_GREETINGS, smallTalk: STEVE_JOBS_SMALL_TALK },
  'sundar-pichai-npc': { greetings: SUNDAR_PICHAI_GREETINGS, smallTalk: SUNDAR_PICHAI_SMALL_TALK },
  'elon-musk-npc': { greetings: ELON_MUSK_GREETINGS, smallTalk: ELON_MUSK_SMALL_TALK },
  'mark-zuckerberg-npc': { greetings: MARK_ZUCKERBERG_GREETINGS, smallTalk: MARK_ZUCKERBERG_SMALL_TALK },
  'jensen-huang-npc': { greetings: JENSEN_HUANG_GREETINGS, smallTalk: JENSEN_HUANG_SMALL_TALK },
  'steve-huang-npc': { greetings: STEVE_HUANG_GREETINGS, smallTalk: STEVE_HUANG_SMALL_TALK },
};

/**
 * Proximity conversation state for a single entity
 */
export interface ProximityConversation {
  /** ID of the conversation partner */
  partnerId: string;
  /** When proximity was first detected */
  startTime: number;
  /** Whether the conversation has moved to small talk phase */
  isLongDuration: boolean;
  /** The speech line this entity should currently display (null = listening) */
  currentLine: string | null;
}

// ====== CONTEXT TYPE ======

/**
 * Seat occupancy tracking - maps area name to set of entity IDs occupying seats
 */
export type SeatOccupancyMap = Map<string, Set<string>>;

interface FactoryContextType {
  /** Map of agent ID to agent data */
  agents: Map<string, FactoryAgent>;
  /** Map of project name to office zone data */
  zones: Map<string, OfficeZone>;
  /** Current camera state */
  camera: CameraState;
  /** Set camera focus target (project name or 'overview') */
  setCameraTarget: (target: CameraFocusTarget) => void;
  /** Current lighting mode */
  lightingMode: LightingMode;
  /** Update lighting mode */
  setLightingMode: (mode: LightingMode) => void;
  /** Whether it's currently night (computed from mode and time) */
  isNightMode: boolean;
  /** Boss mode auto-tour state */
  bossModeState: BossModeState;
  /** Toggle boss mode on/off */
  toggleBossMode: () => void;
  /** Set boss mode type (auto/manual) */
  setBossModeType: (mode: BossModeType) => void;
  /** Navigate to next target in boss mode */
  bossNextTarget: () => void;
  /** Navigate to previous target in boss mode */
  bossPrevTarget: () => void;
  /** Get current target name */
  getCurrentTargetName: () => string;
  /** Factory statistics */
  stats: FactoryStats;
  /** List of project names */
  projects: string[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh factory data from API */
  refreshData: () => Promise<void>;
  /** Update camera state directly */
  updateCamera: (updates: Partial<CameraState>) => void;
  /** Claim a seat in an area for an entity. Returns the seat index, or -1 if full. */
  claimSeat: (area: string, entityId: string) => number;
  /** Release a seat in an area for an entity */
  releaseSeat: (area: string, entityId: string) => void;
  /** Check if a seated area is at capacity */
  isAreaFull: (area: string) => boolean;
  /** Get the seat index for an entity in an area (-1 if not seated) */
  getSeatIndex: (area: string, entityId: string) => number;
  /** Get the current seat occupancy count for an area */
  getSeatOccupancy: () => Record<string, number>;
  /** Claim the stage for a performer. Returns true if successful. */
  claimStage: (entityId: string) => boolean;
  /** Release the stage */
  releaseStage: (entityId: string) => void;
  /** Check if the stage is occupied */
  isStageOccupied: () => boolean;
  /** Get the current stage performer ID (null if empty) */
  getStagePerformerId: () => string | null;
  /** Ref to the stage performer ID (for synchronous reads in useFrame) */
  stagePerformerRef: React.MutableRefObject<string | null>;
  /** Ref to seat occupancy map (for synchronous reads in useFrame) */
  seatOccupancyRef: React.MutableRefObject<SeatOccupancyMap>;
  /** Update an agent's current position (called by agent components) */
  updateAgentPosition: (agentId: string, position: THREE.Vector3) => void;
  /** Update an NPC's current position (called by NPC components) */
  updateNpcPosition: (npcId: string, position: THREE.Vector3) => void;
  /** Map of NPC ID to current position */
  npcPositions: Map<string, THREE.Vector3>;
  /** Currently hovered entity ID (agent or NPC) */
  hoveredEntityId: string | null;
  /** Currently selected entity ID (agent or NPC) */
  selectedEntityId: string | null;
  /** Set the hovered entity (null to clear) */
  setHoveredEntity: (id: string | null) => void;
  /** Select an entity - activates boss mode manual and focuses camera */
  selectEntity: (id: string) => void;
  /** Clear the current selection and exit boss mode */
  clearSelection: () => void;
  /** Active proximity conversations keyed by entity ID */
  entityConversations: Map<string, ProximityConversation>;
  /** Send a command to override an entity's current plan */
  sendEntityCommand: (entityId: string, command: EntityCommand) => void;
  /** Consume (read + delete) a pending command for an entity. Used in useFrame loops. */
  consumeEntityCommand: (entityId: string) => EntityCommand | null;
  /** Pre-built entity position map for collision checks (updated each render, read from useFrame) */
  entityPositionMapRef: React.MutableRefObject<Map<string, { x: number; z: number }>>;
  /** Whether freestyle mode is active (allows moving selected entity by double-clicking) */
  freestyleMode: boolean;
  /** Set the move target for the selected entity in freestyle mode */
  setFreestyleMoveTarget: (target: { x: number; z: number }) => void;
  /** Whether NPC agents (fake audience) are visible */
  showNPCAgents: boolean;
  /** Toggle NPC agents visibility */
  setShowNPCAgents: (show: boolean) => void;
  /** Whether guest agents (celebrity NPCs) are visible */
  showGuestAgents: boolean;
  /** Toggle guest agents visibility */
  setShowGuestAgents: (show: boolean) => void;
  /** Whether additional objects (Cybertruck, etc.) are visible */
  showObjects: boolean;
  /** Toggle objects visibility */
  setShowObjects: (show: boolean) => void;
}

// ====== CONTEXT ======

const FactoryContext = createContext<FactoryContextType | undefined>(undefined);

// ====== PROVIDER ======

interface FactoryProviderProps {
  children: ReactNode;
}

/**
 * Provider component for Factory context.
 * Manages all factory visualization state and API polling.
 *
 * @param children - Child components that need access to factory state
 * @returns JSX element wrapping children with factory context
 */
export const FactoryProvider: React.FC<FactoryProviderProps> = ({ children }) => {
  // Agent and zone state
  const [agents, setAgents] = useState<Map<string, FactoryAgent>>(new Map());
  const [zones, setZones] = useState<Map<string, OfficeZone>>(new Map());
  const [projects, setProjects] = useState<string[]>([]);

  // Camera state
  const [camera, setCamera] = useState<CameraState>(createInitialCameraState);

  // Lighting state
  const [lightingMode, setLightingMode] = useState<LightingMode>('day');

  // Boss mode state
  const [bossModeState, setBossModeState] = useState<BossModeState>({
    isActive: false,
    mode: 'auto',
    currentTargetIndex: 0,
    targets: [],
    timeAtTarget: 0,
    targetDuration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL,
    orbitAngle: 0,
    orbitRadius: 6,
    orbitHeight: 4,
  });

  // Loading and error state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Seat occupancy ref - tracks which seats are taken at each area (no re-renders)
  const seatOccupancyRef = useRef<SeatOccupancyMap>(new Map([
    ['couch', new Set<string>()],
    ['break_room', new Set<string>()],
    ['poker_table', new Set<string>()],
    ['kitchen', new Set<string>()],
  ]));

  // Stage performer ref - tracks who is currently performing (no re-renders)
  const stagePerformerRef = useRef<string | null>(null);

  /** Seat capacity limits per area */
  const SEAT_CAPACITY: Record<string, number> = {
    couch: 2,
    break_room: 4,
    poker_table: 4,
    kitchen: 5,
  };

  // NPC positions state - tracks current positions of NPCs for boss mode
  const [npcPositions, setNpcPositions] = useState<Map<string, THREE.Vector3>>(new Map());

  // Hover and selection state
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Freestyle mode state - allows moving selected entity by double-clicking
  const [freestyleMode] = useState(false);
  const freestyleMoveTargetRef = useRef<{ x: number; z: number } | null>(null);

  // Visibility toggles state
  const [showNPCAgents, setShowNPCAgents] = useState(true);
  const [showGuestAgents, setShowGuestAgents] = useState(true);
  const [showObjects, setShowObjects] = useState(true);

  // Proximity conversation state
  const [entityConversations, setEntityConversations] = useState<Map<string, ProximityConversation>>(new Map());

  // Entity command channel - ref-based for synchronous consumption in useFrame
  const entityCommandRef = useRef<Map<string, EntityCommand>>(new Map());

  /**
   * Queue a command for an entity, overriding its current plan
   */
  const sendEntityCommand = useCallback((entityId: string, command: EntityCommand) => {
    entityCommandRef.current.set(entityId, command);
  }, []);

  /**
   * Consume (read + delete) a pending command for an entity.
   * Called from entity useFrame loops.
   */
  const consumeEntityCommand = useCallback((entityId: string): EntityCommand | null => {
    const command = entityCommandRef.current.get(entityId) ?? null;
    if (command) {
      entityCommandRef.current.delete(entityId);
    }
    return command;
  }, []);

  /**
   * Set the move target for the selected entity in freestyle mode
   */
  const setFreestyleMoveTarget = useCallback((target: { x: number; z: number }) => {
    freestyleMoveTargetRef.current = target;
  }, []);

  // Computed night mode based on lighting mode and time
  const isNightMode = useMemo(() => {
    if (lightingMode === 'day') return false;
    if (lightingMode === 'night') return true;
    return isNightTime();
  }, [lightingMode]);

  // Computed stats
  const stats = useMemo<FactoryStats>(() => {
    let activeCount = 0;
    let idleCount = 0;
    let dormantCount = 0;
    let totalTokens = 0;
    const projectTokenMap = new Map<string, number>();

    agents.forEach((agent) => {
      switch (agent.status) {
        case 'active':
          activeCount++;
          break;
        case 'idle':
          idleCount++;
          break;
        case 'dormant':
          dormantCount++;
          break;
      }
      totalTokens += agent.sessionTokens;
      projectTokenMap.set(
        agent.projectName,
        (projectTokenMap.get(agent.projectName) || 0) + agent.sessionTokens,
      );
    });

    // Build per-project token distribution sorted by tokens descending
    const tokensByProject = Array.from(projectTokenMap.entries())
      .map(([projectName, tokens], i) => {
        const zone = zones.get(projectName);
        return {
          projectName,
          tokens,
          color: zone?.color || ZONE_COLORS[i % ZONE_COLORS.length],
        };
      })
      .sort((a, b) => b.tokens - a.tokens);

    return { activeCount, idleCount, dormantCount, totalTokens, tokensByProject };
  }, [agents, zones]);

  /**
   * Fetches factory state from API and updates local state
   */
  const refreshData = useCallback(async () => {
    try {
      const state = await factoryService.getFactoryState();

      // Create zones from unique projects
      const newZones = new Map<string, OfficeZone>();

      // Collect unique project names and sort alphabetically for consistent zone positions
      const projectNames = [...new Set(state.agents.map((a) => a.projectName))].sort();

      // Create zones in alphabetical order
      projectNames.forEach((projectName, zoneIndex) => {
        // Calculate zone position
        const zonesPerRow = FACTORY_CONSTANTS.ZONE.ZONES_PER_ROW;
        const row = Math.floor(zoneIndex / zonesPerRow);
        const col = zoneIndex % zonesPerRow;

        const zoneX =
          FACTORY_CONSTANTS.ZONE.START_X +
          col * (FACTORY_CONSTANTS.ZONE.WIDTH + FACTORY_CONSTANTS.ZONE.GAP_X);
        const zoneZ =
          FACTORY_CONSTANTS.ZONE.START_Z -
          row * (FACTORY_CONSTANTS.ZONE.DEPTH + FACTORY_CONSTANTS.ZONE.GAP_Z);

        newZones.set(projectName, {
          projectName,
          zoneIndex,
          zoneX,
          zoneZ,
          color: ZONE_COLORS[zoneIndex % ZONE_COLORS.length],
          workstations: FACTORY_CONSTANTS.WORKSTATION_POSITIONS.map((pos, i) => ({
            position: { x: zoneX + pos.x, z: zoneZ + pos.z },
            index: zoneIndex * 4 + i,
            isActive: false,
          })),
        });
      });

      // Create agents with positions
      const newAgents = new Map<string, FactoryAgent>();
      const projectAgentCounts = new Map<string, number>();

      state.agents.forEach((agentData) => {
        const zone = newZones.get(agentData.projectName);
        if (!zone) return;

        const agentIndex = projectAgentCounts.get(agentData.projectName) || 0;
        projectAgentCounts.set(agentData.projectName, agentIndex + 1);

        const workstationIndex = agentIndex % 4;
        const workstation = zone.workstations[workstationIndex];
        if (!workstation) return;

        workstation.assignedAgentId = agentData.id;
        workstation.isActive = agentData.status === 'active';

        const agent: FactoryAgent = {
          id: agentData.id,
          projectName: agentData.projectName,
          status: agentData.status,
          cpuPercent: agentData.cpuPercent,
          activity: agentData.activity,
          sessionTokens: agentData.sessionTokens || 0,
          zoneIndex: zone.zoneIndex,
          workstationIndex,
          animalType: getAnimalTypeForProject(agentData.projectName, agentIndex),
          basePosition: new THREE.Vector3(
            workstation.position.x,
            0,
            workstation.position.z + 0.45
          ),
          sessionName: agentData.sessionName,
          name: agentData.name,
        };

        newAgents.set(agentData.id, agent);
      });

      setZones(newZones);
      setAgents(newAgents);
      setProjects(projectNames);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch factory state');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sets the camera focus target
   *
   * @param target - Project name to focus on, or 'overview' for default view
   */
  const setCameraTarget = useCallback((target: CameraFocusTarget) => {
    // Calculate target position and look-at based on target
    if (target === 'overview') {
      // CCTV-style view from upper floor corner, looking down diagonally
      // Position in back-left corner of upper floor, high up
      setCamera((prev) => ({
        ...prev,
        isAnimating: true,
        animationTarget: {
          position: new THREE.Vector3(-28, 22, -18), // Upper floor corner (inside building bounds)
          lookAt: new THREE.Vector3(15, 2, 10), // Looking diagonally down at ground floor
          duration: FACTORY_CONSTANTS.ANIMATION.FOCUS_DURATION,
          startTime: Date.now(),
          startPosition: prev.position.clone(),
          startLookAt: prev.target.clone(),
        },
      }));
    } else if (target === 'birdseye') {
      // Bird's eye view - high above with slight angle to see the factory floor
      setCamera((prev) => ({
        ...prev,
        isAnimating: true,
        animationTarget: {
          position: new THREE.Vector3(0, 40, 15), // High above, slightly in front
          lookAt: new THREE.Vector3(-5, 0, -5), // Looking at factory center
          duration: FACTORY_CONSTANTS.ANIMATION.FOCUS_DURATION,
          startTime: Date.now(),
          startPosition: prev.position.clone(),
          startLookAt: prev.target.clone(),
        },
      }));
    } else if (target === 'outdoor') {
      // Outdoor view - from outside looking at the building front with neon logo
      // Building front is at z=22, logo is at height ~21 (totalHeight - 3)
      setCamera((prev) => ({
        ...prev,
        isAnimating: true,
        animationTarget: {
          position: new THREE.Vector3(0, 18, 55), // In front of building, elevated
          lookAt: new THREE.Vector3(0, 18, 22), // Looking at the neon sign on front
          duration: FACTORY_CONSTANTS.ANIMATION.FOCUS_DURATION,
          startTime: Date.now(),
          startPosition: prev.position.clone(),
          startLookAt: prev.target.clone(),
        },
      }));
    } else {
      // Find zone for project
      const zone = zones.get(target);
      if (zone) {
        const targetPosition = new THREE.Vector3(
          zone.zoneX - 8,
          8,
          zone.zoneZ + 8
        );
        const lookAt = new THREE.Vector3(zone.zoneX, 0.5, zone.zoneZ);

        setCamera((prev) => ({
          ...prev,
          isAnimating: true,
          animationTarget: {
            position: targetPosition,
            lookAt,
            duration: FACTORY_CONSTANTS.ANIMATION.FOCUS_DURATION,
            startTime: Date.now(),
            startPosition: prev.position.clone(),
            startLookAt: prev.target.clone(),
          },
        }));
      }
    }
  }, [zones]);

  /**
   * Updates camera state directly
   *
   * @param updates - Partial camera state to merge
   */
  const updateCamera = useCallback((updates: Partial<CameraState>) => {
    setCamera((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Generate boss mode targets from current agents + Steve Jobs NPC
   */
  const generateBossModeTargets = useCallback((): BossModeTarget[] => {
    const targets: BossModeTarget[] = [];

    // Add all agents as targets - use currentPosition if available, fallback to basePosition
    agents.forEach((agent) => {
      const pos = agent.currentPosition || agent.basePosition;
      targets.push({
        id: agent.id,
        name: agent.name || agent.sessionName || agent.id,
        type: 'agent',
        position: {
          x: pos.x,
          y: pos.y,
          z: pos.z,
        },
      });
    });

    // Add Steve Jobs NPC as a target (use tracked position or default)
    const stevePos = npcPositions.get('steve-jobs-npc');
    targets.push({
      id: 'steve-jobs-npc',
      name: 'Steve Jobs',
      type: 'npc',
      position: stevePos
        ? { x: stevePos.x, y: stevePos.y, z: stevePos.z }
        : { x: 0, y: 0, z: 5 },
    });

    // Add Sundar Pichai NPC as a target (use tracked position or default)
    const sundarPos = npcPositions.get('sundar-pichai-npc');
    targets.push({
      id: 'sundar-pichai-npc',
      name: 'Sundar Pichai',
      type: 'npc',
      position: sundarPos
        ? { x: sundarPos.x, y: sundarPos.y, z: sundarPos.z }
        : { x: 10, y: 0, z: 0 },
    });

    // Add Jensen Huang NPC as a target
    const jensenPos = npcPositions.get('jensen-huang-npc');
    targets.push({
      id: 'jensen-huang-npc',
      name: 'Jensen Huang',
      type: 'npc',
      position: jensenPos
        ? { x: jensenPos.x, y: jensenPos.y, z: jensenPos.z }
        : { x: -5, y: 0, z: 5 },
    });

    // Add Elon Musk NPC as a target
    const elonPos = npcPositions.get('elon-musk-npc');
    targets.push({
      id: 'elon-musk-npc',
      name: 'Elon Musk',
      type: 'npc',
      position: elonPos
        ? { x: elonPos.x, y: elonPos.y, z: elonPos.z }
        : { x: 4, y: 0, z: 50 },
    });

    // Add Mark Zuckerberg NPC as a target
    const markPos = npcPositions.get('mark-zuckerberg-npc');
    targets.push({
      id: 'mark-zuckerberg-npc',
      name: 'Mark Zuckerberg',
      type: 'npc',
      position: markPos
        ? { x: markPos.x, y: markPos.y, z: markPos.z }
        : { x: 18, y: 0, z: 38 },
    });

    // Add Steve Huang NPC as a target
    const steveHuangPos = npcPositions.get('steve-huang-npc');
    targets.push({
      id: 'steve-huang-npc',
      name: 'Steve Huang',
      type: 'npc',
      position: steveHuangPos
        ? { x: steveHuangPos.x, y: steveHuangPos.y, z: steveHuangPos.z }
        : { x: 16, y: 0, z: 44 },
    });

    // Add fake audience members as targets
    const audiencePositions = FACTORY_CONSTANTS.STAGE.AUDIENCE_POSITIONS;
    audiencePositions.forEach((_, idx) => {
      const audienceId = `fake-audience-${idx}`;
      const audiencePos = npcPositions.get(audienceId);
      targets.push({
        id: audienceId,
        name: `Audience ${idx + 1}`,
        type: 'npc',
        position: audiencePos
          ? { x: audiencePos.x, y: audiencePos.y, z: audiencePos.z }
          : { x: audiencePositions[idx].x, y: 0, z: audiencePositions[idx].z },
      });
    });

    return targets;
  }, [agents, npcPositions]);

  /**
   * Focus camera on a boss mode target
   */
  const focusOnBossModeTarget = useCallback((target: BossModeTarget) => {
    // Use wider offset for NPC targets (taller models need more camera distance)
    const isNpc = target.type === 'npc';
    const cameraOffset = isNpc
      ? { x: -7, y: 7, z: 7 }
      : { x: -4, y: 4, z: 4 };
    const newPosition = new THREE.Vector3(
      target.position.x + cameraOffset.x,
      target.position.y + cameraOffset.y,
      target.position.z + cameraOffset.z
    );
    const lookAt = new THREE.Vector3(
      target.position.x,
      target.position.y + 1.5, // Look at agent head height
      target.position.z
    );

    setCamera((prev) => ({
      ...prev,
      isAnimating: true,
      animationTarget: {
        position: newPosition,
        lookAt,
        duration: 1500,
        startTime: Date.now(),
        startPosition: prev.position.clone(),
        startLookAt: prev.target.clone(),
      },
    }));
  }, []);

  /**
   * Toggles boss mode auto-tour
   */
  const toggleBossMode = useCallback(() => {
    setBossModeState((prev) => {
      if (prev.isActive) {
        // Turning off - reset to overview
        setCameraTarget('overview');
        return {
          ...prev,
          isActive: false,
          targets: [],
          orbitAngle: 0,
        };
      } else {
        // Turning on - generate targets from agents + Steve Jobs
        const targets = generateBossModeTargets();
        return {
          isActive: true,
          mode: 'auto',
          currentTargetIndex: 0,
          targets,
          timeAtTarget: 0,
          targetDuration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL,
          orbitAngle: 0,
          orbitRadius: 6,
          orbitHeight: 4,
        };
      }
    });
  }, [generateBossModeTargets, setCameraTarget]);

  /**
   * Set boss mode type (auto/manual)
   */
  const setBossModeType = useCallback((mode: BossModeType) => {
    setBossModeState((prev) => ({ ...prev, mode }));
  }, []);

  /**
   * Navigate to next target in boss mode
   */
  const bossNextTarget = useCallback(() => {
    setBossModeState((prev) => {
      if (!prev.isActive || prev.targets.length === 0) return prev;
      const nextIndex = (prev.currentTargetIndex + 1) % prev.targets.length;
      return {
        ...prev,
        currentTargetIndex: nextIndex,
        orbitAngle: 0, // Reset orbit angle for new target
        timeAtTarget: 0,
      };
    });
  }, []);

  /**
   * Navigate to previous target in boss mode
   */
  const bossPrevTarget = useCallback(() => {
    setBossModeState((prev) => {
      if (!prev.isActive || prev.targets.length === 0) return prev;
      const prevIndex = prev.currentTargetIndex === 0
        ? prev.targets.length - 1
        : prev.currentTargetIndex - 1;
      return {
        ...prev,
        currentTargetIndex: prevIndex,
        orbitAngle: 0, // Reset orbit angle for new target
        timeAtTarget: 0,
      };
    });
  }, []);

  /**
   * Get current target name
   */
  const getCurrentTargetName = useCallback((): string => {
    if (!bossModeState.isActive || bossModeState.targets.length === 0) {
      return '';
    }
    return bossModeState.targets[bossModeState.currentTargetIndex]?.name || '';
  }, [bossModeState]);

  /**
   * Claim a seat in an area for an entity.
   * Returns the seat index (0-based), or -1 if the area is full.
   */
  const claimSeat = useCallback((area: string, entityId: string): number => {
    const seats = seatOccupancyRef.current.get(area);
    if (!seats) return -1;
    // Already claimed
    if (seats.has(entityId)) {
      return Array.from(seats).indexOf(entityId);
    }
    const capacity = SEAT_CAPACITY[area] ?? 0;
    if (seats.size >= capacity) return -1;
    seats.add(entityId);
    return Array.from(seats).indexOf(entityId);
  }, []);

  /**
   * Release a seat in an area for an entity
   */
  const releaseSeat = useCallback((area: string, entityId: string): void => {
    const seats = seatOccupancyRef.current.get(area);
    if (seats) {
      seats.delete(entityId);
    }
  }, []);

  /**
   * Check if a seated area is at capacity
   */
  const isAreaFull = useCallback((area: string): boolean => {
    const seats = seatOccupancyRef.current.get(area);
    if (!seats) return true;
    return seats.size >= (SEAT_CAPACITY[area] ?? 0);
  }, []);

  /**
   * Get the seat index for an entity in an area (-1 if not seated)
   */
  const getSeatIndex = useCallback((area: string, entityId: string): number => {
    const seats = seatOccupancyRef.current.get(area);
    if (!seats || !seats.has(entityId)) return -1;
    return Array.from(seats).indexOf(entityId);
  }, []);

  /**
   * Get current seat occupancy counts for plan generation
   */
  const getSeatOccupancy = useCallback((): Record<string, number> => {
    const result: Record<string, number> = {};
    seatOccupancyRef.current.forEach((seats, area) => {
      result[area] = seats.size;
    });
    return result;
  }, []);

  /**
   * Claim the stage for a performer. Returns true if successful.
   */
  const claimStage = useCallback((entityId: string): boolean => {
    if (stagePerformerRef.current !== null && stagePerformerRef.current !== entityId) {
      return false;
    }
    stagePerformerRef.current = entityId;
    return true;
  }, []);

  /**
   * Release the stage
   */
  const releaseStage = useCallback((entityId: string): void => {
    if (stagePerformerRef.current === entityId) {
      stagePerformerRef.current = null;
    }
  }, []);

  /**
   * Check if the stage is occupied
   */
  const isStageOccupied = useCallback((): boolean => {
    return stagePerformerRef.current !== null;
  }, []);

  /**
   * Get the current stage performer ID
   */
  const getStagePerformerId = useCallback((): string | null => {
    return stagePerformerRef.current;
  }, []);

  /**
   * Update an agent's current position (called by agent components during animation)
   */
  const updateAgentPosition = useCallback((agentId: string, position: THREE.Vector3) => {
    setAgents((prev) => {
      const agent = prev.get(agentId);
      if (!agent) return prev;

      // Only update if position has changed significantly (avoid unnecessary updates)
      const currentPos = agent.currentPosition;
      if (currentPos &&
          Math.abs(currentPos.x - position.x) < 0.01 &&
          Math.abs(currentPos.y - position.y) < 0.01 &&
          Math.abs(currentPos.z - position.z) < 0.01) {
        return prev;
      }

      const newAgents = new Map(prev);
      newAgents.set(agentId, {
        ...agent,
        currentPosition: position.clone(),
      });
      return newAgents;
    });
  }, []);

  /**
   * Update an NPC's current position (called by NPC components during animation)
   */
  const updateNpcPosition = useCallback((npcId: string, position: THREE.Vector3) => {
    setNpcPositions((prev) => {
      const currentPos = prev.get(npcId);
      // Only update if position has changed significantly
      if (currentPos &&
          Math.abs(currentPos.x - position.x) < 0.01 &&
          Math.abs(currentPos.y - position.y) < 0.01 &&
          Math.abs(currentPos.z - position.z) < 0.01) {
        return prev;
      }

      const newMap = new Map(prev);
      newMap.set(npcId, position.clone());
      return newMap;
    });
  }, []);

  /**
   * Set the hovered entity ID (or null to clear hover)
   */
  const setHoveredEntity = useCallback((id: string | null) => {
    setHoveredEntityId(id);
  }, []);

  /**
   * Select an entity - activates boss mode manual and focuses camera on it
   */
  const selectEntity = useCallback((id: string) => {
    setSelectedEntityId(id);

    // Generate targets and activate boss mode manual focused on selected entity
    const targets = generateBossModeTargets();
    const targetIndex = targets.findIndex((t) => t.id === id);

    setBossModeState({
      isActive: true,
      mode: 'manual',
      currentTargetIndex: Math.max(targetIndex, 0),
      targets,
      timeAtTarget: 0,
      targetDuration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL,
      orbitAngle: 0,
      orbitRadius: 6,
      orbitHeight: 4,
    });
  }, [generateBossModeTargets]);

  /**
   * Clear the current selection and exit boss mode
   */
  const clearSelection = useCallback(() => {
    setSelectedEntityId(null);
    setBossModeState((prev) => ({
      ...prev,
      isActive: false,
      targets: [],
      orbitAngle: 0,
    }));
    setCameraTarget('overview');
  }, [setCameraTarget]);

  // Initial data fetch
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(refreshData, FACTORY_CONSTANTS.API.POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Update night mode when in auto mode
  useEffect(() => {
    if (lightingMode !== 'auto') return;

    const interval = setInterval(() => {
      // Force re-render to check time
      setLightingMode('auto');
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lightingMode]);

  // Boss mode orbit animation - continuously orbits around current target
  // Use refs to access latest state without re-running effects
  const agentsRef = useRef(agents);
  const npcPositionsRef = useRef(npcPositions);
  const entityConversationsRef = useRef(entityConversations);
  agentsRef.current = agents;
  npcPositionsRef.current = npcPositions;
  entityConversationsRef.current = entityConversations;

  // Pre-built entity position map for collision checks.
  // Built once per render (when agents/npcPositions change) instead of once per entity per frame.
  const entityPositionMapRef = useRef<Map<string, { x: number; z: number }>>(new Map());
  entityPositionMapRef.current = useMemo(
    () => buildEntityPositionMap(agents, npcPositions),
    [agents, npcPositions]
  );

  useEffect(() => {
    if (!bossModeState.isActive) return;
    if (bossModeState.targets.length === 0) return;

    const orbitSpeed = 0.3; // Radians per second
    const autoSwitchAfterRotation = bossModeState.mode === 'auto';
    let lastTime = performance.now();
    let animationFrameId: number;

    const animate = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000; // Convert to seconds
      lastTime = now;

      setBossModeState((prev) => {
        if (!prev.isActive || prev.targets.length === 0) return prev;

        const target = prev.targets[prev.currentTargetIndex];
        if (!target) return prev;

        // Update orbit angle
        let newAngle = prev.orbitAngle + orbitSpeed * delta;

        // Check if we've completed a full rotation in auto mode
        let nextIndex = prev.currentTargetIndex;
        if (autoSwitchAfterRotation && newAngle >= Math.PI * 2) {
          newAngle = 0;
          nextIndex = (prev.currentTargetIndex + 1) % prev.targets.length;
        }

        const nextTarget = prev.targets[nextIndex] || target;

        // Get LIVE position for the target (not the stale position from targets array)
        let livePos = nextTarget.position;
        if (nextTarget.type === 'npc') {
          // Look up live NPC position
          const npcPos = npcPositionsRef.current.get(nextTarget.id);
          if (npcPos) {
            livePos = { x: npcPos.x, y: npcPos.y, z: npcPos.z };
          }
        } else if (nextTarget.type === 'agent') {
          // Look up live agent position
          const agent = agentsRef.current.get(nextTarget.id);
          if (agent?.currentPosition) {
            livePos = { x: agent.currentPosition.x, y: agent.currentPosition.y, z: agent.currentPosition.z };
          }
        }

        // Use wider orbit for NPC targets (taller models need more camera distance)
        const isNpcTarget = nextTarget.type === 'npc';
        const effectiveRadius = isNpcTarget ? prev.orbitRadius + 4 : prev.orbitRadius;
        const effectiveHeight = isNpcTarget ? prev.orbitHeight + 3 : prev.orbitHeight;

        // Calculate camera position on orbit using live position
        const camX = livePos.x + effectiveRadius * Math.cos(newAngle);
        const camZ = livePos.z + effectiveRadius * Math.sin(newAngle);
        const camY = livePos.y + effectiveHeight;

        // Update camera position directly
        setCamera((camPrev) => {
          const newPosition = new THREE.Vector3(camX, camY, camZ);
          const newTarget = new THREE.Vector3(
            livePos.x,
            livePos.y + 2, // Look at head height
            livePos.z
          );

          return {
            ...camPrev,
            position: newPosition,
            target: newTarget,
            isAnimating: false,
          };
        });

        return {
          ...prev,
          orbitAngle: newAngle,
          currentTargetIndex: nextIndex,
        };
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [bossModeState.isActive, bossModeState.mode, bossModeState.targets.length]);

  // Proximity conversation detection
  // Uses refs to read latest positions without re-running the effect
  const conversationStartTimesRef = useRef<Map<string, number>>(new Map());
  const conversationCooldownRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    /**
     * Simple hash of a string to produce a stable integer
     */
    const hashString = (s: string): number =>
      s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    const checkProximity = () => {
      const currentAgents = agentsRef.current;
      const currentNpcPositions = npcPositionsRef.current;

      // Collect all entity positions (exclude working agents)
      const entities: Array<{ id: string; x: number; z: number }> = [];

      currentAgents.forEach((agent) => {
        if (agent.status === 'active') return; // working agents don't chat
        const pos = agent.currentPosition || agent.basePosition;
        entities.push({ id: agent.id, x: pos.x, z: pos.z });
      });

      currentNpcPositions.forEach((pos, id) => {
        entities.push({ id, x: pos.x, z: pos.z });
      });

      if (entities.length < 2) {
        if (entityConversationsRef.current.size > 0) {
          conversationStartTimesRef.current.clear();
          setEntityConversations(new Map());
        }
        return;
      }

      // For each entity, find mutual-closest neighbor within threshold
      const closestNeighbor = new Map<string, string>();

      for (let i = 0; i < entities.length; i++) {
        let minDist = Infinity;
        let closestId = '';
        for (let j = 0; j < entities.length; j++) {
          if (i === j) continue;
          const dx = entities[i].x - entities[j].x;
          const dz = entities[i].z - entities[j].z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < minDist && dist < PROXIMITY_THRESHOLD) {
            minDist = dist;
            closestId = entities[j].id;
          }
        }
        if (closestId) {
          closestNeighbor.set(entities[i].id, closestId);
        }
      }

      // Build mutual pairs
      const newConvos = new Map<string, ProximityConversation>();
      const paired = new Set<string>();
      const now = Date.now();
      const startTimes = conversationStartTimesRef.current;
      const activeKeys = new Set<string>();

      const cooldowns = conversationCooldownRef.current;

      closestNeighbor.forEach((neighborId, entityId) => {
        if (paired.has(entityId)) return;
        // Check mutual: neighbor's closest must be this entity
        if (closestNeighbor.get(neighborId) !== entityId) return;

        const pairKey = [entityId, neighborId].sort().join(':');

        // Skip pairs on cooldown (recently finished a conversation)
        const cooldownUntil = cooldowns.get(pairKey);
        if (cooldownUntil && now < cooldownUntil) return;

        paired.add(entityId);
        paired.add(neighborId);
        activeKeys.add(pairKey);

        // Get or create start time
        let startTime = startTimes.get(pairKey);
        if (startTime === undefined) {
          startTime = now;
          startTimes.set(pairKey, startTime);
        }

        const elapsed = now - startTime;
        const isLong = elapsed >= GREETING_PHASE_MS;

        // Count total turns and end conversation if max reached
        const greetingTurns = Math.min(
          Math.ceil(GREETING_PHASE_MS / GREETING_TURN_MS),
          Math.floor(elapsed / GREETING_TURN_MS) + 1
        );
        const smallTalkTurns = isLong
          ? Math.floor((elapsed - GREETING_PHASE_MS) / TALK_TURN_MS) + 1
          : 0;
        const totalTurns = greetingTurns + smallTalkTurns;

        if (totalTurns > MAX_CONVERSATION_TURNS) {
          // Conversation exceeded max turns - end it and put on cooldown
          startTimes.delete(pairKey);
          cooldowns.set(pairKey, now + CONVERSATION_COOLDOWN_MS);
          activeKeys.delete(pairKey);
          return;
        }
        const ids = [entityId, neighborId].sort();

        // Detect if an NPC is in this pair for character-specific lines
        const npcId = ids.find((id) => id in NPC_CONVERSATION_DATA) || null;
        const npcData = npcId ? NPC_CONVERSATION_DATA[npcId] : null;

        if (!isLong) {
          // Greeting phase: quick turn-based greetings
          const turnIndex = Math.floor(elapsed / GREETING_TURN_MS);
          const isFirstTurn = turnIndex % 2 === 0;
          const speakerId = isFirstTurn ? ids[0] : ids[1];

          // NPC uses their own greetings; others use generic
          const activeGreetings = (npcData && speakerId === npcId) ? npcData.greetings : GREETINGS;
          const greetIdx = (hashString(speakerId) + turnIndex) % activeGreetings.length;

          newConvos.set(ids[0], {
            partnerId: ids[1],
            startTime,
            isLongDuration: false,
            currentLine: speakerId === ids[0] ? activeGreetings[greetIdx] : null,
          });
          newConvos.set(ids[1], {
            partnerId: ids[0],
            startTime,
            isLongDuration: false,
            currentLine: speakerId === ids[1] ? activeGreetings[greetIdx] : null,
          });
        } else {
          // Small talk phase: turn-based conversation pairs
          const talkElapsed = elapsed - GREETING_PHASE_MS;
          const turnIndex = Math.floor(talkElapsed / TALK_TURN_MS);
          const isFirstSpeaker = turnIndex % 2 === 0;

          if (npcData && npcId) {
            // NPC-specific small talk: NPC always says [0], partner says [1]
            const pairIndex = Math.floor(turnIndex / 2) % npcData.smallTalk.length;
            const talkPair = npcData.smallTalk[pairIndex];
            const npcSortedIdx = ids.indexOf(npcId);

            newConvos.set(ids[0], {
              partnerId: ids[1],
              startTime,
              isLongDuration: true,
              currentLine: isFirstSpeaker
                ? (npcSortedIdx === 0 ? talkPair[0] : talkPair[1])
                : null,
            });
            newConvos.set(ids[1], {
              partnerId: ids[0],
              startTime,
              isLongDuration: true,
              currentLine: !isFirstSpeaker
                ? (npcSortedIdx === 1 ? talkPair[0] : talkPair[1])
                : null,
            });
          } else {
            // Generic small talk
            const pairIndex = Math.floor(turnIndex / 2) % SMALL_TALK_PAIRS.length;

            newConvos.set(ids[0], {
              partnerId: ids[1],
              startTime,
              isLongDuration: true,
              currentLine: isFirstSpeaker ? SMALL_TALK_PAIRS[pairIndex][0] : null,
            });
            newConvos.set(ids[1], {
              partnerId: ids[0],
              startTime,
              isLongDuration: true,
              currentLine: !isFirstSpeaker ? SMALL_TALK_PAIRS[pairIndex][1] : null,
            });
          }
        }
      });

      // Clean up stale start times
      startTimes.forEach((_, key) => {
        if (!activeKeys.has(key)) startTimes.delete(key);
      });

      // Clean up expired cooldowns
      cooldowns.forEach((until, key) => {
        if (now >= until) cooldowns.delete(key);
      });

      // Only update state if conversations actually changed
      const serialize = (m: Map<string, ProximityConversation>) =>
        JSON.stringify(Array.from(m.entries()).map(([k, v]) => [k, v.currentLine, v.isLongDuration]));

      if (serialize(newConvos) !== serialize(entityConversationsRef.current)) {
        setEntityConversations(newConvos);
      }
    };

    checkProximity();
    const interval = setInterval(checkProximity, PROXIMITY_CHECK_MS);
    return () => clearInterval(interval);
  }, []); // Uses refs for position data, no deps needed

  // Memoize context value to prevent unnecessary re-renders of consumers
  const value = useMemo<FactoryContextType>(
    () => ({
      agents,
      zones,
      camera,
      setCameraTarget,
      lightingMode,
      setLightingMode,
      isNightMode,
      bossModeState,
      toggleBossMode,
      setBossModeType,
      bossNextTarget,
      bossPrevTarget,
      getCurrentTargetName,
      stats,
      projects,
      isLoading,
      error,
      refreshData,
      updateCamera,
      claimSeat,
      releaseSeat,
      isAreaFull,
      getSeatIndex,
      getSeatOccupancy,
      claimStage,
      releaseStage,
      isStageOccupied,
      getStagePerformerId,
      stagePerformerRef,
      seatOccupancyRef,
      updateAgentPosition,
      updateNpcPosition,
      npcPositions,
      hoveredEntityId,
      selectedEntityId,
      setHoveredEntity,
      selectEntity,
      clearSelection,
      entityConversations,
      sendEntityCommand,
      consumeEntityCommand,
      entityPositionMapRef,
      freestyleMode,
      setFreestyleMoveTarget,
      showNPCAgents,
      setShowNPCAgents,
      showGuestAgents,
      setShowGuestAgents,
      showObjects,
      setShowObjects,
    }),
    [
      agents,
      zones,
      camera,
      setCameraTarget,
      lightingMode,
      isNightMode,
      bossModeState,
      toggleBossMode,
      setBossModeType,
      bossNextTarget,
      bossPrevTarget,
      getCurrentTargetName,
      stats,
      projects,
      isLoading,
      error,
      refreshData,
      updateCamera,
      claimSeat,
      releaseSeat,
      isAreaFull,
      getSeatIndex,
      getSeatOccupancy,
      claimStage,
      releaseStage,
      isStageOccupied,
      getStagePerformerId,
      updateAgentPosition,
      updateNpcPosition,
      npcPositions,
      hoveredEntityId,
      selectedEntityId,
      setHoveredEntity,
      selectEntity,
      clearSelection,
      entityConversations,
      sendEntityCommand,
      consumeEntityCommand,
      freestyleMode,
      setFreestyleMoveTarget,
      showNPCAgents,
      showGuestAgents,
      showObjects,
    ]
  );

  return (
    <FactoryContext.Provider value={value}>
      {children}
    </FactoryContext.Provider>
  );
};

// ====== HOOK ======

/**
 * Hook to access factory context
 *
 * @returns FactoryContextType object with factory state and control functions
 * @throws Error if used outside of FactoryProvider
 */
export const useFactory = (): FactoryContextType => {
  const context = useContext(FactoryContext);
  if (context === undefined) {
    throw new Error('useFactory must be used within a FactoryProvider');
  }
  return context;
};
