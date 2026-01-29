import React from 'react';
import { render, act, renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { SidebarProvider, useSidebar } from './SidebarContext';

describe('SidebarContext', () => {
  describe('SidebarProvider', () => {
    it('provides sidebar context to children', () => {
      const TestChild = () => {
        const { isCollapsed } = useSidebar();
        return <div>{isCollapsed ? 'collapsed' : 'expanded'}</div>;
      };

      const { getByText } = render(
        <SidebarProvider>
          <TestChild />
        </SidebarProvider>
      );

      expect(getByText('expanded')).toBeInTheDocument();
    });

    it('starts with sidebar expanded (isCollapsed: false)', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      });

      expect(result.current.isCollapsed).toBe(false);
    });
  });

  describe('useSidebar hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress React error output during this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useSidebar());
      }).toThrow('useSidebar must be used within a SidebarProvider');

      consoleSpy.mockRestore();
    });

    it('toggles sidebar state', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      });

      expect(result.current.isCollapsed).toBe(false);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.isCollapsed).toBe(true);

      act(() => {
        result.current.toggleSidebar();
      });

      expect(result.current.isCollapsed).toBe(false);
    });

    it('collapses sidebar', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      });

      act(() => {
        result.current.collapseSidebar();
      });

      expect(result.current.isCollapsed).toBe(true);
    });

    it('expands sidebar', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      });

      // First collapse it
      act(() => {
        result.current.collapseSidebar();
      });
      expect(result.current.isCollapsed).toBe(true);

      // Then expand it
      act(() => {
        result.current.expandSidebar();
      });
      expect(result.current.isCollapsed).toBe(false);
    });

    it('provides all expected methods and properties', () => {
      const { result } = renderHook(() => useSidebar(), {
        wrapper: SidebarProvider,
      });

      expect(result.current).toHaveProperty('isCollapsed');
      expect(result.current).toHaveProperty('toggleSidebar');
      expect(result.current).toHaveProperty('expandSidebar');
      expect(result.current).toHaveProperty('collapseSidebar');

      expect(typeof result.current.isCollapsed).toBe('boolean');
      expect(typeof result.current.toggleSidebar).toBe('function');
      expect(typeof result.current.expandSidebar).toBe('function');
      expect(typeof result.current.collapseSidebar).toBe('function');
    });
  });
});