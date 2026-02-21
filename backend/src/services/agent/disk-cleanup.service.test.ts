/**
 * Tests for DiskCleanupService
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DiskCleanupService } from './disk-cleanup.service.js';

// Mock LoggerService
jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({
				info: jest.fn(),
				debug: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
			}),
		}),
	},
}));

describe('DiskCleanupService', () => {
	let tempDir: string;

	beforeEach(() => {
		DiskCleanupService.resetInstance();
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crewly-disk-cleanup-test-'));
	});

	afterEach(() => {
		DiskCleanupService.resetInstance();
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	describe('getInstance', () => {
		it('should return a singleton instance', () => {
			const a = DiskCleanupService.getInstance(tempDir);
			const b = DiskCleanupService.getInstance(tempDir);
			expect(a).toBe(b);
		});
	});

	describe('resetInstance', () => {
		it('should create a fresh instance after reset', () => {
			const a = DiskCleanupService.getInstance(tempDir);
			DiskCleanupService.resetInstance();
			const b = DiskCleanupService.getInstance(tempDir);
			expect(a).not.toBe(b);
		});
	});

	describe('purgeDebugLogs', () => {
		it('should handle non-existent debug directory gracefully', () => {
			const service = DiskCleanupService.getInstance(tempDir);
			const result = service.purgeDebugLogs();
			expect(result.deleted).toBe(0);
			expect(result.bytesFreed).toBe(0);
		});

		it('should delete files older than threshold', () => {
			const debugDir = path.join(tempDir, 'debug');
			fs.mkdirSync(debugDir, { recursive: true });

			// Create an "old" file by backdating its mtime
			const oldFile = path.join(debugDir, 'old-debug.log');
			fs.writeFileSync(oldFile, 'old log data');
			const pastTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
			fs.utimesSync(oldFile, new Date(pastTime), new Date(pastTime));

			// Create a "recent" file
			const recentFile = path.join(debugDir, 'recent-debug.log');
			fs.writeFileSync(recentFile, 'recent log data');

			const service = DiskCleanupService.getInstance(tempDir);
			const result = service.purgeDebugLogs(24); // 24-hour threshold

			expect(result.deleted).toBe(1);
			expect(result.bytesFreed).toBeGreaterThan(0);
			expect(fs.existsSync(oldFile)).toBe(false);
			expect(fs.existsSync(recentFile)).toBe(true);
		});

		it('should skip directories inside debug dir', () => {
			const debugDir = path.join(tempDir, 'debug');
			fs.mkdirSync(debugDir, { recursive: true });
			fs.mkdirSync(path.join(debugDir, 'subdir'));

			const service = DiskCleanupService.getInstance(tempDir);
			const result = service.purgeDebugLogs(0); // delete everything
			expect(result.deleted).toBe(0);
		});
	});

	describe('clearShellSnapshots', () => {
		it('should handle non-existent snapshots directory gracefully', () => {
			const service = DiskCleanupService.getInstance(tempDir);
			const result = service.clearShellSnapshots();
			expect(result.deleted).toBe(0);
			expect(result.bytesFreed).toBe(0);
		});

		it('should delete all snapshot files', () => {
			const snapshotsDir = path.join(tempDir, 'shell-snapshots');
			fs.mkdirSync(snapshotsDir, { recursive: true });
			fs.writeFileSync(path.join(snapshotsDir, 'snap1.json'), '{}');
			fs.writeFileSync(path.join(snapshotsDir, 'snap2.json'), '{}');

			const service = DiskCleanupService.getInstance(tempDir);
			const result = service.clearShellSnapshots();

			expect(result.deleted).toBe(2);
			expect(result.bytesFreed).toBeGreaterThan(0);
		});
	});

	describe('runSuspendCleanup', () => {
		it('should aggregate stats from all cleanup steps', () => {
			const debugDir = path.join(tempDir, 'debug');
			const snapshotsDir = path.join(tempDir, 'shell-snapshots');
			fs.mkdirSync(debugDir, { recursive: true });
			fs.mkdirSync(snapshotsDir, { recursive: true });

			// Old debug log
			const oldFile = path.join(debugDir, 'old.log');
			fs.writeFileSync(oldFile, 'old data');
			const pastTime = Date.now() - 25 * 60 * 60 * 1000;
			fs.utimesSync(oldFile, new Date(pastTime), new Date(pastTime));

			// Shell snapshot
			fs.writeFileSync(path.join(snapshotsDir, 'snap.json'), '{}');

			const service = DiskCleanupService.getInstance(tempDir);
			const stats = service.runSuspendCleanup();

			expect(stats.debugLogsDeleted).toBe(1);
			expect(stats.shellSnapshotsDeleted).toBe(1);
			expect(stats.bytesFreed).toBeGreaterThan(0);
		});

		it('should return zero stats when nothing to clean', () => {
			const service = DiskCleanupService.getInstance(tempDir);
			const stats = service.runSuspendCleanup();

			expect(stats.debugLogsDeleted).toBe(0);
			expect(stats.shellSnapshotsDeleted).toBe(0);
			expect(stats.bytesFreed).toBe(0);
		});
	});
});
