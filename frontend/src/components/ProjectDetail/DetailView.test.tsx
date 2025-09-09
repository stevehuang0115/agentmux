import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { DetailView } from './DetailView';
import { DetailViewProps } from './types';

// Mock the fetch function
global.fetch = vi.fn();

// Mock data
const mockProject = {
  id: 'test-project-1',
  name: 'Test Project',
  path: '/path/to/test/project',
  status: 'active',
  description: 'A test project for unit testing',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02')
};

const mockBuildSpecsWorkflow = {
  isActive: false,
  steps: []
};

const mockAlignmentStatus = {
  hasAlignmentIssues: false,
  alignmentFilePath: null,
  content: null
};

const mockAvailableTeams = [
  {
    id: 'team-1',
    name: 'Development Team',
    members: [
      { id: 'member-1', name: 'John Doe', sessionName: 'john-session' }
    ]
  }
];

const defaultProps: DetailViewProps = {
  project: mockProject,
  onAddGoal: vi.fn(),
  onEditGoal: vi.fn(),
  onAddUserJourney: vi.fn(),
  onEditUserJourney: vi.fn(),
  onBuildSpecs: vi.fn(),
  onBuildTasks: vi.fn(),
  buildSpecsWorkflow: mockBuildSpecsWorkflow,
  alignmentStatus: mockAlignmentStatus,
  onContinueWithMisalignment: vi.fn(),
  onViewAlignment: vi.fn(),
  selectedBuildSpecsTeam: '',
  setSelectedBuildSpecsTeam: vi.fn(),
  selectedBuildTasksTeam: '',
  setSelectedBuildTasksTeam: vi.fn(),
  availableTeams: mockAvailableTeams,
  onCreateSpecsTasks: vi.fn(),
  onCreateDevTasks: vi.fn(),
  onCreateE2ETasks: vi.fn()
};

describe('DetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          mdFileCount: 3,
          taskCount: 10,
          hasProjectMd: true,
          hasUserJourneyMd: true,
          hasInitialGoalMd: true,
          hasInitialUserJourneyMd: true
        }
      })
    } as Response);
  });

  it('renders project details correctly', async () => {
    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    expect(screen.getByText('Project Details')).toBeInTheDocument();
    expect(screen.getByText('Overview and key metrics for your project')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('/path/to/test/project')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', async () => {
    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    expect(screen.getByText('Loading project metrics...')).toBeInTheDocument();
  });

  it('displays project metrics after loading', async () => {
    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.queryByText('Loading project metrics...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Project Metrics')).toBeInTheDocument();
    expect(screen.getByText('Specification Files')).toBeInTheDocument();
    expect(screen.getByText('Tasks Defined')).toBeInTheDocument();
    expect(screen.getByText('Project Status')).toBeInTheDocument();
  });

  it('shows Edit buttons when spec files exist', async () => {
    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      expect(editButtons).toHaveLength(2); // One for Goal, one for User Journey
      expect(editButtons[0]).toBeInTheDocument();
    });
  });

  it('shows Add buttons when spec files do not exist', async () => {
    // Mock API response with no spec files
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          mdFileCount: 0,
          taskCount: 0,
          hasProjectMd: false,
          hasUserJourneyMd: false,
          hasInitialGoalMd: false,
          hasInitialUserJourneyMd: false
        }
      })
    } as Response);

    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Add Goal')).toBeInTheDocument();
      expect(screen.getByText('Add User Journey')).toBeInTheDocument();
    });
  });

  it('calls onAddGoal when Add Goal button is clicked', async () => {
    // Mock API response with no goal file
    (fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          mdFileCount: 0,
          taskCount: 0,
          hasProjectMd: false,
          hasUserJourneyMd: false,
          hasInitialGoalMd: false,
          hasInitialUserJourneyMd: true
        }
      })
    } as Response);

    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      const addGoalButton = screen.getByText('Add Goal');
      fireEvent.click(addGoalButton);
    });

    expect(defaultProps.onAddGoal).toHaveBeenCalledTimes(1);
  });

  it('calls onEditGoal when Edit button is clicked', async () => {
    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      // Click the first Edit button (Goal section)
      fireEvent.click(editButtons[0]);
    });

    expect(defaultProps.onEditGoal).toHaveBeenCalledTimes(1);
  });

  it('displays task creation buttons', async () => {
    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Generate Project Tasks')).toBeInTheDocument();
      expect(screen.getByText('Create Specs Tasks')).toBeInTheDocument();
      expect(screen.getByText('Create Dev Tasks')).toBeInTheDocument();
      expect(screen.getByText('Create E2E Tasks')).toBeInTheDocument();
    });
  });

  it('calls task creation handlers when buttons are clicked', async () => {
    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Generate Project Tasks')).toBeInTheDocument();
    });

    const specsButton = screen.getByRole('button', { name: /Create Specs Tasks/i });
    const devButton = screen.getByRole('button', { name: /Create Dev Tasks/i });
    const e2eButton = screen.getByRole('button', { name: /Create E2E Tasks/i });
    
    fireEvent.click(specsButton);
    fireEvent.click(devButton);
    fireEvent.click(e2eButton);

    expect(defaultProps.onCreateSpecsTasks).toHaveBeenCalledTimes(1);
    expect(defaultProps.onCreateDevTasks).toHaveBeenCalledTimes(1);
    expect(defaultProps.onCreateE2ETasks).toHaveBeenCalledTimes(1);
  });

  it('handles API errors gracefully', async () => {
    // Mock console.error to avoid error output in tests
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock failed API response
    (fetch as any).mockRejectedValue(new Error('API Error'));

    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.queryByText('Loading project metrics...')).not.toBeInTheDocument();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error loading project stats:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('displays project description when available', async () => {
    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(screen.getByText('A test project for unit testing')).toBeInTheDocument();
    });
  });

  it('does not display project description section when unavailable', async () => {
    const propsWithoutDescription = {
      ...defaultProps,
      project: {
        ...mockProject,
        description: undefined
      }
    };

    await act(async () => {
      render(<DetailView {...propsWithoutDescription} />);
    });
    
    await waitFor(() => {
      expect(screen.queryByText('A test project for unit testing')).not.toBeInTheDocument();
    });
  });

  it('loads project stats on component mount', async () => {
    await act(async () => {
      render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(`/api/projects/${mockProject.id}/stats`);
    });
  });

  it('reloads project stats when project id changes', async () => {
    const { rerender } = await act(async () => {
      return render(<DetailView {...defaultProps} />);
    });
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const newProps = {
      ...defaultProps,
      project: { ...mockProject, id: 'new-project-id' }
    };

    await act(async () => {
      rerender(<DetailView {...newProps} />);
    });
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith('/api/projects/new-project-id/stats');
    });
  });
});