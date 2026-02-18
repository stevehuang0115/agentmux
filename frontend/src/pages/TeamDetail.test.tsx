import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TeamDetail } from './TeamDetail';

// Mock the useNavigate and useParams hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'team-1' })
  };
});

// Mock the TerminalContext
const mockOpenTerminalWithSession = vi.fn();
vi.mock('../contexts/TerminalContext', () => ({
  useTerminal: () => ({
    openTerminalWithSession: mockOpenTerminalWithSession
  })
}));

// Mock child components
vi.mock('../components/TeamMemberCard', () => ({
  TeamMemberCard: ({ member, onUpdate, onDelete, onStart, onStop }: any) => (
    <div data-testid={`member-card-${member.id}`} className="member-card">
      <h4>{member.name}</h4>
      <p>{member.role}</p>
      <p>Status: {member.sessionName ? 'active' : 'inactive'}</p>
      <button onClick={() => onUpdate(member.id, { name: 'Updated Name' })}>Update</button>
      <button onClick={() => onDelete(member.id)}>Delete</button>
      <button onClick={() => onStart(member.id)}>Start</button>
      <button onClick={() => onStop(member.id)}>Stop</button>
    </div>
  )
}));

vi.mock('../components/StartTeamModal', () => ({
  StartTeamModal: ({ isOpen, onClose, onStartTeam, team, loading }: any) => (
    isOpen ? (
      <div data-testid="start-team-modal">
        <h2>Start Team: {team?.name}</h2>
        <button 
          onClick={() => onStartTeam('project-1', true)}
          disabled={loading}
        >
          {loading ? 'Starting...' : 'Start Team'}
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null
  )
}));

vi.mock('../utils/api', () => ({
  safeParseJSON: vi.fn().mockImplementation(async (response) => {
    return await response.json();
  })
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  value: vi.fn(() => true),
  writable: true
});

// Mock window.alert
Object.defineProperty(window, 'alert', {
  value: vi.fn(),
  writable: true
});

// Test data
const mockTeam = {
  id: 'team-1',
  name: 'Development Team',
  description: 'Frontend development team',
  currentProject: 'project-1',
  status: 'active',
  members: [
    {
      id: 'member-1',
      name: 'John Doe',
      role: 'Developer',
      sessionName: 'john_doe',
      agentStatus: 'active'
    },
    {
      id: 'member-2',
      name: 'Jane Smith',
      role: 'Designer',
      sessionName: null,
      agentStatus: 'inactive'
    }
  ],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-02'
};

const mockOrchestratorTeam = {
  id: 'orchestrator',
  name: 'Orchestrator Team',
  description: 'System orchestrator team',
  currentProject: null,
  status: 'active',
  members: [
    {
      id: 'orc-1',
      name: 'Orchestrator',
      role: 'Orchestrator',
      sessionName: 'crewly-orc',
      agentStatus: 'active'
    }
  ],
  createdAt: '2024-01-01',
  updatedAt: '2024-01-02'
};

const mockProjects = [
  {
    id: 'project-1',
    name: 'Test Project',
    path: '/path/to/project',
    status: 'active'
  }
];

// Mock react-router-dom at module level
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'team-1' })
  };
});

const TestWrapper: React.FC<{ children: React.ReactNode; teamId?: string }> = ({ 
  children, 
  teamId = 'team-1'
}) => {
  return (
    <MemoryRouter initialEntries={[`/teams/${teamId}`]}>
      {children}
    </MemoryRouter>
  );
};

describe('TeamDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default fetch mocks
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/teams/team-1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockTeam
          })
        });
      }
      if (url.includes('/api/teams/team-1/terminals')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: []
          })
        });
      }
      if (url.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockProjects
          })
        });
      }
      if (url.includes('/api/terminal/sessions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: []
          })
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404
      });
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
          <TeamDetail />
        </TestWrapper>
      );

      expect(screen.getByText('Loading team details...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should render error state when team is not found', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/teams/team-1')) {
          return Promise.resolve({
            ok: false,
            status: 404
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Team not found')).toBeInTheDocument();
        expect(screen.getByText('The requested team could not be found.')).toBeInTheDocument();
      });
    });
  });

  describe('Successful Render', () => {
    it('should render team details correctly', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Development Team')).toBeInTheDocument();
      });

      expect(screen.getByText('Frontend development team')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      expect(screen.getByText('1 / 2')).toBeInTheDocument(); // Active members
      expect(screen.getByText('Test Project')).toBeInTheDocument();
    });

    it('should render team members correctly', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('member-card-member-1')).toBeInTheDocument();
      });

      expect(screen.getByTestId('member-card-member-2')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('Designer')).toBeInTheDocument();
    });

    it('should show correct team status based on active members', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
      });
    });

    it('should show project name when team is assigned to project', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });
    });
  });

  describe('Team Controls', () => {
    it('should show Start Team button when team is idle', async () => {
      // Mock team with no active members
      const idleTeam = {
        ...mockTeam,
        members: [
          { ...mockTeam.members[0], sessionName: null },
          { ...mockTeam.members[1], sessionName: null }
        ]
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/teams/team-1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: idleTeam
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Start Team')).toBeInTheDocument();
      });
    });

    it('should show Stop Team button when team is active', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Stop Team')).toBeInTheDocument();
      });
    });

    it('should handle start team button click', async () => {
      // Mock idle team first
      const idleTeam = {
        ...mockTeam,
        members: [
          { ...mockTeam.members[0], sessionName: null },
          { ...mockTeam.members[1], sessionName: null }
        ]
      };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/teams/team-1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: idleTeam
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Start Team')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Start Team'));

      await waitFor(() => {
        expect(screen.getByTestId('start-team-modal')).toBeInTheDocument();
      });
    });

    it('should handle stop team button click', async () => {
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/teams/team-1/stop') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        if (url.includes('/api/teams/team-1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockTeam
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Stop Team')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Stop Team'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/teams/team-1/stop', {
          method: 'POST'
        });
      });
    });
  });

  describe('Member Management', () => {
    it('should show Add Member button for regular teams', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Add Member')).toBeInTheDocument();
      });
    });

    it('should hide Add Member button for orchestrator team', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/teams/orchestrator')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockOrchestratorTeam
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      // Mock useParams for orchestrator team
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useParams: () => ({ id: 'orchestrator' })
        };
      });

      render(
        <TestWrapper teamId="orchestrator">
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Orchestrator Team')).toBeInTheDocument();
      });

      expect(screen.queryByText('Add Member')).not.toBeInTheDocument();
    });

    it('should show add member form when Add Member is clicked', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Add Member')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add Member'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Member name')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Role (e.g., Developer, PM, QA)')).toBeInTheDocument();
        expect(screen.getByText('Add')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('should handle add member form submission', async () => {
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/teams/team-1/members') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        if (url.includes('/api/teams/team-1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockTeam
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Add Member')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Add Member'));

      await waitFor(() => {
        const nameInput = screen.getByPlaceholderText('Member name');
        const roleInput = screen.getByPlaceholderText('Role (e.g., Developer, PM, QA)');
        
        fireEvent.change(nameInput, { target: { value: 'New Member' } });
        fireEvent.change(roleInput, { target: { value: 'Developer' } });
      });

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/teams/team-1/members', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'New Member', role: 'Developer' })
        });
      });
    });

    it('should handle member actions', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('member-card-member-1')).toBeInTheDocument();
      });

      // Test member update
      fireEvent.click(screen.getAllByText('Update')[0]);
      
      // Test member start
      fireEvent.click(screen.getAllByText('Start')[0]);
      
      // Test member stop
      fireEvent.click(screen.getAllByText('Stop')[0]);
      
      // Test member delete
      fireEvent.click(screen.getAllByText('Delete')[0]);
    });
  });

  describe('Orchestrator Team Special Handling', () => {
    beforeEach(() => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/teams/orchestrator')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockOrchestratorTeam
            })
          });
        }
        if (url.includes('/api/terminal/sessions')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: [{ sessionName: 'crewly-orc' }]
            })
          });
        }
        return Promise.resolve({ ok: false });
      });
    });

    it('should show View Terminal button for orchestrator team', async () => {
      render(
        <TestWrapper teamId="orchestrator">
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('View Terminal')).toBeInTheDocument();
      });
    });

    it('should hide Delete Team button for orchestrator team', async () => {
      render(
        <TestWrapper teamId="orchestrator">
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Orchestrator Team')).toBeInTheDocument();
      });

      expect(screen.queryByText('Delete Team')).not.toBeInTheDocument();
    });

    it('should handle View Terminal click for orchestrator team', async () => {
      render(
        <TestWrapper teamId="orchestrator">
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('View Terminal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('View Terminal'));

      expect(mockOpenTerminalWithSession).toHaveBeenCalledWith('crewly-orc');
    });
  });

  describe('Team Deletion', () => {
    it('should handle delete team confirmation', async () => {
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/teams/team-1/stop') && options?.method === 'POST') {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/api/teams/team-1') && options?.method === 'DELETE') {
          return Promise.resolve({ ok: true });
        }
        if (url.includes('/api/teams/team-1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: mockTeam
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Delete Team')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Delete Team'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/teams');
      });
    });

    it('should prevent deletion of orchestrator team', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <TestWrapper teamId="orchestrator">
          <TeamDetail />
        </TestWrapper>
      );

      // Since orchestrator team doesn't show delete button, we need to test the handler directly
      // This would be called if somehow the delete was triggered
      // But in normal UI flow, the button is hidden
      await waitFor(() => {
        expect(screen.getByText('Orchestrator Team')).toBeInTheDocument();
      });

      // Verify delete button is not shown
      expect(screen.queryByText('Delete Team')).not.toBeInTheDocument();

      alertSpy.mockRestore();
    });
  });

  describe('Start Team Modal', () => {
    it('should handle start team modal submission', async () => {
      (global.fetch as any).mockImplementation((url: string, options?: any) => {
        if (url.includes('/api/teams/team-1/start') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              message: 'Team started successfully'
            })
          });
        }
        if (url.includes('/api/teams/team-1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { ...mockTeam, members: mockTeam.members.map(m => ({ ...m, sessionName: null })) }
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Start Team')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Start Team'));

      await waitFor(() => {
        expect(screen.getByTestId('start-team-modal')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Start Team'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/teams/team-1/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId: 'project-1',
          })
        });
        expect(alertSpy).toHaveBeenCalledWith('Team started successfully');
      });

      alertSpy.mockRestore();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no members exist', async () => {
      const emptyTeam = { ...mockTeam, members: [] };

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/teams/team-1')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: emptyTeam
            })
          });
        }
        return Promise.resolve({ ok: false });
      });

      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('No team members yet. Add members to get started.')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        const heading = screen.getByText('Development Team');
        expect(heading).toBeInTheDocument();
        expect(heading.tagName).toBe('H1');
        expect(heading).toHaveClass('page-title');
      });
    });

    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <TeamDetail />
        </TestWrapper>
      );

      await waitFor(() => {
        const stopButton = screen.getByText('Stop Team');
        expect(stopButton).toBeInTheDocument();
      });

      const stopButton = screen.getByText('Stop Team');
      stopButton.focus();
      expect(document.activeElement).toBe(stopButton);
    });
  });
});