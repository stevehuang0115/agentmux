import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Navigation } from './Navigation';
import { SidebarProvider } from '../../contexts/SidebarContext';

// Mock the QRCodeDisplay component
vi.mock('./QRCodeDisplay', () => ({
  QRCodeDisplay: () => <div data-testid="qr-code">QR Code</div>
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <SidebarProvider>
        {component}
      </SidebarProvider>
    </BrowserRouter>
  );
};

describe('Navigation', () => {
  it('renders all navigation items when expanded', () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('Schedules')).toBeInTheDocument();
  });

  it('shows logo text when expanded', () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByText('Crewly')).toBeInTheDocument();
  });

  it('shows collapse toggle button in footer', () => {
    renderWithProviders(<Navigation />);

    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('toggles sidebar when footer button is clicked', () => {
    renderWithProviders(<Navigation />);

    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });

    // Initially expanded, should show navigation labels
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Collapse')).toBeInTheDocument();

    fireEvent.click(toggleButton);

    // After clicking, button label should change to "Expand sidebar"
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
  });

  it('renders navigation links correctly', () => {
    renderWithProviders(<Navigation />);

    // Check that all navigation links are present and have correct href attributes
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const projectsLink = screen.getByRole('link', { name: /projects/i });
    const teamsLink = screen.getByRole('link', { name: /teams/i });
    const schedulesLink = screen.getByRole('link', { name: /schedules/i });

    expect(dashboardLink).toHaveAttribute('href', '/');
    expect(projectsLink).toHaveAttribute('href', '/projects');
    expect(teamsLink).toHaveAttribute('href', '/teams');
    expect(schedulesLink).toHaveAttribute('href', '/scheduled-checkins');
  });

  it('shows QR code display', () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
  });

  it('renders close button when mobile menu is open', () => {
    const onMobileClose = vi.fn();
    renderWithProviders(<Navigation isMobileOpen={true} onMobileClose={onMobileClose} />);

    const closeButton = screen.getByRole('button', { name: /close menu/i });
    expect(closeButton).toBeInTheDocument();

    fireEvent.click(closeButton);
    expect(onMobileClose).toHaveBeenCalled();
  });

  it('renders Settings link in navigation', () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('Settings link has correct href', () => {
    renderWithProviders(<Navigation />);

    const settingsLink = screen.getByRole('link', { name: /settings/i });
    expect(settingsLink).toHaveAttribute('href', '/settings');
  });
});
