/**
 * TokenCubePile Component Tests
 *
 * Tests for the token cube pile visualization component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TokenCubePile } from './TokenCubePile';
import { useFactory } from '../../../contexts/FactoryContext';
import type { FactoryStats, OfficeZone } from '../../../types/factory.types';

// Mock the FactoryContext
vi.mock('../../../contexts/FactoryContext', () => ({
  useFactory: vi.fn(),
}));

// Mock React Three Fiber components
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

describe('TokenCubePile', () => {
  const mockUseFactory = useFactory as ReturnType<typeof vi.fn>;

  const defaultStats: FactoryStats = {
    activeCount: 2,
    idleCount: 0,
    dormantCount: 0,
    totalTokens: 1000000,
    tokensByProject: [],
  };

  const defaultZones = new Map<string, OfficeZone>();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFactory.mockReturnValue({
      stats: defaultStats,
      zones: defaultZones,
    });
  });

  it('should render without crashing', () => {
    expect(() => render(<TokenCubePile />)).not.toThrow();
  });

  it('should return null when no tokensByProject data', () => {
    mockUseFactory.mockReturnValue({
      stats: { ...defaultStats, tokensByProject: [] },
      zones: defaultZones,
    });

    const { container } = render(<TokenCubePile />);
    expect(container.firstChild).toBeNull();
  });

  it('should return null when tokensByProject is undefined', () => {
    mockUseFactory.mockReturnValue({
      stats: { ...defaultStats, tokensByProject: undefined },
      zones: defaultZones,
    });

    const { container } = render(<TokenCubePile />);
    expect(container.firstChild).toBeNull();
  });

  it('should render cubes when projects have enough tokens', () => {
    mockUseFactory.mockReturnValue({
      stats: {
        ...defaultStats,
        tokensByProject: [
          { projectName: 'ProjectA', tokens: 500000, color: 0x4a90d9 },
          { projectName: 'ProjectB', tokens: 300000, color: 0xd94a4a },
        ],
      },
      zones: defaultZones,
    });

    const { container } = render(<TokenCubePile />);
    // Should have rendered something (group with meshes)
    expect(container.firstChild).not.toBeNull();
  });

  it('should not render cubes for projects with tokens below minimum threshold', () => {
    mockUseFactory.mockReturnValue({
      stats: {
        ...defaultStats,
        tokensByProject: [
          { projectName: 'SmallProject', tokens: 50000, color: 0x4a90d9 }, // Below 100K threshold
        ],
      },
      zones: defaultZones,
    });

    const { container } = render(<TokenCubePile />);
    expect(container.firstChild).toBeNull();
  });

  it('should handle single project with many tokens', () => {
    mockUseFactory.mockReturnValue({
      stats: {
        ...defaultStats,
        tokensByProject: [
          { projectName: 'BigProject', tokens: 5000000, color: 0x4a90d9 }, // 5M tokens
        ],
      },
      zones: defaultZones,
    });

    const { container } = render(<TokenCubePile />);
    expect(container.firstChild).not.toBeNull();
  });

  it('should handle multiple projects', () => {
    mockUseFactory.mockReturnValue({
      stats: {
        ...defaultStats,
        tokensByProject: [
          { projectName: 'ProjectA', tokens: 1000000, color: 0x4a90d9 },
          { projectName: 'ProjectB', tokens: 800000, color: 0xd94a4a },
          { projectName: 'ProjectC', tokens: 500000, color: 0x4ad94a },
        ],
      },
      zones: defaultZones,
    });

    const { container } = render(<TokenCubePile />);
    expect(container.firstChild).not.toBeNull();
  });
});
