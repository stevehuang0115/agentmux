/**
 * Use Cloud Connection Hook
 *
 * Custom hook that manages CrewlyAI Cloud connection state.
 * Fetches cloud status on mount, provides connect/disconnect actions,
 * and exposes loading/error states for UI feedback.
 *
 * @module hooks/useCloudConnection
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api.service';
import type { CloudStatus, CloudTier } from '../types';

// ========================= Types =========================

/**
 * Return type for the useCloudConnection hook
 */
export interface UseCloudConnectionResult {
  /** Whether the cloud client is connected */
  isConnected: boolean;
  /** Current subscription tier, or null if disconnected */
  tier: CloudTier | null;
  /** Whether the initial status check is in progress */
  isLoading: boolean;
  /** Whether a connect or disconnect operation is in progress */
  isActioning: boolean;
  /** Error message from the last failed operation, or null */
  error: string | null;
  /** Connect to cloud with a token */
  connect: (token: string, cloudUrl?: string) => Promise<boolean>;
  /** Disconnect from cloud */
  disconnect: () => Promise<boolean>;
  /** Re-fetch cloud status */
  refresh: () => Promise<void>;
}

// ========================= Hook =========================

/**
 * Hook for managing CrewlyAI Cloud connection.
 *
 * Fetches cloud status once on mount. Provides connect/disconnect
 * functions that update local state optimistically and handle errors.
 *
 * @returns Object with connection state and actions
 *
 * @example
 * ```typescript
 * const { isConnected, tier, connect, disconnect } = useCloudConnection();
 *
 * if (isConnected) {
 *   return <Badge>{tier}</Badge>;
 * }
 * ```
 */
export function useCloudConnection(): UseCloudConnectionResult {
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const fetchStatus = useCallback(async () => {
    try {
      const cloudStatus = await apiService.getCloudStatus();
      if (isMountedRef.current) {
        setStatus(cloudStatus);
        setError(null);
      }
    } catch {
      // Non-critical — cloud status check failure is OK
      if (isMountedRef.current) {
        setStatus({ connected: false, tier: null, cloudUrl: null, status: 'disconnected' });
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      await fetchStatus();
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    };

    init();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchStatus]);

  const connect = useCallback(async (token: string, cloudUrl?: string): Promise<boolean> => {
    setIsActioning(true);
    setError(null);
    try {
      const result = await apiService.connectToCloud(token, cloudUrl);
      if (isMountedRef.current) {
        setStatus({
          connected: result.connected,
          tier: result.tier,
          cloudUrl: result.cloudUrl,
          status: 'connected',
        });
      }
      return true;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsActioning(false);
      }
    }
  }, []);

  const disconnect = useCallback(async (): Promise<boolean> => {
    setIsActioning(true);
    setError(null);
    try {
      await apiService.disconnectFromCloud();
      if (isMountedRef.current) {
        setStatus({ connected: false, tier: null, cloudUrl: null, status: 'disconnected' });
      }
      return true;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Disconnect failed');
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setIsActioning(false);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchStatus();
  }, [fetchStatus]);

  return {
    isConnected: status?.connected ?? false,
    tier: status?.tier ?? null,
    isLoading,
    isActioning,
    error,
    connect,
    disconnect,
    refresh,
  };
}

export default useCloudConnection;
