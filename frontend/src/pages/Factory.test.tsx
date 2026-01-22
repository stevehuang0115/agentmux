import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Factory } from './Factory';

// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the SidebarContext
const mockCollapseSidebar = vi.fn();
const mockExpandSidebar = vi.fn();
vi.mock('@/contexts/SidebarContext', () => ({
  useSidebar: () => ({
    isCollapsed: false,
    collapseSidebar: mockCollapseSidebar,
    expandSidebar: mockExpandSidebar,
    toggleSidebar: vi.fn(),
  }),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="arrow-left-icon" />,
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    {children}
  </MemoryRouter>
);

describe('Factory Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the factory page', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    });

    it('should render the back button with arrow icon', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      expect(backButton).toBeInTheDocument();
      expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
    });

    it('should render the iframe with correct attributes', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const iframe = screen.getByTitle('AgentMux Factory');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', 'http://localhost:5173');
      expect(iframe).toHaveClass('w-full', 'h-full', 'border-0');
      expect(iframe).toHaveAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope');
    });

    it('should render the container with correct positioning classes', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const container = screen.getByTitle('AgentMux Factory').parentElement;
      expect(container).toHaveClass('fixed', 'inset-0', 'bg-background-dark');
    });
  });

  describe('Sidebar Management', () => {
    it('should collapse sidebar on mount', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      expect(mockCollapseSidebar).toHaveBeenCalledTimes(1);
    });

    it('should expand sidebar on unmount', () => {
      const { unmount } = render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      expect(mockExpandSidebar).not.toHaveBeenCalled();

      unmount();

      expect(mockExpandSidebar).toHaveBeenCalledTimes(1);
    });

    it('should not call expandSidebar while component is mounted', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      expect(mockExpandSidebar).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('should navigate to dashboard when back button is clicked', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    it('should navigate to root path (dashboard)', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const backButton = screen.getByText('Back to Dashboard');
      fireEvent.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible back button', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button');
      expect(backButton).toBeInTheDocument();
      expect(backButton).toHaveTextContent('Back to Dashboard');
    });

    it('should have titled iframe for screen readers', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const iframe = screen.getByTitle('AgentMux Factory');
      expect(iframe).toBeInTheDocument();
    });

    it('should support keyboard navigation for back button', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      backButton.focus();
      expect(document.activeElement).toBe(backButton);

      fireEvent.keyDown(backButton, { key: 'Enter', code: 'Enter' });
      // Click is triggered by Enter key on buttons
    });
  });

  describe('Styling', () => {
    it('should have hover styles on back button', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      expect(backButton).toHaveClass('hover:bg-surface-dark', 'hover:border-primary/50');
    });

    it('should have backdrop blur effect on back button', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      expect(backButton).toHaveClass('backdrop-blur-sm');
    });

    it('should have z-index on back button for layering', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      expect(backButton).toHaveClass('z-10');
    });
  });

  describe('Layout', () => {
    it('should position back button at top-left', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', { name: /back to dashboard/i });
      expect(backButton).toHaveClass('absolute', 'top-4', 'left-4');
    });

    it('should have responsive left margin for sidebar', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const container = screen.getByTitle('AgentMux Factory').parentElement;
      expect(container).toHaveClass('md:left-16');
    });
  });

  describe('Integration', () => {
    it('should properly integrate with sidebar context lifecycle', async () => {
      const { unmount, rerender } = render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      // Verify collapse called on initial mount
      expect(mockCollapseSidebar).toHaveBeenCalledTimes(1);

      // Re-render should not call collapse again (dependencies haven't changed)
      rerender(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );
      expect(mockCollapseSidebar).toHaveBeenCalledTimes(1);

      // Verify expand called on unmount
      unmount();
      expect(mockExpandSidebar).toHaveBeenCalledTimes(1);
    });

    it('should maintain iframe connection to 3D factory visualization', () => {
      render(
        <TestWrapper>
          <Factory />
        </TestWrapper>
      );

      const iframe = screen.getByTitle('AgentMux Factory') as HTMLIFrameElement;
      expect(iframe.src).toBe('http://localhost:5173/');
    });
  });
});
