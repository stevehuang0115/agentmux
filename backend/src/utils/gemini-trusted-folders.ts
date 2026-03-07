/**
 * Gemini CLI Trusted Folders Utility
 *
 * Provides a standalone function to add folder paths to
 * ~/.gemini/trustedFolders.json so that Gemini CLI does not
 * show an interactive trust prompt when launched in those directories.
 *
 * @module utils/gemini-trusted-folders
 */

import { promises as fsPromises } from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Minimal logger interface for trusted-folder operations.
 * Compatible with ComponentLogger from LoggerService.
 */
export interface TrustedFoldersLogger {
	warn(message: string, meta?: Record<string, unknown>): void;
	info(message: string, meta?: Record<string, unknown>): void;
}

/** Sentinel value used by Gemini CLI to mark a folder as trusted. */
const TRUST_VALUE = 'TRUST_FOLDER' as const;

/**
 * Return the default path to the Gemini trusted folders JSON file.
 */
export function getDefaultTrustedFoldersPath(): string {
	return path.join(os.homedir(), '.gemini', 'trustedFolders.json');
}

/**
 * Add one or more folder paths to the Gemini trusted folders JSON file.
 *
 * The function is idempotent — paths that are already present are skipped.
 * The file and its parent directory are created if they do not exist.
 * Errors are caught and logged (non-fatal) so callers are never blocked.
 *
 * @param paths - Absolute or resolvable folder paths to trust
 * @param logger - Optional logger for diagnostics; if omitted, failures are silent
 * @param trustedFoldersPath - Override path for testing; defaults to ~/.gemini/trustedFolders.json
 * @returns true if any paths were added, false if nothing changed or an error occurred
 */
export async function addGeminiTrustedFolders(
	paths: string[],
	logger?: TrustedFoldersLogger,
	trustedFoldersPath?: string
): Promise<boolean> {
	if (paths.length === 0) return false;

	const filePath = trustedFoldersPath ?? getDefaultTrustedFoldersPath();
	const normalizedPaths = [...new Set(paths.map((p) => path.resolve(p)))];

	try {
		let trustedFolders: Record<string, string> = {};
		try {
			const raw = await fsPromises.readFile(filePath, 'utf8');
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				trustedFolders = parsed as Record<string, string>;
			}
		} catch (readError) {
			// Missing file is expected on first run; malformed content is reset.
			if ((readError as NodeJS.ErrnoException)?.code !== 'ENOENT') {
				logger?.warn('Failed to read Gemini trusted folders, resetting file', {
					trustedFoldersPath: filePath,
					error: readError instanceof Error ? readError.message : String(readError),
				});
			}
		}

		let changed = false;
		for (const folderPath of normalizedPaths) {
			if (trustedFolders[folderPath] !== TRUST_VALUE) {
				trustedFolders[folderPath] = TRUST_VALUE;
				changed = true;
			}
		}

		if (!changed) return false;

		await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
		await fsPromises.writeFile(filePath, `${JSON.stringify(trustedFolders, null, 2)}\n`, 'utf8');
		logger?.info('Gemini trusted folders updated', {
			trustedFoldersPath: filePath,
			addedPaths: normalizedPaths,
		});
		return true;
	} catch (error) {
		logger?.warn('Failed to update Gemini trusted folders (non-fatal)', {
			trustedFoldersPath: filePath,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Build a list of paths that should be trusted for a given project path.
 * Includes the project path itself and its parent directory.
 *
 * @param projectPath - Absolute path to the project
 * @returns Array of paths to add to trusted folders
 */
export function getProjectTrustPaths(projectPath: string): string[] {
	const resolved = path.resolve(projectPath);
	const parentDir = path.dirname(resolved);
	// Deduplicate in case projectPath is at the filesystem root
	return [...new Set([resolved, parentDir])];
}
