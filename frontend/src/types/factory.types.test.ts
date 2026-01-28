/**
 * Tests for factory type definitions.
 *
 * Validates type guards, constants, and utility types.
 */

import { describe, it, expect } from 'vitest';
import {
  ZONE_COLORS,
  LIGHTING_CONFIGS,
  FACTORY_CONSTANTS,
  MODEL_PATHS,
  type AnimalType,
  type AgentStatus,
  type LightingMode,
} from './factory.types';

describe('Factory Types', () => {
  describe('ZONE_COLORS', () => {
    it('should have 6 color definitions', () => {
      expect(ZONE_COLORS).toHaveLength(6);
    });

    it('should contain valid hex color values', () => {
      ZONE_COLORS.forEach((color) => {
        expect(typeof color).toBe('number');
        expect(color).toBeGreaterThanOrEqual(0);
        expect(color).toBeLessThanOrEqual(0xffffff);
      });
    });
  });

  describe('LIGHTING_CONFIGS', () => {
    it('should have day and night configurations', () => {
      expect(LIGHTING_CONFIGS).toHaveProperty('day');
      expect(LIGHTING_CONFIGS).toHaveProperty('night');
    });

    it('day config should have brighter values', () => {
      expect(LIGHTING_CONFIGS.day.ambientIntensity).toBeGreaterThan(
        LIGHTING_CONFIGS.night.ambientIntensity
      );
      expect(LIGHTING_CONFIGS.day.sunIntensity).toBeGreaterThan(
        LIGHTING_CONFIGS.night.sunIntensity
      );
    });

    it('should have all required properties', () => {
      const requiredProps = [
        'background',
        'fog',
        'wallColor',
        'floorColor',
        'ambientIntensity',
        'sunIntensity',
      ];

      requiredProps.forEach((prop) => {
        expect(LIGHTING_CONFIGS.day).toHaveProperty(prop);
        expect(LIGHTING_CONFIGS.night).toHaveProperty(prop);
      });
    });
  });

  describe('FACTORY_CONSTANTS', () => {
    it('should have zone configuration', () => {
      expect(FACTORY_CONSTANTS.ZONE).toBeDefined();
      expect(FACTORY_CONSTANTS.ZONE.WIDTH).toBe(10);
      expect(FACTORY_CONSTANTS.ZONE.DEPTH).toBe(7);
      expect(FACTORY_CONSTANTS.ZONE.ZONES_PER_ROW).toBe(3);
    });

    it('should have workstation positions', () => {
      expect(FACTORY_CONSTANTS.WORKSTATION_POSITIONS).toHaveLength(4);
      FACTORY_CONSTANTS.WORKSTATION_POSITIONS.forEach((pos) => {
        expect(pos).toHaveProperty('x');
        expect(pos).toHaveProperty('z');
      });
    });

    it('should have camera defaults', () => {
      expect(FACTORY_CONSTANTS.CAMERA).toBeDefined();
      expect(FACTORY_CONSTANTS.CAMERA.FOV).toBe(60);
      expect(FACTORY_CONSTANTS.CAMERA.NEAR).toBe(0.1);
      expect(FACTORY_CONSTANTS.CAMERA.FAR).toBe(100);
    });

    it('should have wall dimensions', () => {
      expect(FACTORY_CONSTANTS.WALLS).toBeDefined();
      expect(FACTORY_CONSTANTS.WALLS.HEIGHT).toBe(4);
    });

    it('should have interaction zone positions', () => {
      expect(FACTORY_CONSTANTS.BREAK_ROOM.POSITION).toBeDefined();
      expect(FACTORY_CONSTANTS.POKER_TABLE.POSITION).toBeDefined();
    });

    it('should have animation timing', () => {
      expect(FACTORY_CONSTANTS.ANIMATION.FOCUS_DURATION).toBe(1500);
      expect(FACTORY_CONSTANTS.ANIMATION.BOSS_MODE_INTERVAL).toBe(8000);
    });

    it('should have API polling intervals', () => {
      expect(FACTORY_CONSTANTS.API.POLL_INTERVAL).toBe(5000);
      expect(FACTORY_CONSTANTS.API.USAGE_POLL_INTERVAL).toBe(30000);
    });
  });

  describe('MODEL_PATHS', () => {
    it('should have robot model path in employees folder', () => {
      expect(MODEL_PATHS.ROBOT).toBe('/models/employees/robot/RobotExpressive.glb');
    });

    it('should have employee models in employees folder', () => {
      expect(MODEL_PATHS.COW).toContain('/models/employees/cow/');
      expect(MODEL_PATHS.HORSE).toContain('/models/employees/horse/');
      expect(MODEL_PATHS.TIGER).toContain('/models/employees/tiger/');
      expect(MODEL_PATHS.RABBIT).toContain('/models/employees/rabbit/');
    });

    it('should have guest models in guests folder', () => {
      expect(MODEL_PATHS.STEVE_JOBS).toContain('/models/guests/');
      expect(MODEL_PATHS.ELON_MUSK).toContain('/models/guests/');
      expect(MODEL_PATHS.JENSEN_HUANG).toContain('/models/guests/');
    });

    it('should have object models in objects folder', () => {
      expect(MODEL_PATHS.CYBERTRUCK).toContain('/models/objects/');
    });
  });

  describe('Type exports', () => {
    it('should export AnimalType as a string union', () => {
      const validTypes: AnimalType[] = ['cow', 'horse', 'dragon', 'tiger', 'rabbit'];
      expect(validTypes).toHaveLength(5);
    });

    it('should export AgentStatus as a string union', () => {
      const validStatuses: AgentStatus[] = ['active', 'idle', 'dormant'];
      expect(validStatuses).toHaveLength(3);
    });

    it('should export LightingMode as a string union', () => {
      const validModes: LightingMode[] = ['day', 'night', 'auto'];
      expect(validModes).toHaveLength(3);
    });
  });
});
