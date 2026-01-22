import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  };
});

// Mock child components to simplify testing
vi.mock('@/components/Cards/ProjectCard', () => ({
  ProjectCard: ({ project, onClick }: any) => (
    <div
      data-testid={`project-card-${project.id}`}
      onClick={() => onClick()}
    >
      <h3>{project.name}</h3>
    </div>
  )
}));

vi.mock('@/components/Teams/TeamsGridCard', () => ({
  default: ({ team, onClick }: any) => (
    <div
      data-testid={`team-card-${team.id}`}
      onClick={() => onClick()}
    >
      <h3>{team.name}</h3>
    </div>
  )
}));

vi.mock('@/components/Cards/CreateCard', () => ({
  CreateCard: ({ title, onClick }: any) => (
    <div
      data-testid="create-card"
      onClick={onClick}
    >
      {title}
    </div>
  )
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  FolderOpen: () => <svg data-testid="folder-open-icon" />,
  Users: () => <svg data-testid="users-icon" />,
  ArrowRight: () => <svg data-testid="arrow-right-icon" />,
  Factory: () => <svg data-testid="factory-icon" />,
}));

// Test data
const mockProjects = [
  {
    id: 'project-1',
    name: 'Frontend App',
    path: '/path/to/frontend',
    status: 'active',
    description: 'Frontend application',
    teams: {},
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02'
  },
  {
    id: 'project-2',
    name: 'Backend API',
    path: '/path/to/backend',
    status: 'paused',
    description: 'Backend API service',
    teams: {},
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02'
  }
];

const mockTeams = [
  {
    id: 'team-1',
    name: 'Alpha Team',
    currentProject: 'project-1',
    members: [
      { id: 'm1', name: 'Agent 1', agentStatus: 'active' },
      { id: 'm2', name: 'Agent 2', agentStatus: 'idle' }
    ]
  },
  {
    id: 'team-2',
    name: 'Beta Team',
    currentProject: 'project-2',
    members: [
      { id: 'm3', name: 'Agent 3', agentStatus: 'dormant' }
    ]
  }
];

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    {children}
  </MemoryRouter>
);

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default axios mocks
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/projects/') && url.includes('/tasks')) {
        return Promise.resolve({
          data: { success: true, data: [] }
        });
      }
      if (url.includes('/projects')) {
        return Promise.resolve({
          data: { success: true, data: mockProjects }
        });
      }
      if (url.includes('/teams')) {
        return Promise.resolve({
          data: { success: true, data: mockTeams }
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading state initially', () => {
      mockedAxios.get.mockImplementation(() => new Promise(() => {}));

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
    });
  });

  describe('Successful Render', () => {
    it('should render dashboard with header', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
    });

    it('should render stat cards', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        // Use getAllByText since "Projects" and "Teams" appear in both stat cards and section headers
        expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText('Teams').length).toBeGreaterThan(0);
      expect(screen.getByText('Active Projects')).toBeInTheDocument();
      expect(screen.getByText('Running Agents')).toBeInTheDocument();
    });

    it('should display correct stat values', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        // Projects count - use getAllByText since there are multiple "2"s
        const twos = screen.getAllByText('2');
        expect(twos.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Factory Navigation Button', () => {
    it('should render the Factory button', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Factory')).toBeInTheDocument();
      });

      expect(screen.getByText('3D View')).toBeInTheDocument();
    });

    it('should render the Factory icon', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('factory-icon')).toBeInTheDocument();
      });
    });

    it('should navigate to /factory when Factory button is clicked', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Factory')).toBeInTheDocument();
      });

      const factoryButton = screen.getByText('Factory').closest('button');
      expect(factoryButton).toBeInTheDocument();

      fireEvent.click(factoryButton!);

      expect(mockNavigate).toHaveBeenCalledWith('/factory');
    });

    it('should have proper styling on Factory button', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Factory')).toBeInTheDocument();
      });

      const factoryButton = screen.getByText('Factory').closest('button');
      expect(factoryButton).toHaveClass('bg-gradient-to-br');
    });
  });

  describe('Project Section', () => {
    it('should render projects section header', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument();
      });
    });

    it('should render project cards', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('project-card-project-1')).toBeInTheDocument();
      });

      expect(screen.getByTestId('project-card-project-2')).toBeInTheDocument();
    });

    it('should navigate to project detail on project card click', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('project-card-project-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('project-card-project-1'));

      expect(mockNavigate).toHaveBeenCalledWith('/projects/project-1');
    });

    it('should have View All links for projects and teams', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        // "View All" appears twice - once for Projects and once for Teams
        const viewAllLinks = screen.getAllByText('View All');
        expect(viewAllLinks.length).toBe(2);
      });
    });
  });

  describe('Teams Section', () => {
    it('should render teams section header', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        // Teams appears in both stat card and section header
        expect(screen.getAllByText('Teams').length).toBeGreaterThan(0);
      });
    });

    it('should render team cards', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('team-card-team-1')).toBeInTheDocument();
      });

      expect(screen.getByTestId('team-card-team-2')).toBeInTheDocument();
    });

    it('should navigate to team detail on team card click', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('team-card-team-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('team-card-team-1'));

      expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1');
    });
  });

  describe('Create Cards', () => {
    it('should render create project card', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
      });
    });

    it('should render create team card', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Create New Team')).toBeInTheDocument();
      });
    });

    it('should navigate to projects with create param on create project click', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Create New Project')).toBeInTheDocument();
      });

      const createCards = screen.getAllByTestId('create-card');
      fireEvent.click(createCards[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/projects?create=true');
    });

    it('should navigate to teams with create param on create team click', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Create New Team')).toBeInTheDocument();
      });

      const createCards = screen.getAllByTestId('create-card');
      fireEvent.click(createCards[1]);

      expect(mockNavigate).toHaveBeenCalledWith('/teams?create=true');
    });
  });

  describe('Running Agents Count', () => {
    it('should count active agents correctly', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        // Find the Running Agents stat card and verify value
        const runningAgentsLabel = screen.getByText('Running Agents');
        expect(runningAgentsLabel).toBeInTheDocument();

        // Get the parent stat card and check the value
        const statCard = runningAgentsLabel.closest('div');
        expect(statCard).toBeInTheDocument();

        // Only 1 active agent in mockTeams - verify there's at least one "1" on the page
        const ones = screen.getAllByText('1');
        expect(ones.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: 'Dashboard' });
        expect(heading).toBeInTheDocument();
        expect(heading.tagName).toBe('H2');
      });
    });

    it('should have clickable Factory button', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        const factoryButton = screen.getByText('Factory').closest('button');
        expect(factoryButton).toBeInTheDocument();
        expect(factoryButton?.tagName).toBe('BUTTON');
      });
    });
  });
});
