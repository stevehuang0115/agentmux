/**
 * Stripe Payment Service
 *
 * Singleton service for Stripe API interactions. Handles checkout sessions,
 * subscriptions, customer portal sessions, and webhook event processing.
 *
 * Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables.
 * Returns { success: false, message: 'Stripe is not configured' } when keys
 * are missing, allowing the app to run without Stripe in development.
 *
 * @module services/payment/stripe
 */

import Stripe from 'stripe';
import { LoggerService } from '../core/logger.service.js';
import { formatError } from '../../utils/format-error.js';

const logger = LoggerService.getInstance().createComponentLogger('StripeService');

/** Result type for Stripe operations */
export interface StripeResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/** Subscription info returned to clients */
export interface SubscriptionInfo {
  subscriptionId: string;
  status: Stripe.Subscription.Status;
  planId: string;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Resolve a Stripe Price ID for a plan + interval combination.
 * Reads env vars at call time to support late-loaded configuration.
 *
 * @param planId - Plan identifier (pro, enterprise)
 * @param interval - Billing interval (month, year)
 * @returns Stripe Price ID or undefined
 */
function resolvePriceId(planId: string, interval: string): string | undefined {
  const envVarMap: Record<string, string> = {
    'pro_month': 'STRIPE_PRICE_PRO_MONTHLY',
    'pro_year': 'STRIPE_PRICE_PRO_YEARLY',
    'enterprise_month': 'STRIPE_PRICE_ENTERPRISE_MONTHLY',
    'enterprise_year': 'STRIPE_PRICE_ENTERPRISE_YEARLY',
  };
  const envVar = envVarMap[`${planId}_${interval}`];
  return envVar ? process.env[envVar] : undefined;
}

/**
 * Stripe payment service singleton.
 *
 * Wraps all Stripe API calls with error handling and returns
 * standardized result objects.
 */
export class StripeService {
  private static instance: StripeService | null = null;
  private stripe: Stripe | null = null;
  private webhookSecret: string | undefined;

  private constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }
  }

  /**
   * Get or create the singleton instance.
   *
   * @returns The StripeService singleton
   */
  static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  /**
   * Check if Stripe is configured with required environment variables.
   *
   * @returns True if STRIPE_SECRET_KEY is set and Stripe client initialized
   */
  isConfigured(): boolean {
    return this.stripe !== null;
  }

  /**
   * Return the Stripe client or a "not configured" result.
   * Centralizes the guard check used by all public methods.
   *
   * @returns Stripe instance or null
   */
  private requireStripe(): Stripe | null {
    return this.stripe;
  }

  /**
   * Find a Stripe customer by userId stored in metadata.
   *
   * @param userId - Internal user ID
   * @returns The first matching customer or null
   */
  private async findCustomerByUserId(userId: string): Promise<Stripe.Customer | null> {
    const customers = await this.stripe!.customers.search({
      query: `metadata['userId']:'${userId}'`,
      limit: 1,
    });
    return customers.data.length > 0 ? customers.data[0] : null;
  }

  /**
   * Create a Stripe Checkout Session for a subscription plan.
   *
   * @param userId - User ID attached as metadata for post-checkout correlation
   * @param planId - Plan identifier (pro, enterprise)
   * @param interval - Billing interval (month, year)
   * @param successUrl - Redirect URL after successful checkout
   * @param cancelUrl - Redirect URL if user cancels
   * @returns Result with checkoutUrl and sessionId
   */
  async createCheckoutSession(
    userId: string,
    planId: string,
    interval: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<StripeResult<{ checkoutUrl: string; sessionId: string }>> {
    if (!this.requireStripe()) {
      return { success: false, message: 'Stripe is not configured' };
    }

    const priceId = resolvePriceId(planId, interval);
    if (!priceId) {
      return { success: false, message: `No Stripe price configured for ${planId}/${interval}` };
    }

    try {
      const session = await this.stripe!.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId, planId, interval },
        client_reference_id: userId,
      });

      if (!session.url) {
        return { success: false, message: 'Checkout session created without redirect URL' };
      }

      logger.info('Checkout session created', { sessionId: session.id, userId, planId });

      return {
        success: true,
        data: { checkoutUrl: session.url, sessionId: session.id },
      };
    } catch (error) {
      logger.error('Failed to create checkout session', { error: formatError(error), userId, planId });
      return { success: false, message: formatError(error) };
    }
  }

  /**
   * Process a Stripe webhook event.
   *
   * Verifies the signature, then dispatches the event to the appropriate handler.
   * Currently handles: checkout.session.completed, customer.subscription.updated,
   * customer.subscription.deleted, invoice.payment_failed.
   *
   * @param rawBody - Raw request body for signature verification
   * @param signature - Stripe-Signature header value
   * @returns Result indicating success or failure
   */
  async handleWebhookEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<StripeResult<{ eventType: string }>> {
    if (!this.requireStripe() || !this.webhookSecret) {
      return { success: false, message: 'Stripe webhook is not configured' };
    }

    let event: Stripe.Event;
    try {
      event = this.stripe!.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (error) {
      const msg = formatError(error);
      logger.warn('Webhook signature verification failed', { error: msg });
      return { success: false, message: `Webhook signature verification failed: ${msg}` };
    }

    logger.info('Webhook event received', { type: event.type, id: event.id });

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          logger.info('Unhandled webhook event type', { type: event.type });
      }

      return { success: true, data: { eventType: event.type } };
    } catch (error) {
      logger.error('Webhook handler failed', { type: event.type, error: formatError(error) });
      return { success: false, message: formatError(error) };
    }
  }

  /**
   * Get the current subscription for a user by their Stripe customer ID.
   *
   * @param userId - The user to look up (used as client_reference_id or metadata)
   * @returns Result with subscription data or null if no active subscription
   */
  async getSubscription(userId: string): Promise<StripeResult<SubscriptionInfo | null>> {
    if (!this.requireStripe()) {
      return { success: false, message: 'Stripe is not configured' };
    }

    try {
      const customer = await this.findCustomerByUserId(userId);
      if (!customer) {
        return { success: true, data: null };
      }

      const subscriptions = await this.stripe!.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        return { success: true, data: null };
      }

      const sub = subscriptions.data[0];
      return {
        success: true,
        data: {
          subscriptionId: sub.id,
          status: sub.status,
          planId: sub.metadata?.planId || 'pro',
          cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      };
    } catch (error) {
      logger.error('Failed to get subscription', { error: formatError(error), userId });
      return { success: false, message: formatError(error) };
    }
  }

  /**
   * Create a Stripe Customer Portal session for subscription management.
   *
   * @param userId - The user requesting access
   * @param returnUrl - URL to redirect after portal session
   * @returns Result with portalUrl
   */
  async createPortalSession(
    userId: string,
    returnUrl: string,
  ): Promise<StripeResult<{ portalUrl: string }>> {
    if (!this.requireStripe()) {
      return { success: false, message: 'Stripe is not configured' };
    }

    try {
      const customer = await this.findCustomerByUserId(userId);
      if (!customer) {
        return { success: false, message: 'No Stripe customer found for this user' };
      }

      const session = await this.stripe!.billingPortal.sessions.create({
        customer: customer.id,
        return_url: returnUrl,
      });

      return { success: true, data: { portalUrl: session.url } };
    } catch (error) {
      logger.error('Failed to create portal session', { error: formatError(error), userId });
      return { success: false, message: formatError(error) };
    }
  }

  // ---------------------------------------------------------------------------
  // Webhook Event Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle checkout.session.completed — new subscription created.
   * Links the Stripe customer to the internal userId via metadata.
   *
   * @param session - The completed checkout session
   */
  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.userId || session.client_reference_id;
    const planId = session.metadata?.planId || 'pro';

    if (!userId) {
      logger.warn('Checkout completed without userId', { sessionId: session.id });
      return;
    }

    if (session.customer && typeof session.customer === 'string') {
      await this.stripe!.customers.update(session.customer, {
        metadata: { userId, planId },
      });
    }

    logger.info('Checkout completed', { userId, planId, customerId: session.customer });
  }

  /**
   * Handle customer.subscription.updated — plan changes, renewals.
   *
   * @param subscription - The updated subscription
   */
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription updated', {
      subscriptionId: subscription.id,
      status: subscription.status,
      customerId: subscription.customer,
    });
  }

  /**
   * Handle customer.subscription.deleted — subscription cancelled/expired.
   *
   * @param subscription - The deleted subscription
   */
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    logger.info('Subscription deleted', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
    });
  }

  /**
   * Handle invoice.payment_failed — payment attempt failed.
   *
   * @param invoice - The failed invoice
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    logger.warn('Payment failed', {
      invoiceId: invoice.id,
      customerId: invoice.customer,
      attemptCount: invoice.attempt_count,
    });
  }

  /**
   * Reset the singleton instance (for testing).
   */
  static resetInstance(): void {
    StripeService.instance = null;
  }
}
