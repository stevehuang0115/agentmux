/**
 * Minimal, strict HS256 JWT signing and verification on Web Crypto.
 *
 * Why hand-rolled: the SDK must run unchanged in Node 18+, Next.js route
 * handlers and edge runtimes, with no dependencies. Only HS256 is supported,
 * on purpose: a verifier that accepts several algorithms is where "alg: none"
 * and key-confusion attacks come from.
 *
 * Signature checks use `SubtleCrypto.verify`, which compares in constant time.
 */
import { EMBED_CONSTANTS } from '../constants.js';
import { EmbedTokenError } from './errors.js';

/** A decoded JWT payload: a plain JSON object. */
export type JwtPayload = Record<string, unknown>;

/** HMAC signature length for SHA-256, in bytes. */
const HS256_SIGNATURE_BYTES = 32;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

/**
 * Held in a variable so bundlers (Next.js edge, webpack) do not try to
 * resolve a Node built-in for a code path that only runs on Node 18.
 */
const NODE_CRYPTO_MODULE = 'node:crypto';

let subtlePromise: Promise<SubtleCrypto> | null = null;

/**
 * Resolve a SubtleCrypto implementation.
 *
 * Uses `globalThis.crypto.subtle` where it exists (browsers, edge runtimes,
 * Node 19+) and falls back to `node:crypto`'s `webcrypto` on Node 18, where
 * the global is not always present.
 *
 * @returns The SubtleCrypto instance
 * @throws Error when no Web Crypto implementation is available
 */
export function getSubtle(): Promise<SubtleCrypto> {
  if (!subtlePromise) {
    subtlePromise = (async () => {
      const globalSubtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
      if (globalSubtle) return globalSubtle;
      const nodeCrypto = (await import(/* webpackIgnore: true */ NODE_CRYPTO_MODULE)) as {
        webcrypto: { subtle: unknown };
      };
      return nodeCrypto.webcrypto.subtle as SubtleCrypto;
    })();
  }
  return subtlePromise;
}

/**
 * Encode bytes as unpadded base64url.
 *
 * @param bytes - Raw bytes
 * @returns base64url text without `=` padding
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode unpadded base64url strictly.
 *
 * @param text - base64url text; padding and non-alphabet characters are rejected
 * @returns The decoded bytes
 * @throws EmbedTokenError (`malformed`) on invalid input
 */
export function base64UrlDecode(text: string): Uint8Array {
  if (!BASE64URL_PATTERN.test(text) || text.length % 4 === 1) {
    throw new EmbedTokenError('malformed', 'Token segment is not base64url');
  }
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new EmbedTokenError('malformed', 'Token segment is not base64url');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Import an HMAC-SHA256 key from a shared secret.
 *
 * @param secret - The shared secret (UTF-8)
 * @param usage - Whether the key will sign or verify
 * @returns A CryptoKey for HMAC-SHA256
 * @throws EmbedTokenError (`bad_secret`) when the secret is empty
 */
async function importHmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new EmbedTokenError('bad_secret', 'Secret must be a non-empty string');
  }
  const subtle = await getSubtle();
  return subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}

/**
 * Parse a base64url JSON segment into a plain object.
 *
 * @param segment - base64url-encoded JSON
 * @param what - Segment name, for the error message
 * @returns The parsed object
 * @throws EmbedTokenError (`malformed`) when the segment is not a JSON object
 */
function decodeJsonSegment(segment: string, what: string): JwtPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(base64UrlDecode(segment)));
  } catch (err) {
    if (err instanceof EmbedTokenError) throw err;
    throw new EmbedTokenError('malformed', `Token ${what} is not valid JSON`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new EmbedTokenError('malformed', `Token ${what} is not a JSON object`);
  }
  return parsed as JwtPayload;
}

/**
 * Sign a payload as a compact HS256 JWT.
 *
 * @param payload - Claims to sign (must be JSON-serialisable)
 * @param secret - Shared HMAC secret
 * @returns The compact JWT `header.payload.signature`
 * @throws EmbedTokenError (`bad_secret`) when the secret is empty
 *
 * @example
 * ```typescript
 * const jwt = await signJwt({ sub: 'u1', exp: 1 }, process.env.SECRET!);
 * ```
 */
export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = { alg: EMBED_CONSTANTS.JWT.ALG, typ: EMBED_CONSTANTS.JWT.TYP };
  const signingInput =
    base64UrlEncode(textEncoder.encode(JSON.stringify(header))) +
    '.' +
    base64UrlEncode(textEncoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret, 'sign');
  const subtle = await getSubtle();
  const signature = new Uint8Array(await subtle.sign('HMAC', key, textEncoder.encode(signingInput)));
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Verify a compact JWT's HS256 signature and return its payload.
 *
 * Only the header and signature are checked here; claim checks (aud, exp, …)
 * belong to the caller. Rejected outright: anything but exactly three
 * segments, any `alg` other than `HS256` (including `none` and an empty
 * signature), a `crit` header, and a signature of the wrong length.
 *
 * @param token - The compact JWT
 * @param secrets - One or more accepted secrets (several during a rotation)
 * @returns The decoded payload
 * @throws EmbedTokenError on any structural, algorithm or signature failure
 */
export async function verifyJwt(token: string, secrets: string | readonly string[]): Promise<JwtPayload> {
  const secretList = typeof secrets === 'string' ? [secrets] : [...secrets];
  if (secretList.length === 0 || secretList.some((s) => typeof s !== 'string' || s.length === 0)) {
    throw new EmbedTokenError('bad_secret', 'Secret must be a non-empty string');
  }
  if (typeof token !== 'string' || token.length === 0) {
    throw new EmbedTokenError('malformed', 'Token is empty');
  }
  const parts = token.split('.');
  if (parts.length !== 3) throw new EmbedTokenError('malformed', 'Token must have three segments');
  const [headerSegment, payloadSegment, signatureSegment] = parts as [string, string, string];

  const header = decodeJsonSegment(headerSegment, 'header');
  if (header.alg !== EMBED_CONSTANTS.JWT.ALG) {
    throw new EmbedTokenError('bad_algorithm', 'Only HS256 tokens are accepted');
  }
  if ('crit' in header) throw new EmbedTokenError('malformed', 'Critical header extensions are not supported');

  const signature = base64UrlDecode(signatureSegment);
  if (signature.length !== HS256_SIGNATURE_BYTES) {
    throw new EmbedTokenError('bad_signature', 'Signature has the wrong length');
  }

  const subtle = await getSubtle();
  const signingInput = textEncoder.encode(`${headerSegment}.${payloadSegment}`);
  let valid = false;
  for (const secret of secretList) {
    const key = await importHmacKey(secret, 'verify');
    // SubtleCrypto.verify compares the MAC in constant time.
    if (await subtle.verify('HMAC', key, new Uint8Array(signature), signingInput)) {
      valid = true;
      break;
    }
  }
  if (!valid) throw new EmbedTokenError('bad_signature', 'Signature does not match');

  return decodeJsonSegment(payloadSegment, 'payload');
}
