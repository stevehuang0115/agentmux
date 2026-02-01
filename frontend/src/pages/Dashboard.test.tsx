/**
 * Dashboard Page Tests
 *
 * Tests for the chat-centric dashboard layout.
 *
 * @module pages/Dashboard.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';

// Mock the ChatContext
const mockUseChat = vi.fn();
vi.mock('../contexts/ChatContext', () => ({
  useChat: () => mockUseChat(),
}));

// Mock Chat components
vi.mock('../components/Chat/ChatPanel', () => ({
  ChatPanel: () => <div data-testid="chat-panel">Chat Panel Content</div>,
}));

vi.mock('../components/Chat/ChatSidebar', () => ({
  ChatSidebar: () => <div data-testid="chat-sidebar">Chat Sidebar Content</div>,
}));

// Mock Dashboard components
vi.mock('../components/Dashboard/ProjectsSummary', () => ({
  ProjectsSummary: ({ compact }: { compact?: boolean }) => (
    <div data-testid="projects-summary" data-compact={compact}>
      Projects Summary
    </div>
  ),
}));

vi.mock('../components/Dashboard/TeamsSummary', () => ({
  TeamsSummary: ({ compact }: { compact?: boolean }) => (
    <div data-testid="teams-summary" data-compact={compact}>
      Teams Summary
    </div>
  ),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChat.mockReturnValue({
      error: null,
      isLoading: false,
      messages: [],
      sendMessage: vi.fn(),
      currentConversation: null,
    });
  });

  describe('Layout Structure', () => {
    it('should render the dashboard layout', () => {
      renderWithRouter(<Dashboard />);

      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-main')).toBeInTheDocument();
    });

    it('should render the app title', () => {
      renderWithRouter(<Dashboard />);

      expect(screen.getByText('AgentMux')).toBeInTheDocument();
    });

    it('should render the ChatPanel in main content', () => {
      renderWithRouter(<Dashboard />);

      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });
  });

  describe('Sidebar Navigation', () => {
    it('should render navigation tabs', () => {
      renderWithRouter(<Dashboard />);

      expect(screen.getByTestId('nav-tab-chat')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-projects')).toBeInTheDocument();
      expect(screen.getByTestId('nav-tab-teams')).toBeInTheDocument();
    });

    it('should show Conversations tab as active by default', () => {
      renderWithRouter(<Dashboard />);

      const chatTab = screen.getByTestId('nav-tab-chat');
      expect(chatTab).toHaveClass('active');
    });

    it('should show ChatSidebar by default', () => {
      renderWithRouter(<Dashboard />);

      expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
    });

    it('should switch to Projects view when clicking Projects tab', () => {
      renderWithRouter(<Dashboard />);

      const projectsTab = screen.getByTestId('nav-tab-projects');
      fireEvent.click(projectsTab);

      expect(projectsTab).toHaveClass('active');
      expect(screen.getByTestId('projects-summary')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-sidebar')).not.toBeInTheDocument();
    });

    it('should switch to Teams view when clicking Teams tab', () => {
      renderWithRouter(<Dashboard />);

      const teamsTab = screen.getByTestId('nav-tab-teams');
      fireEvent.click(teamsTab);

      expect(teamsTab).toHaveClass('active');
      expect(screen.getByTestId('teams-summary')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-sidebar')).not.toBeInTheDocument();
    });

    it('should pass compact prop to ProjectsSummary', () => {
      renderWithRouter(<Dashboard />);

      const projectsTab = screen.getByTestId('nav-tab-projects');
      fireEvent.click(projectsTab);

      const projectsSummary = screen.getByTestId('projects-summary');
      expect(projectsSummary).toHaveAttribute('data-compact', 'true');
    });

    it('should pass compact prop to TeamsSummary', () => {
      renderWithRouter(<Dashboard />);

      const teamsTab = screen.getByTestId('nav-tab-teams');
      fireEvent.click(teamsTab);

      const teamsSummary = screen.getByTestId('teams-summary');
      expect(teamsSummary).toHaveAttribute('data-compact', 'true');
    });
  });

  describe('Sidebar Collapse', () => {
    it('should render sidebar toggle button', () => {
      renderWithRouter(<Dashboard />);

      expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument();
    });

    it('should collapse sidebar when toggle is clicked', () => {
      renderWithRouter(<Dashboard />);

      const sidebar = screen.getByTestId('dashboard-sidebar');
      expect(sidebar).not.toHaveClass('collapsed');

      const toggleButton = screen.getByTestId('sidebar-toggle');
      fireEvent.click(toggleButton);

      expect(sidebar).toHaveClass('collapsed');
    });

    it('should hide navigation when sidebar is collapsed', () => {
      renderWithRouter(<Dashboard />);

      const toggleButton = screen.getByTestId('sidebar-toggle');
      fireEvent.click(toggleButton);

      expect(screen.queryByTestId('sidebar-nav')).not.toBeInTheDocument();
      expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument();
    });

    it('should expand sidebar when toggle is clicked again', () => {
      renderWithRouter(<Dashboard />);

      const toggleButton = screen.getByTestId('sidebar-toggle');

      // Collapse
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('dashboard-sidebar')).toHaveClass('collapsed');

      // Expand
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('dashboard-sidebar')).not.toHaveClass('collapsed');
    });

    it('should have proper aria-label on toggle button', () => {
      renderWithRouter(<Dashboard />);

      const toggleButton = screen.getByTestId('sidebar-toggle');
      expect(toggleButton).toHaveAttribute('aria-label', 'Collapse sidebar');

      fireEvent.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-label', 'Expand sidebar');
    });
  });

  describe('Connection Status Banner', () => {
    it('should not show banner when there is no error', () => {
      mockUseChat.mockReturnValue({
        error: null,
        isLoading: false,
        messages: [],
        sendMessage: vi.fn(),
        currentConversation: null,
      });

      renderWithRouter(<Dashboard />);

      expect(screen.queryByTestId('connection-banner')).not.toBeInTheDocument();
    });

    it('should show error banner when there is an error', () => {
      mockUseChat.mockReturnValue({
        error: 'Connection failed',
        isLoading: false,
        messages: [],
        sendMessage: vi.fn(),
        currentConversation: null,
      });

      renderWithRouter(<Dashboard />);

      const banner = screen.getByTestId('connection-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveClass('error');
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    it('should not show error banner when loading', () => {
      mockUseChat.mockReturnValue({
        error: 'Some error',
        isLoading: true,
        messages: [],
        sendMessage: vi.fn(),
        currentConversation: null,
      });

      renderWithRouter(<Dashboard />);

      expect(screen.queryByTestId('connection-banner')).not.toBeInTheDocument();
    });

    it('should have alert role for accessibility', () => {
      mockUseChat.mockReturnValue({
        error: 'Connection error',
        isLoading: false,
        messages: [],
        sendMessage: vi.fn(),
        currentConversation: null,
      });

      renderWithRouter(<Dashboard />);

      const banner = screen.getByRole('alert');
      expect(banner).toBeInTheDocument();
    });
  });

  describe('Tab Navigation State', () => {
    it('should only have one active tab at a time', () => {
      renderWithRouter(<Dashboard />);

      const chatTab = screen.getByTestId('nav-tab-chat');
      const projectsTab = screen.getByTestId('nav-tab-projects');
      const teamsTab = screen.getByTestId('nav-tab-teams');

      // Initially chat is active
      expect(chatTab).toHaveClass('active');
      expect(projectsTab).not.toHaveClass('active');
      expect(teamsTab).not.toHaveClass('active');

      // Switch to projects
      fireEvent.click(projectsTab);
      expect(chatTab).not.toHaveClass('active');
      expect(projectsTab).toHaveClass('active');
      expect(teamsTab).not.toHaveClass('active');

      // Switch to teams
      fireEvent.click(teamsTab);
      expect(chatTab).not.toHaveClass('active');
      expect(projectsTab).not.toHaveClass('active');
      expect(teamsTab).toHaveClass('active');
    });

    it('should return to chat view when clicking chat tab', () => {
      renderWithRouter(<Dashboard />);

      // Switch to projects first
      fireEvent.click(screen.getByTestId('nav-tab-projects'));
      expect(screen.getByTestId('projects-summary')).toBeInTheDocument();

      // Switch back to chat
      fireEvent.click(screen.getByTestId('nav-tab-chat'));
      expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
      expect(screen.queryByTestId('projects-summary')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      renderWithRouter(<Dashboard />);

      const heading = screen.getByRole('heading', { name: 'AgentMux' });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H1');
    });

    it('should have accessible toggle button', () => {
      renderWithRouter(<Dashboard />);

      const toggleButton = screen.getByLabelText('Collapse sidebar');
      expect(toggleButton).toBeInTheDocument();
    });
  });
});
