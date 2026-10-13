/**
 * Team move crypto — end-to-end encryption of the package stream.
 *
 * Only the two machines can read a package; Crewly Cloud stores ciphertext.
 *
 *  - The TARGET makes an ephemeral X25519 key pair per move. The public key
 *    goes to Cloud, the private key never leaves the target's
 *    `~/.crewly/team-moves/<moveId>/`.
 *  - The SOURCE makes an ephemeral X25519 key pair per package, derives a
 *    shared secret with the target's public key and runs it through
 *    HKDF-SHA256 (random 32-byte salt, `info` binds the move id) to get a
 *    one-time AES-256 key.
 *  - The stream is cut into frames of `frameBytes` plaintext. Each frame is
 *    sealed with AES-256-GCM under its own nonce (frame counter). The
 *    authenticated data of every frame is the header (which carries the move
 *    id and the ephemeral public key), the frame counter and a "final" flag,
 *    so a frame cannot be moved, dropped, repeated or cut off at the end, and
 *    a package cannot be replayed into another move, without failing.
 *
 * Wire format:
 *
 *   header : "CTMV" | version u8 | frameBytes u32 | ephemeralPublicKey[32]
 *            | salt[32] | moveIdLength u8 | moveId
 *   frame* : length u32 (ciphertext incl. 16-byte tag) | ciphertext
 *
 * The one-time key makes counter nonces safe: a (key, nonce) pair is never
 * used twice. Both transforms are streaming — memory stays at one frame.
 *
 * @module services/team-move/team-move-crypto
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  type KeyObject,
} from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';

/** Magic bytes at the start of an encrypted package. */
const MAGIC = Buffer.from('CTMV', 'ascii');
/** Format version in the header. */
const FORMAT_VERSION = 1;
/** Length of the GCM tag. */
const TAG_BYTES = 16;
/** Length of an X25519 raw key. */
const KEY_BYTES = 32;
/** DER prefix of an X25519 SubjectPublicKeyInfo (the 32 key bytes follow). */
const X25519_SPKI_PREFIX = Buffer.from('302a300506032b656e032100', 'hex');
/** HKDF info prefix; the move id is appended. */
const HKDF_INFO_PREFIX = 'crewly-team-move/v1|';
/** Largest frame size a header may announce (guards memory). */
const MAX_FRAME_BYTES = 16 * 1024 * 1024;
/** Fixed part of the header, before the move id. */
const FIXED_HEADER_BYTES = MAGIC.length + 1 + 4 + KEY_BYTES + KEY_BYTES + 1;

/** An X25519 key pair for the target of a move. */
export interface TargetKeyPair {
  /** Base64 of the raw 32-byte public key — what Cloud receives. */
  publicKey: string;
  /** Base64 of the PKCS8 DER private key — kept on the target only. */
  privateKey: string;
}

/** Thrown when a package cannot be decrypted or has been altered. */
export class TeamMoveCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamMoveCryptoError';
  }
}

/**
 * Make the target's ephemeral key pair for one move.
 *
 * @returns Base64 public (raw) and private (PKCS8) keys
 */
export function generateTargetKeyPair(): TargetKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');
  return {
    publicKey: rawPublicKey(publicKey).toString('base64'),
    privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
  };
}

/**
 * Raw 32 public-key bytes of a key object.
 *
 * @param key - Public or private X25519 key
 * @returns The 32 raw bytes
 */
function rawPublicKey(key: KeyObject): Buffer {
  const spki = (key.type === 'private' ? createPublicKey(key) : key).export({ format: 'der', type: 'spki' });
  return Buffer.from(spki.subarray(spki.length - KEY_BYTES));
}

/**
 * Import a raw X25519 public key.
 *
 * @param raw - 32 raw bytes
 * @returns Key object
 */
function importPublicKey(raw: Buffer): KeyObject {
  if (raw.length !== KEY_BYTES) throw new TeamMoveCryptoError('public key must be 32 bytes');
  return createPublicKey({ key: Buffer.concat([X25519_SPKI_PREFIX, raw]), format: 'der', type: 'spki' });
}

/**
 * Whether a string is a base64 raw X25519 public key (as Cloud validates it).
 *
 * @param value - Candidate
 * @returns True for 32 bytes of base64
 */
export function isPublicKeyString(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, 'base64').length === KEY_BYTES;
}

/**
 * One-time AES key for a package.
 *
 * @param privateKey - One side's X25519 private key
 * @param peerPublic - The other side's X25519 public key
 * @param salt - 32 random bytes from the header
 * @param moveId - Move id (bound into the derivation)
 * @returns 32-byte key
 */
function deriveKey(privateKey: KeyObject, peerPublic: KeyObject, salt: Buffer, moveId: string): Buffer {
  const shared = diffieHellman({ privateKey, publicKey: peerPublic });
  return Buffer.from(hkdfSync('sha256', shared, salt, Buffer.from(HKDF_INFO_PREFIX + moveId, 'utf8'), 32));
}

/**
 * Nonce of frame `counter`: 4 zero bytes + 8-byte big-endian counter.
 *
 * @param counter - Frame index
 * @returns 12-byte nonce
 */
function nonceFor(counter: number): Buffer {
  const nonce = Buffer.alloc(12);
  nonce.writeBigUInt64BE(BigInt(counter), 4);
  return nonce;
}

/**
 * Authenticated data of a frame: header, frame index, final flag.
 *
 * @param header - Package header bytes
 * @param counter - Frame index
 * @param final - Whether this is the last frame
 * @returns AAD bytes
 */
function aadFor(header: Buffer, counter: number, final: boolean): Buffer {
  const tail = Buffer.alloc(9);
  tail.writeBigUInt64BE(BigInt(counter), 0);
  tail.writeUInt8(final ? 1 : 0, 8);
  return Buffer.concat([header, tail]);
}

/** Options of {@link createEncryptStream}. */
export interface EncryptStreamOptions {
  /** Base64 raw X25519 public key of the target. */
  recipientPublicKey: string;
  /** Move id, bound into the key and the header. */
  moveId: string;
  /** Plaintext bytes per frame (default {@link TEAM_MOVE_CONSTANTS.CRYPTO_FRAME_BYTES}). */
  frameBytes?: number;
}

/**
 * Transform that encrypts a byte stream for the target of a move.
 *
 * @param options - Recipient key, move id, frame size
 * @returns A Transform (plaintext in, package out)
 * @throws TeamMoveCryptoError for an invalid recipient key or move id
 */
export function createEncryptStream(options: EncryptStreamOptions): Transform {
  const frameBytes = options.frameBytes ?? TEAM_MOVE_CONSTANTS.CRYPTO_FRAME_BYTES;
  if (!Number.isInteger(frameBytes) || frameBytes <= 0 || frameBytes > MAX_FRAME_BYTES) {
    throw new TeamMoveCryptoError('invalid frame size');
  }
  const moveId = Buffer.from(options.moveId, 'utf8');
  if (moveId.length === 0 || moveId.length > 255) throw new TeamMoveCryptoError('invalid move id');
  if (!isPublicKeyString(options.recipientPublicKey)) throw new TeamMoveCryptoError('invalid recipient public key');

  const eph = generateKeyPairSync('x25519');
  const salt = randomBytes(KEY_BYTES);
  const key = deriveKey(eph.privateKey, importPublicKey(Buffer.from(options.recipientPublicKey, 'base64')), salt, options.moveId);

  const fixed = Buffer.alloc(MAGIC.length + 1 + 4);
  MAGIC.copy(fixed, 0);
  fixed.writeUInt8(FORMAT_VERSION, MAGIC.length);
  fixed.writeUInt32BE(frameBytes, MAGIC.length + 1);
  const header = Buffer.concat([fixed, rawPublicKey(eph.publicKey), salt, Buffer.from([moveId.length]), moveId]);

  let pending: Buffer[] = [];
  let pendingBytes = 0;
  let counter = 0;
  let headerSent = false;

  const seal = (plain: Buffer, final: boolean): Buffer => {
    const cipher = createCipheriv('aes-256-gcm', key, nonceFor(counter), { authTagLength: TAG_BYTES });
    cipher.setAAD(aadFor(header, counter, final));
    const body = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
    counter += 1;
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length, 0);
    return Buffer.concat([len, body]);
  };

  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback): void {
      try {
        if (!headerSent) {
          this.push(header);
          headerSent = true;
        }
        pending.push(chunk);
        pendingBytes += chunk.length;
        // Keep at least one byte back so the last frame can be sealed as final.
        while (pendingBytes > frameBytes) {
          const all = Buffer.concat(pending);
          this.push(seal(all.subarray(0, frameBytes), false));
          const rest = all.subarray(frameBytes);
          pending = rest.length > 0 ? [rest] : [];
          pendingBytes = rest.length;
        }
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback: TransformCallback): void {
      try {
        if (!headerSent) {
          this.push(header);
          headerSent = true;
        }
        this.push(seal(Buffer.concat(pending), true));
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}

/** Options of {@link createDecryptStream}. */
export interface DecryptStreamOptions {
  /** Base64 PKCS8 private key of the target. */
  privateKey: string;
  /** The move id this package must belong to. */
  moveId: string;
}

/**
 * Transform that decrypts a package on the target. Fails with
 * {@link TeamMoveCryptoError} on any altered, truncated, reordered or
 * foreign-move package.
 *
 * @param options - Target private key and expected move id
 * @returns A Transform (package in, plaintext out)
 */
export function createDecryptStream(options: DecryptStreamOptions): Transform {
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey({ key: Buffer.from(options.privateKey, 'base64'), format: 'der', type: 'pkcs8' });
  } catch {
    throw new TeamMoveCryptoError('invalid private key');
  }

  let buffer: Buffer = Buffer.alloc(0);
  let header: Buffer | null = null;
  let key: Buffer | null = null;
  let frameBytes = 0;
  let counter = 0;

  const open = (body: Buffer, final: boolean): Buffer => {
    if (!header || !key) throw new TeamMoveCryptoError('package header missing');
    if (body.length < TAG_BYTES) throw new TeamMoveCryptoError('truncated frame');
    const decipher = createDecipheriv('aes-256-gcm', key, nonceFor(counter), { authTagLength: TAG_BYTES });
    decipher.setAAD(aadFor(header, counter, final));
    decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
    try {
      const plain = Buffer.concat([decipher.update(body.subarray(0, body.length - TAG_BYTES)), decipher.final()]);
      counter += 1;
      return plain;
    } catch {
      throw new TeamMoveCryptoError('package failed authentication (altered, truncated or not for this move)');
    }
  };

  /** Parse the header once enough bytes are here; returns false when more are needed. */
  const readHeader = (): boolean => {
    if (buffer.length < FIXED_HEADER_BYTES) return false;
    if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) throw new TeamMoveCryptoError('not a team move package');
    if (buffer.readUInt8(MAGIC.length) !== FORMAT_VERSION) throw new TeamMoveCryptoError('unsupported package version');
    const announced = buffer.readUInt32BE(MAGIC.length + 1);
    if (announced <= 0 || announced > MAX_FRAME_BYTES) throw new TeamMoveCryptoError('invalid frame size in package');
    const idLength = buffer.readUInt8(FIXED_HEADER_BYTES - 1);
    const total = FIXED_HEADER_BYTES + idLength;
    if (buffer.length < total) return false;
    const moveId = buffer.subarray(FIXED_HEADER_BYTES, total).toString('utf8');
    if (moveId !== options.moveId) throw new TeamMoveCryptoError('package belongs to another move');
    const ephPublic = buffer.subarray(MAGIC.length + 5, MAGIC.length + 5 + KEY_BYTES);
    const salt = buffer.subarray(MAGIC.length + 5 + KEY_BYTES, MAGIC.length + 5 + 2 * KEY_BYTES);
    header = Buffer.from(buffer.subarray(0, total));
    key = deriveKey(privateKey, importPublicKey(Buffer.from(ephPublic)), Buffer.from(salt), moveId);
    frameBytes = announced;
    buffer = buffer.subarray(total);
    return true;
  };

  /**
   * Open every frame that is certainly not the last one: a frame is open-able
   * once at least one more byte follows it.
   */
  const drain = (push: (b: Buffer) => void): void => {
    for (;;) {
      if (!header && !readHeader()) return;
      if (buffer.length < 4) return;
      const length = buffer.readUInt32BE(0);
      if (length < TAG_BYTES || length > frameBytes + TAG_BYTES) throw new TeamMoveCryptoError('invalid frame length');
      if (buffer.length < 4 + length + 1) return; // need a byte beyond it to know it is not final
      const body = buffer.subarray(4, 4 + length);
      push(open(body, false));
      buffer = buffer.subarray(4 + length);
    }
  };

  return new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback): void {
      try {
        buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
        drain((b) => this.push(b));
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback: TransformCallback): void {
      try {
        if (!header && !readHeader()) throw new TeamMoveCryptoError('package is empty or truncated');
        if (buffer.length < 4) throw new TeamMoveCryptoError('package is truncated');
        const length = buffer.readUInt32BE(0);
        if (length < TAG_BYTES || length > frameBytes + TAG_BYTES) throw new TeamMoveCryptoError('invalid frame length');
        if (buffer.length !== 4 + length) throw new TeamMoveCryptoError('package is truncated or has trailing data');
        this.push(open(buffer.subarray(4), true));
        buffer = Buffer.alloc(0);
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}

/** A pass-through Transform that hashes and counts what flows through it. */
export interface HashTap extends Transform {
  /** Finish and return the hex SHA-256 (call after the stream ended). */
  digest(): string;
  /** Bytes seen so far. */
  readonly bytes: number;
}

/**
 * Pass-through stream computing SHA-256 and size of its data.
 *
 * @returns The tap
 */
export function createHashTap(): HashTap {
  const hash = createHash('sha256');
  let bytes = 0;
  const tap = new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback): void {
      hash.update(chunk);
      bytes += chunk.length;
      callback(null, chunk);
    },
  }) as HashTap;
  Object.defineProperty(tap, 'bytes', { get: () => bytes });
  tap.digest = (): string => hash.digest('hex');
  return tap;
}
