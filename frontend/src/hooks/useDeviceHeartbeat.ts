/**
 * Use Device Heartbeat Hook
 *
 * Sends periodic device heartbeats to the CrewlyAI Cloud API when the user
 * is connected with a Pro tier. Also fetches online remote devices.
 *
 * Heartbeat interval: 30s
 * Device list refresh: 30s
 *
 * Endpoints are on api.crewlyai.com (Cloud service), not local OSS backend.
 *
 * @module hooks/useDeviceHeartbeat
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { CLOUD_API_BASE } from '../constants/cloud.constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Team info included in heartbeat. */
interface HeartbeatTeam {
  id: string;
  name: string;
  memberCount: number;
}

/** Remote device returned by the API. */
export interface OnlineDevice {
  deviceId: string;
  deviceName: string;
  email: string;
  teams: HeartbeatTeam[];
  lastSeenAt: string;
}

/** Hook return type. */
export interface UseDeviceHeartbeatResult {
  /** List of online remote devices */
  devices: OnlineDevice[];
  /** Whether the device list is loading */
  isLoading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Manually refresh the device list */
  refresh: () => Promise<void>;
}

/** Heartbeat interval in milliseconds. */
const HEARTBEAT_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook that manages device heartbeat and remote device discovery.
 *
 * Only active when `enabled` is true (Pro + cloud connected).
 * Sends heartbeat with local teams info and fetches remote devices.
 *
 * @param accessToken - User access token for API calls
 * @param enabled - Whether to activate heartbeating
 * @param localTeams - Local teams to include in heartbeat
 * @param deviceName - This device's name
 * @returns Online devices and loading state
 */
export function useDeviceHeartbeat(
  accessToken: string | null,
  enabled: boolean,
  localTeams: HeartbeatTeam[],
  deviceName: string,
): UseDeviceHeartbeatResult {
  const [devices, setDevices] = useState<OnlineDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  // Store latest values in refs so interval callback always has fresh data
  const tokenRef = useRef(accessToken);
  const teamsRef = useRef(localTeams);
  const nameRef = useRef(deviceName);

  tokenRef.current = accessToken;
  teamsRef.current = localTeams;
  nameRef.current = deviceName;

  /**
   * Send a heartbeat and fetch device list.
   */
  const tick = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    try {
      // Send heartbeat to Cloud API
      await fetch(`${CLOUD_API_BASE}/devices/heartbeat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          deviceName: nameRef.current,
          teams: teamsRef.current,
        }),
      });

      // Fetch online devices from Cloud API
      const res = await fetch(`${CLOUD_API_BASE}/devices`, { headers });
      const data = await res.json();

      if (isMountedRef.current && data.success) {
        setDevices(data.data || []);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Heartbeat failed');
      }
    }
  }, []);

  /**
   * Manually refresh the device list.
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await tick();
    if (isMountedRef.current) setIsLoading(false);
  }, [tick]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || !accessToken) {
      setDevices([]);
      return;
    }

    // Initial fetch
    setIsLoading(true);
    tick().finally(() => {
      if (isMountedRef.current) setIsLoading(false);
    });

    // Periodic heartbeat + refresh
    intervalRef.current = setInterval(tick, HEARTBEAT_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, accessToken, tick]);

  return { devices, isLoading, error, refresh };
}

export default useDeviceHeartbeat;
