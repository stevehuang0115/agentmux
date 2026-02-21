/**
 * Use Version Check Hook
 *
 * Custom hook that fetches version information from the /health endpoint
 * and determines whether a newer version of Crewly is available.
 * Only checks once per session (on mount) — no polling.
 *
 * @module hooks/useVersionCheck
 */

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// ========================= Types =========================

/**
 * Version information returned by the /health endpoint
 */
export interface VersionInfo {
	/** Currently installed version */
	currentVersion: string;
	/** Latest version on npm, or null if not checked yet */
	latestVersion: string | null;
	/** Whether a newer version is available */
	updateAvailable: boolean;
}

/**
 * Return type for the useVersionCheck hook
 */
export interface UseVersionCheckResult {
	/** Version information, or null if not yet loaded */
	versionInfo: VersionInfo | null;
	/** Whether the version check is in progress */
	isLoading: boolean;
}

// ========================= Constants =========================

/** Health endpoint that includes version info */
const HEALTH_ENDPOINT = '/health';

/** Request timeout in milliseconds (5 seconds) */
const REQUEST_TIMEOUT = 5000;

// ========================= Hook =========================

/**
 * Hook to check whether a newer version of Crewly is available.
 *
 * Fetches version data from the /health endpoint once on mount.
 * The backend populates latestVersion and updateAvailable from
 * a cached npm registry check.
 *
 * @returns Object with versionInfo and loading state
 *
 * @example
 * ```typescript
 * const { versionInfo, isLoading } = useVersionCheck();
 *
 * if (versionInfo?.updateAvailable) {
 *   return <UpdateBanner version={versionInfo.latestVersion} />;
 * }
 * ```
 */
export function useVersionCheck(): UseVersionCheckResult {
	const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;

		const fetchVersionInfo = async () => {
			try {
				const response = await axios.get<{
					version: string;
					latestVersion: string | null;
					updateAvailable: boolean;
				}>(HEALTH_ENDPOINT, { timeout: REQUEST_TIMEOUT });

				if (!isMountedRef.current) return;

				setVersionInfo({
					currentVersion: response.data.version,
					latestVersion: response.data.latestVersion,
					updateAvailable: response.data.updateAvailable,
				});
			} catch {
				// Silently ignore — version check is non-critical
			} finally {
				if (isMountedRef.current) {
					setIsLoading(false);
				}
			}
		};

		fetchVersionInfo();

		return () => {
			isMountedRef.current = false;
		};
	}, []);

	return { versionInfo, isLoading };
}

export default useVersionCheck;
