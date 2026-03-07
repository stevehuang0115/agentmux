/**
 * Tests for CloudConnectionBanner component
 *
 * @module components/CloudConnectionBanner.test
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CloudConnectionBanner } from './CloudConnectionBanner';
import type { UseCloudConnectionResult } from '../hooks/useCloudConnection';

// Mock the hook
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockRefresh = vi.fn();

vi.mock('../hooks/useCloudConnection', () => ({
  useCloudConnection: vi.fn(() => ({
    isConnected: false,
    tier: null,
    isLoading: true,
    isActioning: false,
    error: null,
    connect: mockConnect,
    disconnect: mockDisconnect,
    refresh: mockRefresh,
  })),
}));

import { useCloudConnection } from '../hooks/useCloudConnection';

/** Creates a disconnected hook result */
function setDisconnected(overrides?: Partial<UseCloudConnectionResult>): void {
  vi.mocked(useCloudConnection).mockReturnValue({
    isConnected: false,
    tier: null,
    isLoading: false,
    isActioning: false,
    error: null,
    connect: mockConnect,
    disconnect: mockDisconnect,
    refresh: mockRefresh,
    ...overrides,
  });
}

/** Creates a connected hook result */
function setConnected(overrides?: Partial<UseCloudConnectionResult>): void {
  vi.mocked(useCloudConnection).mockReturnValue({
    isConnected: true,
    tier: 'pro',
    isLoading: false,
    isActioning: false,
    error: null,
    connect: mockConnect,
    disconnect: mockDisconnect,
    refresh: mockRefresh,
    ...overrides,
  });
}

describe('CloudConnectionBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(true);
    mockDisconnect.mockResolvedValue(true);
  });

  it('should render nothing when loading', () => {
    vi.mocked(useCloudConnection).mockReturnValue({
      isConnected: false,
      tier: null,
      isLoading: true,
      isActioning: false,
      error: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      refresh: mockRefresh,
    });

    const { container } = render(<CloudConnectionBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('should render disconnected banner with connect button', () => {
    setDisconnected();
    render(<CloudConnectionBanner />);

    expect(screen.getByText('CrewlyAI Cloud')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
  });

  it('should render connected banner with tier badge', () => {
    setConnected();
    render(<CloudConnectionBanner />);

    expect(screen.getByText('Connected to CrewlyAI Cloud')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('should render enterprise tier badge correctly', () => {
    setConnected({ tier: 'enterprise' });
    render(<CloudConnectionBanner />);

    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('should render free tier badge correctly', () => {
    setConnected({ tier: 'free' });
    render(<CloudConnectionBanner />);

    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('should dismiss when X button is clicked in disconnected state', async () => {
    setDisconnected();
    const user = userEvent.setup();
    render(<CloudConnectionBanner />);

    await user.click(screen.getByLabelText('Dismiss cloud banner'));

    expect(screen.queryByText('CrewlyAI Cloud')).not.toBeInTheDocument();
  });

  it('should dismiss when X button is clicked in connected state', async () => {
    setConnected();
    const user = userEvent.setup();
    render(<CloudConnectionBanner />);

    await user.click(screen.getByLabelText('Dismiss cloud banner'));

    expect(screen.queryByText('Connected to CrewlyAI Cloud')).not.toBeInTheDocument();
  });

  it('should open connect modal when Connect button is clicked', async () => {
    setDisconnected();
    const user = userEvent.setup();
    render(<CloudConnectionBanner />);

    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(screen.getByText('Connect to CrewlyAI Cloud')).toBeInTheDocument();
    expect(screen.getByLabelText('API Token')).toBeInTheDocument();
  });

  it('should disable modal Connect button when token is empty', async () => {
    setDisconnected();
    const user = userEvent.setup();
    render(<CloudConnectionBanner />);

    // Open modal
    await user.click(screen.getByRole('button', { name: /^connect$/i }));

    // The modal's Connect button should be disabled when token is empty
    const connectButtons = screen.getAllByRole('button', { name: /connect/i });
    const modalConnectButton = connectButtons[connectButtons.length - 1];
    expect(modalConnectButton).toBeDisabled();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('should call connect with token when form is submitted', async () => {
    setDisconnected();
    const user = userEvent.setup();
    render(<CloudConnectionBanner />);

    // Open modal
    await user.click(screen.getByRole('button', { name: /^connect$/i }));

    // Enter token
    await user.type(screen.getByLabelText('API Token'), 'crewly_cloud_test123');

    // Submit
    const connectButtons = screen.getAllByRole('button', { name: /connect/i });
    const modalConnectButton = connectButtons[connectButtons.length - 1];
    await user.click(modalConnectButton);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('crewly_cloud_test123', undefined);
    });
  });

  it('should call disconnect when Disconnect button is clicked', async () => {
    setConnected();
    const user = userEvent.setup();
    render(<CloudConnectionBanner />);

    await user.click(screen.getByRole('button', { name: /disconnect/i }));

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  it('should disable disconnect button while actioning', () => {
    setConnected({ isActioning: true });
    render(<CloudConnectionBanner />);

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    expect(disconnectButton).toBeDisabled();
  });

  it('should close modal when Cancel is clicked', async () => {
    setDisconnected();
    const user = userEvent.setup();
    render(<CloudConnectionBanner />);

    // Open modal
    await user.click(screen.getByRole('button', { name: /^connect$/i }));
    expect(screen.getByLabelText('API Token')).toBeInTheDocument();

    // Cancel
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // Modal should be closed
    expect(screen.queryByLabelText('API Token')).not.toBeInTheDocument();
  });
});
