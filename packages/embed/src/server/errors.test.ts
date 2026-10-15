import { describe, expect, it } from 'vitest';
import { EmbedTokenError, OpsError } from './errors.js';

describe('errors', () => {
  it('EmbedTokenError carries its code', () => {
    const err = new EmbedTokenError('expired', 'token expired');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EmbedTokenError');
    expect(err.code).toBe('expired');
  });

  it('OpsError carries status and code, message defaults to code', () => {
    const err = new OpsError(404, 'not_found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('not_found');
    expect(err.message).toBe('not_found');
    expect(new OpsError(403, 'forbidden', 'not your lesson').message).toBe('not your lesson');
  });
});
