/**
 * The persisted Cloud sign-in (`<CREWLY_HOME>/cloud/config.json`): the single
 * place that locates, reads (with repair) and writes it. The backend and the
 * `crewly cloud login` CLI both go through here.
 *
 * Incident (2026-10-11): two overlapping `writeFile` calls (token refresh +
 * relay-token refresh) interleaved, the shorter payload landed last and the
 * file ended up as a complete JSON object followed by the tail of the longer
 * one. `JSON.parse` failed, Crewly acted signed-out for >24 h and nobody was
 * told. Writes are now atomic and serialized; reads repair that exact damage
 * and report anything else instead of silently reading as "not signed in".
 *
 * @module services/cloud/cloud-config-file
 */

import * as path from 'path';
import * as fs from 'fs';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import {
	atomicWriteFile,
	atomicWriteFileSync,
	readJsonObjectWithRepairSync,
	type FileIOLogger,
} from '../../utils/file-io.utils.js';

/** Credentials are owner-only. */
export const CLOUD_CONFIG_FILE_MODE = 0o600;

/**
 * Persisted cloud config stored at ~/.crewly/cloud/config.json.
 * Enables auto-reconnect on backend restart.
 */
export interface PersistedCloudConfig {
	cloudUrl: string;
	token: string;
	tier: string;
	connectedAt: string;
	/** Refresh token for auto-renewing expired access tokens */
	refreshToken?: string;
	/**
	 * Relay-signed access JWT (distinct from the access `token`). Persisted so
	 * the BrowserProxy can re-register on backend restart without waiting for a
	 * fresh validate round-trip. Never the Google/Supabase token — see the
	 * RELAY-TOKEN-TYPE invariant in the long-term browser-relay fix design.
	 */
	relayToken?: string;
}

/** What {@link readCloudConfigFile} found. */
export type CloudConfigRead =
	| { status: 'missing' }
	| { status: 'ok'; config: PersistedCloudConfig; repaired: boolean }
	| { status: 'damaged'; reason: string; quarantinedTo: string | null };

/**
 * Path to the persisted cloud config. Resolved through CREWLY_HOME per call so
 * tests (which isolate CREWLY_HOME) can never touch the real login.
 *
 * @returns Absolute file path
 */
export function getCloudConfigPath(): string {
	return path.join(getCrewlyHomePath(), 'cloud', 'config.json');
}

/**
 * Shape check: a usable sign-in has a URL, an access token and a tier.
 *
 * @param data - Parsed JSON
 * @returns Error text, or null when valid
 */
export function validateCloudConfig(data: unknown): string | null {
	if (typeof data !== 'object' || data === null || Array.isArray(data)) return 'not a JSON object';
	const c = data as Record<string, unknown>;
	for (const key of ['cloudUrl', 'token', 'tier'] as const) {
		if (typeof c[key] !== 'string' || c[key] === '') return `missing ${key}`;
	}
	return null;
}

/**
 * Read the cloud config. A file with stale trailing bytes after a complete
 * object is repaired in place (atomic, WARN logged); an unusable file is
 * backed up to `config.json.corrupt-<ts>` and reported as `damaged`.
 *
 * @param logger - Optional logger
 * @returns missing / ok / damaged
 */
export function readCloudConfigFile(logger?: FileIOLogger): CloudConfigRead {
	const r = readJsonObjectWithRepairSync<PersistedCloudConfig>(getCloudConfigPath(), {
		validate: validateCloudConfig,
		logger,
		mode: CLOUD_CONFIG_FILE_MODE,
	});
	if (r.status === 'ok') return { status: 'ok', config: r.data, repaired: r.repaired };
	return r;
}

/**
 * Write the cloud config atomically (mode 600, serialized in this process).
 *
 * @param config - Config to persist
 */
export async function writeCloudConfigFile(config: PersistedCloudConfig): Promise<void> {
	const file = getCloudConfigPath();
	// Sync mkdir: the write lock below must be taken in call order, or two overlapping
	// persists could land newest-first and leave the older token on disk.
	fs.mkdirSync(path.dirname(file), { recursive: true });
	await atomicWriteFile(file, JSON.stringify(config, null, 2), { mode: CLOUD_CONFIG_FILE_MODE });
}

/**
 * Synchronous {@link writeCloudConfigFile} for the CLI.
 *
 * @param config - Config (or a superset of it) to persist
 */
export function writeCloudConfigFileSync(config: PersistedCloudConfig): void {
	const file = getCloudConfigPath();
	fs.mkdirSync(path.dirname(file), { recursive: true });
	atomicWriteFileSync(file, JSON.stringify(config, null, 2), { mode: CLOUD_CONFIG_FILE_MODE });
}
