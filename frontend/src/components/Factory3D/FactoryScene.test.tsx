/**
 * Tests for FactoryScene component.
 *
 * Tests the main R3F canvas and scene setup.
 * Note: We mock all child 3D components to avoid Three.js material interactions.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock React Three Fiber
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
  useThree: () => ({
    scene: {},
    gl: { shadowMap: {}, toneMapping: 0, toneMappingExposure: 1 },
    camera: { position: { x: 0, y: 0, z: 0 } },
  }),
  useFrame: vi.fn(),
}));

// Mock Drei
vi.mock('@react-three/drei', () => {
  const useGLTFMock: any = () => ({
    scene: { traverse: () => {} },
    animations: [],
  });
  useGLTFMock.preload = () => {};

  return {
    Stats: () => null,
    Preload: () => null,
    AdaptiveDpr: () => null,
    AdaptiveEvents: () => null,
    useGLTF: useGLTFMock,
    useAnimations: () => ({
      actions: {},
      mixer: null,
    }),
    Billboard: ({ children }: { children: React.ReactNode }) => children,
    Text: () => null,
    Line: () => null,
    Clone: () => null,
  };
});

// Mock all 3D child components to avoid Three.js material interactions
vi.mock('./Environment/Lighting', () => ({
  Lighting: () => <div data-testid="lighting" />,
}));

vi.mock('./Environment/Floor', () => ({
  Floor: () => <div data-testid="floor" />,
}));

vi.mock('./Environment/Walls', () => ({
  Walls: () => <div data-testid="walls" />,
}));

vi.mock('./Environment/OutdoorScenery', () => ({
  OutdoorScenery: () => <div data-testid="outdoor-scenery" />,
}));

vi.mock('./Office/OfficeZone', () => ({
  OfficeZone: () => <div data-testid="office-zone" />,
  OfficeZones: () => <div data-testid="office-zones" />,
}));

vi.mock('./Office/Decorations', () => ({
  Decorations: () => <div data-testid="decorations" />,
}));

vi.mock('./Office/ConveyorBelt', () => ({
  ConveyorBelt: () => <div data-testid="conveyor-belt" />,
}));

vi.mock('./Office/TokenCubePile', () => ({
  TokenCubePile: () => <div data-testid="token-cube-pile" />,
}));

vi.mock('./InteractionZones/BreakRoom', () => ({
  BreakRoom: () => <div data-testid="break-room" />,
}));

vi.mock('./InteractionZones/PokerTable', () => ({
  PokerTable: () => <div data-testid="poker-table" />,
}));

vi.mock('./Agents/RobotAgent', () => ({
  RobotAgent: () => <div data-testid="robot-agent" />,
  Agents: () => <div data-testid="agents" />,
}));

vi.mock('./Camera/CameraController', () => ({
  CameraController: () => <div data-testid="camera-controller" />,
}));

vi.mock('./UI/InfoPanel', () => ({
  InfoPanel: () => <div data-testid="info-panel" />,
}));

vi.mock('./UI/ProjectButtons', () => ({
  ProjectButtons: () => <div data-testid="project-buttons" />,
}));

vi.mock('./UI/LightingToggle', () => ({
  LightingToggle: () => <div data-testid="lighting-toggle" />,
}));

// Mock three-stdlib
vi.mock('three-stdlib', () => ({
  SkeletonUtils: {
    clone: vi.fn((scene) => scene),
  },
}));

// Mock factory service
vi.mock('../../services/factory.service', () => ({
  factoryService: {
    getFactoryState: vi.fn().mockResolvedValue({
      agents: [],
      projects: [],
      stats: { activeCount: 0, idleCount: 0, dormantCount: 0, totalTokens: 0 },
    }),
  },
}));

// Import after mocks
import { FactoryScene } from './FactoryScene';

describe('FactoryScene', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { container } = render(<FactoryScene />);
    expect(container).toBeDefined();
  });

  it('should render R3F canvas', () => {
    render(<FactoryScene />);
    expect(screen.getByTestId('r3f-canvas')).toBeDefined();
  });

  it('should render with custom className', () => {
    const { container } = render(<FactoryScene className="test-class" />);
    const wrapper = container.querySelector('.test-class');
    expect(wrapper).toBeDefined();
  });

  it('should render with showStats prop', () => {
    // Just verify it renders without errors with showStats
    const { container } = render(<FactoryScene showStats={true} />);
    expect(container).toBeDefined();
  });

  it('should render without showStats prop', () => {
    const { container } = render(<FactoryScene showStats={false} />);
    expect(container).toBeDefined();
  });

  it('should render UI overlay components', () => {
    render(<FactoryScene />);
    expect(screen.getByTestId('info-panel')).toBeDefined();
    expect(screen.getByTestId('project-buttons')).toBeDefined();
    expect(screen.getByTestId('lighting-toggle')).toBeDefined();
  });
});
