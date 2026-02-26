/**
 * UserIdentityService Tests
 *
 * Tests for user CRUD operations and token encryption/decryption.
 * Uses a temporary directory to isolate file I/O.
 *
 * @module user-identity-service.test
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Mock the logger to avoid side-effects
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: jest.fn(() => ({
      createComponentLogger: jest.fn(() => ({
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    })),
  },
}));

import { UserIdentityService } from './user-identity.service.js';

describe('UserIdentityService', () => {
  let service: UserIdentityService;
  let tmpDir: string;

  beforeEach(async () => {
    // Create temp dir and point the service store path there
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'user-identity-test-'));
    // Reset singleton
    (UserIdentityService as any).instance = null;
    service = UserIdentityService.getInstance();
    // Override store path to temp dir
    (service as any).storePath = path.join(tmpDir, 'users.json');
  });

  afterEach(async () => {
    (UserIdentityService as any).instance = null;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const a = UserIdentityService.getInstance();
      const b = UserIdentityService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('encrypt / decrypt round-trip', () => {
    it('should decrypt to original value', () => {
      const original = 'my-secret-token-12345';
      const encrypted = service.encryptToken(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted.split('.')).toHaveLength(3); // iv.tag.body
      const decrypted = service.decryptToken(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', () => {
      const a = service.encryptToken('same');
      const b = service.encryptToken('same');
      expect(a).not.toBe(b);
    });

    it('should throw on malformed encrypted token (too few parts)', () => {
      expect(() => service.decryptToken('abc.def')).toThrow('Invalid encrypted token format');
    });

    it('should throw on empty encrypted token', () => {
      expect(() => service.decryptToken('')).toThrow('Invalid encrypted token format');
    });

    it('should throw on malformed token with empty segment', () => {
      expect(() => service.decryptToken('abc..def')).toThrow('Invalid encrypted token format');
    });
  });

  describe('user CRUD', () => {
    it('should return empty list initially', async () => {
      const users = await service.listUsers();
      expect(users).toEqual([]);
    });

    it('should create a user', async () => {
      const user = await service.createOrUpdateUser({ email: 'alice@test.com' });
      expect(user.email).toBe('alice@test.com');
      expect(user.id).toBeDefined();
      expect(user.connectedServices).toEqual([]);
    });

    it('should update existing user matched by email (case insensitive)', async () => {
      const created = await service.createOrUpdateUser({ email: 'Bob@Test.com' });
      const updated = await service.createOrUpdateUser({ email: 'bob@test.com', slackUserId: 'U123' });
      expect(updated.id).toBe(created.id);
      expect(updated.slackUserId).toBe('U123');
    });

    it('should update existing user matched by slackUserId', async () => {
      const created = await service.createOrUpdateUser({ email: 'a@b.com', slackUserId: 'U1' });
      const updated = await service.createOrUpdateUser({ email: 'new@b.com', slackUserId: 'U1' });
      expect(updated.id).toBe(created.id);
      expect(updated.email).toBe('new@b.com');
    });

    it('should get user by id', async () => {
      const created = await service.createOrUpdateUser({ email: 'x@y.com' });
      const found = await service.getUserById(created.id);
      expect(found?.email).toBe('x@y.com');
    });

    it('should return null for unknown id', async () => {
      expect(await service.getUserById('nonexistent')).toBeNull();
    });

    it('should get user by slackUserId', async () => {
      await service.createOrUpdateUser({ email: 'z@w.com', slackUserId: 'UABC' });
      const found = await service.getUserBySlackUserId('UABC');
      expect(found?.email).toBe('z@w.com');
    });

    it('should return null for unknown slackUserId', async () => {
      expect(await service.getUserBySlackUserId('UNKN')).toBeNull();
    });
  });

  describe('connectService', () => {
    it('should throw for unknown user', async () => {
      await expect(
        service.connectService('no-such-id', 'google', {
          refreshToken: 'rt',
          scopes: ['email'],
        })
      ).rejects.toThrow('User not found: no-such-id');
    });

    it('should add a connected service', async () => {
      const user = await service.createOrUpdateUser({ email: 'svc@test.com' });
      const updated = await service.connectService(user.id, 'google', {
        refreshToken: 'refresh-tok',
        accessToken: 'access-tok',
        scopes: ['email', 'calendar'],
      });
      expect(updated.connectedServices).toHaveLength(1);
      const svc = updated.connectedServices[0];
      expect(svc.provider).toBe('google');
      expect(svc.scopes).toEqual(['email', 'calendar']);
      // Tokens should be encrypted
      expect(svc.encryptedRefreshToken).not.toBe('refresh-tok');
      expect(svc.encryptedAccessToken).not.toBe('access-tok');
      // Round-trip decrypt
      expect(service.decryptToken(svc.encryptedRefreshToken)).toBe('refresh-tok');
      expect(service.decryptToken(svc.encryptedAccessToken!)).toBe('access-tok');
    });

    it('should replace existing service for same provider', async () => {
      const user = await service.createOrUpdateUser({ email: 'rep@test.com' });
      await service.connectService(user.id, 'github', {
        refreshToken: 'old',
        scopes: ['repo'],
      });
      const updated = await service.connectService(user.id, 'github', {
        refreshToken: 'new',
        scopes: ['repo', 'user'],
      });
      expect(updated.connectedServices).toHaveLength(1);
      expect(service.decryptToken(updated.connectedServices[0].encryptedRefreshToken)).toBe('new');
      expect(updated.connectedServices[0].scopes).toEqual(['repo', 'user']);
    });
  });

  describe('loadStore resilience', () => {
    it('should handle malformed JSON gracefully', async () => {
      await fs.writeFile(path.join(tmpDir, 'users.json'), 'not json', 'utf8');
      const users = await service.listUsers();
      expect(users).toEqual([]);
    });

    it('should handle missing users array in stored data', async () => {
      await fs.writeFile(path.join(tmpDir, 'users.json'), JSON.stringify({ schemaVersion: 1 }), 'utf8');
      const users = await service.listUsers();
      expect(users).toEqual([]);
    });
  });
});
