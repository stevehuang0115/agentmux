/**
 * Tests for Stripe Payment Service
 *
 * @module services/payment/stripe.service.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StripeService } from './stripe.service.js';

// Mock LoggerService
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

describe('StripeService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    StripeService.resetInstance();
    process.env = { ...originalEnv };
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

  describe('isConfigured', () => {
    it('should return false when STRIPE_SECRET_KEY is not set', () => {
      delete process.env.STRIPE_SECRET_KEY;
      const service = StripeService.getInstance();
      expect(service.isConfigured()).toBe(false);
    });

    it('should return true when STRIPE_SECRET_KEY is set', () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_123';
      const service = StripeService.getInstance();
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('when Stripe is not configured', () => {
    beforeEach(() => {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
    });

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

  describe('when Stripe is configured', () => {
    let service: StripeService;

    beforeEach(() => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_123';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
      service = StripeService.getInstance();
    });

    describe('createCheckoutSession', () => {
      it('should return error when no price is configured for plan/interval', async () => {
        const result = await service.createCheckoutSession('u1', 'pro', 'month', 'http://ok', 'http://cancel');
        expect(result.success).toBe(false);
        expect(result.message).toContain('No Stripe price configured');
      });

      it('should return error for free plan', async () => {
        const result = await service.createCheckoutSession('u1', 'free', 'month', 'http://ok', 'http://cancel');
        expect(result.success).toBe(false);
        expect(result.message).toContain('No Stripe price configured');
      });
    });

    describe('handleWebhookEvent', () => {
      it('should fail signature verification with invalid data', async () => {
        const result = await service.handleWebhookEvent(
          Buffer.from('{"type":"test"}'),
          'invalid_signature',
        );
        expect(result.success).toBe(false);
        expect(result.message).toContain('Webhook signature verification failed');
      });

      it('should require webhook secret', async () => {
        delete process.env.STRIPE_WEBHOOK_SECRET;
        StripeService.resetInstance();
        process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_123';
        const svc = StripeService.getInstance();
        const result = await svc.handleWebhookEvent(Buffer.from('{}'), 'sig');
        expect(result.success).toBe(false);
        expect(result.message).toContain('not configured');
      });
    });

    describe('getSubscription', () => {
      it('should handle Stripe API errors gracefully', async () => {
        // With a fake key, the API call will fail with auth error
        const result = await service.getSubscription('user-123');
        expect(result.success).toBe(false);
        expect(result.message).toBeDefined();
      });
    });

    describe('createPortalSession', () => {
      it('should handle Stripe API errors gracefully', async () => {
        const result = await service.createPortalSession('user-123', 'http://return');
        expect(result.success).toBe(false);
        expect(result.message).toBeDefined();
      });
    });
  });

  describe('resetInstance', () => {
    it('should allow reconfiguration', () => {
      delete process.env.STRIPE_SECRET_KEY;
      const unconfigured = StripeService.getInstance();
      expect(unconfigured.isConfigured()).toBe(false);

      StripeService.resetInstance();
      process.env.STRIPE_SECRET_KEY = 'sk_test_new_key';
      const configured = StripeService.getInstance();
      expect(configured.isConfigured()).toBe(true);
    });
  });
});
