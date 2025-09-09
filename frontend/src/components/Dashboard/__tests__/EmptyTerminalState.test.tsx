import React from 'react';
import { render, screen } from '@testing-library/react';
import { EmptyTerminalState } from '../EmptyTerminalState';

describe('EmptyTerminalState', () => {
  it('renders empty terminal message', () => {
    render(<EmptyTerminalState />);
    expect(screen.getByText('No terminal selected')).toBeInTheDocument();
    expect(screen.getByText('Select a team from the Teams tab to view its terminal.')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-empty-state';
    render(<EmptyTerminalState className={customClass} />);
    
    const container = screen.getByText('No terminal selected').closest('div');
    expect(container).toHaveClass(customClass);
  });

  it('renders computer desktop icon', () => {
    render(<EmptyTerminalState />);
    // The ComputerDesktopIcon should be rendered
    const iconElement = document.querySelector('svg');
    expect(iconElement).toBeInTheDocument();
  });

  it('has proper styling classes', () => {
    render(<EmptyTerminalState />);
    
    const container = screen.getByText('No terminal selected').closest('div');
    expect(container).toHaveClass('bg-white', 'rounded-lg', 'shadow-md', 'p-8', 'text-center');
  });
});