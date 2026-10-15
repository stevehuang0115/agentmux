import { describe, expect, it } from 'vitest';
import { EmbedTokenError } from './errors.js';
import { signJwt, verifyJwt } from './jwt.js';
import { signHostToken, signIdentityToken, verifyHostToken, verifyIdentityToken } from './tokens.js';

const EMBED = 'emb_test123';
const SECRET = 'identity-secret-abcdefghijklmnop';
const NOW = 1_760_000_000_000; // fixed ms clock
const T = Math.floor(NOW / 1000);

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    if (err instanceof EmbedTokenError) return err.code;
    throw err;
  }
  throw new Error('expected rejection');
}

const hostClaims = (over: Record<string, unknown> = {}) => ({
  iss: 'crewly',
  aud: `host:${EMBED}`,
  sub: 'teacher-118',
  scope: 'self',
  iat: T,
  exp: T + 300,
  ...over,
});

/** Copy of an object without one key. */
function without<T extends Record<string, unknown>>(obj: T, key: keyof T): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...obj };
  delete copy[key as string];
  return copy;
}

describe('signIdentityToken', () => {
  it('signs exactly the contract claims, valid 10 minutes', async () => {
    const token = await signIdentityToken({
      embedId: EMBED,
      secret: SECRET,
      user: { id: 'teacher-118', name: 'Ms Lin', email: 'lin@example.com', roles: ['teacher'] },
      now: NOW,
    });
    const header = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString());
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(await verifyJwt(token, SECRET)).toEqual({
      aud: EMBED,
      sub: 'teacher-118',
      name: 'Ms Lin',
      email: 'lin@example.com',
      roles: ['teacher'],
      iat: T,
      exp: T + 600,
    });
  });

  it('omits empty optional claims', async () => {
    const token = await signIdentityToken({ embedId: EMBED, secret: SECRET, user: { id: 'u', roles: ['admin'] }, now: NOW });
    const claims = await verifyJwt(token, SECRET);
    expect(claims).not.toHaveProperty('name');
    expect(claims).not.toHaveProperty('email');
  });

  it('refuses missing embed id, user id or roles', async () => {
    expect(await codeOf(signIdentityToken({ embedId: '', secret: SECRET, user: { id: 'u', roles: ['a'] } }))).toBe('bad_claims');
    expect(await codeOf(signIdentityToken({ embedId: EMBED, secret: SECRET, user: { id: '', roles: ['a'] } }))).toBe('bad_claims');
    expect(await codeOf(signIdentityToken({ embedId: EMBED, secret: SECRET, user: { id: 'u', roles: [] } }))).toBe('bad_claims');
    expect(await codeOf(signIdentityToken({ embedId: EMBED, secret: SECRET, user: { id: 'u', roles: [''] } }))).toBe('bad_claims');
  });
});

describe('verifyIdentityToken', () => {
  const sign = () => signIdentityToken({ embedId: EMBED, secret: SECRET, user: { id: 'u1', name: 'N', roles: ['admin'] }, now: NOW });

  it('round-trips', async () => {
    const claims = await verifyIdentityToken(await sign(), { embedId: EMBED, secret: SECRET, now: NOW + 1000 });
    expect(claims).toEqual({ aud: EMBED, sub: 'u1', name: 'N', roles: ['admin'], iat: T, exp: T + 600 });
  });

  it('rejects wrong secret, wrong aud, expiry and long lifetime', async () => {
    const token = await sign();
    expect(await codeOf(verifyIdentityToken(token, { embedId: EMBED, secret: 'nope', now: NOW }))).toBe('bad_signature');
    expect(await codeOf(verifyIdentityToken(token, { embedId: 'emb_other', secret: SECRET, now: NOW }))).toBe('bad_audience');
    expect(await codeOf(verifyIdentityToken(token, { embedId: EMBED, secret: SECRET, now: NOW + 700_000 }))).toBe('expired');
    const long = await signJwt({ aud: EMBED, sub: 'u', roles: ['a'], iat: T, exp: T + 601 }, SECRET);
    expect(await codeOf(verifyIdentityToken(long, { embedId: EMBED, secret: SECRET, now: NOW }))).toBe('lifetime_too_long');
  });

  it('requires sub and roles', async () => {
    const noRoles = await signJwt({ aud: EMBED, sub: 'u', iat: T, exp: T + 60 }, SECRET);
    expect(await codeOf(verifyIdentityToken(noRoles, { embedId: EMBED, secret: SECRET, now: NOW }))).toBe('bad_claims');
    const noSub = await signJwt({ aud: EMBED, roles: ['a'], iat: T, exp: T + 60 }, SECRET);
    expect(await codeOf(verifyIdentityToken(noSub, { embedId: EMBED, secret: SECRET, now: NOW }))).toBe('bad_claims');
  });
});

describe('verifyHostToken', () => {
  const opts = { embedId: EMBED, secret: SECRET, now: NOW };

  it('round-trips with signHostToken', async () => {
    const token = await signHostToken({ embedId: EMBED, secret: SECRET, sub: 'teacher-118', now: NOW });
    expect(await verifyJwt(token, SECRET)).toEqual(hostClaims());
    await expect(verifyHostToken(token, opts)).resolves.toEqual({ sub: 'teacher-118', scope: 'self' });
  });

  it('accepts a Cloud-shaped token with no iss', async () => {
    const token = await signJwt(without(hostClaims(), 'iss'), SECRET);
    await expect(verifyHostToken(token, opts)).resolves.toEqual({ sub: 'teacher-118', scope: 'self' });
  });

  it('accepts the previous secret during a rotation', async () => {
    const token = await signJwt(hostClaims(), 'old-secret');
    await expect(verifyHostToken(token, { ...opts, secret: [SECRET, 'old-secret'] })).resolves.toMatchObject({ sub: 'teacher-118' });
  });

  it('rejects a wrong secret', async () => {
    const token = await signJwt(hostClaims(), 'another-secret');
    expect(await codeOf(verifyHostToken(token, opts))).toBe('bad_signature');
  });

  it('rejects alg none', async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${enc({ alg: 'none' })}.${enc(hostClaims())}.`;
    expect(await codeOf(verifyHostToken(token, opts))).toBe('bad_algorithm');
  });

  it('rejects the wrong audience, including an identity token replayed as a host token', async () => {
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ aud: 'host:emb_other' }), SECRET), opts))).toBe('bad_audience');
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ aud: EMBED }), SECRET), opts))).toBe('bad_audience');
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ aud: [`host:${EMBED}`] }), SECRET), opts))).toBe('bad_audience');
  });

  it('rejects a foreign issuer', async () => {
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ iss: 'evil' }), SECRET), opts))).toBe('bad_issuer');
  });

  it('rejects expired tokens, beyond the clock tolerance', async () => {
    const token = await signJwt(hostClaims(), SECRET);
    await expect(verifyHostToken(token, { ...opts, now: NOW + 310_000 })).resolves.toBeTruthy();
    expect(await codeOf(verifyHostToken(token, { ...opts, now: NOW + 330_000 }))).toBe('expired');
    expect(await codeOf(verifyHostToken(token, { ...opts, now: NOW + 301_000, clockToleranceSeconds: 0 }))).toBe('expired');
  });

  it('rejects a lifetime above 300 s', async () => {
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ exp: T + 301 }), SECRET), opts))).toBe('lifetime_too_long');
  });

  it('rejects missing or bad iat / exp', async () => {
    expect(await codeOf(verifyHostToken(await signJwt(without(hostClaims(), 'iat'), SECRET), opts))).toBe('bad_claims');
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ exp: '9999999999' }), SECRET), opts))).toBe('bad_claims');
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ exp: T }), SECRET), opts))).toBe('bad_claims');
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ iat: T + 120, exp: T + 300 }), SECRET), opts))).toBe('not_yet_valid');
  });

  it('rejects any scope other than self', async () => {
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ scope: 'all' }), SECRET), opts))).toBe('bad_scope');
    expect(await codeOf(verifyHostToken(await signJwt(without(hostClaims(), 'scope'), SECRET), opts))).toBe('bad_scope');
  });

  it('requires sub', async () => {
    expect(await codeOf(verifyHostToken(await signJwt(hostClaims({ sub: '' }), SECRET), opts))).toBe('bad_claims');
  });
});

describe('signHostToken', () => {
  it('refuses lifetimes above 300 s and a missing sub', async () => {
    expect(await codeOf(signHostToken({ embedId: EMBED, secret: SECRET, sub: 'u', ttlSeconds: 301 }))).toBe('lifetime_too_long');
    expect(await codeOf(signHostToken({ embedId: EMBED, secret: SECRET, sub: '' }))).toBe('bad_claims');
  });
});
