/**
 * Relay Crypto Service
 *
 * Provides end-to-end encryption (E2EE) for relay message payloads.
 * Uses AES-256-GCM with keys derived via PBKDF2 from a shared secret.
 *
 * The relay server only forwards opaque encrypted blobs — it never
 * has access to the derived key or plaintext content.
 *
 * @module services/cloud/relay-crypto.service
 */

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { CLOUD_CONSTANTS } from '../../constants.js';
import type { EncryptedEnvelope } from './relay.types.js';

const RELAY = CLOUD_CONSTANTS.RELAY;

/**
 * Derive a 256-bit AES key from a shared secret and salt using PBKDF2.
 *
 * Both peers must use the same shared secret and salt to produce
 * the same key. The salt prevents rainbow table attacks.
 *
 * @param sharedSecret - Pre-shared secret string known to both peers
 * @param salt - Salt buffer (should be exchanged or agreed upon)
 * @returns 32-byte derived key buffer
 *
 * @example
 * ```ts
 * const key = deriveKey('my-secret', salt);
 * ```
 */
export function deriveKey(sharedSecret: string, salt: Buffer): Buffer {
  return pbkdf2Sync(
    sharedSecret,
    salt,
    RELAY.KEY_DERIVATION_ITERATIONS,
    RELAY.KEY_LENGTH,
    'sha256',
  );
}

/**
 * Generate a random salt for key derivation.
 *
 * @returns 16-byte random salt buffer
 */
export function generateSalt(): Buffer {
  return randomBytes(16);
}

/**
 * Encrypt a plaintext string into an EncryptedEnvelope using AES-256-GCM.
 *
 * Produces a random IV per encryption to ensure semantic security.
 * The returned envelope contains base64-encoded IV, ciphertext, and auth tag.
 *
 * @param plaintext - Data to encrypt (will be treated as UTF-8)
 * @param key - 32-byte AES key (from deriveKey)
 * @returns EncryptedEnvelope with base64 fields
 * @throws Error if key length is invalid
 *
 * @example
 * ```ts
 * const envelope = encrypt('hello world', key);
 * // { iv: '...', ciphertext: '...', authTag: '...' }
 * ```
 */
export function encrypt(plaintext: string, key: Buffer): EncryptedEnvelope {
  if (key.length !== RELAY.KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${RELAY.KEY_LENGTH} bytes, got ${key.length}`);
  }

  const iv = randomBytes(RELAY.IV_LENGTH);
  const cipher = createCipheriv(RELAY.CIPHER_ALGORITHM, key, iv, {
    authTagLength: RELAY.AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt an EncryptedEnvelope back to plaintext using AES-256-GCM.
 *
 * Verifies the authentication tag to ensure message integrity.
 *
 * @param envelope - Encrypted envelope with base64 fields
 * @param key - 32-byte AES key (same key used for encryption)
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (wrong key, tampered data, or invalid envelope)
 *
 * @example
 * ```ts
 * const plaintext = decrypt(envelope, key);
 * ```
 */
export function decrypt(envelope: EncryptedEnvelope, key: Buffer): string {
  if (key.length !== RELAY.KEY_LENGTH) {
    throw new Error(`Invalid key length: expected ${RELAY.KEY_LENGTH} bytes, got ${key.length}`);
  }

  const iv = Buffer.from(envelope.iv, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');

  const decipher = createDecipheriv(RELAY.CIPHER_ALGORITHM, key, iv, {
    authTagLength: RELAY.AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Serialize an EncryptedEnvelope to a base64 string for wire transport.
 *
 * The relay protocol sends a single base64 payload field. This function
 * packs the envelope into a JSON string and then base64-encodes it.
 *
 * @param envelope - Encrypted envelope to serialize
 * @returns Base64-encoded string
 */
export function serializeEnvelope(envelope: EncryptedEnvelope): string {
  return Buffer.from(JSON.stringify(envelope)).toString('base64');
}

/**
 * Deserialize a base64 wire payload back to an EncryptedEnvelope.
 *
 * @param payload - Base64-encoded string from the relay wire message
 * @returns Parsed EncryptedEnvelope
 * @throws Error if the payload is not valid base64 or does not contain valid envelope fields
 */
export function deserializeEnvelope(payload: string): EncryptedEnvelope {
  const json = Buffer.from(payload, 'base64').toString('utf8');
  const parsed: unknown = JSON.parse(json);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)['iv'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['ciphertext'] !== 'string' ||
    typeof (parsed as Record<string, unknown>)['authTag'] !== 'string'
  ) {
    throw new Error('Invalid encrypted envelope format');
  }

  return parsed as EncryptedEnvelope;
}
