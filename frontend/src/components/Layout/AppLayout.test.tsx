import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppLayout } from './AppLayout';
import { TerminalProvider } from '../../contexts/TerminalContext';
import { SidebarProvider } from '../../contexts/SidebarContext';

// Mock the child components
vi.mock('./Navigation', () => ({
  Navigation: () => <div data-testid="navigation">Navigation</div>
}));

vi.mock('../TerminalPanel/TerminalPanel', () => ({
  TerminalPanel: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="terminal-panel">Terminal Panel</div> : null
}));

vi.mock('../OrchestratorStatusBanner', () => ({
  OrchestratorStatusBanner: () => <div data-testid="orchestrator-banner">Orchestrator Banner</div>
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <TerminalProvider>
        <SidebarProvider>
          {component}
        </SidebarProvider>
      </TerminalProvider>
    </BrowserRouter>
  );
};

describe('AppLayout', () => {
  it('renders navigation and orchestrator banner', () => {
    renderWithProviders(<AppLayout />);

    expect(screen.getByTestId('navigation')).toBeInTheDocument();
    expect(screen.getByTestId('orchestrator-banner')).toBeInTheDocument();
  });

  it('renders terminal toggle button', () => {
    renderWithProviders(<AppLayout />);

    const toggleButton = screen.getByRole('button', { name: /terminal/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('opens terminal panel when terminal button is clicked', () => {
    renderWithProviders(<AppLayout />);

    // Terminal should be closed initially
    expect(screen.queryByTestId('terminal-panel')).not.toBeInTheDocument();

    // Click terminal toggle button
    const toggleButton = screen.getByRole('button', { name: /open terminal/i });
    fireEvent.click(toggleButton);

    // Terminal panel should now be visible
    expect(screen.getByTestId('terminal-panel')).toBeInTheDocument();
  });

  it('closes terminal panel when clicking close', () => {
    renderWithProviders(<AppLayout />);

    // Open terminal first
    const openButton = screen.getByRole('button', { name: /open terminal/i });
    fireEvent.click(openButton);
    expect(screen.getByTestId('terminal-panel')).toBeInTheDocument();

    // Close terminal
    const closeButton = screen.getByRole('button', { name: /close terminal/i });
    fireEvent.click(closeButton);

    // Terminal panel should be hidden
    expect(screen.queryByTestId('terminal-panel')).not.toBeInTheDocument();
  });

  it('renders mobile menu button on small screens', () => {
    renderWithProviders(<AppLayout />);

    // The mobile menu button should be present (though might be hidden on desktop via CSS)
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('shows AgentMux title in mobile header', () => {
    renderWithProviders(<AppLayout />);

    expect(screen.getByText('AgentMux')).toBeInTheDocument();
  });
});
