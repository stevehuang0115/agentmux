/**
 * Tests for Payment barrel export
 *
 * @module controllers/payment/index.test
 */

import { createPaymentRouter } from './index.js';

jest.mock('./payment.routes.js', () => ({
	createPaymentRouter: jest.fn().mockReturnValue(() => {}),
}));

describe('Payment barrel export', () => {
	it('should export createPaymentRouter', () => {
		expect(createPaymentRouter).toBeDefined();
		expect(typeof createPaymentRouter).toBe('function');
	});
});
