/**
 * Payment REST Routes
 *
 * Router configuration for Stripe payment endpoints.
 *
 * All endpoints except the webhook require authentication.
 * The webhook endpoint uses raw body parsing for Stripe signature
 * verification (configured at the Express app level).
 *
 * Note: Authenticated endpoints use a shared pass-through placeholder
 * middleware (require-auth.middleware.ts) that must be replaced with
 * a real auth implementation before production.
 *
 * @module controllers/payment/payment.routes
 */

import { Router } from 'express';
import {
	handleCreateCheckout,
	handleWebhook,
	handleGetSubscription,
	handleCreatePortal,
} from './payment.controller.js';
import { requireAuth } from '../../middleware/require-auth.middleware.js';

/**
 * Creates the payment router with all Stripe payment endpoints.
 *
 * Authenticated endpoints (require auth):
 * - POST /checkout      - Create a Stripe Checkout Session
 * - GET  /subscription  - Get current subscription status
 * - POST /portal        - Create a Stripe Customer Portal session
 *
 * Public endpoints (Stripe signature verification):
 * - POST /webhook       - Receive Stripe webhook events (raw body)
 *
 * @returns Express router configured with payment routes
 */
export function createPaymentRouter(): Router {
	const router = Router();

	// Authenticated endpoints
	router.post('/checkout', requireAuth, handleCreateCheckout);
	router.get('/subscription', requireAuth, handleGetSubscription);
	router.post('/portal', requireAuth, handleCreatePortal);

	// Webhook endpoint (Stripe signature verification, no auth)
	router.post('/webhook', handleWebhook);

	return router;
}
