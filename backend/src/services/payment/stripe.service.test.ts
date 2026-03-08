/**
 * Tests for Stripe Service
 *
 * Covers conditional init, checkout sessions, subscription queries,
 * portal sessions, and webhook event processing with graceful
 * error handling when Stripe is not configured.
 *
 * @module services/payment/stripe.service.test
 */

import { StripeService } from './stripe.service.js';

// Mock logger
jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
			}),
		}),
	},
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const originalEnv = { ...process.env };

function setStripeEnv(secretKey?: string, webhookSecret?: string): void {
	if (secretKey) {
		process.env['STRIPE_SECRET_KEY'] = secretKey;
	} else {
		delete process.env['STRIPE_SECRET_KEY'];
	}
	if (webhookSecret) {
		process.env['STRIPE_WEBHOOK_SECRET'] = webhookSecret;
	} else {
		delete process.env['STRIPE_WEBHOOK_SECRET'];
	}
}

function makeWebhookBody(type: string, metadata?: Record<string, string>, extra?: Record<string, unknown>): Buffer {
	return Buffer.from(JSON.stringify({
		id: `evt_test_${Date.now()}`,
		type,
		data: {
			object: {
				id: 'sub_test_123',
				customer: 'cus_test_456',
				metadata: metadata || {},
				...extra,
			},
		},
	}));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StripeService', () => {
	afterEach(() => {
		StripeService.resetInstance();
		process.env = { ...originalEnv };
	});

	// -----------------------------------------------------------------------
	// Singleton & configuration
	// -----------------------------------------------------------------------

	describe('getInstance', () => {
		it('should return the same instance on multiple calls', () => {
			const a = StripeService.getInstance();
			const b = StripeService.getInstance();
			expect(a).toBe(b);
		});

		it('should return a fresh instance after resetInstance', () => {
			const a = StripeService.getInstance();
			StripeService.resetInstance();
			const b = StripeService.getInstance();
			expect(a).not.toBe(b);
		});
	});

	describe('isConfigured', () => {
		it('should return false when STRIPE_SECRET_KEY is not set', () => {
			setStripeEnv();
			const svc = StripeService.getInstance();
			expect(svc.isConfigured()).toBe(false);
		});

		it('should return true when STRIPE_SECRET_KEY is set', () => {
			setStripeEnv('sk_test_abc');
			const svc = StripeService.getInstance();
			expect(svc.isConfigured()).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// createCheckoutSession
	// -----------------------------------------------------------------------

	describe('createCheckoutSession', () => {
		it('should return error when Stripe is not configured', async () => {
			setStripeEnv();
			const svc = StripeService.getInstance();
			const result = await svc.createCheckoutSession('u1', 'pro', 'month', 'http://ok', 'http://cancel');
			expect(result.success).toBe(false);
			expect(result.message).toContain('not configured');
		});

		it('should return error for free plan', async () => {
			setStripeEnv('sk_test_abc');
			const svc = StripeService.getInstance();
			const result = await svc.createCheckoutSession('u1', 'free', 'month', 'http://ok', 'http://cancel');
			expect(result.success).toBe(false);
			expect(result.message).toContain('free plan');
		});

		it('should create checkout session for pro monthly', async () => {
			setStripeEnv('sk_test_abc');
			const svc = StripeService.getInstance();
			const result = await svc.createCheckoutSession('u1', 'pro', 'month', 'http://ok', 'http://cancel');
			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data!.checkoutUrl).toContain('pro_month');
			expect(result.data!.sessionId).toContain('cs_placeholder');
		});

		it('should create checkout session for enterprise yearly', async () => {
			setStripeEnv('sk_test_abc');
			const svc = StripeService.getInstance();
			const result = await svc.createCheckoutSession('u1', 'enterprise', 'year', 'http://ok', 'http://cancel');
			expect(result.success).toBe(true);
			expect(result.data!.checkoutUrl).toContain('enterprise_year');
		});
	});

	// -----------------------------------------------------------------------
	// getSubscription
	// -----------------------------------------------------------------------

	describe('getSubscription', () => {
		it('should return free defaults when Stripe is not configured', async () => {
			setStripeEnv();
			const svc = StripeService.getInstance();
			const result = await svc.getSubscription('u1');
			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data!.planId).toBe('free');
			expect(result.data!.active).toBe(false);
			expect(result.data!.status).toBeNull();
		});

		it('should return subscription info when configured', async () => {
			setStripeEnv('sk_test_abc');
			const svc = StripeService.getInstance();
			const result = await svc.getSubscription('u1');
			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data!.planId).toBe('free');
		});
	});

	// -----------------------------------------------------------------------
	// createPortalSession
	// -----------------------------------------------------------------------

	describe('createPortalSession', () => {
		it('should return error when Stripe is not configured', async () => {
			setStripeEnv();
			const svc = StripeService.getInstance();
			const result = await svc.createPortalSession('u1', 'http://return');
			expect(result.success).toBe(false);
			expect(result.message).toContain('not configured');
		});

		it('should create portal session when configured', async () => {
			setStripeEnv('sk_test_abc');
			const svc = StripeService.getInstance();
			const result = await svc.createPortalSession('u1', 'http://return');
			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data!.portalUrl).toContain('billing.stripe.com');
		});
	});

	// -----------------------------------------------------------------------
	// handleWebhookEvent
	// -----------------------------------------------------------------------

	describe('handleWebhookEvent', () => {
		it('should return error when Stripe is not configured', async () => {
			setStripeEnv();
			const svc = StripeService.getInstance();
			const result = await svc.handleWebhookEvent(Buffer.from('{}'), 'sig');
			expect(result.success).toBe(false);
			expect(result.message).toContain('not configured');
		});

		it('should return error when webhook secret is not set', async () => {
			setStripeEnv('sk_test_abc');
			const svc = StripeService.getInstance();
			const result = await svc.handleWebhookEvent(Buffer.from('{}'), 'sig');
			expect(result.success).toBe(false);
			expect(result.message).toContain('STRIPE_WEBHOOK_SECRET');
		});

		it('should return error when signature is missing', async () => {
			setStripeEnv('sk_test_abc', 'whsec_test');
			const svc = StripeService.getInstance();
			const result = await svc.handleWebhookEvent(Buffer.from('{}'), '');
			expect(result.success).toBe(false);
			expect(result.message).toContain('Stripe-Signature');
		});

		it('should ignore unhandled event types', async () => {
			setStripeEnv('sk_test_abc', 'whsec_test');
			const svc = StripeService.getInstance();
			const body = makeWebhookBody('charge.succeeded');
			const result = await svc.handleWebhookEvent(body, 'sig_test');
			expect(result.success).toBe(true);
			expect(result.message).toContain('Ignoring');
			expect(result.data).toBeUndefined();
		});

		it('should process checkout.session.completed event', async () => {
			setStripeEnv('sk_test_abc', 'whsec_test');
			const svc = StripeService.getInstance();
			const body = makeWebhookBody('checkout.session.completed', {
				userId: 'user-123',
				planId: 'pro',
			});
			const result = await svc.handleWebhookEvent(body, 'sig_test');
			expect(result.success).toBe(true);
			expect(result.data).toBeDefined();
			expect(result.data!.type).toBe('checkout.session.completed');
			expect(result.data!.userId).toBe('user-123');
			expect(result.data!.planId).toBe('pro');
			expect(result.data!.customerId).toBe('cus_test_456');
			expect(result.data!.subscriptionId).toBe('sub_test_123');
		});

		it('should process customer.subscription.updated event', async () => {
			setStripeEnv('sk_test_abc', 'whsec_test');
			const svc = StripeService.getInstance();
			const body = makeWebhookBody('customer.subscription.updated', { userId: 'u1' });
			const result = await svc.handleWebhookEvent(body, 'sig_test');
			expect(result.success).toBe(true);
			expect(result.data!.type).toBe('customer.subscription.updated');
		});

		it('should process customer.subscription.deleted event', async () => {
			setStripeEnv('sk_test_abc', 'whsec_test');
			const svc = StripeService.getInstance();
			const body = makeWebhookBody('customer.subscription.deleted', { userId: 'u1' });
			const result = await svc.handleWebhookEvent(body, 'sig_test');
			expect(result.success).toBe(true);
			expect(result.data!.type).toBe('customer.subscription.deleted');
		});

		it('should process invoice.payment_succeeded event', async () => {
			setStripeEnv('sk_test_abc', 'whsec_test');
			const svc = StripeService.getInstance();
			const body = makeWebhookBody('invoice.payment_succeeded', {}, { subscription: 'sub_invoice_1' });
			const result = await svc.handleWebhookEvent(body, 'sig_test');
			expect(result.success).toBe(true);
			expect(result.data!.type).toBe('invoice.payment_succeeded');
			expect(result.data!.subscriptionId).toBe('sub_invoice_1');
		});

		it('should process invoice.payment_failed event', async () => {
			setStripeEnv('sk_test_abc', 'whsec_test');
			const svc = StripeService.getInstance();
			const body = makeWebhookBody('invoice.payment_failed', { userId: 'u1' });
			const result = await svc.handleWebhookEvent(body, 'sig_test');
			expect(result.success).toBe(true);
			expect(result.data!.type).toBe('invoice.payment_failed');
		});

		it('should handle malformed JSON gracefully', async () => {
			setStripeEnv('sk_test_abc', 'whsec_test');
			const svc = StripeService.getInstance();
			const result = await svc.handleWebhookEvent(Buffer.from('not json'), 'sig_test');
			expect(result.success).toBe(false);
			expect(result.message).toContain('Webhook processing failed');
		});

		it('should handle missing metadata gracefully', async () => {
			setStripeEnv('sk_test_abc', 'whsec_test');
			const svc = StripeService.getInstance();
			const body = Buffer.from(JSON.stringify({
				id: 'evt_1', type: 'checkout.session.completed',
				data: { object: { id: 'sub_1', customer: 'cus_1' } },
			}));
			const result = await svc.handleWebhookEvent(body, 'sig_test');
			expect(result.success).toBe(true);
			expect(result.data!.userId).toBeNull();
			expect(result.data!.planId).toBeNull();
		});
	});
});
