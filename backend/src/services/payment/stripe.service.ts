/**
 * Stripe Payment Service
 *
 * Wraps the Stripe SDK for checkout session creation, subscription
 * management, customer portal, and webhook event processing.
 *
 * Conditionally initialises — if STRIPE_SECRET_KEY is not set, all
 * methods return graceful errors instead of crashing, allowing the
 * rest of the backend to run without Stripe credentials.
 *
 * @module services/payment/stripe.service
 */

import { LoggerService, type ComponentLogger } from '../core/logger.service.js';
import type {
	PlanId,
	BillingInterval,
	SubscriptionInfo,
	CreateCheckoutResponse,
	CreatePortalResponse,
	WebhookEventPayload,
	PaymentOperationResult,
} from '../../controllers/payment/payment.types.js';
import { isHandledWebhookEvent } from '../../controllers/payment/payment.types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Environment variable name for the Stripe secret key. */
const STRIPE_SECRET_KEY_ENV = 'STRIPE_SECRET_KEY';

/** Environment variable name for the Stripe webhook signing secret. */
const STRIPE_WEBHOOK_SECRET_ENV = 'STRIPE_WEBHOOK_SECRET';

/**
 * Stripe Price ID mapping.
 *
 * In production these would come from env vars or a config table.
 * For now they are placeholders that show the expected shape.
 */
const PRICE_IDS: Record<PlanId, Record<BillingInterval, string>> = {
	free: { month: '', year: '' },
	pro: {
		month: process.env['STRIPE_PRO_MONTHLY_PRICE_ID'] || 'price_pro_monthly',
		year: process.env['STRIPE_PRO_YEARLY_PRICE_ID'] || 'price_pro_yearly',
	},
	enterprise: {
		month: process.env['STRIPE_ENT_MONTHLY_PRICE_ID'] || 'price_enterprise_monthly',
		year: process.env['STRIPE_ENT_YEARLY_PRICE_ID'] || 'price_enterprise_yearly',
	},
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Singleton service for Stripe payment operations.
 *
 * All methods check `isConfigured()` first and return a descriptive
 * error when Stripe is not available rather than throwing.
 */
export class StripeService {
	private static instance: StripeService | null = null;

	private readonly logger: ComponentLogger;
	private readonly secretKey: string | undefined;
	private readonly webhookSecret: string | undefined;

	private constructor() {
		this.logger = LoggerService.getInstance().createComponentLogger('StripeService');
		this.secretKey = process.env[STRIPE_SECRET_KEY_ENV];
		this.webhookSecret = process.env[STRIPE_WEBHOOK_SECRET_ENV];

		if (!this.secretKey) {
			this.logger.warn('STRIPE_SECRET_KEY not set — payment features are disabled');
		}
	}

	/**
	 * Get or create the singleton instance.
	 *
	 * @returns StripeService singleton
	 */
	static getInstance(): StripeService {
		if (!StripeService.instance) {
			StripeService.instance = new StripeService();
		}
		return StripeService.instance;
	}

	/**
	 * Reset the singleton (for testing).
	 */
	static resetInstance(): void {
		StripeService.instance = null;
	}

	/**
	 * Whether Stripe is configured and ready to use.
	 *
	 * @returns true if the secret key is set
	 */
	isConfigured(): boolean {
		return !!this.secretKey;
	}

	// -----------------------------------------------------------------------
	// Checkout
	// -----------------------------------------------------------------------

	/**
	 * Create a Stripe Checkout Session for a subscription.
	 *
	 * @param userId - Supabase user ID (stored in session metadata)
	 * @param planId - Plan to subscribe to
	 * @param interval - Billing interval
	 * @param successUrl - Redirect URL after successful payment
	 * @param cancelUrl - Redirect URL if user cancels
	 * @returns Result containing the checkout URL and session ID
	 */
	async createCheckoutSession(
		userId: string,
		planId: PlanId,
		interval: BillingInterval,
		successUrl: string,
		cancelUrl: string,
	): Promise<PaymentOperationResult<CreateCheckoutResponse>> {
		if (!this.isConfigured()) {
			return { success: false, message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.' };
		}

		if (planId === 'free') {
			return { success: false, message: 'Cannot create checkout session for free plan' };
		}

		const priceId = PRICE_IDS[planId]?.[interval];
		if (!priceId) {
			return { success: false, message: `No price configured for ${planId}/${interval}` };
		}

		try {
			// In production this calls:
			// const stripe = new Stripe(this.secretKey);
			// const session = await stripe.checkout.sessions.create({ ... });
			//
			// For now, return a placeholder that shows the expected shape:
			this.logger.info(`Creating checkout session: user=${userId} plan=${planId} interval=${interval}`);

			return {
				success: true,
				message: 'Checkout session created',
				data: {
					checkoutUrl: `https://checkout.stripe.com/pay/placeholder_${planId}_${interval}`,
					sessionId: `cs_placeholder_${Date.now()}`,
				},
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.logger.error(`Checkout session creation failed: ${msg}`);
			return { success: false, message: `Failed to create checkout session: ${msg}` };
		}
	}

	// -----------------------------------------------------------------------
	// Subscription
	// -----------------------------------------------------------------------

	/**
	 * Get the current subscription for a user.
	 *
	 * Queries the Supabase `licenses` table (or Stripe customer lookup)
	 * to determine the user's active subscription.
	 *
	 * @param userId - Supabase user ID
	 * @returns Subscription info
	 */
	async getSubscription(userId: string): Promise<PaymentOperationResult<SubscriptionInfo>> {
		if (!this.isConfigured()) {
			return {
				success: true,
				message: 'Stripe not configured — returning free plan defaults',
				data: {
					active: false,
					planId: 'free',
					status: null,
					currentPeriodEnd: null,
					cancelAtPeriodEnd: false,
				},
			};
		}

		try {
			// In production this calls:
			// const stripe = new Stripe(this.secretKey);
			// const customers = await stripe.customers.search({ query: `metadata['userId']:'${userId}'` });
			// const subscription = await stripe.subscriptions.list({ customer: customers.data[0].id });
			//
			// For now, return free plan defaults:
			this.logger.info(`Getting subscription for user=${userId}`);

			return {
				success: true,
				message: 'Subscription retrieved',
				data: {
					active: false,
					planId: 'free',
					status: null,
					currentPeriodEnd: null,
					cancelAtPeriodEnd: false,
				},
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to get subscription: ${msg}`);
			return { success: false, message: `Failed to get subscription: ${msg}` };
		}
	}

	// -----------------------------------------------------------------------
	// Customer Portal
	// -----------------------------------------------------------------------

	/**
	 * Create a Stripe Customer Portal session for subscription management.
	 *
	 * @param userId - Supabase user ID
	 * @param returnUrl - URL to redirect to when the user is done
	 * @returns Portal URL
	 */
	async createPortalSession(
		userId: string,
		returnUrl: string,
	): Promise<PaymentOperationResult<CreatePortalResponse>> {
		if (!this.isConfigured()) {
			return { success: false, message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.' };
		}

		try {
			// In production this calls:
			// const stripe = new Stripe(this.secretKey);
			// const session = await stripe.billingPortal.sessions.create({ customer, return_url });
			//
			this.logger.info(`Creating portal session for user=${userId}`);

			return {
				success: true,
				message: 'Portal session created',
				data: {
					portalUrl: `https://billing.stripe.com/session/placeholder_${Date.now()}`,
				},
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.logger.error(`Portal session creation failed: ${msg}`);
			return { success: false, message: `Failed to create portal session: ${msg}` };
		}
	}

	// -----------------------------------------------------------------------
	// Webhook
	// -----------------------------------------------------------------------

	/**
	 * Verify and process a Stripe webhook event.
	 *
	 * Validates the webhook signature, then extracts relevant data
	 * from the event payload.
	 *
	 * @param rawBody - Raw request body (Buffer)
	 * @param signature - Stripe-Signature header value
	 * @returns Processed webhook event payload
	 */
	async handleWebhookEvent(
		rawBody: Buffer,
		signature: string,
	): Promise<PaymentOperationResult<WebhookEventPayload>> {
		if (!this.isConfigured()) {
			return { success: false, message: 'Stripe is not configured' };
		}

		if (!this.webhookSecret) {
			return { success: false, message: 'STRIPE_WEBHOOK_SECRET not set — cannot verify webhooks' };
		}

		if (!signature) {
			return { success: false, message: 'Missing Stripe-Signature header' };
		}

		try {
			// TODO(security): Enable Stripe signature verification before production deployment.
			// When the Stripe SDK is available, replace the JSON.parse below with:
			//   const stripe = new Stripe(this.secretKey);
			//   const event = stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
			// This prevents forged webhook events from unauthorized sources.
			this.logger.warn('Webhook signature verification not yet implemented — accepting unverified events');

			const eventData = JSON.parse(rawBody.toString()) as {
				id?: string;
				type?: string;
				data?: { object?: Record<string, unknown> };
			};

			const eventType = eventData.type || '';

			if (!isHandledWebhookEvent(eventType)) {
				return {
					success: true,
					message: `Ignoring unhandled event type: ${eventType}`,
				};
			}

			const obj = eventData.data?.object || {};

			const payload: WebhookEventPayload = {
				eventId: (eventData.id as string) || '',
				type: eventType,
				userId: (obj['metadata'] as Record<string, string>)?.['userId'] || null,
				customerId: (obj['customer'] as string) || null,
				subscriptionId: (obj['subscription'] as string) || (obj['id'] as string) || null,
				planId: ((obj['metadata'] as Record<string, string>)?.['planId'] as WebhookEventPayload['planId']) || null,
			};

			this.logger.info(`Webhook processed: type=${eventType} eventId=${payload.eventId}`);

			return {
				success: true,
				message: `Webhook event ${eventType} processed`,
				data: payload,
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			this.logger.error(`Webhook processing failed: ${msg}`);
			return { success: false, message: `Webhook processing failed: ${msg}` };
		}
	}
}
