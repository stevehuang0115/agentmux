import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { LogRotationService } from './log-rotation.service.js';
import { LOG_ROTATION_CONSTANTS } from '../../constants.js';

// Use a temp directory for all tests
let testDir: string;
let sessionsDir: string;
let archiveDir: string;

// Mock os.homedir to use temp dir
const originalHomedir = os.homedir;

beforeEach(async () => {
	testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'log-rotation-test-'));
	sessionsDir = path.join(testDir, '.crewly', 'logs', 'sessions');
	archiveDir = path.join(testDir, '.crewly', 'logs', 'archive');
	await fs.mkdir(sessionsDir, { recursive: true });
	await fs.mkdir(archiveDir, { recursive: true });

	// Override homedir
	jest.spyOn(os, 'homedir').mockReturnValue(testDir);

	// Reset singleton so it picks up new homedir
	LogRotationService.resetInstance();
});

afterEach(async () => {
	LogRotationService.resetInstance();
	jest.restoreAllMocks();

	// Clean up temp dir
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch {
		// ignore cleanup errors
	}
});

/**
 * Creates a test log file with the specified size in bytes.
 */
async function createLogFile(name: string, sizeBytes: number): Promise<string> {
	const filePath = path.join(sessionsDir, name);
	const content = Buffer.alloc(sizeBytes, 'A');
	// Write recognizable tail content for verification
	const tail = Buffer.from('TAIL_MARKER_END');
	if (sizeBytes > tail.length) {
		tail.copy(content, sizeBytes - tail.length);
	}
	await fs.writeFile(filePath, content);
	return filePath;
}

/**
 * Creates a test archive file with a specific mtime.
 */
async function createArchiveFile(name: string, mtimeDaysAgo: number): Promise<string> {
	const filePath = path.join(archiveDir, name);
	await fs.writeFile(filePath, 'archive-content');
	const mtime = new Date(Date.now() - mtimeDaysAgo * 24 * 60 * 60 * 1000);
	await fs.utimes(filePath, mtime, mtime);
	return filePath;
}

describe('LogRotationService', () => {
	describe('getInstance', () => {
		it('should return a singleton instance', () => {
			const a = LogRotationService.getInstance();
			const b = LogRotationService.getInstance();
			expect(a).toBe(b);
		});

		it('should return a fresh instance after resetInstance', () => {
			const a = LogRotationService.getInstance();
			LogRotationService.resetInstance();
			const b = LogRotationService.getInstance();
			expect(a).not.toBe(b);
		});
	});

	describe('start and stop', () => {
		it('should start and stop without error', async () => {
			const service = LogRotationService.getInstance();
			await service.start([]);
			service.stop();
		});

		it('should not start twice', async () => {
			const service = LogRotationService.getInstance();
			await service.start([]);
			await service.start([]); // Should warn but not throw
			service.stop();
		});

		it('should run rotation immediately on start', async () => {
			await createLogFile('test.log', 100);
			const service = LogRotationService.getInstance();
			const spy = jest.spyOn(service, 'runRotation');
			await service.start([]);
			expect(spy).toHaveBeenCalledTimes(1);
			service.stop();
		});
	});

	describe('scanLogFiles (via getStatus)', () => {
		it('should detect log files in the sessions directory', async () => {
			await createLogFile('session-a.log', 1000);
			await createLogFile('session-b.log', 2000);

			const service = LogRotationService.getInstance();
			const status = await service.getStatus();

			expect(status.currentFiles).toHaveLength(2);
			expect(status.totalSizeBytes).toBe(3000);
		});

		it('should ignore non-.log files', async () => {
			await createLogFile('session-a.log', 1000);
			await fs.writeFile(path.join(sessionsDir, 'notes.txt'), 'hello');

			const service = LogRotationService.getInstance();
			const status = await service.getStatus();

			expect(status.currentFiles).toHaveLength(1);
		});

		it('should mark orphan files when active sessions are provided', async () => {
			await createLogFile('active-session.log', 1000);
			await createLogFile('dead-session.log', 1000);

			const service = LogRotationService.getInstance();
			service.updateActiveSessionNames(['active-session']);
			const status = await service.getStatus();

			const active = status.currentFiles.find(f => f.name === 'active-session.log');
			const dead = status.currentFiles.find(f => f.name === 'dead-session.log');

			expect(active?.isOrphan).toBe(false);
			expect(dead?.isOrphan).toBe(true);
		});

		it('should treat all as active when no active sessions are specified', async () => {
			await createLogFile('session.log', 1000);

			const service = LogRotationService.getInstance();
			// Don't call updateActiveSessionNames — empty set
			const status = await service.getStatus();

			expect(status.currentFiles[0]?.isOrphan).toBe(false);
		});
	});

	describe('runRotation', () => {
		it('should truncate files exceeding MAX_LOG_SIZE_BYTES', async () => {
			const size = LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES + 1024 * 1024; // 21MB
			await createLogFile('big.log', size);

			const service = LogRotationService.getInstance();
			const result = await service.runRotation();

			expect(result.filesScanned).toBe(1);
			expect(result.filesTruncated).toBe(1);
			expect(result.bytesFreed).toBe(size - LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES);

			// Verify file was truncated to max size
			const stat = await fs.stat(path.join(sessionsDir, 'big.log'));
			expect(stat.size).toBe(LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES);
		});

		it('should not truncate files under the limit', async () => {
			await createLogFile('small.log', 1000);

			const service = LogRotationService.getInstance();
			const result = await service.runRotation();

			expect(result.filesTruncated).toBe(0);
			expect(result.bytesFreed).toBe(0);
		});

		it('should use stricter limit for orphan logs', async () => {
			// Create a file bigger than orphan limit but smaller than normal limit
			const size = LOG_ROTATION_CONSTANTS.ORPHAN_LOG_MAX_SIZE_BYTES + 1024 * 1024; // 6MB
			await createLogFile('orphan.log', size);

			const service = LogRotationService.getInstance();
			service.updateActiveSessionNames(['other-session']);
			const result = await service.runRotation();

			expect(result.filesTruncated).toBe(1);

			const stat = await fs.stat(path.join(sessionsDir, 'orphan.log'));
			expect(stat.size).toBe(LOG_ROTATION_CONSTANTS.ORPHAN_LOG_MAX_SIZE_BYTES);
		});

		it('should preserve the tail content after truncation', async () => {
			const size = LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES + 1024;
			const filePath = path.join(sessionsDir, 'tail-test.log');

			// Write with recognizable tail
			const content = Buffer.alloc(size, 'X');
			const marker = 'UNIQUE_TAIL_MARKER';
			Buffer.from(marker).copy(content, size - marker.length);
			await fs.writeFile(filePath, content);

			const service = LogRotationService.getInstance();
			await service.runRotation();

			const truncated = await fs.readFile(filePath, 'utf-8');
			expect(truncated.endsWith(marker)).toBe(true);
		});

		it('should create archive when archiving is enabled', async () => {
			const size = LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES + 1024;
			await createLogFile('archived.log', size);

			const service = LogRotationService.getInstance();
			const result = await service.runRotation();

			expect(result.archivesCreated).toBe(1);

			// Check archive directory has a .gz file
			const archives = await fs.readdir(archiveDir);
			const gzFiles = archives.filter(f => f.endsWith('.gz'));
			expect(gzFiles).toHaveLength(1);
			expect(gzFiles[0]).toMatch(/^archived-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.gz$/);
		});

		it('should delete stale archives', async () => {
			await createArchiveFile('old-session-2026-01-01T00-00-00.gz', 10); // 10 days old
			await createArchiveFile('recent-session-2026-03-08T00-00-00.gz', 1); // 1 day old

			const service = LogRotationService.getInstance();
			const result = await service.runRotation();

			expect(result.staleArchivesDeleted).toBe(1);

			// Only recent should remain
			const remaining = await fs.readdir(archiveDir);
			expect(remaining).toHaveLength(1);
			expect(remaining[0]).toContain('recent');
		});

		it('should handle empty sessions directory', async () => {
			const service = LogRotationService.getInstance();
			const result = await service.runRotation();

			expect(result.filesScanned).toBe(0);
			expect(result.filesTruncated).toBe(0);
			expect(result.errors).toHaveLength(0);
		});

		it('should report errors for unreadable files without crashing', async () => {
			await createLogFile('normal.log', 100);
			// Create a file then make sessions dir contain a broken symlink
			const brokenLink = path.join(sessionsDir, 'broken.log');
			try {
				await fs.symlink('/nonexistent/path', brokenLink);
			} catch {
				// Skip test if symlinks not supported
				return;
			}

			const service = LogRotationService.getInstance();
			const result = await service.runRotation();

			// Should still scan the normal file
			expect(result.filesScanned).toBeGreaterThanOrEqual(1);
		});
	});

	describe('getStatus', () => {
		it('should return service status with file info', async () => {
			await createLogFile('a.log', 5000);
			await createLogFile('b.log', 3000);

			const service = LogRotationService.getInstance();
			const status = await service.getStatus();

			expect(status.isRunning).toBe(false);
			expect(status.lastRun).toBeNull();
			expect(status.currentFiles).toHaveLength(2);
			expect(status.totalSizeBytes).toBe(8000);
		});

		it('should reflect lastRun after a rotation', async () => {
			await createLogFile('test.log', 100);

			const service = LogRotationService.getInstance();
			await service.runRotation();
			const status = await service.getStatus();

			expect(status.lastRun).not.toBeNull();
			expect(status.lastRun!.filesScanned).toBe(1);
		});

		it('should show isRunning=true after start', async () => {
			const service = LogRotationService.getInstance();
			await service.start([]);

			const status = await service.getStatus();
			expect(status.isRunning).toBe(true);

			service.stop();
		});
	});

	describe('updateActiveSessionNames', () => {
		it('should update orphan detection based on active sessions', async () => {
			await createLogFile('session-a.log', 1000);
			await createLogFile('session-b.log', 1000);

			const service = LogRotationService.getInstance();

			service.updateActiveSessionNames(['session-a']);
			let status = await service.getStatus();
			expect(status.currentFiles.find(f => f.name === 'session-a.log')?.isOrphan).toBe(false);
			expect(status.currentFiles.find(f => f.name === 'session-b.log')?.isOrphan).toBe(true);

			service.updateActiveSessionNames(['session-a', 'session-b']);
			status = await service.getStatus();
			expect(status.currentFiles.find(f => f.name === 'session-b.log')?.isOrphan).toBe(false);
		});
	});

	describe('atomic truncation', () => {
		it('should use temp file for atomic write', async () => {
			const size = LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES + 2048;
			const filePath = await createLogFile('atomic.log', size);

			const service = LogRotationService.getInstance();
			await service.runRotation();

			// After rotation, no .tmp file should remain
			const files = await fs.readdir(sessionsDir);
			const tmpFiles = files.filter(f => f.endsWith('.tmp'));
			expect(tmpFiles).toHaveLength(0);

			// Original file should still exist
			const stat = await fs.stat(filePath);
			expect(stat.size).toBe(LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES);
		});
	});

	describe('multiple files rotation', () => {
		it('should process multiple oversized files in one run', async () => {
			const bigSize = LOG_ROTATION_CONSTANTS.MAX_LOG_SIZE_BYTES + 500000;
			await createLogFile('big1.log', bigSize);
			await createLogFile('big2.log', bigSize);
			await createLogFile('small.log', 1000);

			const service = LogRotationService.getInstance();
			const result = await service.runRotation();

			expect(result.filesScanned).toBe(3);
			expect(result.filesTruncated).toBe(2);
			expect(result.archivesCreated).toBe(2);
		});
	});
});
