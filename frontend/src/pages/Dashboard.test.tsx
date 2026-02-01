/**
 * Dashboard Page Tests
 *
 * Tests for the chat-centric Dashboard page.
 *
 * @module pages/Dashboard.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import * as useChatHook from '../contexts/ChatContext';

// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the useChat hook
vi.mock('../contexts/ChatContext');

// Mock child components to simplify testing
vi.mock('../components/Chat/ChatPanel', () => ({
  ChatPanel: () => <div data-testid="chat-panel">Chat Panel</div>,
}));

vi.mock('../components/Chat/ChatSidebar', () => ({
  ChatSidebar: () => <div data-testid="chat-sidebar">Chat Sidebar</div>,
}));

vi.mock('../components/Dashboard/ProjectsSummary', () => ({
  ProjectsSummary: ({ onProjectClick }: any) => (
    <div data-testid="projects-summary">
      <button onClick={() => onProjectClick('project-1')}>Project 1</button>
    </div>
  ),
}));

vi.mock('../components/Dashboard/TeamsSummary', () => ({
  TeamsSummary: ({ onTeamClick }: any) => (
    <div data-testid="teams-summary">
      <button onClick={() => onTeamClick('team-1')}>Team 1</button>
    </div>
  ),
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('Dashboard Page', () => {
  const mockChatContext = {
    conversations: [],
    currentConversation: null,
    messages: [],
    isLoading: false,
    isSending: false,
    error: null,
    isTyping: false,
    sendMessage: vi.fn(),
    selectConversation: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    archiveConversation: vi.fn(),
    clearConversation: vi.fn(),
    refreshMessages: vi.fn(),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChatHook.useChat).mockReturnValue(mockChatContext);
  });

  describe('Layout', () => {
    it('should render the app title', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('AgentMux')).toBeInTheDocument();
    });

    it('should render the sidebar', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('should render the main content area', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByRole('main')).toBeInTheDocument();
    });

    it('should render the chat panel in main content', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });
  });

  describe('Navigation Tabs', () => {
    it('should render Conversations tab', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /Conversations/i })).toBeInTheDocument();
    });

    it('should render Projects tab', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /Projects/i })).toBeInTheDocument();
    });

    it('should render Teams tab', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /Teams/i })).toBeInTheDocument();
    });

    it('should show ChatSidebar when Conversations tab is active', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
    });

    it('should show ProjectsSummary when Projects tab is clicked', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /Projects/i }));

      expect(screen.getByTestId('projects-summary')).toBeInTheDocument();
    });

    it('should show TeamsSummary when Teams tab is clicked', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /Teams/i }));

      expect(screen.getByTestId('teams-summary')).toBeInTheDocument();
    });
  });

  describe('Sidebar Toggle', () => {
    it('should toggle sidebar when toggle button is clicked', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('complementary');
      const toggleButton = screen.getByRole('button', { name: /Collapse sidebar/i });

      expect(sidebar).not.toHaveClass('collapsed');

      fireEvent.click(toggleButton);

      expect(sidebar).toHaveClass('collapsed');
    });

    it('should expand sidebar when toggle is clicked again', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      const sidebar = screen.getByRole('complementary');
      const toggleButton = screen.getByRole('button', { name: /Collapse sidebar/i });

      fireEvent.click(toggleButton);
      expect(sidebar).toHaveClass('collapsed');

      const expandButton = screen.getByRole('button', { name: /Expand sidebar/i });
      fireEvent.click(expandButton);

      expect(sidebar).not.toHaveClass('collapsed');
    });
  });

  describe('Footer Links', () => {
    it('should navigate to settings when Settings button is clicked', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });

    it('should navigate to factory when 3D Factory button is clicked', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /3D Factory/i }));

      expect(mockNavigate).toHaveBeenCalledWith('/factory');
    });
  });

  describe('Navigation from Summary Components', () => {
    it('should navigate to project when project is clicked in summary', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /Projects/i }));
      fireEvent.click(screen.getByText('Project 1'));

      expect(mockNavigate).toHaveBeenCalledWith('/projects/project-1');
    });

    it('should navigate to team when team is clicked in summary', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /Teams/i }));
      fireEvent.click(screen.getByText('Team 1'));

      expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1');
    });
  });

  describe('Connection Status', () => {
    it('should show loading banner when isLoading is true', () => {
      vi.mocked(useChatHook.useChat).mockReturnValue({
        ...mockChatContext,
        isLoading: true,
      });

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText(/Connecting to orchestrator/i)).toBeInTheDocument();
    });

    it('should show error banner when error exists', () => {
      vi.mocked(useChatHook.useChat).mockReturnValue({
        ...mockChatContext,
        error: 'Connection failed',
      });

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
    });

    it('should not show status banners when connected successfully', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Connection failed/i)).not.toBeInTheDocument();
    });
  });

  describe('Tab Highlighting', () => {
    it('should highlight active tab', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      const conversationsTab = screen.getByRole('button', { name: /Conversations/i });
      expect(conversationsTab).toHaveClass('active');
    });

    it('should update active tab when different tab is clicked', () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      const projectsTab = screen.getByRole('button', { name: /Projects/i });
      fireEvent.click(projectsTab);

      expect(projectsTab).toHaveClass('active');
      expect(screen.getByRole('button', { name: /Conversations/i })).not.toHaveClass('active');
    });
  });
});
