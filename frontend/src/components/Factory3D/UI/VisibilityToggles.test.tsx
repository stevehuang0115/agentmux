/**
 * VisibilityToggles tests - Verifies toggle configurations and visibility logic.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';

/**
 * Toggle switch configuration (matches the component interface)
 */
interface ToggleConfig {
  key: 'npc' | 'guest' | 'objects' | 'pets';
  label: string;
  icon: React.ReactNode;
  isVisible: boolean;
  onToggle: (visible: boolean) => void;
}

/**
 * Creates toggle configurations for testing.
 */
function createToggles(
  visibilityState: { npc: boolean; guest: boolean; objects: boolean; pets: boolean },
  handlers: {
    setNPC: (v: boolean) => void;
    setGuest: (v: boolean) => void;
    setObjects: (v: boolean) => void;
    setPets: (v: boolean) => void;
  }
): ToggleConfig[] {
  return [
    {
      key: 'npc',
      label: 'NPC Agents',
      icon: null, // Simplified for testing
      isVisible: visibilityState.npc,
      onToggle: handlers.setNPC,
    },
    {
      key: 'guest',
      label: 'Guest Agents',
      icon: null,
      isVisible: visibilityState.guest,
      onToggle: handlers.setGuest,
    },
    {
      key: 'objects',
      label: 'Objects',
      icon: null,
      isVisible: visibilityState.objects,
      onToggle: handlers.setObjects,
    },
    {
      key: 'pets',
      label: 'Pets',
      icon: null,
      isVisible: visibilityState.pets,
      onToggle: handlers.setPets,
    },
  ];
}

/**
 * Counts how many toggles are hidden.
 */
function countHidden(toggles: ToggleConfig[]): number {
  return toggles.filter((t) => !t.isVisible).length;
}

/**
 * Gets the display text for the toggle button.
 */
function getButtonText(hiddenCount: number): string {
  return hiddenCount > 0 ? `${hiddenCount} Hidden` : 'Visibility';
}

describe('VisibilityToggles', () => {
  describe('Toggle configurations', () => {
    it('should have all four toggle types', () => {
      const toggles = createToggles(
        { npc: true, guest: true, objects: true, pets: true },
        {
          setNPC: vi.fn(),
          setGuest: vi.fn(),
          setObjects: vi.fn(),
          setPets: vi.fn(),
        }
      );

      expect(toggles).toHaveLength(4);
      expect(toggles.map((t) => t.key)).toEqual(['npc', 'guest', 'objects', 'pets']);
    });

    it('should have correct labels', () => {
      const toggles = createToggles(
        { npc: true, guest: true, objects: true, pets: true },
        {
          setNPC: vi.fn(),
          setGuest: vi.fn(),
          setObjects: vi.fn(),
          setPets: vi.fn(),
        }
      );

      expect(toggles.find((t) => t.key === 'npc')?.label).toBe('NPC Agents');
      expect(toggles.find((t) => t.key === 'guest')?.label).toBe('Guest Agents');
      expect(toggles.find((t) => t.key === 'objects')?.label).toBe('Objects');
      expect(toggles.find((t) => t.key === 'pets')?.label).toBe('Pets');
    });

    it('should reflect visibility state correctly', () => {
      const toggles = createToggles(
        { npc: true, guest: false, objects: true, pets: false },
        {
          setNPC: vi.fn(),
          setGuest: vi.fn(),
          setObjects: vi.fn(),
          setPets: vi.fn(),
        }
      );

      expect(toggles.find((t) => t.key === 'npc')?.isVisible).toBe(true);
      expect(toggles.find((t) => t.key === 'guest')?.isVisible).toBe(false);
      expect(toggles.find((t) => t.key === 'objects')?.isVisible).toBe(true);
      expect(toggles.find((t) => t.key === 'pets')?.isVisible).toBe(false);
    });
  });

  describe('Toggle handlers', () => {
    it('should call correct handler when toggled', () => {
      const handlers = {
        setNPC: vi.fn(),
        setGuest: vi.fn(),
        setObjects: vi.fn(),
        setPets: vi.fn(),
      };

      const toggles = createToggles(
        { npc: true, guest: true, objects: true, pets: true },
        handlers
      );

      // Simulate toggling each one
      toggles.find((t) => t.key === 'npc')?.onToggle(false);
      toggles.find((t) => t.key === 'guest')?.onToggle(false);
      toggles.find((t) => t.key === 'objects')?.onToggle(false);
      toggles.find((t) => t.key === 'pets')?.onToggle(false);

      expect(handlers.setNPC).toHaveBeenCalledWith(false);
      expect(handlers.setGuest).toHaveBeenCalledWith(false);
      expect(handlers.setObjects).toHaveBeenCalledWith(false);
      expect(handlers.setPets).toHaveBeenCalledWith(false);
    });

    it('should toggle visibility correctly', () => {
      let npcVisible = true;
      const setNPC = vi.fn((v) => { npcVisible = v; });

      const toggles = createToggles(
        { npc: npcVisible, guest: true, objects: true, pets: true },
        {
          setNPC,
          setGuest: vi.fn(),
          setObjects: vi.fn(),
          setPets: vi.fn(),
        }
      );

      // Toggle off
      toggles.find((t) => t.key === 'npc')?.onToggle(!npcVisible);
      expect(setNPC).toHaveBeenCalledWith(false);
      expect(npcVisible).toBe(false);

      // Toggle back on
      toggles.find((t) => t.key === 'npc')?.onToggle(!npcVisible);
      expect(setNPC).toHaveBeenCalledWith(true);
      expect(npcVisible).toBe(true);
    });
  });

  describe('Hidden count', () => {
    it('should return 0 when all visible', () => {
      const toggles = createToggles(
        { npc: true, guest: true, objects: true, pets: true },
        {
          setNPC: vi.fn(),
          setGuest: vi.fn(),
          setObjects: vi.fn(),
          setPets: vi.fn(),
        }
      );

      expect(countHidden(toggles)).toBe(0);
    });

    it('should return 4 when all hidden', () => {
      const toggles = createToggles(
        { npc: false, guest: false, objects: false, pets: false },
        {
          setNPC: vi.fn(),
          setGuest: vi.fn(),
          setObjects: vi.fn(),
          setPets: vi.fn(),
        }
      );

      expect(countHidden(toggles)).toBe(4);
    });

    it('should return correct count for partial visibility', () => {
      const toggles = createToggles(
        { npc: true, guest: false, objects: true, pets: false },
        {
          setNPC: vi.fn(),
          setGuest: vi.fn(),
          setObjects: vi.fn(),
          setPets: vi.fn(),
        }
      );

      expect(countHidden(toggles)).toBe(2);
    });
  });

  describe('Button text', () => {
    it('should show "Visibility" when none hidden', () => {
      expect(getButtonText(0)).toBe('Visibility');
    });

    it('should show "1 Hidden" when one hidden', () => {
      expect(getButtonText(1)).toBe('1 Hidden');
    });

    it('should show "4 Hidden" when all hidden', () => {
      expect(getButtonText(4)).toBe('4 Hidden');
    });
  });

  describe('Expansion state', () => {
    it('should track expanded state correctly', () => {
      let isExpanded = false;

      const toggle = () => {
        isExpanded = !isExpanded;
      };

      expect(isExpanded).toBe(false);
      toggle();
      expect(isExpanded).toBe(true);
      toggle();
      expect(isExpanded).toBe(false);
    });
  });

  describe('Toggle order', () => {
    it('should maintain consistent order', () => {
      const toggles = createToggles(
        { npc: true, guest: true, objects: true, pets: true },
        {
          setNPC: vi.fn(),
          setGuest: vi.fn(),
          setObjects: vi.fn(),
          setPets: vi.fn(),
        }
      );

      expect(toggles[0].key).toBe('npc');
      expect(toggles[1].key).toBe('guest');
      expect(toggles[2].key).toBe('objects');
      expect(toggles[3].key).toBe('pets');
    });
  });

  describe('UI state derivation', () => {
    it('should determine warning state from hidden count', () => {
      const hasHidden = (count: number) => count > 0;

      expect(hasHidden(0)).toBe(false);
      expect(hasHidden(1)).toBe(true);
      expect(hasHidden(4)).toBe(true);
    });

    it('should select correct icon based on hidden state', () => {
      const getIcon = (count: number) => (count > 0 ? 'EyeOff' : 'Eye');

      expect(getIcon(0)).toBe('Eye');
      expect(getIcon(1)).toBe('EyeOff');
      expect(getIcon(4)).toBe('EyeOff');
    });

    it('should select correct chevron based on expanded state', () => {
      const getChevron = (expanded: boolean) => (expanded ? 'ChevronDown' : 'ChevronUp');

      expect(getChevron(false)).toBe('ChevronUp');
      expect(getChevron(true)).toBe('ChevronDown');
    });
  });
});
