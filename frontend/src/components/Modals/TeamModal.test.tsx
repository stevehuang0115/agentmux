import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { TeamModal } from './TeamModal';

// Mock fetch globally
global.fetch = vi.fn();

// Mock window.alert
Object.defineProperty(window, 'alert', {
  value: vi.fn(),
  writable: true
});

// Mock UI components to simplify testing
vi.mock('../UI', () => ({
  FormPopup: ({ isOpen, onClose, onSubmit, title, subtitle, size, submitText, submitDisabled, loading, children }: any) => (
    isOpen ? (
      <div data-testid="form-popup">
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <div>Size: {size}</div>
        <form onSubmit={onSubmit}>
          {children}
          <button 
            type="submit" 
            disabled={submitDisabled}
            data-testid="submit-button"
          >
            {loading ? 'Loading...' : submitText}
          </button>
          <button type="button" onClick={onClose} data-testid="close-button">
            Close
          </button>
        </form>
      </div>
    ) : null
  ),
  Dropdown: ({ id, name, value, onChange, placeholder, options, required }: any) => (
    <div data-testid={`dropdown-${id || name}`}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        <option value="">{placeholder}</option>
        {options.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}));

// Test data
const mockProjects = [
  {
    id: 'project-1',
    name: 'Frontend App',
    path: '/path/to/frontend'
  },
  {
    id: 'project-2',
    name: 'Backend API',
    path: '/path/to/backend'
  }
];

const mockRoles = {
  roles: [
    {
      key: 'tpm',
      displayName: 'Technical Product Manager',
      promptFile: 'tpm.md',
      description: 'Technical Product Manager role',
      category: 'management',
      isDefault: true
    },
    {
      key: 'fullstack-dev',
      displayName: 'Fullstack Developer',
      promptFile: 'fullstack-dev.md',
      description: 'Fullstack Developer role',
      category: 'development',
      isDefault: true
    },
    {
      key: 'qa',
      displayName: 'QA Engineer',
      promptFile: 'qa.md',
      description: 'QA Engineer role',
      category: 'quality',
      isDefault: false
    }
  ]
};

const mockTeam = {
  id: 'team-1',
  name: 'Development Team',
  description: 'Frontend development team',
  projectPath: 'project-1',
  members: [
    {
      id: '1',
      name: 'John Doe',
      role: 'tpm',
      systemPrompt: 'Load from tpm.md'
    },
    {
      id: '2',
      name: 'Jane Smith',
      role: 'fullstack-dev',
      systemPrompt: 'Load from fullstack-dev.md'
    }
  ]
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn()
};

describe('TeamModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default fetch mocks
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/projects')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: mockProjects
          })
        });
      }
      if (url.includes('/api/config/available_team_roles.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRoles)
        });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render modal when isOpen is true', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      expect(screen.getByTestId('form-popup')).toBeInTheDocument();
      expect(screen.getByText('Create New Team')).toBeInTheDocument();
      expect(screen.getByText('Set up a new collaborative team')).toBeInTheDocument();
    });

    it('should not render modal when isOpen is false', () => {
      render(<TeamModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByTestId('form-popup')).not.toBeInTheDocument();
    });

    it('should render edit mode when team is provided', () => {
      render(<TeamModal {...defaultProps} team={mockTeam} />);
      
      expect(screen.getByText('Edit Team')).toBeInTheDocument();
      expect(screen.getByText('Modify team configuration and members')).toBeInTheDocument();
    });

    it('should render modal with lg size', () => {
      render(<TeamModal {...defaultProps} />);
      
      expect(screen.getByText('Size: lg')).toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    it('should render all form fields', async () => {
      render(<TeamModal {...defaultProps} />);
      
      expect(screen.getByLabelText('Team Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Project (Optional)')).toBeInTheDocument();
    });

    it('should populate form fields when editing team', async () => {
      render(<TeamModal {...defaultProps} team={mockTeam} />);
      
      await waitFor(() => {
        const nameInput = screen.getByDisplayValue('Development Team');
        expect(nameInput).toBeInTheDocument();
        
        const descriptionInput = screen.getByDisplayValue('Frontend development team');
        expect(descriptionInput).toBeInTheDocument();
      });
    });

    it('should handle form field changes', async () => {
      render(<TeamModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText('Team Name *');
      fireEvent.change(nameInput, { target: { value: 'New Team Name' } });
      
      expect(nameInput).toHaveValue('New Team Name');
      
      const descriptionInput = screen.getByLabelText('Description');
      fireEvent.change(descriptionInput, { target: { value: 'New description' } });
      
      expect(descriptionInput).toHaveValue('New description');
    });
  });

  describe('Projects Dropdown', () => {
    it('should fetch and render projects', async () => {
      render(<TeamModal {...defaultProps} />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/projects');
      });

      await waitFor(() => {
        const dropdown = screen.getByTestId('dropdown-projectPath');
        const select = dropdown.querySelector('select');
        expect(select).toBeInTheDocument();
      });
    });

    it('should handle project selection', async () => {
      render(<TeamModal {...defaultProps} />);
      
      await waitFor(() => {
        const dropdown = screen.getByTestId('dropdown-projectPath');
        const select = dropdown.querySelector('select');
        fireEvent.change(select!, { target: { value: 'project-1' } });
        expect(select).toHaveValue('project-1');
      });
    });

    it('should handle projects fetch error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/projects')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRoles) });
      });

      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching projects:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Team Roles', () => {
    it('should fetch and use team roles', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/config/available_team_roles.json');
      });
    });

    it('should handle roles fetch error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/config/available_team_roles.json')) {
          return Promise.reject(new Error('Config error'));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: mockProjects }) });
      });

      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching available roles:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Team Members', () => {
    it('should initialize with default members for new teams', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Team Members (2)')).toBeInTheDocument();
        expect(screen.getByText('Member 1')).toBeInTheDocument();
        expect(screen.getByText('Member 2')).toBeInTheDocument();
      });
    });

    it('should render existing members when editing team', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} team={mockTeam} />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Team Members (2)')).toBeInTheDocument();
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should add new member when Add Member button is clicked', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Team Members (2)')).toBeInTheDocument();
      });

      const addButton = screen.getByText('+ Add Member');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Team Members (3)')).toBeInTheDocument();
        expect(screen.getByText('Member 3')).toBeInTheDocument();
      });
    });

    it('should remove member when Remove button is clicked', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      await waitFor(() => {
        expect(screen.getByText('Team Members (2)')).toBeInTheDocument();
      });

      const removeButtons = screen.getAllByText('Remove');
      fireEvent.click(removeButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Team Members (1)')).toBeInTheDocument();
      });
    });

    it('should not allow removing the last member', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      // Remove all but one member
      await waitFor(() => {
        const removeButtons = screen.getAllByText('Remove');
        fireEvent.click(removeButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByText('Team Members (1)')).toBeInTheDocument();
        expect(screen.queryByText('Remove')).not.toBeInTheDocument();
      });
    });

    it('should handle member name change', async () => {
      render(<TeamModal {...defaultProps} />);
      
      await waitFor(() => {
        const nameInputs = screen.getAllByPlaceholderText('Member name');
        expect(nameInputs).toHaveLength(2);
      });

      const nameInputs = screen.getAllByPlaceholderText('Member name');
      fireEvent.change(nameInputs[0], { target: { value: 'Updated Name' } });
      
      expect(nameInputs[0]).toHaveValue('Updated Name');
    });

    it('should handle member role change and update system prompt', async () => {
      render(<TeamModal {...defaultProps} />);
      
      await waitFor(() => {
        const roleDropdowns = screen.getAllByTestId(/dropdown-/);
        expect(roleDropdowns.length).toBeGreaterThan(0);
      });

      // Find role dropdowns (not the project dropdown)
      const roleDropdown = screen.getAllByTestId(/dropdown-/)[1]; // Skip project dropdown
      const select = roleDropdown.querySelector('select');
      
      if (select) {
        fireEvent.change(select, { target: { value: 'qa' } });
        expect(select).toHaveValue('qa');
      }
    });
  });

  describe('Form Submission', () => {
    it('should disable submit button when team name is empty', () => {
      render(<TeamModal {...defaultProps} />);
      
      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when team name is provided', async () => {
      render(<TeamModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText('Team Name *');
      fireEvent.change(nameInput, { target: { value: 'New Team' } });

      await waitFor(() => {
        const submitButton = screen.getByTestId('submit-button');
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('should handle form submission for new team', async () => {
      render(<TeamModal {...defaultProps} />);
      
      const nameInput = screen.getByLabelText('Team Name *');
      fireEvent.change(nameInput, { target: { value: 'New Team' } });
      
      const descriptionInput = screen.getByLabelText('Description');
      fireEvent.change(descriptionInput, { target: { value: 'Team description' } });

      await waitFor(() => {
        const submitButton = screen.getByTestId('submit-button');
        expect(submitButton).not.toBeDisabled();
      });

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Team',
            description: 'Team description',
            members: expect.any(Array)
          })
        );
      });
    });

    it('should handle form submission for team edit', async () => {
      const onSubmit = vi.fn();
      render(<TeamModal {...defaultProps} team={mockTeam} onSubmit={onSubmit} />);
      
      await waitFor(() => {
        const submitButton = screen.getByTestId('submit-button');
        expect(submitButton).not.toBeDisabled();
      });

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Development Team',
            description: 'Frontend development team',
            members: expect.any(Array)
          })
        );
      });
    });

    it('should validate member names before submission', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      const nameInput = screen.getByLabelText('Team Name *');
      fireEvent.change(nameInput, { target: { value: 'New Team' } });

      // Clear member names
      await waitFor(() => {
        const memberNameInputs = screen.getAllByPlaceholderText('Member name');
        memberNameInputs.forEach(input => {
          fireEvent.change(input, { target: { value: '' } });
        });
      });

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('All team members must have a name');
        expect(defaultProps.onSubmit).not.toHaveBeenCalled();
      });

      alertSpy.mockRestore();
    });

    it('should handle submission error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onSubmit = vi.fn().mockRejectedValue(new Error('Submission failed'));
      
      await act(async () => {
        render(<TeamModal {...defaultProps} onSubmit={onSubmit} />);
      });
      
      const nameInput = screen.getByLabelText('Team Name *');
      fireEvent.change(nameInput, { target: { value: 'New Team' } });

      await waitFor(() => {
        const submitButton = screen.getByTestId('submit-button');
        expect(submitButton).not.toBeDisabled();
      });

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error submitting team:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    it('should show loading state on submit button during submission', async () => {
      const onSubmit = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      await act(async () => {
        render(<TeamModal {...defaultProps} onSubmit={onSubmit} />);
      });
      
      const nameInput = screen.getByLabelText('Team Name *');
      fireEvent.change(nameInput, { target: { value: 'New Team' } });

      await waitFor(() => {
        const submitButton = screen.getByTestId('submit-button');
        expect(submitButton).not.toBeDisabled();
      });

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      // Should show loading state briefly
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });
  });

  describe('Modal Controls', () => {
    it('should handle close button click', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Submit Button Text', () => {
    it('should show "Create Team" for new team', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      expect(screen.getByText('Create Team')).toBeInTheDocument();
    });

    it('should show "Update Team" for existing team', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} team={mockTeam} />);
      });
      
      expect(screen.getByText('Update Team')).toBeInTheDocument();
    });
  });

  describe('Data Processing', () => {
    it('should process project data correctly', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      const nameInput = screen.getByLabelText('Team Name *');
      fireEvent.change(nameInput, { target: { value: 'New Team' } });

      // Select a project
      await waitFor(() => {
        const dropdown = screen.getByTestId('dropdown-projectPath');
        const select = dropdown.querySelector('select');
        fireEvent.change(select!, { target: { value: 'project-1' } });
      });

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            projectIds: ['project-1'],
            projectPath: '/path/to/frontend'
          })
        );
      });
    });

    it('should handle no project selection', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      const nameInput = screen.getByLabelText('Team Name *');
      fireEvent.change(nameInput, { target: { value: 'New Team' } });

      const submitButton = screen.getByTestId('submit-button');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            projectIds: [],
            projectPath: undefined
          })
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty members array in team data', async () => {
      const teamWithNoMembers = { ...mockTeam, members: [] };
      await act(async () => {
        render(<TeamModal {...defaultProps} team={teamWithNoMembers} />);
      });
      
      // Should still initialize with default members since members is empty
      expect(screen.getByText('Team Members')).toBeInTheDocument();
    });

    it('should handle invalid roles data', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/config/available_team_roles.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ invalid: 'data' })
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: mockProjects }) });
      });

      await act(async () => {
        render(<TeamModal {...defaultProps} />);
      });
      
      // Should handle gracefully
      await waitFor(() => {
        expect(screen.getByText('Team Members')).toBeInTheDocument();
      });
    });

    it('should handle missing team data gracefully', async () => {
      await act(async () => {
        render(<TeamModal {...defaultProps} team={undefined} />);
      });
      
      expect(screen.getByText('Create New Team')).toBeInTheDocument();
      expect(screen.getByLabelText('Team Name *')).toHaveValue('');
    });
  });
});