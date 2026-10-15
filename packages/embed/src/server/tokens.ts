/**
 * The two tokens of the embed contract (spec P1a):
 *
 * - **Identity token** — signed by the host server for its logged-in user and
 *   handed to the panel: `{ aud: embedId, sub, name?, email?, roles, iat, exp }`,
 *   HS256, at most 10 minutes. Cloud verifies it.
 * - **Host token** — minted by Cloud for one conversation and sent by the
 *   agent to the host's ops API: `{ iss: 'crewly', aud: 'host:<embedId>', sub,
 *   scope: 'self', iat, exp: iat + 300 }`. The host verifies it.
 *
 * Both are signed with the embed's `identitySecret`.
 */
import { EMBED_CONSTANTS } from '../constants.js';
import { EmbedTokenError } from './errors.js';
import { signJwt, verifyJwt, type JwtPayload } from './jwt.js';

const { JWT } = EMBED_CONSTANTS;

/** The host's user as it appears in an identity token. */
export interface EmbedIdentityUser {
  /** Stable user id; becomes `sub`. Never an email that can be reassigned. */
  id: string;
  /** Display name shown to the agent. */
  name?: string;
  /** Contact email shown to the agent. */
  email?: string;
  /** Roles the user is acting in; Cloud maps them to a profile. At least one. */
  roles: readonly string[];
}

/** Options for {@link signIdentityToken}. */
export interface SignIdentityTokenOptions {
  /** The embed id (`emb_…`); becomes `aud`. */
  embedId: string;
  /** The embed's identity secret. Server-side only. */
  secret: string;
  /** The logged-in user. */
  user: EmbedIdentityUser;
  /** Override "now" (ms since epoch); for tests. */
  now?: number;
}

/** Claims of an identity token, as decoded. */
export interface IdentityTokenClaims {
  aud: string;
  sub: string;
  name?: string;
  email?: string;
  roles: string[];
  iat: number;
  exp: number;
}

/** Options shared by the verifiers. */
export interface VerifyTokenOptions {
  /** The embed id the token must be for. */
  embedId: string;
  /** Accepted secret(s). Pass two during a rotation: `[newSecret, oldSecret]`. */
  secret: string | readonly string[];
  /** Override "now" (ms since epoch); for tests. */
  now?: number;
  /** Clock skew tolerated on `exp` and `iat`, in seconds. Default 30. */
  clockToleranceSeconds?: number;
}

/** Options for {@link signHostToken}. */
export interface SignHostTokenOptions {
  embedId: string;
  secret: string;
  /** The asker's `sub` for the conversation. */
  sub: string;
  /** Override "now" (ms since epoch); for tests. */
  now?: number;
  /** Lifetime in seconds. Default and maximum 300. */
  ttlSeconds?: number;
}

/** What a verified host token grants. */
export interface HostTokenGrant {
  /** The asker the agent is acting for. */
  sub: string;
  /** Always `'self'` in P1: only the asker's own data. */
  scope: 'self';
}

/**
 * Current time in whole seconds.
 *
 * @param now - Optional override in ms since epoch
 * @returns Seconds since epoch
 */
function nowSeconds(now?: number): number {
  return Math.floor((now ?? Date.now()) / 1000);
}

/**
 * Check that a value is a non-empty string.
 *
 * @param value - Value to check
 * @returns True for a non-empty string
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validate `iat` / `exp`: both integers, not expired, not issued in the
 * future, and a lifetime no longer than `maxLifetime`.
 *
 * @param payload - Decoded claims
 * @param maxLifetime - Largest allowed `exp - iat`, in seconds
 * @param options - Time overrides and tolerance
 * @throws EmbedTokenError on any failure
 */
function checkTimes(
  payload: JwtPayload,
  maxLifetime: number,
  options: Pick<VerifyTokenOptions, 'now' | 'clockToleranceSeconds'>,
): void {
  const { iat, exp } = payload;
  if (!Number.isInteger(iat) || !Number.isInteger(exp)) {
    throw new EmbedTokenError('bad_claims', 'Token must carry integer iat and exp');
  }
  const tolerance = options.clockToleranceSeconds ?? JWT.DEFAULT_CLOCK_TOLERANCE_SECONDS;
  const now = nowSeconds(options.now);
  const issuedAt = iat as number;
  const expiresAt = exp as number;
  if (expiresAt <= issuedAt) throw new EmbedTokenError('bad_claims', 'Token exp must be after iat');
  if (expiresAt - issuedAt > maxLifetime) {
    throw new EmbedTokenError('lifetime_too_long', `Token lifetime exceeds ${maxLifetime}s`);
  }
  if (now >= expiresAt + tolerance) throw new EmbedTokenError('expired', 'Token has expired');
  if (issuedAt > now + tolerance) throw new EmbedTokenError('not_yet_valid', 'Token was issued in the future');
}

/**
 * Sign the identity token for the host's logged-in user.
 *
 * Call this in the host's token route, only for users whose acting role is
 * allowed to see the panel; for everyone else answer 204 so the panel does
 * not render. The token is valid for 10 minutes; the panel asks for a new
 * one before it expires.
 *
 * @param options - Embed id, secret and the user
 * @returns The compact JWT, to be returned as `text/plain`
 * @throws EmbedTokenError (`bad_claims`) when the embed id, user id or roles are missing
 *
 * @example
 * ```typescript
 * const token = await signIdentityToken({
 *   embedId: process.env.CREWLY_EMBED_ID!,
 *   secret: process.env.CREWLY_EMBED_SECRET!,
 *   user: { id: user.id, name: user.name, roles: ['admin'] },
 * });
 * ```
 */
export async function signIdentityToken(options: SignIdentityTokenOptions): Promise<string> {
  const { embedId, secret, user } = options;
  if (!isNonEmptyString(embedId)) throw new EmbedTokenError('bad_claims', 'embedId is required');
  if (!user || !isNonEmptyString(user.id)) throw new EmbedTokenError('bad_claims', 'user.id is required');
  if (!Array.isArray(user.roles) || user.roles.length === 0 || !user.roles.every(isNonEmptyString)) {
    throw new EmbedTokenError('bad_claims', 'user.roles must be a non-empty list of strings');
  }
  const iat = nowSeconds(options.now);
  const claims: JwtPayload = { aud: embedId, sub: user.id };
  if (isNonEmptyString(user.name)) claims.name = user.name;
  if (isNonEmptyString(user.email)) claims.email = user.email;
  claims.roles = [...user.roles];
  claims.iat = iat;
  claims.exp = iat + JWT.IDENTITY_TTL_SECONDS;
  return signJwt(claims, secret);
}

/**
 * Verify an identity token the way Cloud does.
 *
 * Hosts rarely need this; it exists for tests, local demos and anyone
 * running a stand-in for Cloud. Checks: HS256 only, `aud === embedId`, `exp`,
 * `iat`, lifetime ≤ 600 s, `sub` and `roles` present.
 *
 * @param token - The compact JWT
 * @param options - Expected embed id and secret(s)
 * @returns The decoded claims
 * @throws EmbedTokenError on any failure
 */
export async function verifyIdentityToken(token: string, options: VerifyTokenOptions): Promise<IdentityTokenClaims> {
  const payload = await verifyJwt(token, options.secret);
  if (payload.aud !== options.embedId) throw new EmbedTokenError('bad_audience', 'Token is for another embed');
  checkTimes(payload, JWT.IDENTITY_TTL_SECONDS, options);
  const { sub, roles, name, email } = payload;
  if (!isNonEmptyString(sub)) throw new EmbedTokenError('bad_claims', 'Token sub is required');
  if (!Array.isArray(roles) || roles.length === 0 || !roles.every(isNonEmptyString)) {
    throw new EmbedTokenError('bad_claims', 'Token roles must be a non-empty list of strings');
  }
  const claims: IdentityTokenClaims = {
    aud: options.embedId,
    sub,
    roles: [...roles],
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
  if (isNonEmptyString(name)) claims.name = name;
  if (isNonEmptyString(email)) claims.email = email;
  return claims;
}

/**
 * Mint a host token the way Cloud does.
 *
 * In production only Cloud mints these (`POST …/embeds/:id/host-token`);
 * this exists for tests and for calling a local ops API by hand.
 *
 * @param options - Embed id, secret, the asker's sub and optional lifetime
 * @returns The compact JWT
 * @throws EmbedTokenError when sub is missing or the lifetime exceeds 300 s
 */
export async function signHostToken(options: SignHostTokenOptions): Promise<string> {
  const ttl = options.ttlSeconds ?? JWT.HOST_TOKEN_TTL_SECONDS;
  if (!isNonEmptyString(options.embedId)) throw new EmbedTokenError('bad_claims', 'embedId is required');
  if (!isNonEmptyString(options.sub)) throw new EmbedTokenError('bad_claims', 'sub is required');
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > JWT.HOST_TOKEN_MAX_LIFETIME_SECONDS) {
    throw new EmbedTokenError('lifetime_too_long', `ttlSeconds must be 1..${JWT.HOST_TOKEN_MAX_LIFETIME_SECONDS}`);
  }
  const iat = nowSeconds(options.now);
  return signJwt(
    {
      iss: JWT.HOST_ISSUER,
      aud: JWT.HOST_AUDIENCE_PREFIX + options.embedId,
      sub: options.sub,
      scope: JWT.SCOPE_SELF,
      iat,
      exp: iat + ttl,
    },
    options.secret,
  );
}

/**
 * Verify a host token sent by the Crewly agent to the host's ops API.
 *
 * Strict by design: HS256 only (`none` and every other algorithm are
 * refused), `aud === 'host:' + embedId`, unexpired, `iat` present and not in
 * the future, lifetime ≤ 300 s, `scope === 'self'`, and `iss` — when present
 * — must be `crewly`.
 *
 * @param token - The bearer token from the `Authorization` header
 * @param options - Expected embed id and secret(s)
 * @returns `{ sub, scope }`: who the agent is acting for
 * @throws EmbedTokenError on any failure
 *
 * @example
 * ```typescript
 * const { sub } = await verifyHostToken(bearer, { embedId, secret });
 * ```
 */
export async function verifyHostToken(token: string, options: VerifyTokenOptions): Promise<HostTokenGrant> {
  const payload = await verifyJwt(token, options.secret);
  if (payload.aud !== JWT.HOST_AUDIENCE_PREFIX + options.embedId) {
    throw new EmbedTokenError('bad_audience', 'Token is not a host token for this embed');
  }
  if ('iss' in payload && payload.iss !== JWT.HOST_ISSUER) {
    throw new EmbedTokenError('bad_issuer', 'Token issuer is not Crewly');
  }
  checkTimes(payload, JWT.HOST_TOKEN_MAX_LIFETIME_SECONDS, options);
  if (payload.scope !== JWT.SCOPE_SELF) throw new EmbedTokenError('bad_scope', "Token scope must be 'self'");
  if (!isNonEmptyString(payload.sub)) throw new EmbedTokenError('bad_claims', 'Token sub is required');
  return { sub: payload.sub, scope: JWT.SCOPE_SELF };
}
