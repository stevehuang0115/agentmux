/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock Phase 1 Components for Testing
import { ProjectCard } from '../frontend/src/components/ProjectCard';
import { TeamCard } from '../frontend/src/components/TeamCard';
import { AssignmentBoard } from '../frontend/src/components/AssignmentBoard';
import { AgentMuxDashboard } from '../frontend/src/components/AgentMuxDashboard';

// Mock Context
const mockAgentMuxContext = {
  projects: [
    {
      id: 'project-1',
      name: 'Test Project',
      fsPath: '/tmp/test-project',
      status: 'active' as const,
      createdAt: '2024-01-01T00:00:00Z',
      lastActivity: '2024-01-01T12:00:00Z'
    }
  ],
  teams: [
    {
      id: 'team-1',
      name: 'Test Team',
      roles: [
        { name: 'orchestrator', count: 1 },
        { name: 'dev', count: 1 }
      ],
      status: 'idle' as const,
      createdAt: '2024-01-01T00:00:00Z'
    }
  ],
  assignments: [
    {
      id: 'assignment-1',
      projectId: 'project-1',
      teamId: 'team-1',
      status: 'active' as const,
      createdAt: '2024-01-01T00:00:00Z'
    }
  ],
  loading: false,
  error: null,
  isConnected: true,
  updateProject: jest.fn(),
  deleteProject: jest.fn(),
  updateTeam: jest.fn(),
  deleteTeam: jest.fn(),
  createAssignment: jest.fn(),
  updateAssignment: jest.fn(),
  deleteAssignment: jest.fn(),
  refreshData: jest.fn(),
  clearError: jest.fn()
};

// Mock the Context Provider
jest.mock('../frontend/src/context/AgentMuxContext', () => ({
  useAgentMux: () => mockAgentMuxContext,
  AgentMuxProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

describe('Phase 1 Components Tests', () => {
  
  describe('ProjectCard Component', () => {
    const mockProject = mockAgentMuxContext.projects[0];

    test('should render project information correctly', () => {
      render(<ProjectCard project={mockProject} />);
      
      // Check project name
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      
      // Check project path
      expect(screen.getByText('/tmp/test-project')).toBeInTheDocument();
      
      // Check status badge
      expect(screen.getByTestId('project-project-1-status')).toHaveTextContent('Active');
    });

    test('should handle edit mode correctly', async () => {
      const user = userEvent.setup();
      render(<ProjectCard project={mockProject} />);
      
      // Click edit button
      const editButton = screen.getByTitle('Edit project');
      await user.click(editButton);
      
      // Should show input fields
      const nameInput = screen.getByDisplayValue('Test Project');
      const pathInput = screen.getByDisplayValue('/tmp/test-project');
      
      expect(nameInput).toBeInTheDocument();
      expect(pathInput).toBeInTheDocument();
      
      // Should show save/cancel buttons
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('should call updateProject when saving changes', async () => {
      const user = userEvent.setup();
      render(<ProjectCard project={mockProject} />);
      
      // Enter edit mode
      await user.click(screen.getByTitle('Edit project'));
      
      // Modify name
      const nameInput = screen.getByDisplayValue('Test Project');
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Project');
      
      // Save changes
      await user.click(screen.getByText('Save'));
      
      expect(mockAgentMuxContext.updateProject).toHaveBeenCalledWith('project-1', {
        name: 'Updated Project',
        fsPath: '/tmp/test-project'
      });
    });

    test('should handle project archival', async () => {
      const user = userEvent.setup();
      // Mock window.confirm
      window.confirm = jest.fn(() => true);
      
      render(<ProjectCard project={mockProject} />);
      
      const archiveButton = screen.getByTitle('Archive project');
      await user.click(archiveButton);
      
      expect(mockAgentMuxContext.updateProject).toHaveBeenCalledWith('project-1', {
        status: 'archived'
      });
    });
  });

  describe('TeamCard Component', () => {
    const mockTeam = mockAgentMuxContext.teams[0];

    test('should render team information correctly', () => {
      render(<TeamCard team={mockTeam} />);
      
      // Check team name
      expect(screen.getByText('Test Team')).toBeInTheDocument();
      
      // Check status badge
      expect(screen.getByTestId('team-team-1-status')).toHaveTextContent('Idle');
      
      // Check roles
      expect(screen.getByText('orchestrator')).toBeInTheDocument();
      expect(screen.getByText('dev')).toBeInTheDocument();
    });

    test('should handle team status changes', async () => {
      const user = userEvent.setup();
      render(<TeamCard team={mockTeam} />);
      
      // Should show Start button for idle team
      const startButton = screen.getByText('▶️ Start');
      await user.click(startButton);
      
      expect(mockAgentMuxContext.updateTeam).toHaveBeenCalledWith('team-1', {
        status: 'active'
      });
    });

    test('should validate orchestrator requirement', async () => {
      const user = userEvent.setup();
      window.alert = jest.fn();
      
      render(<TeamCard team={mockTeam} />);
      
      // Enter edit mode
      await user.click(screen.getByTitle('Edit team'));
      
      // Try to remove orchestrator role count
      const orchestratorCountInput = screen.getAllByDisplayValue('1')[0]; // First count input (orchestrator)
      await user.clear(orchestratorCountInput);
      await user.type(orchestratorCountInput, '0');
      
      // Try to save
      await user.click(screen.getByText('Save'));
      
      expect(window.alert).toHaveBeenCalledWith('Team must have at least one Orchestrator role');
    });
  });

  describe('AssignmentBoard Component', () => {
    const mockProps = {
      projects: mockAgentMuxContext.projects,
      teams: mockAgentMuxContext.teams,
      assignments: mockAgentMuxContext.assignments
    };

    test('should render assignment grid correctly', () => {
      render(<AssignmentBoard {...mockProps} />);
      
      // Should show teams column
      expect(screen.getByText('Teams')).toBeInTheDocument();
      expect(screen.getByTestId('team-team-1')).toBeInTheDocument();
      
      // Should show assignment grid
      expect(screen.getByText('Assignment Grid')).toBeInTheDocument();
      expect(screen.getByTestId('project-project-1')).toBeInTheDocument();
      
      // Should show assignment cell
      expect(screen.getByTestId('assignment-cell-project-1-team-1')).toBeInTheDocument();
    });

    test('should handle assignment creation via click', async () => {
      const user = userEvent.setup();
      
      // Mock with no existing assignments
      const propsWithoutAssignment = {
        ...mockProps,
        assignments: []
      };
      
      render(<AssignmentBoard {...propsWithoutAssignment} />);
      
      // Click on assignment cell
      const assignmentCell = screen.getByTestId('assignment-cell-project-1-team-1');
      await user.click(assignmentCell);
      
      expect(mockAgentMuxContext.createAssignment).toHaveBeenCalledWith('project-1', 'team-1');
    });

    test('should handle empty state correctly', () => {
      const emptyProps = {
        projects: [],
        teams: [],
        assignments: []
      };
      
      render(<AssignmentBoard {...emptyProps} />);
      
      expect(screen.getByText('No projects or teams yet')).toBeInTheDocument();
      expect(screen.getByText('Create projects and teams first, then use the assignment board to connect them')).toBeInTheDocument();
    });
  });

  describe('AgentMuxDashboard Component', () => {
    test('should render main dashboard correctly', () => {
      render(<AgentMuxDashboard />);
      
      // Check header
      expect(screen.getByText('AgentMux')).toBeInTheDocument();
      
      // Check tabs
      expect(screen.getByText('Projects (1)')).toBeInTheDocument();
      expect(screen.getByText('Teams (1)')).toBeInTheDocument();
      expect(screen.getByText('Assignment Board (1)')).toBeInTheDocument();
      
      // Check connection status
      expect(screen.getByText('ONLINE')).toBeInTheDocument();
    });

    test('should switch tabs correctly', async () => {
      const user = userEvent.setup();
      render(<AgentMuxDashboard />);
      
      // Default to projects tab
      expect(screen.getByText('Projects')).toBeInTheDocument();
      
      // Switch to teams tab
      await user.click(screen.getByText('Teams (1)'));
      expect(screen.getByText('Teams')).toBeInTheDocument();
      
      // Switch to assignment board
      await user.click(screen.getByText('Assignment Board (1)'));
      expect(screen.getByText('Assignment Board')).toBeInTheDocument();
    });

    test('should show connection status correctly', () => {
      render(<AgentMuxDashboard />);
      
      // Should show ONLINE status
      const statusElement = screen.getByText('ONLINE');
      expect(statusElement).toHaveClass('bg-green-100', 'text-green-800');
    });

    test('should handle offline status', () => {
      // Mock offline context
      const offlineContext = {
        ...mockAgentMuxContext,
        isConnected: false
      };
      
      jest.doMock('../frontend/src/context/AgentMuxContext', () => ({
        useAgentMux: () => offlineContext,
        AgentMuxProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
      }));
      
      render(<AgentMuxDashboard />);
      
      // Should show OFFLINE status
      const statusElement = screen.getByText('OFFLINE');
      expect(statusElement).toHaveClass('bg-red-100', 'text-red-800');
    });

    test('should handle refresh functionality', async () => {
      const user = userEvent.setup();
      render(<AgentMuxDashboard />);
      
      const refreshButton = screen.getByText('⟳ Refresh');
      await user.click(refreshButton);
      
      expect(mockAgentMuxContext.refreshData).toHaveBeenCalled();
    });
  });

  describe('Phase 1 Integration Tests', () => {
    test('CRITICAL: Dashboard should show correct header title', () => {
      render(<AgentMuxDashboard />);
      
      // This was the critical bug - header should show "AgentMux"
      const header = screen.getByRole('heading', { level: 1 });
      expect(header).toHaveTextContent('AgentMux');
    });

    test('CRITICAL: Phase 1 tabs should be functional', async () => {
      const user = userEvent.setup();
      render(<AgentMuxDashboard />);
      
      // All three Phase 1 tabs should be present and clickable
      const projectsTab = screen.getByText('Projects (1)');
      const teamsTab = screen.getByText('Teams (1)');
      const assignmentTab = screen.getByText('Assignment Board (1)');
      
      expect(projectsTab).toBeInTheDocument();
      expect(teamsTab).toBeInTheDocument();
      expect(assignmentTab).toBeInTheDocument();
      
      // Should be able to navigate between tabs
      await user.click(teamsTab);
      expect(screen.getByText('No teams yet')).toBeInTheDocument();
      
      await user.click(assignmentTab);
      expect(screen.getByText('Assignment Grid')).toBeInTheDocument();
    });

    test('CRITICAL: Connection status should work properly', () => {
      render(<AgentMuxDashboard />);
      
      // Connection status should be visible and accurate
      const statusElement = screen.getByText('ONLINE');
      expect(statusElement).toBeInTheDocument();
      expect(statusElement).toHaveClass('bg-green-100');
    });

    test('CRITICAL: Phase 1 CRUD operations should be accessible', () => {
      render(<AgentMuxDashboard />);
      
      // Projects CRUD
      expect(screen.getByText('+ New Project')).toBeInTheDocument();
      
      // Teams CRUD  
      const teamsTab = screen.getByText('Teams (1)');
      fireEvent.click(teamsTab);
      expect(screen.getByText('+ New Team')).toBeInTheDocument();
    });
  });
});