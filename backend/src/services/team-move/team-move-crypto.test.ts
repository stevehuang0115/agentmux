import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  TeamMoveCryptoError,
  createDecryptStream,
  createEncryptStream,
  createHashTap,
  generateTargetKeyPair,
  isPublicKeyString,
} from './team-move-crypto.js';

async function collect(source: Readable, ...transforms: NodeJS.ReadWriteStream[]): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const { Writable } = await import('node:stream');
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });
  await pipeline([source, ...transforms, sink] as unknown as NodeJS.ReadableStream[]);
  return Buffer.concat(chunks);
}

async function encrypt(plain: Buffer, publicKey: string, moveId: string, frameBytes = 1024, slice = 777): Promise<Buffer> {
  const pieces: Buffer[] = [];
  for (let i = 0; i < plain.length; i += slice) pieces.push(plain.subarray(i, i + slice));
  return collect(Readable.from(pieces), createEncryptStream({ recipientPublicKey: publicKey, moveId, frameBytes }));
}

async function decrypt(cipher: Buffer, privateKey: string, moveId: string, slice = 513): Promise<Buffer> {
  const pieces: Buffer[] = [];
  for (let i = 0; i < cipher.length; i += slice) pieces.push(cipher.subarray(i, i + slice));
  return collect(Readable.from(pieces), createDecryptStream({ privateKey, moveId }));
}

describe('team-move-crypto', () => {
  const moveId = 'move-1234567890';

  it('makes valid base64 raw public keys', () => {
    const pair = generateTargetKeyPair();
    expect(isPublicKeyString(pair.publicKey)).toBe(true);
    expect(Buffer.from(pair.publicKey, 'base64')).toHaveLength(32);
    expect(isPublicKeyString('nope')).toBe(false);
    expect(isPublicKeyString(undefined)).toBe(false);
  });

  it('round-trips data of many sizes across frame boundaries', async () => {
    const pair = generateTargetKeyPair();
    for (const size of [0, 1, 1023, 1024, 1025, 2048, 5000, 100_000]) {
      const plain = randomBytes(size);
      const cipher = await encrypt(plain, pair.publicKey, moveId);
      expect(cipher.length).toBeGreaterThan(size);
      const back = await decrypt(cipher, pair.privateKey, moveId);
      expect(back.equals(plain)).toBe(true);
    }
  });

  it('does not contain the plaintext and differs between runs', async () => {
    const pair = generateTargetKeyPair();
    const plain = Buffer.from('super secret team memory '.repeat(100));
    const a = await encrypt(plain, pair.publicKey, moveId);
    const b = await encrypt(plain, pair.publicKey, moveId);
    expect(a.includes(Buffer.from('super secret'))).toBe(false);
    expect(a.equals(b)).toBe(false);
  });

  it('refuses the wrong private key', async () => {
    const pair = generateTargetKeyPair();
    const other = generateTargetKeyPair();
    const cipher = await encrypt(randomBytes(3000), pair.publicKey, moveId);
    await expect(decrypt(cipher, other.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
  });

  it('refuses a package from another move', async () => {
    const pair = generateTargetKeyPair();
    const cipher = await encrypt(randomBytes(3000), pair.publicKey, moveId);
    await expect(decrypt(cipher, pair.privateKey, 'another-move-0000')).rejects.toThrow(/another move/);
  });

  it('detects a flipped bit in any frame', async () => {
    const pair = generateTargetKeyPair();
    const cipher = await encrypt(randomBytes(6000), pair.publicKey, moveId);
    const headerLength = 4 + 1 + 4 + 32 + 32 + 1 + moveId.length;
    for (const offset of [headerLength + 10, Math.floor(cipher.length / 2), cipher.length - 3]) {
      const tampered = Buffer.from(cipher);
      tampered[offset] = tampered[offset]! ^ 0x01;
      await expect(decrypt(tampered, pair.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
    }
  });

  it('detects a tampered header', async () => {
    const pair = generateTargetKeyPair();
    const cipher = await encrypt(randomBytes(3000), pair.publicKey, moveId);
    const tampered = Buffer.from(cipher);
    tampered[20] = tampered[20]! ^ 0xff; // inside the ephemeral public key
    await expect(decrypt(tampered, pair.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
  });

  it('detects truncation at a frame boundary and mid-frame', async () => {
    const pair = generateTargetKeyPair();
    const plain = randomBytes(5000);
    const cipher = await encrypt(plain, pair.publicKey, moveId);
    const headerLength = 4 + 1 + 4 + 32 + 32 + 1 + moveId.length;
    const frame = 4 + 1024 + 16;
    // Drop the final frame entirely (cut exactly at a frame boundary).
    await expect(decrypt(cipher.subarray(0, headerLength + frame * 2), pair.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
    await expect(decrypt(cipher.subarray(0, cipher.length - 5), pair.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
    await expect(decrypt(cipher.subarray(0, 10), pair.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
    await expect(decrypt(Buffer.alloc(0), pair.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
  });

  it('detects reordered and repeated frames and trailing data', async () => {
    const pair = generateTargetKeyPair();
    const cipher = await encrypt(randomBytes(4000), pair.publicKey, moveId);
    const headerLength = 4 + 1 + 4 + 32 + 32 + 1 + moveId.length;
    const frame = 4 + 1024 + 16;
    const header = cipher.subarray(0, headerLength);
    const f0 = cipher.subarray(headerLength, headerLength + frame);
    const f1 = cipher.subarray(headerLength + frame, headerLength + 2 * frame);
    const rest = cipher.subarray(headerLength + 2 * frame);
    await expect(decrypt(Buffer.concat([header, f1, f0, rest]), pair.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
    await expect(decrypt(Buffer.concat([header, f0, f0, f1, rest]), pair.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
    await expect(decrypt(Buffer.concat([cipher, Buffer.from([1, 2, 3])]), pair.privateKey, moveId)).rejects.toBeInstanceOf(TeamMoveCryptoError);
  });

  it('rejects garbage that is not a package', async () => {
    const pair = generateTargetKeyPair();
    await expect(decrypt(randomBytes(500), pair.privateKey, moveId)).rejects.toThrow(/not a team move package/);
  });

  it('rejects bad inputs up front', () => {
    const pair = generateTargetKeyPair();
    expect(() => createEncryptStream({ recipientPublicKey: 'x', moveId })).toThrow(TeamMoveCryptoError);
    expect(() => createEncryptStream({ recipientPublicKey: pair.publicKey, moveId: '' })).toThrow(TeamMoveCryptoError);
    expect(() => createEncryptStream({ recipientPublicKey: pair.publicKey, moveId, frameBytes: 0 })).toThrow(TeamMoveCryptoError);
    expect(() => createDecryptStream({ privateKey: 'not a key', moveId })).toThrow(TeamMoveCryptoError);
  });

  it('hash tap reports sha256 and size of what passed', async () => {
    const tap = createHashTap();
    const out = await collect(Readable.from([Buffer.from('abc')]), tap);
    expect(out.toString()).toBe('abc');
    expect(tap.bytes).toBe(3);
    expect(tap.digest()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
