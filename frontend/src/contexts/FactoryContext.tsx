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
  const [lightingMode, setLightingMode] = useState<LightingMode>('auto');

  // Boss mode state
  const [bossModeState, setBossModeState] = useState<BossModeState>({
    isActive: false,
    currentTargetIndex: 0,
    targets: [],
    timeAtTarget: 0,
    targetDuration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL,
  });

  // Loading and error state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const projectSet = new Set<string>();
      let zoneIndex = 0;

      state.agents.forEach((agentData) => {
        if (!projectSet.has(agentData.projectName)) {
          projectSet.add(agentData.projectName);

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

          newZones.set(agentData.projectName, {
            projectName: agentData.projectName,
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

          zoneIndex++;
        }
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
      setProjects(Array.from(projectSet));
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
      const { DEFAULT_POSITION } = FACTORY_CONSTANTS.CAMERA;
      setCamera((prev) => ({
        ...prev,
        isAnimating: true,
        animationTarget: {
          position: new THREE.Vector3(
            DEFAULT_POSITION.x,
            DEFAULT_POSITION.y,
            DEFAULT_POSITION.z
          ),
          lookAt: new THREE.Vector3(0, 1, 0),
          duration: FACTORY_CONSTANTS.ANIMATION.FOCUS_DURATION,
          startTime: Date.now(),
          startPosition: prev.position.clone(),
          startLookAt: prev.target.clone(),
        },
      }));
    } else if (target === 'birdseye') {
      // Bird's eye view - high above looking straight down
      setCamera((prev) => ({
        ...prev,
        isAnimating: true,
        animationTarget: {
          position: new THREE.Vector3(0, 35, 0.1), // High above center
          lookAt: new THREE.Vector3(0, 0, 0), // Looking at center
          duration: FACTORY_CONSTANTS.ANIMATION.FOCUS_DURATION,
          startTime: Date.now(),
          startPosition: prev.position.clone(),
          startLookAt: prev.target.clone(),
        },
      }));
    } else if (target === 'outdoor') {
      // Outdoor view - from outside looking at the building
      setCamera((prev) => ({
        ...prev,
        isAnimating: true,
        animationTarget: {
          position: new THREE.Vector3(-30, 8, -30), // Outside the building
          lookAt: new THREE.Vector3(0, 2, 0), // Looking at building center
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
   * Toggles boss mode auto-tour
   */
  const toggleBossMode = useCallback(() => {
    setBossModeState((prev) => {
      if (prev.isActive) {
        // Turning off - reset to overview
        setCameraTarget('overview');
        return { ...prev, isActive: false };
      } else {
        // Turning on - start tour
        const targets: CameraFocusTarget[] = ['overview', ...projects];
        return {
          isActive: true,
          currentTargetIndex: 0,
          targets,
          timeAtTarget: 0,
          targetDuration: FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL,
        };
      }
    });
  }, [projects, setCameraTarget]);

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

  // Boss mode tour logic
  useEffect(() => {
    if (!bossModeState.isActive) return;

    const interval = setInterval(() => {
      setBossModeState((prev) => {
        const nextIndex = (prev.currentTargetIndex + 1) % prev.targets.length;
        const nextTarget = prev.targets[nextIndex];
        setCameraTarget(nextTarget);
        return {
          ...prev,
          currentTargetIndex: nextIndex,
          timeAtTarget: 0,
        };
      });
    }, bossModeState.targetDuration);

    // Focus on first target
    if (bossModeState.targets.length > 0) {
      setCameraTarget(bossModeState.targets[bossModeState.currentTargetIndex]);
    }

    return () => clearInterval(interval);
  }, [bossModeState.isActive, bossModeState.targetDuration, setCameraTarget]);

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
      stats,
      projects,
      isLoading,
      error,
      refreshData,
      updateCamera,
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
      stats,
      projects,
      isLoading,
      error,
      refreshData,
      updateCamera,
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
