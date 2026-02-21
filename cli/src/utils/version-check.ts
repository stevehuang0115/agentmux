/**
 * CLI Version Check Utilities
 *
 * Standalone functions for checking whether a newer version of Crewly is
 * available on npm. Designed for short-lived CLI processes — no singleton
 * service pattern needed.
 *
 * Results are cached in ~/.crewly/.update-check (shared with the backend
 * VersionCheckService) so that repeated CLI invocations do not repeatedly
 * hit the network.
 *
 * @module cli/utils/version-check
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { VERSION_CHECK_CONSTANTS, CREWLY_CONSTANTS } from '../../../config/constants.js';

// ========================= Types =========================

/**
 * Cached version check result persisted to disk
 */
export interface CachedResult {
	/** The latest version found on npm */
	latestVersion: string;
	/** ISO timestamp of when the check was performed */
	checkedAt: string;
}

/**
 * Result of a version comparison
 */
export interface VersionCheckResult {
	/** Currently installed version */
	currentVersion: string;
	/** Latest version on npm, or null if check failed */
	latestVersion: string | null;
	/** Whether a newer version is available */
	updateAvailable: boolean;
}

// ========================= Package Root =========================

/**
 * Finds the Crewly package root by walking up from a starting directory,
 * looking for a package.json with `"name": "crewly"`.
 *
 * @param startDir - Directory to start searching from
 * @returns The absolute path to the package root directory
 * @throws Error if no matching package.json is found
 */
function findPackageRoot(startDir: string): string {
	let current = path.resolve(startDir);

	while (true) {
		const pkgPath = path.join(current, 'package.json');
		if (existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
				if (pkg.name === 'crewly') {
					return current;
				}
			} catch {
				// Malformed package.json — keep searching
			}
		}

		const parent = path.dirname(current);
		if (parent === current) {
			throw new Error(
				'Could not find Crewly package root (no package.json with name "crewly" found in any parent directory)'
			);
		}
		current = parent;
	}
}

// ========================= Functions =========================

/**
 * Reads the current Crewly version from the root package.json.
 *
 * @returns The version string from package.json
 */
export function getLocalVersion(): string {
	const root = findPackageRoot(process.cwd());
	const pkgPath = path.join(root, 'package.json');
	const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
	return pkg.version as string;
}

/**
 * Returns the absolute path to the version-check cache file.
 *
 * @returns Path to ~/.crewly/.update-check
 */
function getCachePath(): string {
	return path.join(
		os.homedir(),
		CREWLY_CONSTANTS.PATHS.CREWLY_HOME,
		VERSION_CHECK_CONSTANTS.CHECK_CACHE_FILE
	);
}

/**
 * Reads the disk-cached version check result.
 *
 * @returns The cached result, or null if the file does not exist or is malformed
 */
export function readCache(): CachedResult | null {
	try {
		const cachePath = getCachePath();
		if (!existsSync(cachePath)) {
			return null;
		}
		const content = readFileSync(cachePath, 'utf-8');
		const parsed = JSON.parse(content) as CachedResult;
		if (parsed.latestVersion && parsed.checkedAt) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Writes a version check result to the disk cache.
 *
 * @param version - The latest version string to cache
 */
export function writeCache(version: string): void {
	try {
		const cachePath = getCachePath();
		const cacheDir = path.dirname(cachePath);
		if (!existsSync(cacheDir)) {
			mkdirSync(cacheDir, { recursive: true });
		}

		const data: CachedResult = {
			latestVersion: version,
			checkedAt: new Date().toISOString(),
		};
		writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
	} catch {
		// Silently ignore write failures
	}
}

/**
 * Compares two semver version strings to determine if `latest` is newer than `current`.
 *
 * @param latest - The version to compare against
 * @param current - The currently installed version
 * @returns true if latest is strictly newer than current
 */
function isNewerVersion(latest: string, current: string): boolean {
	const latestParts = latest.split('.').map(Number);
	const currentParts = current.split('.').map(Number);

	for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
		const l = latestParts[i] ?? 0;
		const c = currentParts[i] ?? 0;
		if (l > c) return true;
		if (l < c) return false;
	}
	return false;
}

/**
 * Checks whether a newer version of Crewly is available on npm.
 * Uses the disk cache if it is still fresh (within CACHE_TTL_MS).
 *
 * @returns An object with currentVersion, latestVersion, and updateAvailable
 */
export async function checkForUpdate(): Promise<VersionCheckResult> {
	const currentVersion = getLocalVersion();

	// Check cache first
	const cached = readCache();
	if (cached) {
		const age = Date.now() - new Date(cached.checkedAt).getTime();
		if (age < VERSION_CHECK_CONSTANTS.CACHE_TTL_MS) {
			const updateAvailable = isNewerVersion(cached.latestVersion, currentVersion);
			return { currentVersion, latestVersion: cached.latestVersion, updateAvailable };
		}
	}

	try {
		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			VERSION_CHECK_CONSTANTS.REQUEST_TIMEOUT_MS
		);

		const response = await fetch(VERSION_CHECK_CONSTANTS.NPM_REGISTRY_URL, {
			signal: controller.signal,
			headers: { 'Accept': 'application/json' },
		});
		clearTimeout(timeout);

		if (!response.ok) {
			return { currentVersion, latestVersion: null, updateAvailable: false };
		}

		const data = await response.json() as { version?: string };
		const latestVersion = data.version ?? null;

		if (latestVersion) {
			writeCache(latestVersion);
		}

		const updateAvailable =
			latestVersion !== null && isNewerVersion(latestVersion, currentVersion);

		return { currentVersion, latestVersion, updateAvailable };
	} catch {
		return { currentVersion, latestVersion: null, updateAvailable: false };
	}
}

/**
 * Prints a styled update notification to the terminal.
 *
 * @param current - The currently installed version
 * @param latest - The latest available version
 */
export function printUpdateNotification(current: string, latest: string): void {
	console.log('');
	console.log(chalk.cyan('  ┌─────────────────────────────────────────────────┐'));
	console.log(chalk.cyan('  │                                                 │'));
	console.log(chalk.cyan('  │  ') + chalk.white.bold('Update available!') + chalk.cyan('                            │'));
	console.log(chalk.cyan('  │  ') + chalk.gray(`${current}`) + chalk.white(' → ') + chalk.green.bold(`${latest}`) + chalk.cyan('                            │'.slice(0, 33 - current.length - latest.length) + '│'));
	console.log(chalk.cyan('  │                                                 │'));
	console.log(chalk.cyan('  │  ') + chalk.white('Run ') + chalk.cyan.bold('crewly upgrade') + chalk.white(' to update') + chalk.cyan('                │'));
	console.log(chalk.cyan('  │                                                 │'));
	console.log(chalk.cyan('  └─────────────────────────────────────────────────┘'));
	console.log('');
}
