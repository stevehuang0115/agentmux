/**
 * Tests for Payment Types
 *
 * Validates type guards, constants, and validation helpers
 * for the Stripe payment integration types.
 *
 * @module controllers/payment/payment.types.test
 */

import {
	isValidPlanId,
	isValidBillingInterval,
	isHandledWebhookEvent,
	VALID_PLAN_IDS,
	VALID_BILLING_INTERVALS,
	HANDLED_WEBHOOK_EVENTS,
} from './payment.types.js';

describe('Payment Types', () => {
	describe('VALID_PLAN_IDS', () => {
		it('should contain free, pro, and enterprise', () => {
			expect(VALID_PLAN_IDS).toContain('free');
			expect(VALID_PLAN_IDS).toContain('pro');
			expect(VALID_PLAN_IDS).toContain('enterprise');
			expect(VALID_PLAN_IDS).toHaveLength(3);
		});
	});

	describe('VALID_BILLING_INTERVALS', () => {
		it('should contain month and year', () => {
			expect(VALID_BILLING_INTERVALS).toContain('month');
			expect(VALID_BILLING_INTERVALS).toContain('year');
			expect(VALID_BILLING_INTERVALS).toHaveLength(2);
		});
	});

	describe('HANDLED_WEBHOOK_EVENTS', () => {
		it('should contain all handled event types', () => {
			expect(HANDLED_WEBHOOK_EVENTS).toContain('checkout.session.completed');
			expect(HANDLED_WEBHOOK_EVENTS).toContain('customer.subscription.updated');
			expect(HANDLED_WEBHOOK_EVENTS).toContain('customer.subscription.deleted');
			expect(HANDLED_WEBHOOK_EVENTS).toContain('invoice.payment_succeeded');
			expect(HANDLED_WEBHOOK_EVENTS).toContain('invoice.payment_failed');
			expect(HANDLED_WEBHOOK_EVENTS).toHaveLength(5);
		});
	});

	describe('isValidPlanId', () => {
		it('should return true for valid plan IDs', () => {
			expect(isValidPlanId('free')).toBe(true);
			expect(isValidPlanId('pro')).toBe(true);
			expect(isValidPlanId('enterprise')).toBe(true);
		});

		it('should return false for invalid plan IDs', () => {
			expect(isValidPlanId('premium')).toBe(false);
			expect(isValidPlanId('basic')).toBe(false);
			expect(isValidPlanId('')).toBe(false);
		});

		it('should return false for non-string values', () => {
			expect(isValidPlanId(null)).toBe(false);
			expect(isValidPlanId(undefined)).toBe(false);
			expect(isValidPlanId(42)).toBe(false);
			expect(isValidPlanId({})).toBe(false);
		});
	});

	describe('isValidBillingInterval', () => {
		it('should return true for valid intervals', () => {
			expect(isValidBillingInterval('month')).toBe(true);
			expect(isValidBillingInterval('year')).toBe(true);
		});

		it('should return false for invalid intervals', () => {
			expect(isValidBillingInterval('week')).toBe(false);
			expect(isValidBillingInterval('daily')).toBe(false);
			expect(isValidBillingInterval('')).toBe(false);
		});

		it('should return false for non-string values', () => {
			expect(isValidBillingInterval(null)).toBe(false);
			expect(isValidBillingInterval(undefined)).toBe(false);
			expect(isValidBillingInterval(12)).toBe(false);
		});
	});

	describe('isHandledWebhookEvent', () => {
		it('should return true for handled event types', () => {
			expect(isHandledWebhookEvent('checkout.session.completed')).toBe(true);
			expect(isHandledWebhookEvent('customer.subscription.updated')).toBe(true);
			expect(isHandledWebhookEvent('customer.subscription.deleted')).toBe(true);
			expect(isHandledWebhookEvent('invoice.payment_succeeded')).toBe(true);
			expect(isHandledWebhookEvent('invoice.payment_failed')).toBe(true);
		});

		it('should return false for unhandled event types', () => {
			expect(isHandledWebhookEvent('charge.succeeded')).toBe(false);
			expect(isHandledWebhookEvent('payment_intent.created')).toBe(false);
			expect(isHandledWebhookEvent('')).toBe(false);
		});

		it('should return false for non-string values', () => {
			expect(isHandledWebhookEvent(null)).toBe(false);
			expect(isHandledWebhookEvent(undefined)).toBe(false);
			expect(isHandledWebhookEvent({})).toBe(false);
		});
	});
});
