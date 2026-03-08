/**
 * Payment REST Controller
 *
 * Handles Stripe payment endpoints: checkout session creation,
 * subscription queries, customer portal sessions, and webhook events.
 *
 * All endpoints except the webhook require Supabase authentication.
 * The webhook endpoint receives raw body for Stripe signature verification.
 *
 * @module controllers/payment/payment.controller
 */

import type { Request, Response } from 'express';
import { StripeService } from '../../services/payment/stripe.service.js';
import { isValidPlanId, isValidBillingInterval } from './payment.types.js';
import type { SupabaseAuthenticatedRequest } from '../../services/cloud/auth/supabase-auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/payment/checkout
 *
 * Creates a Stripe Checkout Session for a subscription plan.
 * Requires Supabase auth. The authenticated user ID is attached
 * as session metadata for post-checkout correlation.
 *
 * @param req - Request with body: { planId, interval, successUrl, cancelUrl }
 * @param res - Response with { success, data: { checkoutUrl, sessionId } }
 */
export const handleCreateCheckout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const { planId, interval, successUrl, cancelUrl } = req.body as {
		planId?: string;
		interval?: string;
		successUrl?: string;
		cancelUrl?: string;
	};

	if (!planId || !isValidPlanId(planId)) {
		res.status(400).json({ success: false, error: 'planId must be one of: free, pro, enterprise' });
		return;
	}

	if (!interval || !isValidBillingInterval(interval)) {
		res.status(400).json({ success: false, error: 'interval must be one of: month, year' });
		return;
	}

	if (!successUrl || !cancelUrl) {
		res.status(400).json({ success: false, error: 'successUrl and cancelUrl are required' });
		return;
	}

	const userId = (req as SupabaseAuthenticatedRequest).user.userId;
	const stripe = StripeService.getInstance();
	const result = await stripe.createCheckoutSession(userId, planId, interval, successUrl, cancelUrl);

	if (!result.success) {
		res.status(result.message.includes('not configured') ? 503 : 400).json(result);
		return;
	}

	res.json({ success: true, data: result.data });
});

/**
 * POST /api/payment/webhook
 *
 * Receives Stripe webhook events. Does NOT require Supabase auth —
 * authentication is done via Stripe signature verification.
 *
 * Expects raw body (application/json with raw Buffer) and the
 * Stripe-Signature header.
 *
 * @param req - Request with raw body and Stripe-Signature header
 * @param res - Response with 200 on success, 400 on failure
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const signature = req.headers['stripe-signature'] as string || '';
	const rawBody = req.body as Buffer;

	if (!Buffer.isBuffer(rawBody)) {
		res.status(400).json({ success: false, error: 'Webhook requires raw body' });
		return;
	}

	const stripe = StripeService.getInstance();
	const result = await stripe.handleWebhookEvent(rawBody, signature);

	if (!result.success) {
		res.status(400).json(result);
		return;
	}

	// Always return 200 to Stripe to acknowledge receipt
	res.json({ success: true, received: true });
});

/**
 * GET /api/payment/subscription
 *
 * Returns the current subscription status for the authenticated user.
 * Requires Supabase auth.
 *
 * @param req - Authenticated request
 * @param res - Response with { success, data: SubscriptionInfo }
 */
export const handleGetSubscription = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const userId = (req as SupabaseAuthenticatedRequest).user.userId;
	const stripe = StripeService.getInstance();
	const result = await stripe.getSubscription(userId);

	if (!result.success) {
		res.status(503).json(result);
		return;
	}

	res.json({ success: true, data: result.data });
});

/**
 * POST /api/payment/portal
 *
 * Creates a Stripe Customer Portal session for subscription management.
 * Requires Supabase auth.
 *
 * @param req - Request with body: { returnUrl }
 * @param res - Response with { success, data: { portalUrl } }
 */
export const handleCreatePortal = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const { returnUrl } = req.body as { returnUrl?: string };

	if (!returnUrl) {
		res.status(400).json({ success: false, error: 'returnUrl is required' });
		return;
	}

	const userId = (req as SupabaseAuthenticatedRequest).user.userId;
	const stripe = StripeService.getInstance();
	const result = await stripe.createPortalSession(userId, returnUrl);

	if (!result.success) {
		res.status(result.message.includes('not configured') ? 503 : 400).json(result);
		return;
	}

	res.json({ success: true, data: result.data });
});
