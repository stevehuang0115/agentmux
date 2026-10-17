/**
 * Worktree janitor — what counts as "dirty", and reclaiming regenerable dirs.
 *
 * Nested packages (`web-visa/node_modules`, `.next`) are often not git-ignored,
 * so `git status` reports them as untracked and the janitor kept 39 finished
 * worktrees "dirty" forever. Untracked regenerable output is not work. Tracked
 * modifications and untracked source files still count.
 *
 * @module services/worktree/worktree-dirty
 */

import * as fs from 'fs';
import * as path from 'path';
import { WORKTREE_JANITOR_CONSTANTS } from '../../constants.js';
import { EventLoopYielder } from './worktree-janitor.git.js';

/** Strip git's C-style quoting from a porcelain path. */
function unquote(p: string): string {
	return p.length >= 2 && p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : p;
}

/**
 * Whether an untracked path is regenerable output: any directory segment
 * named like a build/dependency dir, or a `*.log` file.
 *
 * @param untrackedPath - Path as printed after `?? ` (a trailing slash marks a directory)
 * @returns True for regenerable output
 *
 * @example
 * ```typescript
 * isRegenerablePath('web-visa/node_modules/'); // true
 * isRegenerablePath('debug.log');              // true
 * isRegenerablePath('notes/todo.md');          // false
 * ```
 */
export function isRegenerablePath(untrackedPath: string): boolean {
	const segments = unquote(untrackedPath).split('/').filter((s) => s !== '');
	if (segments.some((s) => WORKTREE_JANITOR_CONSTANTS.REGENERABLE_DIRS.includes(s))) return true;
	const last = segments[segments.length - 1] ?? '';
	return WORKTREE_JANITOR_CONSTANTS.REGENERABLE_FILE_SUFFIXES.some((suf) => last.endsWith(suf));
}

/**
 * Lines of `git status --porcelain` that are real changes: everything except
 * untracked (`??`) regenerable output. Run status with
 * `--untracked-files=normal` so untracked directories stay collapsed.
 *
 * @param porcelain - Raw `git status --porcelain` output
 * @returns The lines that make the worktree dirty
 */
export function dirtyStatusLines(porcelain: string): string[] {
	return porcelain
		.split('\n')
		.filter((l) => l.trim() !== '')
		.filter((l) => !(l.startsWith('?? ') && isRegenerablePath(l.slice(3))));
}

/**
 * Reclaimable directories (`node_modules`, `.next`, `dist`, …) inside a worktree, found
 * without following symlinks and without descending into a found directory
 * or `.git`. Bounded by depth.
 *
 * @param root - Worktree root
 * @returns Absolute directory paths
 */
export async function findReclaimableDirs(root: string): Promise<string[]> {
	const out: string[] = [];
	const yielder = new EventLoopYielder();
	const walk = async (dir: string, depth: number): Promise<void> => {
		await yielder.tick();
		let entries: fs.Dirent[];
		try {
			entries = await fs.promises.readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) {
			if (e.name === '.git') continue;
			const full = path.join(dir, e.name);
			if (WORKTREE_JANITOR_CONSTANTS.RECLAIM_DIRS.includes(e.name)) {
				// A symlink is removed as a link (its target is never followed).
				if (e.isDirectory() || e.isSymbolicLink()) out.push(full);
				continue;
			}
			if (e.isDirectory() && depth < WORKTREE_JANITOR_CONSTANTS.RECLAIM_SEARCH_DEPTH) await walk(full, depth + 1);
		}
	};
	await walk(root, 0);
	return out;
}

/** What a reclaim did. */
export interface ReclaimResult {
	/** Directories removed (or, in a dry run, that would be) */
	dirs: string[];
	/** Bytes freed (0 in a dry run or when sizes are unknown) */
	freedBytes: number;
}

/** Options of {@link reclaimRegenerableDirs}. */
export interface ReclaimOptions {
	/**
	 * Whether git tracks anything under a directory (true), nothing (false)
	 * or could not tell (null). A tracked directory is never deleted — some
	 * repos commit `dist`. Unknown counts as tracked. Default: untracked.
	 */
	isTracked?: (dir: string) => Promise<boolean | null>;
	/** Leave symlinks alone (a managed worktree shares `node_modules` by symlink; removing it only breaks the manifest check). */
	keepSymlinks?: boolean;
}

/**
 * Delete the reclaimable directories of a kept worktree. Reversible
 * (`npm install`, rebuild) — never touches tracked or source files.
 *
 * @param root - Worktree root
 * @param sizeOf - Size probe (bytes or null)
 * @param dryRun - List only (sizes are still probed so a dry run can report MB)
 * @param options - Tracked-dir check and symlink handling
 * @returns Directories handled and bytes freed (in a dry run: bytes that would be)
 */
export async function reclaimRegenerableDirs(
	root: string,
	sizeOf: (p: string) => Promise<number | null>,
	dryRun: boolean,
	options: ReclaimOptions = {},
): Promise<ReclaimResult> {
	const dirs = await findReclaimableDirs(root);
	const done: string[] = [];
	let freed = 0;
	for (const d of dirs) {
		if (options.keepSymlinks) {
			try {
				if ((await fs.promises.lstat(d)).isSymbolicLink()) continue;
			} catch {
				continue;
			}
		}
		if (options.isTracked) {
			const tracked = await options.isTracked(d).catch(() => null);
			if (tracked !== false) continue;
		}
		const size = (await sizeOf(d)) ?? 0;
		if (dryRun) {
			done.push(d);
			freed += size;
			continue;
		}
		try {
			await fs.promises.rm(d, { recursive: true, force: true });
			done.push(d);
			freed += size;
		} catch {
			// busy or permission: leave it
		}
	}
	return { dirs: done, freedBytes: freed };
}
