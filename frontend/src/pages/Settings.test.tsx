/**
 * Tests for Settings Page
 *
 * @module pages/Settings.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { Settings } from './Settings';

// Mock the tab components
vi.mock('../components/Settings/GeneralTab', () => ({
  GeneralTab: () => <div data-testid="general-tab">General Tab Content</div>,
}));

vi.mock('../components/Settings/RolesTab', () => ({
  RolesTab: () => <div data-testid="roles-tab">Roles Tab Content</div>,
}));

vi.mock('../components/Settings/SkillsTab', () => ({
  SkillsTab: () => <div data-testid="skills-tab">Skills Tab Content</div>,
}));

vi.mock('../components/Settings/SlackTab', () => ({
  SlackTab: () => <div data-testid="slack-tab">Slack Tab Content</div>,
}));

describe('Settings Page', () => {
  describe('Rendering', () => {
    it('should render settings page with header', () => {
      render(<Settings />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText(/Configure AgentMux/)).toBeInTheDocument();
    });

    it('should show all tab buttons', () => {
      render(<Settings />);

      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Roles')).toBeInTheDocument();
      expect(screen.getByText('Skills')).toBeInTheDocument();
      expect(screen.getByText('Slack')).toBeInTheDocument();
    });

    it('should show tab icons', () => {
      render(<Settings />);

      expect(screen.getByText('⚙️')).toBeInTheDocument();
      expect(screen.getByText('👤')).toBeInTheDocument();
      expect(screen.getByText('🛠️')).toBeInTheDocument();
      expect(screen.getByText('💬')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should show General tab by default', () => {
      render(<Settings />);

      expect(screen.getByTestId('general-tab')).toBeInTheDocument();
      expect(screen.queryByTestId('roles-tab')).not.toBeInTheDocument();
      expect(screen.queryByTestId('skills-tab')).not.toBeInTheDocument();
      expect(screen.queryByTestId('slack-tab')).not.toBeInTheDocument();
    });

    it('should switch to Slack tab when clicked', () => {
      render(<Settings />);

      fireEvent.click(screen.getByText('Slack'));

      expect(screen.getByTestId('slack-tab')).toBeInTheDocument();
      expect(screen.queryByTestId('general-tab')).not.toBeInTheDocument();
    });

    it('should switch to Roles tab when clicked', () => {
      render(<Settings />);

      fireEvent.click(screen.getByText('Roles'));

      expect(screen.getByTestId('roles-tab')).toBeInTheDocument();
      expect(screen.queryByTestId('general-tab')).not.toBeInTheDocument();
    });

    it('should switch to Skills tab when clicked', () => {
      render(<Settings />);

      fireEvent.click(screen.getByText('Skills'));

      expect(screen.getByTestId('skills-tab')).toBeInTheDocument();
      expect(screen.queryByTestId('general-tab')).not.toBeInTheDocument();
    });

    it('should switch back to General tab from another tab', () => {
      render(<Settings />);

      // Go to Roles tab
      fireEvent.click(screen.getByText('Roles'));
      expect(screen.getByTestId('roles-tab')).toBeInTheDocument();

      // Go back to General
      fireEvent.click(screen.getByText('General'));
      expect(screen.getByTestId('general-tab')).toBeInTheDocument();
    });
  });

  describe('Active Tab Styling', () => {
    it('should mark General tab as active by default', () => {
      render(<Settings />);

      const generalButton = screen.getByText('General').closest('button');
      expect(generalButton).toHaveClass('active');
    });

    it('should mark active tab with active class and remove from previous', () => {
      render(<Settings />);

      const generalButton = screen.getByText('General').closest('button');
      const rolesButton = screen.getByText('Roles').closest('button');

      expect(generalButton).toHaveClass('active');
      expect(rolesButton).not.toHaveClass('active');

      fireEvent.click(screen.getByText('Roles'));

      expect(rolesButton).toHaveClass('active');
      expect(generalButton).not.toHaveClass('active');
    });
  });

  describe('Accessibility', () => {
    it('should have proper tab role attributes', () => {
      render(<Settings />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(4);
    });

    it('should set aria-selected on active tab', () => {
      render(<Settings />);

      const generalTab = screen.getByText('General').closest('button');
      const rolesTab = screen.getByText('Roles').closest('button');

      expect(generalTab).toHaveAttribute('aria-selected', 'true');
      expect(rolesTab).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(screen.getByText('Roles'));

      expect(generalTab).toHaveAttribute('aria-selected', 'false');
      expect(rolesTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should have tabpanel role on content area', () => {
      render(<Settings />);

      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toBeInTheDocument();
    });
  });
});
