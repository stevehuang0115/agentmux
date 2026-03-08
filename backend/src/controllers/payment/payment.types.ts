/**
 * Payment Type Definitions
 *
 * Types for Stripe-based payment processing including checkout sessions,
 * subscriptions, webhook events, and customer portal sessions.
 *
 * @module controllers/payment/payment.types
 */

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------

/** Available subscription plan identifiers. */
export type PlanId = 'free' | 'pro' | 'enterprise';

/** Billing interval for subscriptions. */
export type BillingInterval = 'month' | 'year';

/** Subscription status mirroring Stripe's status values. */
export type SubscriptionStatus =
	| 'active'
	| 'past_due'
	| 'canceled'
	| 'incomplete'
	| 'trialing'
	| 'unpaid'
	| 'paused';

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

/** Request body for POST /api/payment/checkout. */
export interface CreateCheckoutRequest {
	/** Plan to subscribe to */
	planId: PlanId;
	/** Billing interval */
	interval: BillingInterval;
	/** URL to redirect to after successful checkout */
	successUrl: string;
	/** URL to redirect to if user cancels */
	cancelUrl: string;
}

/** Response from POST /api/payment/checkout. */
export interface CreateCheckoutResponse {
	/** Stripe Checkout Session URL to redirect the user to */
	checkoutUrl: string;
	/** Stripe Checkout Session ID */
	sessionId: string;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

/** Subscription details returned by GET /api/payment/subscription. */
export interface SubscriptionInfo {
	/** Whether the user has an active subscription */
	active: boolean;
	/** Current plan */
	planId: PlanId;
	/** Subscription status */
	status: SubscriptionStatus | null;
	/** Current billing period end (ISO timestamp) */
	currentPeriodEnd: string | null;
	/** Whether the subscription is set to cancel at period end */
	cancelAtPeriodEnd: boolean;
}

// ---------------------------------------------------------------------------
// Customer portal
// ---------------------------------------------------------------------------

/** Request body for POST /api/payment/portal. */
export interface CreatePortalRequest {
	/** URL to redirect to when the user is done managing their subscription */
	returnUrl: string;
}

/** Response from POST /api/payment/portal. */
export interface CreatePortalResponse {
	/** Stripe Customer Portal URL */
	portalUrl: string;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/** Relevant Stripe webhook event types we handle. */
export type PaymentWebhookEventType =
	| 'checkout.session.completed'
	| 'customer.subscription.updated'
	| 'customer.subscription.deleted'
	| 'invoice.payment_succeeded'
	| 'invoice.payment_failed';

/** Processed webhook event payload (subset of Stripe event). */
export interface WebhookEventPayload {
	/** Stripe event ID */
	eventId: string;
	/** Event type */
	type: PaymentWebhookEventType;
	/** Supabase user ID extracted from metadata */
	userId: string | null;
	/** Stripe customer ID */
	customerId: string | null;
	/** Stripe subscription ID */
	subscriptionId: string | null;
	/** Plan ID from metadata */
	planId: PlanId | null;
}

// ---------------------------------------------------------------------------
// Service result
// ---------------------------------------------------------------------------

/** Result wrapper for payment operations. */
export interface PaymentOperationResult<T = unknown> {
	/** Whether the operation succeeded */
	success: boolean;
	/** Human-readable message */
	message: string;
	/** Result data, if any */
	data?: T;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid plan IDs for validation. */
export const VALID_PLAN_IDS: PlanId[] = ['free', 'pro', 'enterprise'];

/** Valid billing intervals for validation. */
export const VALID_BILLING_INTERVALS: BillingInterval[] = ['month', 'year'];

/** Webhook event types we process. */
export const HANDLED_WEBHOOK_EVENTS: PaymentWebhookEventType[] = [
	'checkout.session.completed',
	'customer.subscription.updated',
	'customer.subscription.deleted',
	'invoice.payment_succeeded',
	'invoice.payment_failed',
];

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Check whether a value is a valid PlanId.
 *
 * @param value - Value to check
 * @returns true if value is a valid PlanId
 */
export function isValidPlanId(value: unknown): value is PlanId {
	return typeof value === 'string' && VALID_PLAN_IDS.includes(value as PlanId);
}

/**
 * Check whether a value is a valid BillingInterval.
 *
 * @param value - Value to check
 * @returns true if value is a valid BillingInterval
 */
export function isValidBillingInterval(value: unknown): value is BillingInterval {
	return typeof value === 'string' && VALID_BILLING_INTERVALS.includes(value as BillingInterval);
}

/**
 * Check whether a value is a handled webhook event type.
 *
 * @param value - Value to check
 * @returns true if value is a handled webhook event type
 */
export function isHandledWebhookEvent(value: unknown): value is PaymentWebhookEventType {
	return typeof value === 'string' && HANDLED_WEBHOOK_EVENTS.includes(value as PaymentWebhookEventType);
}
