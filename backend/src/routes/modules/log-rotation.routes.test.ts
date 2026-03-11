import express from 'express';
import request from 'supertest';
import { createLogRotationRouter } from './log-rotation.routes';
import { LogRotationService } from '../../services/session/log-rotation.service';

// Mock the LogRotationService
jest.mock('../../services/session/log-rotation.service');

const mockRunRotation = jest.fn();
const mockGetStatus = jest.fn();

(LogRotationService.getInstance as jest.Mock) = jest.fn().mockReturnValue({
	runRotation: mockRunRotation,
	getStatus: mockGetStatus,
});

function createApp() {
	const app = express();
	app.use(express.json());
	app.use('/admin/log-rotation', createLogRotationRouter());
	return app;
}

describe('Log Rotation Routes', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('POST /admin/log-rotation/run', () => {
		it('should trigger a rotation and return result', async () => {
			mockRunRotation.mockResolvedValue({
				timestamp: new Date('2026-03-09T12:00:00Z'),
				filesScanned: 5,
				filesTruncated: 2,
				archivesCreated: 2,
				staleArchivesDeleted: 1,
				bytesFreed: 1024 * 1024 * 100, // 100MB
				errors: [],
			});

			const app = createApp();
			const res = await request(app).post('/admin/log-rotation/run');

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.filesScanned).toBe(5);
			expect(res.body.data.filesTruncated).toBe(2);
			expect(res.body.data.bytesFreedMB).toBeCloseTo(100, 0);
			expect(mockRunRotation).toHaveBeenCalledTimes(1);
		});

		it('should return 500 on rotation error', async () => {
			mockRunRotation.mockRejectedValue(new Error('disk full'));

			const app = createApp();
			const res = await request(app).post('/admin/log-rotation/run');

			expect(res.status).toBe(500);
			expect(res.body.success).toBe(false);
			expect(res.body.error).toContain('disk full');
		});

		it('should compute bytesFreedMB correctly for fractional values', async () => {
			mockRunRotation.mockResolvedValue({
				timestamp: new Date('2026-03-09T12:00:00Z'),
				filesScanned: 1,
				filesTruncated: 1,
				archivesCreated: 0,
				staleArchivesDeleted: 0,
				bytesFreed: 1536000, // ~1.46 MB
				errors: [],
			});

			const app = createApp();
			const res = await request(app).post('/admin/log-rotation/run');

			expect(res.status).toBe(200);
			expect(res.body.data.bytesFreedMB).toBeCloseTo(1.46, 1);
		});

		it('should handle zero bytes freed', async () => {
			mockRunRotation.mockResolvedValue({
				timestamp: new Date('2026-03-11T08:00:00Z'),
				filesScanned: 3,
				filesTruncated: 0,
				archivesCreated: 0,
				staleArchivesDeleted: 0,
				bytesFreed: 0,
				errors: [],
			});

			const app = createApp();
			const res = await request(app).post('/admin/log-rotation/run');

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.bytesFreedMB).toBe(0);
			expect(res.body.data.filesTruncated).toBe(0);
		});

		it('should stringify non-Error thrown values in error response', async () => {
			mockRunRotation.mockRejectedValue('string error');

			const app = createApp();
			const res = await request(app).post('/admin/log-rotation/run');

			expect(res.status).toBe(500);
			expect(res.body.success).toBe(false);
			expect(res.body.error).toBe('string error');
		});

		it('should preserve original result fields alongside bytesFreedMB', async () => {
			mockRunRotation.mockResolvedValue({
				timestamp: new Date('2026-03-11T09:00:00Z'),
				filesScanned: 10,
				filesTruncated: 4,
				archivesCreated: 3,
				staleArchivesDeleted: 2,
				bytesFreed: 1024 * 1024 * 50,
				errors: ['partial failure on log-x.txt'],
			});

			const app = createApp();
			const res = await request(app).post('/admin/log-rotation/run');

			expect(res.status).toBe(200);
			expect(res.body.data.archivesCreated).toBe(3);
			expect(res.body.data.staleArchivesDeleted).toBe(2);
			expect(res.body.data.errors).toEqual(['partial failure on log-x.txt']);
		});
	});

	describe('GET /admin/log-rotation/status', () => {
		it('should return current status with file info', async () => {
			mockGetStatus.mockResolvedValue({
				isRunning: true,
				lastRun: null,
				currentFiles: [
					{ name: 'crewly-orc.log', path: '/tmp/crewly-orc.log', sizeBytes: 1024 * 1024 * 50, isOrphan: false },
					{ name: 'old-session.log', path: '/tmp/old-session.log', sizeBytes: 1024 * 1024 * 10, isOrphan: true },
				],
				totalSizeBytes: 1024 * 1024 * 60,
			});

			const app = createApp();
			const res = await request(app).get('/admin/log-rotation/status');

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.isRunning).toBe(true);
			expect(res.body.data.totalSizeMB).toBeCloseTo(60, 0);
			expect(res.body.data.currentFiles).toHaveLength(2);
			expect(res.body.data.currentFiles[0].sizeMB).toBeCloseTo(50, 0);
			expect(res.body.data.currentFiles[1].isOrphan).toBe(true);
		});

		it('should return 500 on status error', async () => {
			mockGetStatus.mockRejectedValue(new Error('cannot access'));

			const app = createApp();
			const res = await request(app).get('/admin/log-rotation/status');

			expect(res.status).toBe(500);
			expect(res.body.success).toBe(false);
		});

		it('should handle empty currentFiles array', async () => {
			mockGetStatus.mockResolvedValue({
				isRunning: false,
				lastRun: '2026-03-11T07:00:00Z',
				currentFiles: [],
				totalSizeBytes: 0,
			});

			const app = createApp();
			const res = await request(app).get('/admin/log-rotation/status');

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.currentFiles).toEqual([]);
			expect(res.body.data.totalSizeMB).toBe(0);
		});

		it('should compute sizeMB for each file independently', async () => {
			mockGetStatus.mockResolvedValue({
				isRunning: false,
				lastRun: null,
				currentFiles: [
					{ name: 'a.log', path: '/tmp/a.log', sizeBytes: 512000, isOrphan: false },
					{ name: 'b.log', path: '/tmp/b.log', sizeBytes: 2048000, isOrphan: false },
				],
				totalSizeBytes: 2560000,
			});

			const app = createApp();
			const res = await request(app).get('/admin/log-rotation/status');

			expect(res.status).toBe(200);
			expect(res.body.data.currentFiles[0].sizeMB).toBeCloseTo(0.49, 1);
			expect(res.body.data.currentFiles[1].sizeMB).toBeCloseTo(1.95, 1);
		});

		it('should stringify non-Error thrown values in error response', async () => {
			mockGetStatus.mockRejectedValue(42);

			const app = createApp();
			const res = await request(app).get('/admin/log-rotation/status');

			expect(res.status).toBe(500);
			expect(res.body.success).toBe(false);
			expect(res.body.error).toBe('42');
		});

		it('should preserve original file fields alongside sizeMB', async () => {
			mockGetStatus.mockResolvedValue({
				isRunning: false,
				lastRun: null,
				currentFiles: [
					{ name: 'test.log', path: '/var/log/test.log', sizeBytes: 1024 * 1024, isOrphan: true },
				],
				totalSizeBytes: 1024 * 1024,
			});

			const app = createApp();
			const res = await request(app).get('/admin/log-rotation/status');

			const file = res.body.data.currentFiles[0];
			expect(file.name).toBe('test.log');
			expect(file.path).toBe('/var/log/test.log');
			expect(file.isOrphan).toBe(true);
			expect(file.sizeMB).toBeCloseTo(1, 0);
		});
	});

	describe('Route registration', () => {
		it('should register exactly two routes', () => {
			const router = createLogRotationRouter();
			const routes = router.stack.filter((layer: any) => layer.route);
			expect(routes).toHaveLength(2);
		});

		it('should register POST /run and GET /status', () => {
			const router = createLogRotationRouter();
			const routes = router.stack
				.filter((layer: any) => layer.route)
				.map((layer: any) => ({
					path: layer.route.path,
					methods: Object.keys(layer.route.methods),
				}));

			expect(routes).toContainEqual({ path: '/run', methods: ['post'] });
			expect(routes).toContainEqual({ path: '/status', methods: ['get'] });
		});
	});
});
