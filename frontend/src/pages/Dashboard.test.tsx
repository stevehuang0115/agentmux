/**
 * Dashboard Page Tests
 *
 * Tests for the cards-based Dashboard page.
 *
 * @module pages/Dashboard.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { apiService } from '../services/api.service';

// Mock the navigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the API service
vi.mock('../services/api.service', () => ({
  apiService: {
    getProjects: vi.fn(),
    getTeams: vi.fn(),
  },
}));

// Mock the TerminalContext
vi.mock('../contexts/TerminalContext', () => ({
  useTerminal: () => ({
    openTerminalWithSession: vi.fn(),
  }),
}));

const mockProjects = [
  {
    id: 'project-1',
    name: 'Test Project 1',
    path: '/path/to/project1',
    status: 'active',
    updatedAt: new Date().toISOString(),
    teams: {},
  },
  {
    id: 'project-2',
    name: 'Test Project 2',
    path: '/path/to/project2',
    status: 'paused',
    updatedAt: new Date().toISOString(),
    teams: {},
  },
];

const mockTeams = [
  {
    id: 'team-1',
    name: 'Test Team 1',
    description: 'Team 1 description',
    members: [],
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'team-2',
    name: 'Test Team 2',
    description: 'Team 2 description',
    members: [],
    updatedAt: new Date().toISOString(),
  },
];

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getProjects).mockResolvedValue(mockProjects);
    vi.mocked(apiService.getTeams).mockResolvedValue(mockTeams);
  });

  describe('Layout', () => {
    it('should render the dashboard container', async () => {
      const { container } = render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(container.querySelector('.dashboard')).toBeInTheDocument();
      });
    });

    it('should render projects section header', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Projects')).toBeInTheDocument();
      });
    });

    it('should render teams section header', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Teams')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      // Make the API never resolve to see loading state
      vi.mocked(apiService.getProjects).mockImplementation(() => new Promise(() => {}));
      vi.mocked(apiService.getTeams).mockImplementation(() => new Promise(() => {}));

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message on API failure', async () => {
      vi.mocked(apiService.getProjects).mockRejectedValue(new Error('API Error'));
      vi.mocked(apiService.getTeams).mockRejectedValue(new Error('API Error'));

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      vi.mocked(apiService.getProjects).mockRejectedValue(new Error('API Error'));
      vi.mocked(apiService.getTeams).mockRejectedValue(new Error('API Error'));

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Projects Section', () => {
    it('should render project cards', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument();
        expect(screen.getByText('Test Project 2')).toBeInTheDocument();
      });
    });

    it('should render View All button for projects', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const viewAllButtons = screen.getAllByRole('button', { name: /View All/i });
        expect(viewAllButtons.length).toBeGreaterThan(0);
      });
    });

    it('should navigate to projects page when View All is clicked', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const viewAllButtons = screen.getAllByRole('button', { name: /View All/i });
        fireEvent.click(viewAllButtons[0]);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/projects');
    });

    it('should render New Project create card', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('New Project')).toBeInTheDocument();
      });
    });
  });

  describe('Teams Section', () => {
    it('should render team cards', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Team 1')).toBeInTheDocument();
        expect(screen.getByText('Test Team 2')).toBeInTheDocument();
      });
    });

    it('should render New Team create card', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('New Team')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to project detail when project card is clicked', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const projectCard = screen.getByText('Test Project 1').closest('[class*="bg-surface-dark"]');
        if (projectCard) {
          fireEvent.click(projectCard);
        }
      });

      expect(mockNavigate).toHaveBeenCalledWith('/projects/project-1');
    });

    it('should navigate to team detail when team card is clicked', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const teamCard = screen.getByText('Test Team 1').closest('[class*="bg-surface-dark"]');
        if (teamCard) {
          fireEvent.click(teamCard);
        }
      });

      expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1');
    });

    it('should navigate to create project when New Project is clicked', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const createCard = screen.getByText('New Project').closest('div');
        if (createCard) {
          fireEvent.click(createCard);
        }
      });

      expect(mockNavigate).toHaveBeenCalledWith('/projects?create=true');
    });
  });

  describe('Empty State', () => {
    it('should show message when no projects exist', async () => {
      vi.mocked(apiService.getProjects).mockResolvedValue([]);
      vi.mocked(apiService.getTeams).mockResolvedValue(mockTeams);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/No projects yet/)).toBeInTheDocument();
      });
    });

    it('should show message when no teams exist', async () => {
      vi.mocked(apiService.getProjects).mockResolvedValue(mockProjects);
      vi.mocked(apiService.getTeams).mockResolvedValue([]);

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/No teams yet/)).toBeInTheDocument();
      });
    });
  });
});
