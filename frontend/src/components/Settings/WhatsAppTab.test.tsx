/**
 * Tests for WhatsAppTab Component
 *
 * @module components/Settings/WhatsAppTab.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WhatsAppTab } from './WhatsAppTab';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.confirm
const mockConfirm = vi.fn();
global.confirm = mockConfirm;

describe('WhatsAppTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves
      render(<WhatsAppTab />);

      expect(screen.getByText('Loading WhatsApp status...')).toBeInTheDocument();
    });
  });

  describe('Disconnected State', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: { connected: false, isConfigured: false },
        }),
      });
    });

    it('should show not connected status', async () => {
      render(<WhatsAppTab />);

      await waitFor(() => {
        expect(screen.getByText('Not connected to WhatsApp')).toBeInTheDocument();
      });
    });

    it('should show setup instructions', async () => {
      render(<WhatsAppTab />);

      await waitFor(() => {
        expect(screen.getByText('How to Connect')).toBeInTheDocument();
      });
    });

    it('should show connect button', async () => {
      render(<WhatsAppTab />);

      await waitFor(() => {
        expect(screen.getByText('Connect WhatsApp')).toBeInTheDocument();
      });
    });
  });

  describe('Connected State', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: true,
          data: {
            connected: true,
            isConfigured: true,
            phoneNumber: '+1234567890',
            messagesSent: 10,
            messagesReceived: 5,
          },
        }),
      });
    });

    it('should show connected status', async () => {
      render(<WhatsAppTab />);

      await waitFor(() => {
        expect(screen.getByText('Connected to WhatsApp')).toBeInTheDocument();
      });
    });

    it('should show connection details', async () => {
      render(<WhatsAppTab />);

      await waitFor(() => {
        expect(screen.getByText('+1234567890')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('should show disconnect button', async () => {
      render(<WhatsAppTab />);

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });
    });

    it('should show refresh button', async () => {
      render(<WhatsAppTab />);

      await waitFor(() => {
        expect(screen.getByText('Refresh Status')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show not connected when fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      render(<WhatsAppTab />);

      await waitFor(() => {
        expect(screen.getByText('Not connected to WhatsApp')).toBeInTheDocument();
      });
    });

    it('should show error when API returns error', async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({
          success: false,
          error: 'Service unavailable',
        }),
      });
      render(<WhatsAppTab />);

      await waitFor(() => {
        expect(screen.getByText('Not connected to WhatsApp')).toBeInTheDocument();
      });
    });
  });
});
