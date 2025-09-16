import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { Navigation } from './Navigation';
import { SidebarProvider } from '../../contexts/SidebarContext';

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
    expect(screen.getByText('Assignments')).toBeInTheDocument();
    expect(screen.getByText('Schedules')).toBeInTheDocument();
  });

  it('shows logo text when expanded', () => {
    renderWithProviders(<Navigation />);

    expect(screen.getByText('AgentMux')).toBeInTheDocument();
  });

  it('shows toggle button in footer', () => {
    renderWithProviders(<Navigation />);

    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('toggles sidebar when footer button is clicked', () => {
    renderWithProviders(<Navigation />);

    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });

    // Initially expanded, should show navigation labels
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    fireEvent.click(toggleButton);

    // After clicking, button text should change
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
  });

  it('adds collapsed class when sidebar is collapsed', () => {
    renderWithProviders(<Navigation />);

    const navigation = document.querySelector('.navigation');
    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });

    // Initially not collapsed
    expect(navigation).not.toHaveClass('navigation--collapsed');

    fireEvent.click(toggleButton);

    // After clicking, should have collapsed class
    expect(navigation).toHaveClass('navigation--collapsed');
  });

  it('shows tooltips for navigation items when collapsed', () => {
    renderWithProviders(<Navigation />);

    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    fireEvent.click(toggleButton);

    // Navigation items should have title attributes when collapsed
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute('title', 'Dashboard');
  });

  it('shows correct toggle icon based on state', () => {
    renderWithProviders(<Navigation />);

    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });

    // Initially expanded, should show ChevronLeft (collapse) icon
    expect(toggleButton.querySelector('.toggle-icon')).toBeInTheDocument();

    fireEvent.click(toggleButton);

    // After clicking, should show ChevronRight (expand) icon
    const expandButton = screen.getByRole('button', { name: /expand sidebar/i });
    expect(expandButton.querySelector('.toggle-icon')).toBeInTheDocument();
  });

  it('renders navigation links correctly', () => {
    renderWithProviders(<Navigation />);

    // Check that all navigation links are present and have correct href attributes
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const projectsLink = screen.getByRole('link', { name: /projects/i });
    const teamsLink = screen.getByRole('link', { name: /teams/i });
    const assignmentsLink = screen.getByRole('link', { name: /assignments/i });
    const schedulesLink = screen.getByRole('link', { name: /schedules/i });

    expect(dashboardLink).toHaveAttribute('href', '/');
    expect(projectsLink).toHaveAttribute('href', '/projects');
    expect(teamsLink).toHaveAttribute('href', '/teams');
    expect(assignmentsLink).toHaveAttribute('href', '/assignments');
    expect(schedulesLink).toHaveAttribute('href', '/scheduled-checkins');
  });
});