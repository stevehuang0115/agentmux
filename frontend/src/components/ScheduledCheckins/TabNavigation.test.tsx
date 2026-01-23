import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { TabNavigation } from '../TabNavigation';
import { ScheduledMessage } from '../types';

const mockActiveMessages: ScheduledMessage[] = [
  {
    id: '1',
    name: 'Active Message 1',
    targetTeam: 'orchestrator',
    message: 'Test',
    delayAmount: 5,
    delayUnit: 'minutes',
    isRecurring: false,
    isActive: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  }
];

const mockCompletedMessages: ScheduledMessage[] = [
  {
    id: '2',
    name: 'Completed Message 1',
    targetTeam: 'orchestrator',
    message: 'Test',
    delayAmount: 5,
    delayUnit: 'minutes',
    isRecurring: false,
    isActive: false,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  },
  {
    id: '3',
    name: 'Completed Message 2',
    targetTeam: 'orchestrator',
    message: 'Test',
    delayAmount: 5,
    delayUnit: 'minutes',
    isRecurring: false,
    isActive: false,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  }
];

const mockProps = {
  activeTab: 'active' as const,
  setActiveTab: vi.fn(),
  activeMessages: mockActiveMessages,
  completedMessages: mockCompletedMessages
};

describe('TabNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tabs with correct counts', () => {
    render(<TabNavigation {...mockProps} />);
    
    expect(screen.getByText('Active Messages (1)')).toBeInTheDocument();
    expect(screen.getByText('Completed Messages (2)')).toBeInTheDocument();
  });

  it('shows active tab correctly', () => {
    render(<TabNavigation {...mockProps} />);
    
    const activeTab = screen.getByText('Active Messages (1)');
    expect(activeTab).toHaveClass('tab--active');
  });

  it('calls setActiveTab when completed tab is clicked', () => {
    render(<TabNavigation {...mockProps} />);
    
    const completedTab = screen.getByText('Completed Messages (2)');
    fireEvent.click(completedTab);
    
    expect(mockProps.setActiveTab).toHaveBeenCalledWith('completed');
  });

  it('calls setActiveTab when active tab is clicked', () => {
    const propsWithCompletedActive = { ...mockProps, activeTab: 'completed' as const };
    render(<TabNavigation {...propsWithCompletedActive} />);
    
    const activeTab = screen.getByText('Active Messages (1)');
    fireEvent.click(activeTab);
    
    expect(mockProps.setActiveTab).toHaveBeenCalledWith('active');
  });

  it('shows completed tab as active when activeTab is completed', () => {
    const propsWithCompletedActive = { ...mockProps, activeTab: 'completed' as const };
    render(<TabNavigation {...propsWithCompletedActive} />);
    
    const completedTab = screen.getByText('Completed Messages (2)');
    expect(completedTab).toHaveClass('tab--active');
    
    const activeTab = screen.getByText('Active Messages (1)');
    expect(activeTab).not.toHaveClass('tab--active');
  });
});