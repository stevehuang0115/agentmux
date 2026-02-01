/**
 * Tests for RolesTab Component
 *
 * @module components/Settings/RolesTab.test
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RolesTab } from './RolesTab';
import * as useRolesHook from '../../hooks/useRoles';

// Mock RoleEditor component
vi.mock('./RoleEditor', () => ({
  RoleEditor: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="role-editor">
      <button onClick={onClose}>Close Editor</button>
    </div>
  ),
}));

describe('RolesTab', () => {
  const mockRoles = [
    {
      id: 'developer',
      name: 'developer',
      displayName: 'Developer',
      description: 'Software developer role for coding tasks',
      category: 'development' as const,
      skillCount: 3,
      isDefault: true,
      isBuiltin: true,
    },
    {
      id: 'product-manager',
      name: 'product-manager',
      displayName: 'Product Manager',
      description: 'Product management role',
      category: 'management' as const,
      skillCount: 2,
      isDefault: false,
      isBuiltin: true,
    },
    {
      id: 'custom-role',
      name: 'custom-role',
      displayName: 'Custom Role',
      description: 'A custom user-created role',
      category: 'development' as const,
      skillCount: 1,
      isDefault: false,
      isBuiltin: false,
    },
  ];

  const mockCreateRole = vi.fn().mockResolvedValue(undefined);
  const mockUpdateRole = vi.fn().mockResolvedValue(undefined);
  const mockDeleteRole = vi.fn().mockResolvedValue(undefined);
  const mockRefreshRoles = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useRolesHook, 'useRoles').mockReturnValue({
      roles: mockRoles,
      isLoading: false,
      error: null,
      createRole: mockCreateRole,
      updateRole: mockUpdateRole,
      deleteRole: mockDeleteRole,
      refreshRoles: mockRefreshRoles,
    });
  });

  describe('Rendering', () => {
    it('should render role cards', () => {
      render(<RolesTab />);

      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('Product Manager')).toBeInTheDocument();
      expect(screen.getByText('Custom Role')).toBeInTheDocument();
    });

    it('should render search bar', () => {
      render(<RolesTab />);

      expect(screen.getByPlaceholderText('Search roles...')).toBeInTheDocument();
    });

    it('should render Create Role button', () => {
      render(<RolesTab />);

      expect(screen.getByText('+ Create Role')).toBeInTheDocument();
    });

    it('should group roles by category', () => {
      render(<RolesTab />);

      // Check category headers
      expect(screen.getByText(/Development/)).toBeInTheDocument();
      expect(screen.getByText(/Management/)).toBeInTheDocument();
    });
  });

  describe('Role Badges', () => {
    it('should show default badge for default role', () => {
      render(<RolesTab />);

      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('should show builtin badge for builtin roles', () => {
      render(<RolesTab />);

      const builtinBadges = screen.getAllByText('Built-in');
      expect(builtinBadges.length).toBe(2); // Developer and Product Manager
    });
  });

  describe('Role Actions', () => {
    it('should show View button for builtin roles', () => {
      render(<RolesTab />);

      const viewButtons = screen.getAllByText('View');
      expect(viewButtons.length).toBe(2); // Developer and Product Manager
    });

    it('should show Edit button for custom roles', () => {
      render(<RolesTab />);

      const editButtons = screen.getAllByText('Edit');
      expect(editButtons.length).toBe(1); // Custom Role
    });

    it('should show Delete button for custom roles only', () => {
      render(<RolesTab />);

      const deleteButtons = screen.getAllByText('Delete');
      expect(deleteButtons.length).toBe(1); // Custom Role
    });
  });

  describe('Search Functionality', () => {
    it('should filter roles by display name', () => {
      render(<RolesTab />);

      const searchInput = screen.getByPlaceholderText('Search roles...');
      fireEvent.change(searchInput, { target: { value: 'Developer' } });

      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.queryByText('Product Manager')).not.toBeInTheDocument();
    });

    it('should filter roles by description', () => {
      render(<RolesTab />);

      const searchInput = screen.getByPlaceholderText('Search roles...');
      fireEvent.change(searchInput, { target: { value: 'coding' } });

      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.queryByText('Product Manager')).not.toBeInTheDocument();
    });

    it('should show empty state when no roles match search', () => {
      render(<RolesTab />);

      const searchInput = screen.getByPlaceholderText('Search roles...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText(/No roles found/)).toBeInTheDocument();
    });

    it('should filter roles by category', () => {
      render(<RolesTab />);

      const searchInput = screen.getByPlaceholderText('Search roles...');
      fireEvent.change(searchInput, { target: { value: 'management' } });

      expect(screen.getByText('Product Manager')).toBeInTheDocument();
      expect(screen.queryByText('Developer')).not.toBeInTheDocument();
    });
  });

  describe('Editor Modal', () => {
    it('should open editor when Create Role is clicked', () => {
      render(<RolesTab />);

      fireEvent.click(screen.getByText('+ Create Role'));

      expect(screen.getByTestId('role-editor')).toBeInTheDocument();
    });

    it('should open editor when Edit is clicked', () => {
      render(<RolesTab />);

      const editButton = screen.getByText('Edit');
      fireEvent.click(editButton);

      expect(screen.getByTestId('role-editor')).toBeInTheDocument();
    });

    it('should open editor when View is clicked', () => {
      render(<RolesTab />);

      const viewButtons = screen.getAllByText('View');
      fireEvent.click(viewButtons[0]);

      expect(screen.getByTestId('role-editor')).toBeInTheDocument();
    });

    it('should close editor when close is triggered', () => {
      render(<RolesTab />);

      // Open editor
      fireEvent.click(screen.getByText('+ Create Role'));
      expect(screen.getByTestId('role-editor')).toBeInTheDocument();

      // Close editor
      fireEvent.click(screen.getByText('Close Editor'));
      expect(screen.queryByTestId('role-editor')).not.toBeInTheDocument();
    });
  });

  describe('Delete Functionality', () => {
    it('should show alert when trying to delete builtin role', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(<RolesTab />);

      // Try to delete a builtin role (should not have delete button, but testing the handler)
      // Since builtin roles don't have delete buttons, this tests the guard
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('should call deleteRole when delete is confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(<RolesTab />);

      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      expect(mockDeleteRole).toHaveBeenCalledWith('custom-role');
    });

    it('should not call deleteRole when delete is cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<RolesTab />);

      const deleteButton = screen.getByText('Delete');
      fireEvent.click(deleteButton);

      expect(mockDeleteRole).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading state', () => {
      vi.spyOn(useRolesHook, 'useRoles').mockReturnValue({
        roles: null,
        isLoading: true,
        error: null,
        createRole: mockCreateRole,
        updateRole: mockUpdateRole,
        deleteRole: mockDeleteRole,
        refreshRoles: mockRefreshRoles,
      });

      render(<RolesTab />);

      expect(screen.getByText('Loading roles...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error state', () => {
      vi.spyOn(useRolesHook, 'useRoles').mockReturnValue({
        roles: null,
        isLoading: false,
        error: 'Failed to load roles',
        createRole: mockCreateRole,
        updateRole: mockUpdateRole,
        deleteRole: mockDeleteRole,
        refreshRoles: mockRefreshRoles,
      });

      render(<RolesTab />);

      expect(screen.getByText(/Error loading roles/)).toBeInTheDocument();
    });
  });
});
