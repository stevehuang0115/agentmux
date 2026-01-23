import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ScheduledMessageCard } from '../ScheduledMessageCard';
import { ScheduledMessage } from '../types';

const mockMessage: ScheduledMessage = {
  id: '1',
  name: 'Test Message',
  targetTeam: 'orchestrator',
  targetProject: 'test-project',
  message: 'This is a test message',
  delayAmount: 5,
  delayUnit: 'minutes',
  isRecurring: false,
  isActive: true,
  lastRun: '2023-01-01T00:00:00Z',
  nextRun: '2023-01-01T01:00:00Z',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
};

const mockProps = {
  message: mockMessage,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onToggleActive: vi.fn(),
  onRunNow: vi.fn(),
  formatDate: (dateString: string) => new Date(dateString).toLocaleString()
};

describe('ScheduledMessageCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders message information correctly', () => {
    render(<ScheduledMessageCard {...mockProps} />);

    expect(screen.getByText('Test Message')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('orchestrator')).toBeInTheDocument();
    expect(screen.getByText('test-project')).toBeInTheDocument();
    // Message text is not shown in compact view - it's only in the popup
    expect(screen.getByText('Once after 5 minutes')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    render(<ScheduledMessageCard {...mockProps} />);
    
    const editButton = screen.getByTitle('Edit');
    fireEvent.click(editButton);
    
    expect(mockProps.onEdit).toHaveBeenCalledWith(mockMessage);
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<ScheduledMessageCard {...mockProps} />);
    
    const deleteButton = screen.getByTitle('Delete');
    fireEvent.click(deleteButton);
    
    expect(mockProps.onDelete).toHaveBeenCalledWith(mockMessage.id, mockMessage.name);
  });

  it('calls onToggleActive when toggle button is clicked', () => {
    render(<ScheduledMessageCard {...mockProps} />);
    
    const toggleButton = screen.getByTitle('Disable');
    fireEvent.click(toggleButton);
    
    expect(mockProps.onToggleActive).toHaveBeenCalledWith(mockMessage.id, mockMessage.isActive);
  });

  it('calls onRunNow when run button is clicked', () => {
    render(<ScheduledMessageCard {...mockProps} />);
    
    const runButton = screen.getByTitle('Run now');
    fireEvent.click(runButton);
    
    expect(mockProps.onRunNow).toHaveBeenCalledWith(mockMessage.id, mockMessage.name);
  });

  it('renders completed message with different styling', () => {
    const completedMessage = { ...mockMessage, isActive: false };
    const props = { ...mockProps, message: completedMessage };

    render(<ScheduledMessageCard {...props} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    // Status messaging is not shown in compact view
    expect(screen.getByText('Once after 5 minutes')).toBeInTheDocument();
  });

  it('shows recurring message status when deactivated', () => {
    const completedRecurringMessage = {
      ...mockMessage,
      isActive: false,
      isRecurring: true
    };
    const props = { ...mockProps, message: completedRecurringMessage };

    render(<ScheduledMessageCard {...props} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Every 5 minutes')).toBeInTheDocument();
  });
});