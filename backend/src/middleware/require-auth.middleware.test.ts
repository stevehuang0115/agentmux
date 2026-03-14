/**
 * Tests for require-auth middleware placeholder
 *
 * @module middleware/require-auth.test
 */

import { requireAuth } from './require-auth.middleware.js';

describe('requireAuth', () => {
  it('should call next() without error', () => {
    const next = jest.fn();
    requireAuth({} as any, {} as any, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
