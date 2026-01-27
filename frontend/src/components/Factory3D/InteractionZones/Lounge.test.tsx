/**
 * Lounge component tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock React Three Fiber
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  useThree: vi.fn(() => ({
    camera: {},
    gl: {},
    scene: {},
  })),
}));

// Mock the factory context
vi.mock('../../../contexts/FactoryContext', () => ({
  useFactory: () => ({
    isNightMode: false,
    zones: new Map(),
  }),
}));

// Mock THREE
vi.mock('three', () => ({
  DoubleSide: 2,
  Vector3: class {
    constructor(public x = 0, public y = 0, public z = 0) {}
  },
}));

describe('Lounge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export Lounge component', async () => {
    const module = await import('./Lounge');
    expect(module.Lounge).toBeDefined();
    expect(typeof module.Lounge).toBe('function');
  });

  it('should export default component', async () => {
    const module = await import('./Lounge');
    expect(module.default).toBeDefined();
    expect(module.default).toBe(module.Lounge);
  });
});
