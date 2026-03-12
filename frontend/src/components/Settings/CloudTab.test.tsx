/**
 * CloudTab Component Tests
 *
 * @module components/Settings/CloudTab.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CloudTab } from './CloudTab';

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('CloudTab', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockFetch.mockReset();
    vi.stubGlobal('location', { ...window.location, href: 'http://localhost:5173/settings', origin: 'http://localhost:5173', search: '' });
    vi.stubGlobal('history', { replaceState: vi.fn() });
  });

  it('should render sign-in button when not connected', async () => {
    render(<CloudTab />);

    await waitFor(() => {
      expect(screen.getByTestId('cloud-sign-in-button')).toBeDefined();
    });
  });

  it('should show user info when token is valid', async () => {
    mockStorage.set('crewly_cloud_token', 'valid-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'u1', email: 'test@test.com', plan: 'pro', name: 'Test User' },
      }),
    });

    render(<CloudTab />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeDefined();
      expect(screen.getByText('test@test.com')).toBeDefined();
      expect(screen.getByText('Pro')).toBeDefined();
    });
  });

  it('should clear token when validation fails', async () => {
    mockStorage.set('crewly_cloud_token', 'invalid-token');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Invalid token' }),
    });

    render(<CloudTab />);

    await waitFor(() => {
      expect(mockStorage.has('crewly_cloud_token')).toBe(false);
    });
  });

  it('should disconnect when disconnect button clicked', async () => {
    mockStorage.set('crewly_cloud_token', 'valid-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'u1', email: 'test@test.com', plan: 'free' },
      }),
    });

    render(<CloudTab />);

    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Disconnect'));

    await waitFor(() => {
      expect(mockStorage.has('crewly_cloud_token')).toBe(false);
      expect(screen.getByTestId('cloud-sign-in-button')).toBeDefined();
    });
  });
});
