/**
 * Factory Routes Tests
 *
 * Tests for the Factory API endpoints
 *
 * @module routes/factory.routes.test
 */

import { createFactoryRoutes } from './factory.routes.js';
import express, { Express } from 'express';
import request from 'supertest';

describe('Factory Routes', () => {
	let app: Express;

	beforeAll(() => {
		app = express();
		app.use(express.json());
		app.use('/api/factory', createFactoryRoutes());
	});

	describe('GET /api/factory/health', () => {
		it('should return health status', async () => {
			const response = await request(app).get('/api/factory/health');

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('status', 'ok');
			expect(response.body).toHaveProperty('timestamp');
		});
	});

	describe('GET /api/factory/claude-instances', () => {
		it('should return instances data structure', async () => {
			const response = await request(app).get('/api/factory/claude-instances');

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('timestamp');
			expect(response.body).toHaveProperty('totalInstances');
			expect(response.body).toHaveProperty('activeCount');
			expect(response.body).toHaveProperty('idleCount');
			expect(response.body).toHaveProperty('dormantCount');
			expect(response.body).toHaveProperty('instances');
			expect(Array.isArray(response.body.instances)).toBe(true);
		});
	});

	describe('GET /api/factory/usage', () => {
		it('should return usage data structure', async () => {
			const response = await request(app).get('/api/factory/usage');

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty('timestamp');
			expect(response.body).toHaveProperty('today');
			expect(response.body).toHaveProperty('totals');
			expect(response.body).toHaveProperty('modelUsage');
			expect(response.body).toHaveProperty('recentDays');

			// Check today structure
			expect(response.body.today).toHaveProperty('date');
			expect(response.body.today).toHaveProperty('messages');
			expect(response.body.today).toHaveProperty('sessions');
			expect(response.body.today).toHaveProperty('toolCalls');
			expect(response.body.today).toHaveProperty('tokens');
		});
	});
});
