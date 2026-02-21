/**
 * Disk Cleanup Service
 *
 * Handles cleanup of temporary files when agents are suspended and
 * system-level cleanup of Docker resources and log files.
 *
 * Agent cleanup targets:
 * - `~/.claude/debug/` — debug log files
 * - `~/.claude/shell-snapshots/` — shell state snapshots
 *
 * System cleanup targets:
 * - Docker dangling images and build cache
 * - Docker stopped containers and unused volumes
 * - Crewly log files older than 7 days
 *
 * @module disk-cleanup-service
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import { AGENT_SUSPEND_CONSTANTS } from '../../constants.js';

/** Maximum age (in hours) for Crewly log files before cleanup */
const CREWLY_LOG_MAX_AGE_HOURS = 168; // 7 days

/** Timeout for Docker CLI commands in milliseconds */
const DOCKER_COMMAND_TIMEOUT_MS = 30_000;

/**
 * Statistics returned after a cleanup run.
 */
export interface CleanupStats {
	/** Number of debug log files deleted */
	debugLogsDeleted: number;
	/** Number of shell snapshot files deleted */
	shellSnapshotsDeleted: number;
	/** Total bytes freed (approximate) */
	bytesFreed: number;
}

/**
 * Statistics returned after a system-level cleanup run.
 */
export interface SystemCleanupStats {
	/** Whether Docker cleanup was executed */
	dockerCleaned: boolean;
	/** Textual summary of Docker cleanup output */
	dockerOutput: string;
	/** Number of Crewly log files deleted */
	crewlyLogsDeleted: number;
	/** Total bytes freed from log cleanup (approximate) */
	logBytesFreed: number;
}

/**
 * Handles disk cleanup on agent suspension.
 *
 * Targets the Claude Code data directories:
 * - `~/.claude/debug/` — debug log files
 * - `~/.claude/shell-snapshots/` — shell state snapshots
 */
export class DiskCleanupService {
	private static instance: DiskCleanupService | null = null;
	private logger: ComponentLogger;
	private claudeDir: string;

	private constructor(claudeDir?: string) {
		this.logger = LoggerService.getInstance().createComponentLogger('DiskCleanup');
		this.claudeDir = claudeDir ?? path.join(os.homedir(), '.claude');
	}

	/**
	 * Get the singleton instance.
	 *
	 * @param claudeDir - Optional override for the Claude data directory (testing)
	 * @returns The DiskCleanupService singleton
	 */
	static getInstance(claudeDir?: string): DiskCleanupService {
		if (!DiskCleanupService.instance) {
			DiskCleanupService.instance = new DiskCleanupService(claudeDir);
		}
		return DiskCleanupService.instance;
	}

	/**
	 * Reset the singleton (for testing).
	 */
	static resetInstance(): void {
		DiskCleanupService.instance = null;
	}

	/**
	 * Purge debug log files older than the configured threshold.
	 *
	 * @param maxAgeHours - Maximum age in hours before deletion
	 * @returns Object with count of deleted files and bytes freed
	 */
	purgeDebugLogs(
		maxAgeHours: number = AGENT_SUSPEND_CONSTANTS.DEBUG_LOG_MAX_AGE_HOURS
	): { deleted: number; bytesFreed: number } {
		const debugDir = path.join(this.claudeDir, 'debug');
		return this.purgeOldFiles(debugDir, maxAgeHours);
	}

	/**
	 * Clear shell snapshot files.
	 *
	 * @returns Object with count of deleted files and bytes freed
	 */
	clearShellSnapshots(): { deleted: number; bytesFreed: number } {
		const snapshotsDir = path.join(this.claudeDir, 'shell-snapshots');
		// Shell snapshots are ephemeral — clear all of them on suspend
		return this.purgeOldFiles(snapshotsDir, 0);
	}

	/**
	 * Run the full suspend cleanup pipeline.
	 * Called by AgentSuspendService when suspending an agent.
	 *
	 * @returns Aggregate cleanup statistics
	 */
	runSuspendCleanup(): CleanupStats {
		this.logger.info('Running suspend disk cleanup...');

		const debugResult = this.purgeDebugLogs();
		const snapshotResult = this.clearShellSnapshots();

		const stats: CleanupStats = {
			debugLogsDeleted: debugResult.deleted,
			shellSnapshotsDeleted: snapshotResult.deleted,
			bytesFreed: debugResult.bytesFreed + snapshotResult.bytesFreed,
		};

		this.logger.info('Suspend disk cleanup complete', {
			debugLogsDeleted: stats.debugLogsDeleted,
			shellSnapshotsDeleted: stats.shellSnapshotsDeleted,
			bytesFreedMB: (stats.bytesFreed / (1024 * 1024)).toFixed(2),
		});

		return stats;
	}

	/**
	 * Delete files in a directory older than the given threshold.
	 *
	 * @param dirPath - Directory to scan
	 * @param maxAgeHours - Maximum file age in hours (0 = delete all)
	 * @returns Object with count and bytes
	 */
	private purgeOldFiles(
		dirPath: string,
		maxAgeHours: number
	): { deleted: number; bytesFreed: number } {
		let deleted = 0;
		let bytesFreed = 0;

		if (!fs.existsSync(dirPath)) {
			return { deleted, bytesFreed };
		}

		const cutoffMs = maxAgeHours * 60 * 60 * 1000;
		const now = Date.now();

		try {
			const entries = fs.readdirSync(dirPath);
			for (const entry of entries) {
				const filePath = path.join(dirPath, entry);
				try {
					const stat = fs.statSync(filePath);
					if (!stat.isFile()) continue;

					// When maxAgeHours is 0, delete all files regardless of timing precision
					if (cutoffMs === 0 || (now - stat.mtimeMs) >= cutoffMs) {
						fs.unlinkSync(filePath);
						deleted++;
						bytesFreed += stat.size;
					}
				} catch (fileErr) {
					this.logger.debug('Failed to process file during cleanup', {
						filePath,
						error: fileErr instanceof Error ? fileErr.message : String(fileErr),
					});
				}
			}
		} catch (err) {
			this.logger.warn('Failed to read directory for cleanup', {
				dirPath,
				error: err instanceof Error ? err.message : String(err),
			});
		}

		return { deleted, bytesFreed };
	}
}
