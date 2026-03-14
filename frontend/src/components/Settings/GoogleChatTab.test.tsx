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

    it('should show connection mode toggle', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByTestId('mode-webhook')).toBeInTheDocument();
        expect(screen.getByTestId('mode-service-account')).toBeInTheDocument();
      });
    });

    it('should default to webhook mode', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Webhook Setup')).toBeInTheDocument();
      });
    });

    it('should switch to service account mode', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByTestId('mode-service-account')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('mode-service-account'));

      expect(screen.getByText('Service Account Setup')).toBeInTheDocument();
    });

    it('should show connect button', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Connect Google Chat')).toBeInTheDocument();
      });
    });
  });

  describe('Connected State', () => {
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

    it('should show disconnect button', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });
    });

    it('should show refresh button', async () => {
      render(<GoogleChatTab />);

      await waitFor(() => {
        expect(screen.getByText('Refresh Status')).toBeInTheDocument();
      });
    });
  });
});
