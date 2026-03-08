/**
 * Tests for Payment Routes
 *
 * Validates the Express router configuration for payment endpoints,
 * ensuring correct HTTP methods, path registrations, and
 * authentication middleware placement.
 *
 * @module controllers/payment/payment.routes.test
 */

import { createPaymentRouter } from './payment.routes.js';

// Mock controller handlers
jest.mock('./payment.controller.js', () => ({
	handleCreateCheckout: jest.fn((_req: unknown, _res: unknown) => {}),
	handleWebhook: jest.fn((_req: unknown, _res: unknown) => {}),
	handleGetSubscription: jest.fn((_req: unknown, _res: unknown) => {}),
	handleCreatePortal: jest.fn((_req: unknown, _res: unknown) => {}),
}));

jest.mock('../../services/cloud/auth/supabase-auth.middleware.js', () => ({
	requireSupabaseAuth: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

interface RouteInfo {
	path: string;
	methods: string[];
	middlewareCount: number;
}

describe('createPaymentRouter', () => {
	it('should return an Express router', () => {
		const router = createPaymentRouter();
		expect(router).toBeDefined();
		expect(typeof router).toBe('function');
	});

	it('should register exactly 4 routes', () => {
		const router = createPaymentRouter();
		const routeCount = (router as any).stack.filter((layer: any) => layer.route).length;
		expect(routeCount).toBe(4);
	});

	it('should register all expected routes with correct methods', () => {
		const router = createPaymentRouter();
		const routes: RouteInfo[] = (router as any).stack
			.filter((layer: any) => layer.route)
			.map((layer: any) => ({
				path: layer.route.path,
				methods: Object.keys(layer.route.methods),
				middlewareCount: layer.route.stack.length,
			}));

		// POST /checkout (auth + handler = 2)
		const checkoutRoute = routes.find(r => r.path === '/checkout' && r.methods.includes('post'));
		expect(checkoutRoute).toBeDefined();
		expect(checkoutRoute!.middlewareCount).toBe(2);

		// GET /subscription (auth + handler = 2)
		const subscriptionRoute = routes.find(r => r.path === '/subscription' && r.methods.includes('get'));
		expect(subscriptionRoute).toBeDefined();
		expect(subscriptionRoute!.middlewareCount).toBe(2);

		// POST /portal (auth + handler = 2)
		const portalRoute = routes.find(r => r.path === '/portal' && r.methods.includes('post'));
		expect(portalRoute).toBeDefined();
		expect(portalRoute!.middlewareCount).toBe(2);

		// POST /webhook (handler only = 1, no auth)
		const webhookRoute = routes.find(r => r.path === '/webhook' && r.methods.includes('post'));
		expect(webhookRoute).toBeDefined();
		expect(webhookRoute!.middlewareCount).toBe(1);
	});

	it('should have 3 authenticated routes and 1 public route', () => {
		const router = createPaymentRouter();
		const routes: RouteInfo[] = (router as any).stack
			.filter((layer: any) => layer.route)
			.map((layer: any) => ({
				path: layer.route.path,
				methods: Object.keys(layer.route.methods),
				middlewareCount: layer.route.stack.length,
			}));

		const authenticated = routes.filter(r => r.middlewareCount === 2);
		const publicRoutes = routes.filter(r => r.middlewareCount === 1);

		expect(authenticated).toHaveLength(3); // checkout, subscription, portal
		expect(publicRoutes).toHaveLength(1);   // webhook
	});

	it('should not require auth on webhook route', () => {
		const router = createPaymentRouter();
		const routes: RouteInfo[] = (router as any).stack
			.filter((layer: any) => layer.route)
			.map((layer: any) => ({
				path: layer.route.path,
				methods: Object.keys(layer.route.methods),
				middlewareCount: layer.route.stack.length,
			}));

		const webhookRoute = routes.find(r => r.path === '/webhook');
		expect(webhookRoute).toBeDefined();
		expect(webhookRoute!.middlewareCount).toBe(1); // Only the handler, no auth middleware
	});
});
