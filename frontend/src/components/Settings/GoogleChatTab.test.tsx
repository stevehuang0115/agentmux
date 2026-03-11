/**
 * Tests for GoogleChatTab Component
 *
 * @module components/Settings/GoogleChatTab.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GoogleChatTab } from './GoogleChatTab';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GoogleChatTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      render(<GoogleChatTab />);

      expect(screen.getByText('Loading Google Chat status...')).toBeInTheDocument();
    });
  });

  describe('Disconnected State', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ platform: 'google-chat', connected: false, details: { mode: 'none' } }],
        }),
      });
    });

    it('should show not connected status', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Not connected to Google Chat')).toBeInTheDocument();
      });
    });

    it('should show all three connection mode toggles', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByTestId('mode-pubsub')).toBeInTheDocument();
        expect(screen.getByTestId('mode-webhook')).toBeInTheDocument();
        expect(screen.getByTestId('mode-service-account')).toBeInTheDocument();
      });
    });

    it('should default to pubsub mode', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Pub/Sub Setup (Bidirectional)')).toBeInTheDocument();
      });
    });

    it('should show projectId and subscriptionName fields in pubsub mode', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByLabelText(/GCP Project ID/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Pub\/Sub Subscription Name/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Service Account Key/)).toBeInTheDocument();
      });
    });

    it('should switch to webhook mode', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByTestId('mode-webhook')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('mode-webhook'));

      expect(screen.getByText('Webhook Setup (Send-only)')).toBeInTheDocument();
      expect(screen.getByLabelText(/Webhook URL/)).toBeInTheDocument();
    });

    it('should switch to service account mode', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByTestId('mode-service-account')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('mode-service-account'));

      expect(screen.getByText('Service Account Setup (Send-only)')).toBeInTheDocument();
    });

    it('should show connect button', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Connect Google Chat')).toBeInTheDocument();
      });
    });
  });

  describe('Connected State (webhook)', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{ platform: 'google-chat', connected: true, details: { mode: 'webhook' } }],
        }),
      });
    });

    it('should show connected status', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Connected to Google Chat')).toBeInTheDocument();
      });
    });

    it('should show connection mode in details', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Webhook')).toBeInTheDocument();
      });
    });

    it('should show disconnect and refresh buttons', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
        expect(screen.getByText('Refresh Status')).toBeInTheDocument();
      });
    });
  });

  describe('Connected State (pubsub)', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{
            platform: 'google-chat',
            connected: true,
            details: {
              mode: 'pubsub',
              projectId: 'my-project',
              subscriptionName: 'projects/my-project/subscriptions/chat-sub',
              pullActive: true,
              pullPaused: false,
            },
          }],
        }),
      });
    });

    it('should show pubsub mode label', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Pub/Sub (Bidirectional)')).toBeInTheDocument();
      });
    });

    it('should show project ID', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('my-project')).toBeInTheDocument();
      });
    });

    it('should show pull status as Active', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });
  });

  describe('Connected State (pubsub paused)', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: [{
            platform: 'google-chat',
            connected: true,
            details: {
              mode: 'pubsub',
              projectId: 'my-project',
              pullActive: false,
              pullPaused: true,
            },
          }],
        }),
      });
    });

    it('should show pull status as Paused', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Paused (errors)')).toBeInTheDocument();
      });
    });
  });
});
