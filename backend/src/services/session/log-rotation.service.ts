import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { LOG_ROTATION_CONSTANTS, CREWLY_CONSTANTS } from '../../constants.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';

/**
 * Status information for a single log file
 */
export interface LogFileInfo {
	/** File name (e.g., crewly-orc.log) */
	name: string;
	/** Full absolute path */
	path: string;
	/** File size in bytes */
	sizeBytes: number;
	/** Whether this log belongs to an active session */
	isOrphan: boolean;
}

/**
 * Result of a single rotation run
 */
export interface RotationRunResult {
	/** Timestamp of the run */
	timestamp: Date;
	/** Number of files scanned */
	filesScanned: number;
	/** Number of files truncated */
	filesTruncated: number;
	/** Number of archives created */
	archivesCreated: number;
	/** Number of stale archives deleted */
	staleArchivesDeleted: number;
	/** Bytes freed by truncation */
	bytesFreed: number;
	/** Errors encountered during rotation */
	errors: string[];
}

/**
 * Overall status of the log rotation service
 */
export interface LogRotationStatus {
	/** Whether the service is running */
	isRunning: boolean;
	/** Last rotation run result */
	lastRun: RotationRunResult | null;
	/** Current log files and their sizes */
	currentFiles: LogFileInfo[];
	/** Total size of all log files in bytes */
	totalSizeBytes: number;
}

/**
 * Service that manages session log file sizes through periodic rotation.
 *
 * Scans ~/.crewly/logs/sessions/ for .log files, truncates oversized files
 * (keeping the tail), optionally archives old content as .gz, and cleans up
 * stale archives. Orphan logs (no matching active session) are truncated
 * more aggressively.
 *
 * @example
 * ```typescript
 * const service = LogRotationService.getInstance();
 * service.start(activeSessionNames);
 * // ... later
 * service.stop();
 * ```
 */
export class LogRotationService {
	private static instance: LogRotationService | null = null;
	private logger: ComponentLogger;
	private timer: ReturnType<typeof setInterval> | null = null;
	private isRunning = false;
	private lastRunResult: RotationRunResult | null = null;
	private activeSessionNames: Set<string> = new Set();

	private readonly sessionsDir: string;
	private readonly archiveDir: string;

	private constructor() {
		this.logger = LoggerService.getInstance().createComponentLogger('LogRotationService');
		const crewlyHome = path.join(os.homedir(), CREWLY_CONSTANTS.PATHS.CREWLY_HOME);
		this.sessionsDir = path.join(crewlyHome, LOG_ROTATION_CONSTANTS.LOGS_DIR, LOG_ROTATION_CONSTANTS.SESSIONS_LOG_DIR);
		this.archiveDir = path.join(crewlyHome, LOG_ROTATION_CONSTANTS.LOGS_DIR, LOG_ROTATION_CONSTANTS.ARCHIVE_DIR);
	}

	/**
	 * Returns the singleton instance of LogRotationService
	 * @returns The shared LogRotationService instance
	 */
	static getInstance(): LogRotationService {
		if (!LogRotationService.instance) {
			LogRotationService.instance = new LogRotationService();
		}
		return LogRotationService.instance;
	}

	/**
	 * Resets the singleton instance (for testing only)
	 */
	static resetInstance(): void {
		if (LogRotationService.instance) {
			LogRotationService.instance.stop();
		}
		LogRotationService.instance = null;
	}

	/**
	 * Starts the log rotation service. Runs an immediate rotation, then
	 * schedules periodic rotations at the configured interval.
	 *
	 * @param activeSessionNames - Names of currently active sessions (used for orphan detection)
	 */
	async start(activeSessionNames: string[] = []): Promise<void> {
		if (this.isRunning) {
			this.logger.warn('LogRotationService already running');
			return;
		}
		this.isRunning = true;
		this.activeSessionNames = new Set(activeSessionNames);

		this.logger.info('LogRotationService starting', {
			sessionsDir: this.sessionsDir,
			archiveDir: this.archiveDir,
			maxLogSize: LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES,
			orphanMaxSize: LOG_ROTATION_CONSTANTS.ORPHAN_LOG_MAX_SIZE_BYTES,
			intervalMs: LOG_ROTATION_CONSTANTS.LOG_ROTATION_INTERVAL_MS,
		});

		// Run immediately on start
		try {
			await this.runRotation();
		} catch (error) {
			this.logger.error('Initial rotation failed', {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		// Schedule periodic runs
		this.timer = setInterval(async () => {
			try {
				await this.runRotation();
			} catch (error) {
				this.logger.error('Scheduled rotation failed', {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}, LOG_ROTATION_CONSTANTS.LOG_ROTATION_INTERVAL_MS);
	}

	/**
	 * Stops the log rotation service and clears the periodic timer.
	 */
	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		this.isRunning = false;
		this.logger.info('LogRotationService stopped');
	}

	/**
	 * Updates the set of active session names (for orphan detection).
	 * Call this when sessions start or stop.
	 *
	 * @param names - Current active session names
	 */
	updateActiveSessionNames(names: string[]): void {
		this.activeSessionNames = new Set(names);
	}

	/**
	 * Executes a single rotation pass: scan, archive, truncate, and clean archives.
	 *
	 * @returns Result of the rotation run
	 */
	async runRotation(): Promise<RotationRunResult> {
		const result: RotationRunResult = {
			timestamp: new Date(),
			filesScanned: 0,
			filesTruncated: 0,
			archivesCreated: 0,
			staleArchivesDeleted: 0,
			bytesFreed: 0,
			errors: [],
		};

		try {
			// Ensure directories exist
			await fs.mkdir(this.sessionsDir, { recursive: true });
			await fs.mkdir(this.archiveDir, { recursive: true });

			// Scan log files
			const logFiles = await this.scanLogFiles();
			result.filesScanned = logFiles.length;

			// Process each file
			for (const file of logFiles) {
				const maxSize = file.isOrphan
					? LOG_ROTATION_CONSTANTS.ORPHAN_LOG_MAX_SIZE_BYTES
					: LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES;

				if (file.sizeBytes > maxSize) {
					try {
						const freed = await this.rotateFile(file, maxSize, result);
						result.bytesFreed += freed;
						result.filesTruncated++;
					} catch (error) {
						const msg = `Failed to rotate ${file.name}: ${error instanceof Error ? error.message : String(error)}`;
						result.errors.push(msg);
						this.logger.error(msg);
					}
				}
			}

			// Clean stale archives
			const staleDeleted = await this.cleanStaleArchives(result);
			result.staleArchivesDeleted = staleDeleted;

		} catch (error) {
			const msg = `Rotation run error: ${error instanceof Error ? error.message : String(error)}`;
			result.errors.push(msg);
			this.logger.error(msg);
		}

		this.lastRunResult = result;

		this.logger.info('Rotation complete', {
			filesScanned: result.filesScanned,
			filesTruncated: result.filesTruncated,
			archivesCreated: result.archivesCreated,
			staleArchivesDeleted: result.staleArchivesDeleted,
			bytesFreedMB: Math.round(result.bytesFreed / (1024 * 1024) * 100) / 100,
			errors: result.errors.length,
		});

		return result;
	}

	/**
	 * Returns the current status of all log files and the service.
	 *
	 * @returns Status including file sizes and last run info
	 */
	async getStatus(): Promise<LogRotationStatus> {
		let currentFiles: LogFileInfo[] = [];
		try {
			currentFiles = await this.scanLogFiles();
		} catch {
			// Directory may not exist yet
		}

		const totalSizeBytes = currentFiles.reduce((sum, f) => sum + f.sizeBytes, 0);

		return {
			isRunning: this.isRunning,
			lastRun: this.lastRunResult,
			currentFiles,
			totalSizeBytes,
		};
	}

	/**
	 * Scans the sessions log directory for .log files and returns their info.
	 *
	 * @returns Array of log file information
	 */
	private async scanLogFiles(): Promise<LogFileInfo[]> {
		const entries = await fs.readdir(this.sessionsDir);
		const logFiles: LogFileInfo[] = [];

		for (const entry of entries) {
			if (!entry.endsWith('.log')) continue;

			const filePath = path.join(this.sessionsDir, entry);
			try {
				const stat = await fs.stat(filePath);
				if (!stat.isFile()) continue;

				const sessionName = entry.replace(/\.log$/, '');
				const isOrphan = !this.isActiveSession(sessionName);

				logFiles.push({
					name: entry,
					path: filePath,
					sizeBytes: stat.size,
					isOrphan,
				});
			} catch {
				// File may have been removed between readdir and stat
			}
		}

		return logFiles;
	}

	/**
	 * Checks if a session name matches any active session.
	 * A session is active if its name is in the active set.
	 *
	 * @param sessionName - The session name derived from the log file name
	 * @returns true if the session is currently active
	 */
	private isActiveSession(sessionName: string): boolean {
		if (this.activeSessionNames.size === 0) return true; // If no active sessions provided, treat all as active
		return this.activeSessionNames.has(sessionName);
	}

	/**
	 * Rotates a single log file: optionally archives, then truncates to keep
	 * only the tail portion up to maxSize.
	 *
	 * Uses atomic write (temp file + rename) to prevent data corruption.
	 *
	 * @param file - Log file information
	 * @param maxSize - Maximum allowed size in bytes
	 * @param result - Rotation result to update archive count
	 * @returns Number of bytes freed
	 */
	private async rotateFile(file: LogFileInfo, maxSize: number, result: RotationRunResult): Promise<number> {
		const originalSize = file.sizeBytes;

		// Archive before truncating (if enabled)
		if (LOG_ROTATION_CONSTANTS.LOG_ROTATION_ARCHIVE_ENABLED) {
			try {
				await this.archiveFile(file);
				result.archivesCreated++;
			} catch (error) {
				this.logger.warn(`Archive failed for ${file.name}, proceeding with truncation`, {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Truncate: keep only the last maxSize bytes
		await this.truncateFile(file.path, maxSize);

		return originalSize - maxSize;
	}

	/**
	 * Compresses a log file to the archive directory as a gzipped file.
	 *
	 * @param file - Log file to archive
	 */
	private async archiveFile(file: LogFileInfo): Promise<void> {
		const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const sessionName = file.name.replace(/\.log$/, '');
		const archiveName = `${sessionName}-${dateStr}.gz`;
		const archivePath = path.join(this.archiveDir, archiveName);

		const source = createReadStream(file.path);
		const gzip = createGzip({ level: 6 });
		const dest = createWriteStream(archivePath);

		await pipeline(source, gzip, dest);

		this.logger.info(`Archived ${file.name} → ${archiveName}`, {
			originalSizeMB: Math.round(file.sizeBytes / (1024 * 1024) * 100) / 100,
		});
	}

	/**
	 * Truncates a file to keep only the last `keepBytes` bytes.
	 * Uses atomic write: reads tail → writes to temp → renames over original.
	 *
	 * @param filePath - Path to the file to truncate
	 * @param keepBytes - Number of bytes to keep from the end
	 */
	private async truncateFile(filePath: string, keepBytes: number): Promise<void> {
		const stat = await fs.stat(filePath);
		if (stat.size <= keepBytes) return;

		const skipBytes = stat.size - keepBytes;
		const tempPath = filePath + '.tmp';

		// Read the tail portion
		const fd = await fs.open(filePath, 'r');
		try {
			const buffer = Buffer.alloc(keepBytes);
			await fd.read(buffer, 0, keepBytes, skipBytes);
			await fs.writeFile(tempPath, buffer);
		} finally {
			await fd.close();
		}

		// Atomic rename
		await fs.rename(tempPath, filePath);

		this.logger.info(`Truncated ${path.basename(filePath)}`, {
			originalSizeMB: Math.round(stat.size / (1024 * 1024) * 100) / 100,
			newSizeMB: Math.round(keepBytes / (1024 * 1024) * 100) / 100,
		});
	}

	/**
	 * Deletes archive files older than the configured retention period.
	 *
	 * @param result - Rotation result to record errors
	 * @returns Number of stale archives deleted
	 */
	private async cleanStaleArchives(result: RotationRunResult): Promise<number> {
		let deleted = 0;

		try {
			const entries = await fs.readdir(this.archiveDir);
			const now = Date.now();
			const maxAgeMs = LOG_ROTATION_CONSTANTS.ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

			for (const entry of entries) {
				if (!entry.endsWith('.gz')) continue;

				const archivePath = path.join(this.archiveDir, entry);
				try {
					const stat = await fs.stat(archivePath);
					if (now - stat.mtimeMs > maxAgeMs) {
						await fs.unlink(archivePath);
						deleted++;
						this.logger.info(`Deleted stale archive: ${entry}`);
					}
				} catch (error) {
					const msg = `Failed to check/delete archive ${entry}: ${error instanceof Error ? error.message : String(error)}`;
					result.errors.push(msg);
				}
			}
		} catch {
			// Archive directory may not exist yet
		}

		return deleted;
	}

	// Expose private paths for testing
	/** @internal */
	getSessionsDir(): string { return this.sessionsDir; }
	/** @internal */
	getArchiveDir(): string { return this.archiveDir; }
}
