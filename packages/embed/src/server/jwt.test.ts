import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { base64UrlDecode, base64UrlEncode, getSubtle, signJwt, verifyJwt } from './jwt.js';
import { EmbedTokenError } from './errors.js';

const SECRET = 'test-secret-0123456789abcdef';

/** Build a token with an arbitrary header, signed with node:crypto. */
function forge(header: object, payload: object, secret = SECRET): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const input = `${enc(header)}.${enc(payload)}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof EmbedTokenError) return err.code;
    throw err;
  }
  throw new Error('expected rejection');
}

describe('base64url', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255, 62, 63]);
    const text = base64UrlEncode(bytes);
    expect(text).not.toMatch(/[+/=]/);
    expect(Array.from(base64UrlDecode(text))).toEqual(Array.from(bytes));
  });

  it('rejects padding and foreign characters', () => {
    expect(() => base64UrlDecode('abc=')).toThrow(EmbedTokenError);
    expect(() => base64UrlDecode('ab+c')).toThrow(EmbedTokenError);
    expect(() => base64UrlDecode('a')).toThrow(EmbedTokenError);
  });
});

describe('getSubtle', () => {
  it('returns a SubtleCrypto', async () => {
    const subtle = await getSubtle();
    expect(typeof subtle.sign).toBe('function');
  });

  it('falls back to node:crypto when there is no global crypto (Node 18)', async () => {
    vi.resetModules();
    vi.stubGlobal('crypto', undefined);
    try {
      const fresh = await import('./jwt.js');
      const token = await fresh.signJwt({ sub: 'u1' }, SECRET);
      expect(token).toBe(forge({ alg: 'HS256', typ: 'JWT' }, { sub: 'u1' }));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('signJwt / verifyJwt', () => {
  it('produces tokens node:crypto agrees with', async () => {
    const token = await signJwt({ sub: 'u1', n: 1 }, SECRET);
    expect(token).toBe(forge({ alg: 'HS256', typ: 'JWT' }, { sub: 'u1', n: 1 }));
  });

  it('round-trips the payload', async () => {
    const token = await signJwt({ sub: 'u1', roles: ['a'] }, SECRET);
    await expect(verifyJwt(token, SECRET)).resolves.toEqual({ sub: 'u1', roles: ['a'] });
  });

  it('rejects a wrong secret', async () => {
    const token = await signJwt({ sub: 'u1' }, SECRET);
    expect(await codeOf(verifyJwt(token, 'other-secret'))).toBe('bad_signature');
  });

  it('accepts any of several secrets (rotation)', async () => {
    const token = await signJwt({ sub: 'u1' }, SECRET);
    await expect(verifyJwt(token, ['new-secret', SECRET])).resolves.toEqual({ sub: 'u1' });
  });

  it('rejects alg none with an empty signature', async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ sub: 'u1' })}.`;
    expect(await codeOf(verifyJwt(token, SECRET))).toBe('bad_algorithm');
  });

  it('rejects other algorithms even when the HMAC is right', async () => {
    for (const alg of ['HS512', 'RS256', 'hs256', 'NONE']) {
      expect(await codeOf(verifyJwt(forge({ alg, typ: 'JWT' }, { sub: 'u1' }), SECRET))).toBe('bad_algorithm');
    }
    expect(await codeOf(verifyJwt(forge({ typ: 'JWT' }, { sub: 'u1' }), SECRET))).toBe('bad_algorithm');
  });

  it('rejects crit headers', async () => {
    expect(await codeOf(verifyJwt(forge({ alg: 'HS256', crit: ['x'] }, {}), SECRET))).toBe('malformed');
  });

  it('rejects tampered payloads', async () => {
    const token = await signJwt({ sub: 'u1' }, SECRET);
    const [h, , s] = token.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url')}.${s}`;
    expect(await codeOf(verifyJwt(forged, SECRET))).toBe('bad_signature');
  });

  it('rejects malformed tokens', async () => {
    expect(await codeOf(verifyJwt('', SECRET))).toBe('malformed');
    expect(await codeOf(verifyJwt('a.b', SECRET))).toBe('malformed');
    expect(await codeOf(verifyJwt('a.b.c.d', SECRET))).toBe('malformed');
    expect(await codeOf(verifyJwt('!!.b.c', SECRET))).toBe('malformed');
    expect(await codeOf(verifyJwt(forge({ alg: 'HS256' }, [1, 2]), SECRET))).toBe('malformed');
  });

  it('rejects truncated signatures', async () => {
    const token = await signJwt({ sub: 'u1' }, SECRET);
    expect(await codeOf(verifyJwt(token.slice(0, -4), SECRET))).toBe('bad_signature');
  });

  it('refuses empty secrets', async () => {
    expect(await codeOf(signJwt({}, ''))).toBe('bad_secret');
    const token = await signJwt({}, SECRET);
    expect(await codeOf(verifyJwt(token, ''))).toBe('bad_secret');
    expect(await codeOf(verifyJwt(token, []))).toBe('bad_secret');
  });
});
