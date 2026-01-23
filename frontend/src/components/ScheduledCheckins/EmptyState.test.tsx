import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders active empty state correctly', () => {
    const mockOnCreate = vi.fn();
    render(<EmptyState type="active" onCreateMessage={mockOnCreate} />);
    
    expect(screen.getByText('⏰')).toBeInTheDocument();
    expect(screen.getByText('No active messages')).toBeInTheDocument();
    expect(screen.getByText(/Create your first scheduled message/)).toBeInTheDocument();
    
    const createButton = screen.getByText('Create Scheduled Message');
    expect(createButton).toBeInTheDocument();
    
    fireEvent.click(createButton);
    expect(mockOnCreate).toHaveBeenCalled();
  });

  it('renders completed empty state correctly', () => {
    render(<EmptyState type="completed" />);
    
    expect(screen.getByText('✅')).toBeInTheDocument();
    expect(screen.getByText('No completed messages')).toBeInTheDocument();
    expect(screen.getByText(/Completed one-time messages and deactivated recurring messages/)).toBeInTheDocument();
    
    // Should not have a create button
    expect(screen.queryByText('Create Scheduled Message')).not.toBeInTheDocument();
  });

  it('renders logs empty state correctly', () => {
    render(<EmptyState type="logs" />);
    
    expect(screen.getByText('No delivery logs yet')).toBeInTheDocument();
    
    // Should not have other empty state content
    expect(screen.queryByText('⏰')).not.toBeInTheDocument();
    expect(screen.queryByText('✅')).not.toBeInTheDocument();
  });

  it('returns null for invalid type', () => {
    const { container } = render(<EmptyState type={'invalid' as any} />);
    expect(container.firstChild).toBeNull();
  });
});