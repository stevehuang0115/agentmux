/**
 * Use Orchestrator Status Hook Tests
 *
 * Tests for the useOrchestratorStatus hook.
 *
 * @module hooks/useOrchestratorStatus.test
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { useOrchestratorStatus } from './useOrchestratorStatus';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('useOrchestratorStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with loading state', () => {
      mockedAxios.get.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useOrchestratorStatus());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.status).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('successful fetch', () => {
    it('should fetch and return active status', async () => {
      const mockStatus = {
        isActive: true,
        agentStatus: 'active',
        message: 'Orchestrator is active and ready.',
        offlineMessage: null,
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: mockStatus },
      });

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status).toEqual(mockStatus);
      expect(result.current.error).toBeNull();
    });

    it('should fetch and return inactive status', async () => {
      const mockStatus = {
        isActive: false,
        agentStatus: 'inactive',
        message: 'Orchestrator is not running.',
        offlineMessage: 'The orchestrator is currently offline. Please start it from the Dashboard.',
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: mockStatus },
      });

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.status?.isActive).toBe(false);
      expect(result.current.status?.offlineMessage).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.status?.isActive).toBe(false);
    });

    it('should handle API returning error response', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { success: false, error: 'Server error' },
      });

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Server error');
    });
  });

  describe('polling', () => {
    it('should poll for status when enablePolling is true', async () => {
      const mockStatus = {
        isActive: true,
        agentStatus: 'active',
        message: 'Orchestrator is active.',
        offlineMessage: null,
      };

      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: mockStatus },
      });

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: true, pollingInterval: 1000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initial call
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Advance timer to trigger polling
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should not poll when enablePolling is false', async () => {
      const mockStatus = {
        isActive: true,
        agentStatus: 'active',
        message: 'Orchestrator is active.',
        offlineMessage: null,
      };

      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: mockStatus },
      });

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Initial call
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Advance timer
      await act(async () => {
        vi.advanceTimersByTime(15000);
      });

      // Should still be 1 (no polling)
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    it('should allow manual refresh', async () => {
      const mockStatus = {
        isActive: true,
        agentStatus: 'active',
        message: 'Orchestrator is active.',
        offlineMessage: null,
      };

      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: mockStatus },
      });

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Trigger manual refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should set loading state during refresh', async () => {
      let resolvePromise: (value: unknown) => void;
      const mockPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockedAxios.get.mockImplementation(() => mockPromise);

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          data: {
            success: true,
            data: {
              isActive: true,
              agentStatus: 'active',
              message: 'Active',
              offlineMessage: null,
            },
          },
        });
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup polling interval on unmount', async () => {
      const mockStatus = {
        isActive: true,
        agentStatus: 'active',
        message: 'Orchestrator is active.',
        offlineMessage: null,
      };

      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: mockStatus },
      });

      const { result, unmount } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: true, pollingInterval: 1000 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Unmount the hook
      unmount();

      // Advance timer
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Should only have initial call (polling stopped on unmount)
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });
});
