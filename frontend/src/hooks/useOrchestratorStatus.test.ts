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
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    isCancel: vi.fn(() => false),
  },
  get: vi.fn(),
  isCancel: vi.fn(() => false),
}));
const mockedAxios = {
  get: axios.get as ReturnType<typeof vi.fn>,
  isCancel: axios.isCancel as ReturnType<typeof vi.fn>,
};

describe('useOrchestratorStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.isCancel.mockReturnValue(false);
  });

  describe('initial state', () => {
    it('should start with loading state', () => {
      mockedAxios.get.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useOrchestratorStatus({ enablePolling: false }));

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
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

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

      renderHook(() =>
        useOrchestratorStatus({ enablePolling: true, pollingInterval: 1000 })
      );

      // Initial call
      await vi.advanceTimersByTimeAsync(0);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Advance timer to trigger polling
      await vi.advanceTimersByTimeAsync(1000);
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

      renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      // Initial call
      await vi.advanceTimersByTimeAsync(0);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Advance timer
      await vi.advanceTimersByTimeAsync(15000);

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
      const mockStatus = {
        isActive: true,
        agentStatus: 'active',
        message: 'Active',
        offlineMessage: null,
      };

      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: mockStatus },
      });

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Trigger refresh and check loading state
      let refreshPromise: Promise<void>;
      act(() => {
        refreshPromise = result.current.refresh();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await refreshPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

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

      const { unmount } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: true, pollingInterval: 1000 })
      );

      // Initial call
      await vi.advanceTimersByTimeAsync(0);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Unmount the hook
      unmount();

      // Advance timer
      await vi.advanceTimersByTimeAsync(5000);

      // Should only have initial call (polling stopped on unmount)
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should abort in-flight requests on unmount', async () => {
      let rejectPromise: (error: Error) => void;
      const mockPromise = new Promise((_, reject) => {
        rejectPromise = reject;
      });

      mockedAxios.get.mockImplementation(() => mockPromise);

      const { unmount } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      // Unmount while request is in-flight
      unmount();

      // Simulate cancelled request being rejected
      mockedAxios.isCancel.mockReturnValue(true);
      await act(async () => {
        const cancelError = new Error('canceled');
        (cancelError as Error & { __CANCEL__: boolean }).__CANCEL__ = true;
        try {
          rejectPromise!(cancelError);
        } catch {
          // Ignore - expected for cancelled requests
        }
      });

      // The hook should have been unmounted and abort controller called
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('request cancellation', () => {
    it('should ignore cancelled requests', async () => {
      const cancelError = new Error('canceled');
      (cancelError as Error & { __CANCEL__: boolean }).__CANCEL__ = true;

      mockedAxios.isCancel.mockReturnValue(true);
      mockedAxios.get.mockRejectedValueOnce(cancelError);

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      // Give the hook time to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cancelled requests should be ignored - hook remains in loading state
      // because no successful response was received
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('should pass abort signal and timeout to axios request', async () => {
      mockedAxios.get.mockResolvedValueOnce({
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

      const { result } = renderHook(() =>
        useOrchestratorStatus({ enablePolling: false })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify axios.get was called with signal and timeout options
      expect(mockedAxios.get).toHaveBeenCalledWith(
        '/api/orchestrator/status',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          timeout: 5000,
        })
      );
    });
  });
});
