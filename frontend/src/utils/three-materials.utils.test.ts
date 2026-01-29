/**
 * Tests for THREE.js Material Utilities.
 *
 * Covers material cache functionality including creation, retrieval,
 * disposal, and the React hook integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  createMaterialCache,
  createSharedMaterials,
  disposeMaterials,
} from './three-materials.utils';

// Mock THREE.MeshStandardMaterial
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');
  return {
    ...actual,
    MeshStandardMaterial: vi.fn().mockImplementation((props) => ({
      ...props,
      dispose: vi.fn(),
      type: 'MeshStandardMaterial',
    })),
  };
});

describe('createMaterialCache', () => {
  let cache: ReturnType<typeof createMaterialCache>;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = createMaterialCache();
  });

  describe('getOrCreate', () => {
    it('should create a new material when not cached', () => {
      const material = cache.getOrCreate(0xff0000);

      expect(material).toBeDefined();
      expect(THREE.MeshStandardMaterial).toHaveBeenCalledTimes(1);
      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({ color: 0xff0000 })
      );
    });

    it('should return cached material on subsequent calls with same color', () => {
      const material1 = cache.getOrCreate(0x00ff00);
      const material2 = cache.getOrCreate(0x00ff00);

      expect(material1).toBe(material2);
      expect(THREE.MeshStandardMaterial).toHaveBeenCalledTimes(1);
    });

    it('should create different materials for different colors', () => {
      const red = cache.getOrCreate(0xff0000);
      const blue = cache.getOrCreate(0x0000ff);

      expect(red).not.toBe(blue);
      expect(THREE.MeshStandardMaterial).toHaveBeenCalledTimes(2);
    });

    it('should apply custom options to material', () => {
      cache.getOrCreate(0xff0000, { roughness: 0.5, metalness: 0.9 });

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: 0xff0000,
          roughness: 0.5,
          metalness: 0.9,
        })
      );
    });

    it('should create different materials for same color with different options', () => {
      const rough = cache.getOrCreate(0xff0000, { roughness: 0.9 });
      const smooth = cache.getOrCreate(0xff0000, { roughness: 0.1 });

      expect(rough).not.toBe(smooth);
      expect(THREE.MeshStandardMaterial).toHaveBeenCalledTimes(2);
    });

    it('should apply default options when none provided', () => {
      cache.getOrCreate(0x888888);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          roughness: 0.8,
          metalness: 0.1,
          flatShading: false,
          transparent: false,
        })
      );
    });

    it('should handle transparent materials', () => {
      cache.getOrCreate(0xffffff, { transparent: true, opacity: 0.5 });

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          transparent: true,
          opacity: 0.5,
        })
      );
    });

    it('should handle emissive materials', () => {
      cache.getOrCreate(0xff0000, {
        emissive: 0x330000,
        emissiveIntensity: 0.5,
      });

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          emissive: 0x330000,
          emissiveIntensity: 0.5,
        })
      );
    });
  });

  describe('get', () => {
    it('should return undefined for uncached color', () => {
      const material = cache.get(0xff0000);
      expect(material).toBeUndefined();
    });

    it('should return cached material', () => {
      const created = cache.getOrCreate(0xff0000);
      const retrieved = cache.get(0xff0000);

      expect(retrieved).toBe(created);
    });

    it('should return undefined for different options', () => {
      cache.getOrCreate(0xff0000, { roughness: 0.5 });
      const retrieved = cache.get(0xff0000, { roughness: 0.9 });

      expect(retrieved).toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('should dispose all cached materials', () => {
      const material1 = cache.getOrCreate(0xff0000);
      const material2 = cache.getOrCreate(0x00ff00);

      cache.dispose();

      expect(material1.dispose).toHaveBeenCalled();
      expect(material2.dispose).toHaveBeenCalled();
    });

    it('should clear the cache after disposal', () => {
      cache.getOrCreate(0xff0000);
      cache.dispose();

      expect(cache.size()).toBe(0);
    });

    it('should handle empty cache gracefully', () => {
      expect(() => cache.dispose()).not.toThrow();
    });
  });

  describe('size', () => {
    it('should return 0 for empty cache', () => {
      expect(cache.size()).toBe(0);
    });

    it('should return correct count after adding materials', () => {
      cache.getOrCreate(0xff0000);
      cache.getOrCreate(0x00ff00);
      cache.getOrCreate(0x0000ff);

      expect(cache.size()).toBe(3);
    });

    it('should not increase for duplicate materials', () => {
      cache.getOrCreate(0xff0000);
      cache.getOrCreate(0xff0000);
      cache.getOrCreate(0xff0000);

      expect(cache.size()).toBe(1);
    });
  });
});

describe('createSharedMaterials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create standard materials for day mode', () => {
    const materials = createSharedMaterials(false);

    expect(materials.floor).toBeDefined();
    expect(materials.wall).toBeDefined();
    expect(materials.metal).toBeDefined();
    expect(materials.glass).toBeDefined();
    expect(materials.wood).toBeDefined();
    expect(materials.plastic).toBeDefined();
  });

  it('should create darker materials for night mode', () => {
    const dayMaterials = createSharedMaterials(false);
    const nightMaterials = createSharedMaterials(true);

    // Night floor should be darker
    expect(nightMaterials.floor.color).not.toEqual(dayMaterials.floor.color);
  });

  it('should create metal material with high metalness', () => {
    const materials = createSharedMaterials();

    expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        metalness: 0.8,
      })
    );
  });

  it('should create glass material with transparency', () => {
    createSharedMaterials();

    expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith(
      expect.objectContaining({
        transparent: true,
        opacity: 0.3,
      })
    );
  });
});

describe('disposeMaterials', () => {
  it('should handle null input', () => {
    expect(() => disposeMaterials(null)).not.toThrow();
  });

  it('should handle undefined input', () => {
    expect(() => disposeMaterials(undefined)).not.toThrow();
  });

  it('should dispose single material', () => {
    const material = {
      dispose: vi.fn(),
    } as unknown as THREE.Material;

    disposeMaterials(material);

    expect(material.dispose).toHaveBeenCalled();
  });

  it('should dispose array of materials', () => {
    const materials = [
      { dispose: vi.fn() },
      { dispose: vi.fn() },
      { dispose: vi.fn() },
    ] as unknown as THREE.Material[];

    disposeMaterials(materials);

    materials.forEach(material => {
      expect(material.dispose).toHaveBeenCalled();
    });
  });

  it('should handle materials without dispose method', () => {
    const material = {} as THREE.Material;

    expect(() => disposeMaterials(material)).not.toThrow();
  });

  it('should handle mixed array with and without dispose', () => {
    const materials = [
      { dispose: vi.fn() },
      {},
      { dispose: vi.fn() },
    ] as unknown as THREE.Material[];

    expect(() => disposeMaterials(materials)).not.toThrow();
    expect((materials[0] as any).dispose).toHaveBeenCalled();
    expect((materials[2] as any).dispose).toHaveBeenCalled();
  });
});
