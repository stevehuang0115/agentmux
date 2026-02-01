/**
 * Use Orchestrator Status Hook
 *
 * Custom hook for checking orchestrator status.
 * Used by Chat and other components to determine if orchestrator is active.
 *
 * @module hooks/useOrchestratorStatus
 */

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// =============================================================================
// Types
// =============================================================================

/**
 * Orchestrator status data from the API
 */
export interface OrchestratorStatus {
  /** Whether the orchestrator is active and ready */
  isActive: boolean;
  /** Current agent status (active, inactive, activating) */
  agentStatus: string | null;
  /** Human-readable status message */
  message: string;
  /** User-friendly offline message for display */
  offlineMessage: string | null;
}

/**
 * Return type for the useOrchestratorStatus hook
 */
export interface UseOrchestratorStatusResult {
  /** Current orchestrator status */
  status: OrchestratorStatus | null;
  /** Whether the status is being loaded */
  isLoading: boolean;
  /** Error message if status check failed */
  error: string | null;
  /** Function to manually refresh status */
  refresh: () => Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

/** API endpoint for orchestrator status */
const ORCHESTRATOR_STATUS_ENDPOINT = '/api/orchestrator/status';

/** Polling interval in milliseconds (10 seconds) */
const POLLING_INTERVAL = 10000;

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to check and monitor orchestrator status.
 *
 * Fetches status on mount and polls at regular intervals.
 * Provides real-time orchestrator availability information for UI components.
 *
 * @param options - Hook options
 * @param options.enablePolling - Whether to poll for status updates (default: true)
 * @param options.pollingInterval - Polling interval in ms (default: 10000)
 * @returns Object with status, loading state, error, and refresh function
 *
 * @example
 * ```typescript
 * const { status, isLoading, error, refresh } = useOrchestratorStatus();
 *
 * if (isLoading) return <Loading />;
 * if (!status?.isActive) return <OrchestratorOffline message={status?.offlineMessage} />;
 * ```
 */
export function useOrchestratorStatus(options?: {
  enablePolling?: boolean;
  pollingInterval?: number;
}): UseOrchestratorStatusResult {
  const { enablePolling = true, pollingInterval = POLLING_INTERVAL } = options || {};

  const [status, setStatus] = useState<OrchestratorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch orchestrator status from the API
   */
  const fetchStatus = useCallback(async () => {
    try {
      const response = await axios.get<{
        success: boolean;
        data: OrchestratorStatus;
        error?: string;
      }>(ORCHESTRATOR_STATUS_ENDPOINT);

      if (response.data.success && response.data.data) {
        setStatus(response.data.data);
        setError(null);
      } else {
        setError(response.data.error || 'Failed to get orchestrator status');
      }
    } catch (err) {
      // Don't set error for network errors - orchestrator might just be starting
      const errorMessage = err instanceof Error ? err.message : 'Unable to check orchestrator status';
      setError(errorMessage);
      // Set a default offline status
      setStatus({
        isActive: false,
        agentStatus: null,
        message: 'Unable to check orchestrator status',
        offlineMessage: 'The orchestrator is currently offline. Please start it from the Dashboard.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Public refresh function for manual status refresh
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchStatus();
  }, [fetchStatus]);

  // Initial fetch on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling for status updates
  useEffect(() => {
    if (!enablePolling) return;

    const intervalId = setInterval(fetchStatus, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enablePolling, pollingInterval, fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refresh,
  };
}

export default useOrchestratorStatus;
