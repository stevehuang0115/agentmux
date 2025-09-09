import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Teams } from './Teams';

// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock child components to simplify testing
vi.mock('../components/Cards/TeamCard', () => ({
  TeamCard: ({ team, onClick, onMemberClick }: any) => (
    <div 
      data-testid={`team-card-${team.id}`}
      onClick={() => onClick(team)}
      className="team-card"
    >
      <h3>{team.name}</h3>
      <p>{team.description}</p>
      <div className="members">
        {team.members.map((member: any) => (
          <button
            key={member.id}
            onClick={(e) => {
              e.stopPropagation();
              onMemberClick(member);
            }}
            data-testid={`member-${member.id}`}
          >
            {member.name} - {member.role}
          </button>
        ))}
      </div>
    </div>
  )
}));

vi.mock('../components/Cards/CreateCard', () => ({
  CreateCard: ({ title, onClick }: any) => (
    <div 
      data-testid="create-card"
      onClick={onClick}
      className="create-card"
    >
      {title}
    </div>
  )
}));

vi.mock('../components/Modals/TeamModal', () => ({
  TeamModal: ({ isOpen, onClose, onSubmit }: any) => (
    isOpen ? (
      <div data-testid="team-modal">
        <h2>Create New Team</h2>
        <button 
          onClick={() => onSubmit({ 
            name: 'New Team',
            description: 'Test team',
            members: []
          })}
        >
          Create Team
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  )
}));

vi.mock('../components/Modals/TeamMemberModal', () => ({
  TeamMemberModal: ({ member, teamId, onClose }: any) => (
    <div data-testid="team-member-modal">
      <h2>Team Member: {member.name}</h2>
      <p>Role: {member.role}</p>
      <p>Team ID: {teamId}</p>
      <button onClick={onClose}>Close</button>
    </div>
  )
}));

// Test data
const mockTeams = [
  {
    id: 'team-1',
    name: 'Frontend Team',
    description: 'Frontend development team',
    currentProject: 'project-1',
    status: 'active',
    members: [
      {
        id: 'member-1',
        name: 'John Doe',
        role: 'developer',
        agentStatus: 'active'
      },
      {
        id: 'member-2',
        name: 'Jane Smith',
        role: 'designer',
        agentStatus: 'inactive'
      }
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02'
  },
  {
    id: 'team-2',
    name: 'Backend Team',
    description: 'Backend development team',
    currentProject: null,
    status: 'inactive',
    members: [
      {
        id: 'member-3',
        name: 'Bob Wilson',
        role: 'developer',
        agentStatus: 'inactive'
      }
    ],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02'
  }
];

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MemoryRouter>
    {children}
  </MemoryRouter>
);

describe('Teams Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default fetch mock for teams
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mockTeams
      })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should render loading state initially', () => {
      // Make fetch hang to test loading state
      (global.fetch as any).mockImplementation(() => new Promise(() => {}));
      
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      expect(screen.getByText('Loading teams...')).toBeInTheDocument();
      expect(screen.getByText('Teams')).toBeInTheDocument();
      expect(screen.getByText('Manage and organize your development teams')).toBeInTheDocument();
    });
  });

  describe('Successful Render', () => {
    it('should render teams page with header and controls', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Teams')).toBeInTheDocument();
      });

      expect(screen.getByText('Manage and organize your development teams')).toBeInTheDocument();
      expect(screen.getByText('New Team')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search teams...')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render team cards correctly', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Frontend Team')).toBeInTheDocument();
      });

      expect(screen.getByText('Frontend development team')).toBeInTheDocument();
      expect(screen.getByText('Backend Team')).toBeInTheDocument();
      expect(screen.getByText('Backend development team')).toBeInTheDocument();
      expect(screen.getByText('Create New Team')).toBeInTheDocument();
    });

    it('should render team members correctly', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('John Doe - developer')).toBeInTheDocument();
      });

      expect(screen.getByText('Jane Smith - designer')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson - developer')).toBeInTheDocument();
    });
  });

  describe('Search and Filter Functionality', () => {
    it('should filter teams by search query', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Frontend Team')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search teams...');
      fireEvent.change(searchInput, { target: { value: 'frontend' } });

      await waitFor(() => {
        expect(screen.getByText('Frontend Team')).toBeInTheDocument();
        expect(screen.queryByText('Backend Team')).not.toBeInTheDocument();
      });
    });

    it('should filter teams by member name', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Frontend Team')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search teams...');
      fireEvent.change(searchInput, { target: { value: 'john doe' } });

      await waitFor(() => {
        expect(screen.getByText('Frontend Team')).toBeInTheDocument();
        expect(screen.queryByText('Backend Team')).not.toBeInTheDocument();
      });
    });

    it('should filter teams by status', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Frontend Team')).toBeInTheDocument();
      });

      const statusFilter = screen.getByRole('combobox');
      fireEvent.change(statusFilter, { target: { value: 'active' } });

      await waitFor(() => {
        // Frontend team has active members, backend team doesn't
        expect(screen.getByText('Frontend Team')).toBeInTheDocument();
        expect(screen.queryByText('Backend Team')).not.toBeInTheDocument();
      });
    });

    it('should filter teams by inactive status', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Frontend Team')).toBeInTheDocument();
      });

      const statusFilter = screen.getByRole('combobox');
      fireEvent.change(statusFilter, { target: { value: 'inactive' } });

      await waitFor(() => {
        // Backend team has all inactive members
        expect(screen.queryByText('Frontend Team')).not.toBeInTheDocument();
        expect(screen.getByText('Backend Team')).toBeInTheDocument();
      });
    });

    it('should show empty state when no teams match filters', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Frontend Team')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search teams...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent team' } });

      await waitFor(() => {
        expect(screen.getByText('No teams found')).toBeInTheDocument();
        expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
      });
    });
  });

  describe('Team Interactions', () => {
    it('should navigate to team detail on team click', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('team-card-team-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('team-card-team-1'));

      expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1');
    });

    it('should open member modal on member click', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('member-member-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('member-member-1'));

      await waitFor(() => {
        expect(screen.getByTestId('team-member-modal')).toBeInTheDocument();
        expect(screen.getByText('Team Member: John Doe')).toBeInTheDocument();
        expect(screen.getByText('Role: developer')).toBeInTheDocument();
        expect(screen.getByText('Team ID: team-1')).toBeInTheDocument();
      });
    });

    it('should close member modal', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('member-member-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('member-member-1'));

      await waitFor(() => {
        expect(screen.getByTestId('team-member-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('team-member-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Team Creation', () => {
    it('should open team creation modal', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('New Team')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Team'));

      await waitFor(() => {
        expect(screen.getByTestId('team-modal')).toBeInTheDocument();
        expect(screen.getByText('Create New Team')).toBeInTheDocument();
      });
    });

    it('should open team creation modal from create card', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('create-card')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('create-card'));

      await waitFor(() => {
        expect(screen.getByTestId('team-modal')).toBeInTheDocument();
      });
    });

    it('should create new team successfully', async () => {
      const newTeam = {
        id: 'team-3',
        name: 'New Team',
        description: 'Test team',
        members: [],
        status: 'active',
        createdAt: '2024-01-03',
        updatedAt: '2024-01-03'
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockTeams })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: newTeam })
        });

      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('New Team')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Team'));

      await waitFor(() => {
        expect(screen.getByTestId('team-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Team'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/teams', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'New Team',
            description: 'Test team',
            members: []
          })
        });
      });
    });

    it('should handle team creation error', async () => {
      // Mock alert
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockTeams })
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Team creation failed' })
        });

      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('New Team')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Team'));

      await waitFor(() => {
        expect(screen.getByTestId('team-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Team'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Error creating team: Team creation failed');
      });

      alertSpy.mockRestore();
    });

    it('should close team creation modal', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('New Team')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('New Team'));

      await waitFor(() => {
        expect(screen.getByTestId('team-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId('team-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API fetch error gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Teams')).toBeInTheDocument();
      });

      // Should show empty state when no teams are loaded due to error
      await waitFor(() => {
        expect(screen.getByText('No teams found')).toBeInTheDocument();
        expect(screen.getByText('Create your first team to get started')).toBeInTheDocument();
      });
    });

    it('should handle non-ok response', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      });

      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No teams found')).toBeInTheDocument();
      });
    });

    it('should handle invalid API response structure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' })
      });

      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No teams found')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no teams exist', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] })
      });

      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No teams found')).toBeInTheDocument();
        expect(screen.getByText('Create your first team to get started')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        const heading = screen.getByText('Teams');
        expect(heading).toBeInTheDocument();
        expect(heading.tagName).toBe('H1');
        expect(heading).toHaveClass('page-title');
      });
    });

    it('should have accessible form controls', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search teams...');
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute('type', 'text');

        const selectFilter = screen.getByRole('combobox');
        expect(selectFilter).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <Teams />
        </TestWrapper>
      );

      await waitFor(() => {
        const newTeamButton = screen.getByText('New Team');
        expect(newTeamButton).toBeInTheDocument();
      });

      const newTeamButton = screen.getByText('New Team');
      newTeamButton.focus();
      expect(document.activeElement).toBe(newTeamButton);
    });
  });
});