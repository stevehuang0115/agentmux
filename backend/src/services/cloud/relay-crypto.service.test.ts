/**
 * Tests for Relay Crypto Service
 *
 * Validates E2EE encryption/decryption, key derivation,
 * and envelope serialization.
 *
 * @module services/cloud/relay-crypto.service.test
 */

import {
  deriveKey,
  generateSalt,
  encrypt,
  decrypt,
  serializeEnvelope,
  deserializeEnvelope,
} from './relay-crypto.service.js';
import { CLOUD_CONSTANTS } from '../../constants.js';

const RELAY = CLOUD_CONSTANTS.RELAY;

// ---------------------------------------------------------------------------
// deriveKey
// ---------------------------------------------------------------------------

describe('deriveKey', () => {
  it('should derive a key of the expected length', () => {
    const salt = generateSalt();
    const key = deriveKey('my-secret', salt);
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(RELAY.KEY_LENGTH);
  });

  it('should produce the same key for the same secret and salt', () => {
    const salt = generateSalt();
    const key1 = deriveKey('same-secret', salt);
    const key2 = deriveKey('same-secret', salt);
    expect(key1.equals(key2)).toBe(true);
  });

  it('should produce different keys for different secrets', () => {
    const salt = generateSalt();
    const key1 = deriveKey('secret-a', salt);
    const key2 = deriveKey('secret-b', salt);
    expect(key1.equals(key2)).toBe(false);
  });

  it('should produce different keys for different salts', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const key1 = deriveKey('same-secret', salt1);
    const key2 = deriveKey('same-secret', salt2);
    expect(key1.equals(key2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateSalt
// ---------------------------------------------------------------------------

describe('generateSalt', () => {
  it('should return a 16-byte buffer', () => {
    const salt = generateSalt();
    expect(salt).toBeInstanceOf(Buffer);
    expect(salt.length).toBe(16);
  });

  it('should produce unique salts', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1.equals(salt2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// encrypt / decrypt roundtrip
// ---------------------------------------------------------------------------

describe('encrypt and decrypt', () => {
  let key: Buffer;

  beforeAll(() => {
    const salt = generateSalt();
    key = deriveKey('test-secret', salt);
  });

  it('should roundtrip a simple string', () => {
    const plaintext = 'Hello, relay!';
    const envelope = encrypt(plaintext, key);
    const decrypted = decrypt(envelope, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should roundtrip an empty string', () => {
    const envelope = encrypt('', key);
    const decrypted = decrypt(envelope, key);
    expect(decrypted).toBe('');
  });

  it('should roundtrip a large payload', () => {
    const plaintext = 'x'.repeat(100_000);
    const envelope = encrypt(plaintext, key);
    const decrypted = decrypt(envelope, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should roundtrip unicode content', () => {
    const plaintext = '你好世界 🌍 — 双机互联';
    const envelope = encrypt(plaintext, key);
    const decrypted = decrypt(envelope, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same content';
    const env1 = encrypt(plaintext, key);
    const env2 = encrypt(plaintext, key);
    expect(env1.ciphertext).not.toBe(env2.ciphertext);
    expect(env1.iv).not.toBe(env2.iv);
  });
});

// ---------------------------------------------------------------------------
// encrypt validation
// ---------------------------------------------------------------------------

describe('encrypt validation', () => {
  it('should throw for invalid key length', () => {
    const shortKey = Buffer.alloc(16);
    expect(() => encrypt('test', shortKey)).toThrow('Invalid key length');
  });

  it('should return envelope with all required fields', () => {
    const salt = generateSalt();
    const key = deriveKey('test', salt);
    const envelope = encrypt('data', key);

    expect(typeof envelope.iv).toBe('string');
    expect(typeof envelope.ciphertext).toBe('string');
    expect(typeof envelope.authTag).toBe('string');
    expect(envelope.iv.length).toBeGreaterThan(0);
    expect(envelope.ciphertext.length).toBeGreaterThan(0);
    expect(envelope.authTag.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// decrypt validation
// ---------------------------------------------------------------------------

describe('decrypt validation', () => {
  it('should throw for invalid key length', () => {
    const salt = generateSalt();
    const key = deriveKey('test', salt);
    const envelope = encrypt('data', key);
    const badKey = Buffer.alloc(16);

    expect(() => decrypt(envelope, badKey)).toThrow('Invalid key length');
  });

  it('should throw when decrypting with a wrong key', () => {
    const salt = generateSalt();
    const key1 = deriveKey('correct-secret', salt);
    const key2 = deriveKey('wrong-secret', salt);

    const envelope = encrypt('secret data', key1);
    expect(() => decrypt(envelope, key2)).toThrow();
  });

  it('should throw when ciphertext is tampered', () => {
    const salt = generateSalt();
    const key = deriveKey('test', salt);
    const envelope = encrypt('data', key);

    // Tamper with the ciphertext
    const tampered = { ...envelope, ciphertext: 'AAAA' + envelope.ciphertext.slice(4) };
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it('should throw when authTag is tampered', () => {
    const salt = generateSalt();
    const key = deriveKey('test', salt);
    const envelope = encrypt('data', key);

    const tampered = { ...envelope, authTag: Buffer.alloc(16).toString('base64') };
    expect(() => decrypt(tampered, key)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// serializeEnvelope / deserializeEnvelope roundtrip
// ---------------------------------------------------------------------------

describe('serializeEnvelope and deserializeEnvelope', () => {
  it('should roundtrip an envelope through serialization', () => {
    const salt = generateSalt();
    const key = deriveKey('test', salt);
    const original = encrypt('payload', key);

    const serialized = serializeEnvelope(original);
    expect(typeof serialized).toBe('string');

    const deserialized = deserializeEnvelope(serialized);
    expect(deserialized.iv).toBe(original.iv);
    expect(deserialized.ciphertext).toBe(original.ciphertext);
    expect(deserialized.authTag).toBe(original.authTag);
  });

  it('should throw for invalid base64', () => {
    expect(() => deserializeEnvelope('not-valid-base64!!!')).toThrow();
  });

  it('should throw for valid base64 but invalid JSON', () => {
    const notJson = Buffer.from('not json').toString('base64');
    expect(() => deserializeEnvelope(notJson)).toThrow();
  });

  it('should throw for JSON without required fields', () => {
    const incomplete = Buffer.from(JSON.stringify({ iv: 'a' })).toString('base64');
    expect(() => deserializeEnvelope(incomplete)).toThrow('Invalid encrypted envelope format');
  });

  it('should throw for JSON with non-string fields', () => {
    const badTypes = Buffer.from(JSON.stringify({ iv: 1, ciphertext: 2, authTag: 3 })).toString('base64');
    expect(() => deserializeEnvelope(badTypes)).toThrow('Invalid encrypted envelope format');
  });
});

// ---------------------------------------------------------------------------
// Full E2EE roundtrip (encrypt → serialize → deserialize → decrypt)
// ---------------------------------------------------------------------------

describe('full E2EE roundtrip', () => {
  it('should recover plaintext after wire transport simulation', () => {
    const salt = generateSalt();
    const key = deriveKey('shared-team-secret', salt);

    const plaintext = '{"action":"delegate","task":"build feature X"}';

    // Sender side
    const envelope = encrypt(plaintext, key);
    const wirePayload = serializeEnvelope(envelope);

    // Receiver side
    const receivedEnvelope = deserializeEnvelope(wirePayload);
    const recovered = decrypt(receivedEnvelope, key);

    expect(recovered).toBe(plaintext);
  });
});
