/**
 * Payment REST Routes
 *
 * Router configuration for Stripe payment endpoints.
 *
 * All endpoints except the webhook require Supabase authentication.
 * The webhook endpoint uses raw body parsing for Stripe signature
 * verification (configured at the Express app level).
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
import { requireSupabaseAuth } from '../../services/cloud/auth/supabase-auth.middleware.js';

/**
 * Creates the payment router with all Stripe payment endpoints.
 *
 * Authenticated endpoints (require Supabase JWT):
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

	// Authenticated endpoints (Supabase JWT required)
	router.post('/checkout', requireSupabaseAuth, handleCreateCheckout);
	router.get('/subscription', requireSupabaseAuth, handleGetSubscription);
	router.post('/portal', requireSupabaseAuth, handleCreatePortal);

	// Webhook endpoint (Stripe signature verification, no Supabase auth)
	router.post('/webhook', handleWebhook);

	return router;
}
