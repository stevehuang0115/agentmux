/**
 * Teams Restore Popup Tests
 *
 * Tests for the TeamsRestorePopup component.
 *
 * @module components/TeamsRestorePopup.test
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TeamsRestorePopup } from './TeamsRestorePopup';
import { apiService } from '../services/api.service';

vi.mock('../services/api.service', () => ({
  apiService: {
    getTeamsBackupStatus: vi.fn(),
    restoreTeamsFromBackup: vi.fn(),
  },
}));

describe('TeamsRestorePopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when no mismatch exists', async () => {
    vi.mocked(apiService.getTeamsBackupStatus).mockResolvedValue({
      hasMismatch: false,
      backupTeamCount: 0,
      currentTeamCount: 2,
      backupTimestamp: null,
    });

    render(<TeamsRestorePopup />);

    await waitFor(() => {
      expect(apiService.getTeamsBackupStatus).toHaveBeenCalled();
    });

    expect(screen.queryByText('Teams Data Missing')).not.toBeInTheDocument();
  });

  it('should render popup when mismatch is detected', async () => {
    vi.mocked(apiService.getTeamsBackupStatus).mockResolvedValue({
      hasMismatch: true,
      backupTeamCount: 3,
      currentTeamCount: 0,
      backupTimestamp: '2026-02-08T12:00:00.000Z',
    });

    render(<TeamsRestorePopup />);

    await waitFor(() => {
      expect(screen.getByText('Teams Data Missing')).toBeInTheDocument();
    });

    expect(screen.getByText(/3 teams/)).toBeInTheDocument();
    expect(screen.getByText('Restore')).toBeInTheDocument();
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('should close when Dismiss is clicked', async () => {
    vi.mocked(apiService.getTeamsBackupStatus).mockResolvedValue({
      hasMismatch: true,
      backupTeamCount: 2,
      currentTeamCount: 0,
      backupTimestamp: '2026-02-08T12:00:00.000Z',
    });

    const user = userEvent.setup();
    render(<TeamsRestorePopup />);

    await waitFor(() => {
      expect(screen.getByText('Teams Data Missing')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Dismiss'));

    await waitFor(() => {
      expect(screen.queryByText('Teams Data Missing')).not.toBeInTheDocument();
    });
  });

  it('should call restore API and reload on success', async () => {
    vi.mocked(apiService.getTeamsBackupStatus).mockResolvedValue({
      hasMismatch: true,
      backupTeamCount: 2,
      currentTeamCount: 0,
      backupTimestamp: '2026-02-08T12:00:00.000Z',
    });
    vi.mocked(apiService.restoreTeamsFromBackup).mockResolvedValue({
      restoredCount: 2,
      totalInBackup: 2,
    });

    // Mock window.location.reload
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });

    const user = userEvent.setup();
    render(<TeamsRestorePopup />);

    await waitFor(() => {
      expect(screen.getByText('Teams Data Missing')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Restore'));

    await waitFor(() => {
      expect(apiService.restoreTeamsFromBackup).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(reloadMock).toHaveBeenCalled();
    });
  });

  it('should show error on restore failure', async () => {
    vi.mocked(apiService.getTeamsBackupStatus).mockResolvedValue({
      hasMismatch: true,
      backupTeamCount: 2,
      currentTeamCount: 0,
      backupTimestamp: '2026-02-08T12:00:00.000Z',
    });
    vi.mocked(apiService.restoreTeamsFromBackup).mockRejectedValue(
      new Error('Restore failed')
    );

    const user = userEvent.setup();
    render(<TeamsRestorePopup />);

    await waitFor(() => {
      expect(screen.getByText('Teams Data Missing')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Restore'));

    await waitFor(() => {
      expect(screen.getByText('Restore failed')).toBeInTheDocument();
    });

    // Popup should still be open
    expect(screen.getByText('Teams Data Missing')).toBeInTheDocument();
  });

  it('should show partial error when some teams fail to restore', async () => {
    vi.mocked(apiService.getTeamsBackupStatus).mockResolvedValue({
      hasMismatch: true,
      backupTeamCount: 3,
      currentTeamCount: 0,
      backupTimestamp: '2026-02-08T12:00:00.000Z',
    });
    vi.mocked(apiService.restoreTeamsFromBackup).mockResolvedValue({
      restoredCount: 2,
      totalInBackup: 3,
      errors: ['Failed to restore team Alpha: disk error'],
    });

    const user = userEvent.setup();
    render(<TeamsRestorePopup />);

    await waitFor(() => {
      expect(screen.getByText('Teams Data Missing')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Restore'));

    await waitFor(() => {
      expect(screen.getByText(/Restored 2 of 3 teams/)).toBeInTheDocument();
    });
  });

  it('should handle API error on status check gracefully', async () => {
    vi.mocked(apiService.getTeamsBackupStatus).mockRejectedValue(
      new Error('Network error')
    );

    render(<TeamsRestorePopup />);

    await waitFor(() => {
      expect(apiService.getTeamsBackupStatus).toHaveBeenCalled();
    });

    // Should not show popup on error
    expect(screen.queryByText('Teams Data Missing')).not.toBeInTheDocument();
  });

  it('should show singular "team" for backup with 1 team', async () => {
    vi.mocked(apiService.getTeamsBackupStatus).mockResolvedValue({
      hasMismatch: true,
      backupTeamCount: 1,
      currentTeamCount: 0,
      backupTimestamp: '2026-02-08T12:00:00.000Z',
    });

    render(<TeamsRestorePopup />);

    await waitFor(() => {
      expect(screen.getByText(/1 team(?!s)/)).toBeInTheDocument();
    });
  });
});
