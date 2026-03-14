/**
 * Tests for Stripe Payment Service
 *
 * @module services/payment/stripe.service.test
 */

import { StripeService } from './stripe.service.js';

describe('StripeService', () => {
  afterEach(() => {
    StripeService.resetInstance();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const a = StripeService.getInstance();
      const b = StripeService.getInstance();
      expect(a).toBe(b);
    });

    it('should return a new instance after reset', () => {
      const a = StripeService.getInstance();
      StripeService.resetInstance();
      const b = StripeService.getInstance();
      expect(a).not.toBe(b);
    });
  });

  describe('when Stripe is not configured', () => {
    it('createCheckoutSession should return not configured', async () => {
      const service = StripeService.getInstance();
      const result = await service.createCheckoutSession('u1', 'pro', 'month', 'http://ok', 'http://cancel');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('handleWebhookEvent should return not configured', async () => {
      const service = StripeService.getInstance();
      const result = await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('getSubscription should return not configured', async () => {
      const service = StripeService.getInstance();
      const result = await service.getSubscription('u1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('createPortalSession should return not configured', async () => {
      const service = StripeService.getInstance();
      const result = await service.createPortalSession('u1', 'http://return');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });
  });
});
