import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { AddMemberForm } from './AddMemberForm';

const mockProps = {
  isVisible: false,
  onToggle: vi.fn(),
  onAdd: vi.fn(),
  onCancel: vi.fn(),
  isOrchestratorTeam: false,
};

describe('AddMemberForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Add Member button for regular teams', () => {
    render(<AddMemberForm {...mockProps} />);
    expect(screen.getByText('Add Member')).toBeInTheDocument();
  });

  it('does not render Add Member button for orchestrator team', () => {
    render(<AddMemberForm {...mockProps} isOrchestratorTeam={true} />);
    expect(screen.queryByText('Add Member')).not.toBeInTheDocument();
  });

  it('shows form when isVisible is true', () => {
    render(<AddMemberForm {...mockProps} isVisible={true} />);
    expect(screen.getByPlaceholderText('Member name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Role (e.g., Developer, PM, QA)')).toBeInTheDocument();
  });

  it('calls onToggle when Add Member button is clicked', () => {
    render(<AddMemberForm {...mockProps} />);
    fireEvent.click(screen.getByText('Add Member'));
    expect(mockProps.onToggle).toHaveBeenCalled();
  });

  it('calls onAdd with member data when form is submitted with valid data', () => {
    render(<AddMemberForm {...mockProps} isVisible={true} />);
    
    fireEvent.change(screen.getByPlaceholderText('Member name'), {
      target: { value: 'John Doe' }
    });
    fireEvent.change(screen.getByPlaceholderText('Role (e.g., Developer, PM, QA)'), {
      target: { value: 'Developer' }
    });
    fireEvent.click(screen.getByText('Add'));

    expect(mockProps.onAdd).toHaveBeenCalledWith({
      name: 'John Doe',
      role: 'Developer'
    });
  });

  it('shows alert when trying to add member with empty fields', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<AddMemberForm {...mockProps} isVisible={true} />);
    
    fireEvent.click(screen.getByText('Add'));
    expect(alertSpy).toHaveBeenCalledWith('Please fill in both name and role');
    
    alertSpy.mockRestore();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    render(<AddMemberForm {...mockProps} isVisible={true} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockProps.onCancel).toHaveBeenCalled();
  });
});