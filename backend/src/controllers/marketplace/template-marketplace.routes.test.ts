/**
 * Tests for Template Marketplace Routes
 *
 * Validates the Express router configuration for template marketplace
 * endpoints, ensuring correct HTTP methods, path registrations, and
 * authentication middleware on write operations.
 *
 * @module controllers/marketplace/template-marketplace.routes.test
 */

import { createTemplateMarketplaceRouter } from './template-marketplace.routes.js';

// Mock all controller handlers
jest.mock('./template-marketplace.controller.js', () => ({
	handleCreateTemplate: jest.fn((_req: unknown, _res: unknown) => {}),
	handleListTemplates: jest.fn((_req: unknown, _res: unknown) => {}),
	handleGetTemplate: jest.fn((_req: unknown, _res: unknown) => {}),
	handleUpdateTemplate: jest.fn((_req: unknown, _res: unknown) => {}),
	handleArchiveTemplate: jest.fn((_req: unknown, _res: unknown) => {}),
	handleAddVersion: jest.fn((_req: unknown, _res: unknown) => {}),
	handleListVersions: jest.fn((_req: unknown, _res: unknown) => {}),
	handlePublishTemplate: jest.fn((_req: unknown, _res: unknown) => {}),
}));

jest.mock('../../services/cloud/cloud-auth.middleware.js', () => ({
	requireCloudConnection: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
	requireTier: jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

interface RouteInfo {
	path: string;
	methods: string[];
	middlewareCount: number;
}

describe('createTemplateMarketplaceRouter', () => {
	it('should return an Express router', () => {
		const router = createTemplateMarketplaceRouter();
		expect(router).toBeDefined();
		expect(typeof router).toBe('function');
	});

	it('should register all expected routes', () => {
		const router = createTemplateMarketplaceRouter();
		const routes: RouteInfo[] = (router as any).stack
			.filter((layer: any) => layer.route)
			.map((layer: any) => ({
				path: layer.route.path,
				methods: Object.keys(layer.route.methods),
				middlewareCount: layer.route.stack.length,
			}));

		// Public read routes (no auth middleware — 1 handler only)
		const listRoute = routes.find(r => r.path === '/' && r.methods.includes('get'));
		expect(listRoute).toBeDefined();
		expect(listRoute!.middlewareCount).toBe(1);

		const getRoute = routes.find(r => r.path === '/:id' && r.methods.includes('get'));
		expect(getRoute).toBeDefined();
		expect(getRoute!.middlewareCount).toBe(1);

		const listVersionsRoute = routes.find(r => r.path === '/:id/versions' && r.methods.includes('get'));
		expect(listVersionsRoute).toBeDefined();
		expect(listVersionsRoute!.middlewareCount).toBe(1);

		// Protected write routes (requireSupabaseAuth + handler = 2)
		const createRoute = routes.find(r => r.path === '/' && r.methods.includes('post'));
		expect(createRoute).toBeDefined();
		expect(createRoute!.middlewareCount).toBe(2);

		const updateRoute = routes.find(r => r.path === '/:id' && r.methods.includes('put'));
		expect(updateRoute).toBeDefined();
		expect(updateRoute!.middlewareCount).toBe(2);

		const archiveRoute = routes.find(r => r.path === '/:id' && r.methods.includes('delete'));
		expect(archiveRoute).toBeDefined();
		expect(archiveRoute!.middlewareCount).toBe(2);

		const addVersionRoute = routes.find(r => r.path === '/:id/versions' && r.methods.includes('post'));
		expect(addVersionRoute).toBeDefined();
		expect(addVersionRoute!.middlewareCount).toBe(2);

		const publishRoute = routes.find(r => r.path === '/:id/publish' && r.methods.includes('post'));
		expect(publishRoute).toBeDefined();
		expect(publishRoute!.middlewareCount).toBe(2);
	});

	it('should register exactly 8 routes', () => {
		const router = createTemplateMarketplaceRouter();
		const routeCount = (router as any).stack.filter((layer: any) => layer.route).length;
		expect(routeCount).toBe(8);
	});

	it('should have 3 public routes and 5 protected routes', () => {
		const router = createTemplateMarketplaceRouter();
		const routes: RouteInfo[] = (router as any).stack
			.filter((layer: any) => layer.route)
			.map((layer: any) => ({
				path: layer.route.path,
				methods: Object.keys(layer.route.methods),
				middlewareCount: layer.route.stack.length,
			}));

		const publicRoutes = routes.filter(r => r.middlewareCount === 1);
		const protectedRoutes = routes.filter(r => r.middlewareCount === 2);

		expect(publicRoutes).toHaveLength(3);  // GET /, GET /:id, GET /:id/versions
		expect(protectedRoutes).toHaveLength(5); // POST /, PUT /:id, DELETE /:id, POST /:id/versions, POST /:id/publish
	});
});
