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
  AnimalType,
  FACTORY_CONSTANTS,
  ZONE_COLORS,
} from '../types/factory.types';
import { factoryService } from '../services/factory.service';
import {
  getAnimalTypeForProject,
  isNightTime,
  createInitialCameraState,
} from '../utils/factory.utils';

// ====== CONTEXT TYPE ======

/**
 * Idle activity types for agents when not working
 */
export type IdleActivity = 'wander' | 'couch' | 'stage';

/**
 * Idle destinations state - tracks where each idle agent should go
 */
interface IdleDestinationsState {
  /** Map of agent ID to their idle activity */
  destinations: Map<string, IdleActivity>;
  /** ID of the agent currently on stage (only one at a time) */
  stagePerformerId: string | null;
  /** IDs of agents on couches */
  couchAgentIds: string[];
}

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
  /** Idle destinations state */
  idleDestinations: IdleDestinationsState;
  /** Get the idle activity for an agent */
  getIdleActivity: (agentId: string) => IdleActivity;
  /** Check if an agent is the stage performer */
  isStagePerformer: (agentId: string) => boolean;
  /** Get couch position index for an agent (-1 if not on couch) */
  getCouchPositionIndex: (agentId: string) => number;
  /** Update an agent's current position (called by agent components) */
  updateAgentPosition: (agentId: string, position: THREE.Vector3) => void;
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
  const [cameraTarget, setCameraTargetState] = useState<CameraFocusTarget>('overview');

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

  // Idle destinations state - randomized activities for idle agents
  const [idleDestinations, setIdleDestinations] = useState<IdleDestinationsState>({
    destinations: new Map(),
    stagePerformerId: null,
    couchAgentIds: [],
  });

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
    });

    return { activeCount, idleCount, dormantCount, totalTokens };
  }, [agents]);

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

      // Debug logging
      console.log('[FactoryContext] === REFRESH DATA ===');
      console.log('[FactoryContext] Zones created:', newZones.size);
      console.log('[FactoryContext] Zone names:', Array.from(newZones.keys()));
      console.log('[FactoryContext] Agents created:', newAgents.size);
      newAgents.forEach((agent, id) => {
        console.log(`[FactoryContext] Agent ${id}: project="${agent.projectName}", type=${agent.animalType}, wsIndex=${agent.workstationIndex}`);
      });
      console.log('[FactoryContext] === END REFRESH ===');

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
    setCameraTargetState(target);

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

    // Add Steve Jobs NPC as a target
    targets.push({
      id: 'steve-jobs-npc',
      name: 'Steve Jobs',
      type: 'npc',
      position: { x: 0, y: 0, z: 5 }, // Default position, will update dynamically
    });

    // Add Sundar Pichai NPC as a target
    targets.push({
      id: 'sundar-pichai-npc',
      name: 'Sundar Pichai',
      type: 'npc',
      position: { x: 10, y: 0, z: 0 }, // Default position, will update dynamically
    });

    return targets;
  }, [agents]);

  /**
   * Focus camera on a boss mode target
   */
  const focusOnBossModeTarget = useCallback((target: BossModeTarget) => {
    // Calculate camera position based on target
    const cameraOffset = { x: -4, y: 4, z: 4 };
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
   * Get the idle activity for an agent
   */
  const getIdleActivity = useCallback((agentId: string): IdleActivity => {
    return idleDestinations.destinations.get(agentId) || 'wander';
  }, [idleDestinations.destinations]);

  /**
   * Check if an agent is the stage performer
   */
  const isStagePerformer = useCallback((agentId: string): boolean => {
    return idleDestinations.stagePerformerId === agentId;
  }, [idleDestinations.stagePerformerId]);

  /**
   * Get couch position index for an agent (-1 if not on couch)
   */
  const getCouchPositionIndex = useCallback((agentId: string): number => {
    return idleDestinations.couchAgentIds.indexOf(agentId);
  }, [idleDestinations.couchAgentIds]);

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

        // Calculate camera position on orbit
        const targetPos = prev.targets[nextIndex]?.position || target.position;
        const camX = targetPos.x + prev.orbitRadius * Math.cos(newAngle);
        const camZ = targetPos.z + prev.orbitRadius * Math.sin(newAngle);
        const camY = targetPos.y + prev.orbitHeight;

        // Update camera position directly
        setCamera((camPrev) => {
          const newPosition = new THREE.Vector3(camX, camY, camZ);
          const newTarget = new THREE.Vector3(
            targetPos.x,
            targetPos.y + 2, // Look at head height
            targetPos.z
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

  // Idle destinations management - assign random activities to idle agents
  useEffect(() => {
    const DESTINATION_CHECK_INTERVAL = 5000; // Check every 5 seconds
    const MAX_COUCH_AGENTS = 4; // Maximum agents on couches

    const assignIdleDestinations = () => {
      // Get all idle agents
      const idleAgents = Array.from(agents.values()).filter(
        (agent) => agent.status === 'idle'
      );

      if (idleAgents.length === 0) {
        // Clear all destinations if no idle agents
        setIdleDestinations({
          destinations: new Map(),
          stagePerformerId: null,
          couchAgentIds: [],
        });
        return;
      }

      const newDestinations = new Map<string, IdleActivity>();
      let newStagePerformerId: string | null = null;
      const newCouchAgentIds: string[] = [];

      // Keep existing assignments for agents still idle, clear for non-idle
      idleAgents.forEach((agent) => {
        const existingDest = idleDestinations.destinations.get(agent.id);

        if (existingDest) {
          // Keep existing assignment
          newDestinations.set(agent.id, existingDest);
          if (existingDest === 'stage') {
            newStagePerformerId = agent.id;
          } else if (existingDest === 'couch') {
            newCouchAgentIds.push(agent.id);
          }
        } else {
          // New idle agent - assign random destination
          // Probabilities: 50% wander, 25% couch, 25% stage
          const rand = Math.random();
          let activity: IdleActivity;

          if (rand < 0.25 && !newStagePerformerId) {
            // Stage (only if no one on stage yet)
            activity = 'stage';
            newStagePerformerId = agent.id;
          } else if (rand < 0.5 && newCouchAgentIds.length < MAX_COUCH_AGENTS) {
            // Couch (if space available)
            activity = 'couch';
            newCouchAgentIds.push(agent.id);
          } else {
            // Default to wandering
            activity = 'wander';
          }

          newDestinations.set(agent.id, activity);
        }
      });

      // Only update if something changed
      const currentDestStr = JSON.stringify(Array.from(idleDestinations.destinations.entries()));
      const newDestStr = JSON.stringify(Array.from(newDestinations.entries()));

      if (currentDestStr !== newDestStr) {
        setIdleDestinations({
          destinations: newDestinations,
          stagePerformerId: newStagePerformerId,
          couchAgentIds: newCouchAgentIds,
        });
      }
    };

    // Run check immediately and then on interval
    assignIdleDestinations();
    const interval = setInterval(assignIdleDestinations, DESTINATION_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [agents, idleDestinations.destinations]);

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
      idleDestinations,
      getIdleActivity,
      isStagePerformer,
      getCouchPositionIndex,
      updateAgentPosition,
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
      idleDestinations,
      getIdleActivity,
      isStagePerformer,
      getCouchPositionIndex,
      updateAgentPosition,
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
