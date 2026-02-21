import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ScheduledCheckCard } from './ScheduledCheckCard';
import { ScheduledCheck } from './types';

const mockRecurringCheck: ScheduledCheck = {
  id: '64c4e30e-1234-5678-abcd-ef0123456789',
  targetSession: 'crewly-dev-sam-217bfbbf',
  message: 'Check in with the agent for a progress update',
  scheduledFor: '2026-02-19T22:00:00.000Z',
  intervalMinutes: 10,
  isRecurring: true,
  createdAt: '2026-02-19T21:00:00.000Z'
};

const mockOneTimeCheck: ScheduledCheck = {
  id: 'aabb1122-3344-5566-7788-99aabbccddee',
  targetSession: 'crewly-dev-mia-member-1',
  message: 'Remind to commit changes before EOD',
  scheduledFor: '2026-02-19T23:30:00.000Z',
  isRecurring: false,
  createdAt: '2026-02-19T21:00:00.000Z'
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

describe('ScheduledCheckCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a recurring check with interval', () => {
    const onCancel = vi.fn();
    render(
      <ScheduledCheckCard check={mockRecurringCheck} onCancel={onCancel} formatDate={formatDate} />
    );

    expect(screen.getByText('Recurring')).toBeInTheDocument();
    expect(screen.getByText('crewly-dev-sam-217bfbbf')).toBeInTheDocument();
    expect(screen.getByText('Every 10 min')).toBeInTheDocument();
    expect(screen.getByText('Check in with the agent for a progress update')).toBeInTheDocument();
    expect(screen.getByText('64c4e30e')).toBeInTheDocument();
  });

  it('renders a one-time check without interval', () => {
    const onCancel = vi.fn();
    render(
      <ScheduledCheckCard check={mockOneTimeCheck} onCancel={onCancel} formatDate={formatDate} />
    );

    expect(screen.getByText('One-time')).toBeInTheDocument();
    expect(screen.getByText('crewly-dev-mia-member-1')).toBeInTheDocument();
    expect(screen.queryByText(/Every/)).not.toBeInTheDocument();
    expect(screen.getByText('Remind to commit changes before EOD')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ScheduledCheckCard check={mockRecurringCheck} onCancel={onCancel} formatDate={formatDate} />
    );

    const cancelButton = screen.getByTitle('Cancel check');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledWith(mockRecurringCheck.id, mockRecurringCheck.message);
  });

  it('truncates long messages at 120 characters', () => {
    const longMessage = 'A'.repeat(150);
    const check: ScheduledCheck = {
      ...mockRecurringCheck,
      message: longMessage
    };
    const onCancel = vi.fn();
    render(
      <ScheduledCheckCard check={check} onCancel={onCancel} formatDate={formatDate} />
    );

    expect(screen.getByText('A'.repeat(120) + '...')).toBeInTheDocument();
  });

  it('displays the next fire time', () => {
    const onCancel = vi.fn();
    render(
      <ScheduledCheckCard check={mockRecurringCheck} onCancel={onCancel} formatDate={formatDate} />
    );

    const formattedDate = formatDate(mockRecurringCheck.scheduledFor);
    expect(screen.getByText(`Next: ${formattedDate}`)).toBeInTheDocument();
  });

  it('shows short ID prefix (8 chars)', () => {
    const onCancel = vi.fn();
    render(
      <ScheduledCheckCard check={mockRecurringCheck} onCancel={onCancel} formatDate={formatDate} />
    );

    // ID prefix is first 8 chars
    expect(screen.getByText('64c4e30e')).toBeInTheDocument();
  });
});
