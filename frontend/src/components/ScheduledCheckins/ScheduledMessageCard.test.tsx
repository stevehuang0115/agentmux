import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScheduledMessageCard } from './ScheduledMessageCard';
import { ScheduledMessage } from './types';

describe('ScheduledMessageCard', () => {
  const mockMessage: ScheduledMessage = {
    id: '1',
    name: 'Daily Check-in',
    targetTeam: 'orchestrator',
    targetProject: 'test-project',
    message: 'Please provide status update',
    isRecurring: true,
    delayAmount: '30',
    delayUnit: 'minutes',
    isActive: true,
    lastRun: '2025-01-15T10:00:00Z',
    nextRun: '2025-01-15T10:30:00Z',
    createdAt: '2025-01-15T09:00:00Z',
    updatedAt: '2025-01-15T09:30:00Z'
  };

  const defaultProps = {
    message: mockMessage,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleActive: vi.fn(),
    onRunNow: vi.fn(),
    formatDate: vi.fn((date) => new Date(date).toLocaleDateString()),
    onCardClick: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders message information correctly', () => {
    render(<ScheduledMessageCard {...defaultProps} />);

    expect(screen.getByText('Daily Check-in')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('orchestrator')).toBeInTheDocument();
    expect(screen.getByText('test-project')).toBeInTheDocument();
    expect(screen.getByText('Every 30 minutes')).toBeInTheDocument();
  });

  it('renders clickable card with hover effect', () => {
    render(<ScheduledMessageCard {...defaultProps} />);

    const card = screen.getByText('Daily Check-in').closest('.scheduled-message-card');
    expect(card).toHaveClass('clickable');
  });

  it('calls onCardClick when card is clicked', () => {
    render(<ScheduledMessageCard {...defaultProps} />);

    const card = screen.getByText('Daily Check-in').closest('.scheduled-message-card');
    fireEvent.click(card!);

    expect(defaultProps.onCardClick).toHaveBeenCalledWith(mockMessage);
  });

  it('does not call onCardClick when action button is clicked', () => {
    render(<ScheduledMessageCard {...defaultProps} />);

    const editButton = screen.getByTitle('Edit');
    fireEvent.click(editButton);

    expect(defaultProps.onCardClick).not.toHaveBeenCalled();
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockMessage);
  });

  it('renders compact layout with proper information', () => {
    render(<ScheduledMessageCard {...defaultProps} />);

    // Check for compact content structure
    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.getByText('Project:')).toBeInTheDocument();
    expect(screen.getByText('Schedule:')).toBeInTheDocument();
    expect(screen.getByText(/Next:/)).toBeInTheDocument();
  });

  it('handles completed messages correctly', () => {
    const completedMessage = { ...mockMessage, isActive: false };
    render(<ScheduledMessageCard {...defaultProps} message={completedMessage} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();

    const card = screen.getByText('Daily Check-in').closest('.scheduled-message-card');
    expect(card).toHaveClass('completed');
  });

  it('renders action buttons correctly for active messages', () => {
    render(<ScheduledMessageCard {...defaultProps} />);

    expect(screen.getByTitle('Edit')).toBeInTheDocument();
    expect(screen.getByTitle('Run now')).toBeInTheDocument();
    expect(screen.getByTitle('Disable')).toBeInTheDocument();
    expect(screen.getByTitle('Delete')).toBeInTheDocument();
  });

  it('calls appropriate handlers when action buttons are clicked', () => {
    render(<ScheduledMessageCard {...defaultProps} />);

    fireEvent.click(screen.getByTitle('Edit'));
    expect(defaultProps.onEdit).toHaveBeenCalledWith(mockMessage);

    fireEvent.click(screen.getByTitle('Run now'));
    expect(defaultProps.onRunNow).toHaveBeenCalledWith('1', 'Daily Check-in');

    fireEvent.click(screen.getByTitle('Disable'));
    expect(defaultProps.onToggleActive).toHaveBeenCalledWith('1', true);

    fireEvent.click(screen.getByTitle('Delete'));
    expect(defaultProps.onDelete).toHaveBeenCalledWith('1', 'Daily Check-in');
  });

  it('does not show next run time for inactive messages', () => {
    const inactiveMessage = { ...mockMessage, isActive: false, nextRun: undefined };
    render(<ScheduledMessageCard {...defaultProps} message={inactiveMessage} />);

    expect(screen.queryByText(/Next:/)).not.toBeInTheDocument();
  });

  it('handles messages without target project', () => {
    const messageWithoutProject = { ...mockMessage, targetProject: undefined };
    render(<ScheduledMessageCard {...defaultProps} message={messageWithoutProject} />);

    expect(screen.getByText('Target:')).toBeInTheDocument();
    expect(screen.queryByText('Project:')).not.toBeInTheDocument();
  });

  it('works correctly without onCardClick prop', () => {
    const propsWithoutCardClick = { ...defaultProps };
    delete propsWithoutCardClick.onCardClick;

    render(<ScheduledMessageCard {...propsWithoutCardClick} />);

    const card = screen.getByText('Daily Check-in').closest('.scheduled-message-card');
    expect(card).not.toHaveClass('clickable');

    fireEvent.click(card!);
    // Should not throw an error
  });
});