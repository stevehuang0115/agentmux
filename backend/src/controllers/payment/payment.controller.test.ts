/**
 * Tests for Payment Controller
 *
 * Tests all payment endpoints: checkout, webhook, subscription, portal.
 *
 * @module controllers/payment/payment.controller.test
 */

import type { Request, Response } from 'express';
import {
	handleCreateCheckout,
	handleWebhook,
	handleGetSubscription,
	handleCreatePortal,
} from './payment.controller.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreateCheckoutSession = jest.fn();
const mockHandleWebhookEvent = jest.fn();
const mockGetSubscription = jest.fn();
const mockCreatePortalSession = jest.fn();
const mockIsConfigured = jest.fn().mockReturnValue(true);

jest.mock('../../services/payment/stripe.service.js', () => ({
	StripeService: {
		getInstance: () => ({
			createCheckoutSession: mockCreateCheckoutSession,
			handleWebhookEvent: mockHandleWebhookEvent,
			getSubscription: mockGetSubscription,
			createPortalSession: mockCreatePortalSession,
			isConfigured: mockIsConfigured,
		}),
	},
}));

jest.mock('../../services/cloud/auth/supabase-auth.middleware.js', () => ({
	requireSupabaseAuth: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(body: Record<string, unknown> = {}, headers: Record<string, string> = {}): Request {
	const req = {
		body,
		headers,
		user: { userId: 'user-123', email: 'test@test.com', plan: 'free' },
	} as unknown as Request;
	return req;
}

function mockRes(): Response {
	return {
		status: jest.fn().mockReturnThis(),
		json: jest.fn().mockReturnThis(),
	} as unknown as Response;
}

const next = jest.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Payment Controller', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	// -----------------------------------------------------------------------
	// POST /api/payment/checkout
	// -----------------------------------------------------------------------

	describe('handleCreateCheckout', () => {
		it('should return 400 when planId is missing', async () => {
			const req = mockReq({ interval: 'month', successUrl: 'http://ok', cancelUrl: 'http://cancel' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('planId') }));
		});

		it('should return 400 when planId is invalid', async () => {
			const req = mockReq({ planId: 'invalid', interval: 'month', successUrl: 'http://ok', cancelUrl: 'http://cancel' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
		});

		it('should return 400 when interval is missing', async () => {
			const req = mockReq({ planId: 'pro', successUrl: 'http://ok', cancelUrl: 'http://cancel' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('interval') }));
		});

		it('should return 400 when interval is invalid', async () => {
			const req = mockReq({ planId: 'pro', interval: 'weekly', successUrl: 'http://ok', cancelUrl: 'http://cancel' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
		});

		it('should return 400 when successUrl is missing', async () => {
			const req = mockReq({ planId: 'pro', interval: 'month', cancelUrl: 'http://cancel' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('successUrl') }));
		});

		it('should return 400 when cancelUrl is missing', async () => {
			const req = mockReq({ planId: 'pro', interval: 'month', successUrl: 'http://ok' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
		});

		it('should return 503 when Stripe is not configured', async () => {
			mockCreateCheckoutSession.mockResolvedValue({ success: false, message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.' });
			const req = mockReq({ planId: 'pro', interval: 'month', successUrl: 'http://ok', cancelUrl: 'http://cancel' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(res.status).toHaveBeenCalledWith(503);
		});

		it('should return 400 when service returns error (non-config)', async () => {
			mockCreateCheckoutSession.mockResolvedValue({ success: false, message: 'Cannot create checkout session for free plan' });
			const req = mockReq({ planId: 'pro', interval: 'month', successUrl: 'http://ok', cancelUrl: 'http://cancel' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
		});

		it('should return checkout data on success', async () => {
			const data = { checkoutUrl: 'https://checkout.stripe.com/test', sessionId: 'cs_1' };
			mockCreateCheckoutSession.mockResolvedValue({ success: true, message: 'ok', data });
			const req = mockReq({ planId: 'pro', interval: 'month', successUrl: 'http://ok', cancelUrl: 'http://cancel' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(res.json).toHaveBeenCalledWith({ success: true, data });
		});

		it('should pass authenticated userId to service', async () => {
			mockCreateCheckoutSession.mockResolvedValue({ success: true, message: 'ok', data: {} });
			const req = mockReq({ planId: 'pro', interval: 'month', successUrl: 'http://ok', cancelUrl: 'http://cancel' });
			const res = mockRes();
			await handleCreateCheckout(req, res, next);
			expect(mockCreateCheckoutSession).toHaveBeenCalledWith('user-123', 'pro', 'month', 'http://ok', 'http://cancel');
		});
	});

	// -----------------------------------------------------------------------
	// POST /api/payment/webhook
	// -----------------------------------------------------------------------

	describe('handleWebhook', () => {
		it('should return 400 when body is not a Buffer', async () => {
			const req = mockReq({ some: 'json' });
			const res = mockRes();
			await handleWebhook(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('raw body') }));
		});

		it('should return 400 when service returns error', async () => {
			mockHandleWebhookEvent.mockResolvedValue({ success: false, message: 'Missing Stripe-Signature header' });
			const req = { body: Buffer.from('{}'), headers: {} } as unknown as Request;
			const res = mockRes();
			await handleWebhook(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
		});

		it('should return 200 with received:true on success', async () => {
			mockHandleWebhookEvent.mockResolvedValue({ success: true, message: 'Processed', data: {} });
			const req = { body: Buffer.from('{}'), headers: { 'stripe-signature': 'sig' } } as unknown as Request;
			const res = mockRes();
			await handleWebhook(req, res, next);
			expect(res.json).toHaveBeenCalledWith({ success: true, received: true });
		});

		it('should pass signature header to service', async () => {
			mockHandleWebhookEvent.mockResolvedValue({ success: true, message: 'ok' });
			const rawBody = Buffer.from('{"type":"test"}');
			const req = { body: rawBody, headers: { 'stripe-signature': 'sig_abc' } } as unknown as Request;
			const res = mockRes();
			await handleWebhook(req, res, next);
			expect(mockHandleWebhookEvent).toHaveBeenCalledWith(rawBody, 'sig_abc');
		});
	});

	// -----------------------------------------------------------------------
	// GET /api/payment/subscription
	// -----------------------------------------------------------------------

	describe('handleGetSubscription', () => {
		it('should return 503 when service returns error', async () => {
			mockGetSubscription.mockResolvedValue({ success: false, message: 'Service unavailable' });
			const req = mockReq();
			const res = mockRes();
			await handleGetSubscription(req, res, next);
			expect(res.status).toHaveBeenCalledWith(503);
		});

		it('should return subscription data on success', async () => {
			const data = { active: true, planId: 'pro', status: 'active', currentPeriodEnd: '2026-04-01', cancelAtPeriodEnd: false };
			mockGetSubscription.mockResolvedValue({ success: true, data });
			const req = mockReq();
			const res = mockRes();
			await handleGetSubscription(req, res, next);
			expect(res.json).toHaveBeenCalledWith({ success: true, data });
		});

		it('should pass authenticated userId to service', async () => {
			mockGetSubscription.mockResolvedValue({ success: true, data: {} });
			const req = mockReq();
			const res = mockRes();
			await handleGetSubscription(req, res, next);
			expect(mockGetSubscription).toHaveBeenCalledWith('user-123');
		});
	});

	// -----------------------------------------------------------------------
	// POST /api/payment/portal
	// -----------------------------------------------------------------------

	describe('handleCreatePortal', () => {
		it('should return 400 when returnUrl is missing', async () => {
			const req = mockReq({});
			const res = mockRes();
			await handleCreatePortal(req, res, next);
			expect(res.status).toHaveBeenCalledWith(400);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('returnUrl') }));
		});

		it('should return 503 when Stripe is not configured', async () => {
			mockCreatePortalSession.mockResolvedValue({ success: false, message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.' });
			const req = mockReq({ returnUrl: 'http://return' });
			const res = mockRes();
			await handleCreatePortal(req, res, next);
			expect(res.status).toHaveBeenCalledWith(503);
		});

		it('should return portal data on success', async () => {
			const data = { portalUrl: 'https://billing.stripe.com/session/test' };
			mockCreatePortalSession.mockResolvedValue({ success: true, message: 'ok', data });
			const req = mockReq({ returnUrl: 'http://return' });
			const res = mockRes();
			await handleCreatePortal(req, res, next);
			expect(res.json).toHaveBeenCalledWith({ success: true, data });
		});

		it('should pass authenticated userId and returnUrl to service', async () => {
			mockCreatePortalSession.mockResolvedValue({ success: true, message: 'ok', data: {} });
			const req = mockReq({ returnUrl: 'http://return' });
			const res = mockRes();
			await handleCreatePortal(req, res, next);
			expect(mockCreatePortalSession).toHaveBeenCalledWith('user-123', 'http://return');
		});
	});

	// -----------------------------------------------------------------------
	// Error handling
	// -----------------------------------------------------------------------

	describe('error handling', () => {
		it('should catch and return 500 for unhandled exceptions', async () => {
			mockGetSubscription.mockRejectedValue(new Error('Unexpected DB error'));
			const req = mockReq();
			const res = mockRes();
			await handleGetSubscription(req, res, next);
			expect(res.status).toHaveBeenCalledWith(500);
			expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unexpected DB error' }));
		});
	});
});
