import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { CREWLY_CONSTANTS } from '../../constants.js';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';

export type ConnectedProvider = 'google' | 'github' | 'calendar' | 'drive';

export interface ConnectedService {
  provider: ConnectedProvider;
  encryptedRefreshToken: string;
  encryptedAccessToken?: string;
  scopes: string[];
  connectedAt: string;
}

export interface UserIdentity {
  id: string;
  email: string;
  slackUserId?: string;
  connectedServices: ConnectedService[];
  createdAt: string;
  updatedAt: string;
}

interface UserStore {
  schemaVersion: number;
  users: UserIdentity[];
}

const STORE_SCHEMA_VERSION = 1;

/**
 * Service for managing user identities and encrypted service tokens.
 *
 * Uses a file-backed JSON store with an in-memory cache for reads.
 * Tokens are encrypted with AES-256-GCM using a key derived from
 * environment variables.
 */
export class UserIdentityService {
  private static instance: UserIdentityService | null = null;
  private readonly logger: ComponentLogger;
  private readonly storePath: string;
  /** Cached encryption key (derived once from env) */
  private cachedKey: Buffer | null = null;
  /** In-memory cache of the user store to avoid repeated disk reads */
  private storeCache: UserStore | null = null;

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('UserIdentityService');
    this.storePath = path.join(os.homedir(), CREWLY_CONSTANTS.PATHS.CREWLY_HOME, 'users.json');
  }

  static getInstance(): UserIdentityService {
    if (!UserIdentityService.instance) {
      UserIdentityService.instance = new UserIdentityService();
    }
    return UserIdentityService.instance;
  }

  /**
   * Reset the singleton instance (for testing).
   */
  static resetInstance(): void {
    UserIdentityService.instance = null;
  }

  private async ensureStoreDir(): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
  }

  /**
   * Load the user store from disk, using in-memory cache when available.
   *
   * @returns The parsed user store
   */
  private async loadStore(): Promise<UserStore> {
    if (this.storeCache) {
      return this.storeCache;
    }
    try {
      const raw = await fs.readFile(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as UserStore;
      if (!Array.isArray(parsed.users)) {
        this.storeCache = { schemaVersion: STORE_SCHEMA_VERSION, users: [] };
        return this.storeCache;
      }
      this.storeCache = parsed;
      return this.storeCache;
    } catch {
      this.storeCache = { schemaVersion: STORE_SCHEMA_VERSION, users: [] };
      return this.storeCache;
    }
  }

  /**
   * Persist the user store to disk using atomic write (temp + rename).
   *
   * @param store - The store data to persist
   */
  private async saveStore(store: UserStore): Promise<void> {
    await this.ensureStoreDir();
    const tmpPath = `${this.storePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(store, null, 2) + '\n', 'utf8');
    await fs.rename(tmpPath, this.storePath);
    this.storeCache = store;
  }

  /**
   * Derive the AES-256 encryption key from environment variables.
   * Caches the result to avoid recomputing SHA-256 on every call.
   *
   * @returns 32-byte key buffer
   */
  private getKey(): Buffer {
    if (this.cachedKey) {
      return this.cachedKey;
    }
    const source = process.env.CREWLY_TOKEN_ENCRYPTION_KEY || process.env.CREWLY_SECRET;
    if (!source) {
      this.logger.warn('No CREWLY_TOKEN_ENCRYPTION_KEY or CREWLY_SECRET set — using insecure fallback key');
    }
    this.cachedKey = crypto.createHash('sha256').update(source || 'crewly-local-dev-key').digest();
    return this.cachedKey;
  }

  /**
   * Encrypt a plaintext token using AES-256-GCM.
   *
   * @param value - The plaintext token
   * @returns Encrypted string in the format `iv.tag.ciphertext` (base64)
   */
  encryptToken(value: string): string {
    const iv = crypto.randomBytes(12);
    const key = this.getKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  /**
   * Decrypt an encrypted token string produced by {@link encryptToken}.
   *
   * @param value - Encrypted string in `iv.tag.ciphertext` format
   * @returns The decrypted plaintext
   * @throws Error if the token format is invalid or decryption fails
   */
  decryptToken(value: string): string {
    const parts = value.split('.');
    if (parts.length !== 3 || parts.some((p) => !p)) {
      throw new Error('Invalid encrypted token format: expected iv.tag.ciphertext');
    }
    const [ivB64, tagB64, bodyB64] = parts;
    const key = this.getKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(bodyB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  async listUsers(): Promise<UserIdentity[]> {
    const store = await this.loadStore();
    return store.users;
  }

  async getUserById(id: string): Promise<UserIdentity | null> {
    const store = await this.loadStore();
    return store.users.find((u) => u.id === id) || null;
  }

  async getUserBySlackUserId(slackUserId: string): Promise<UserIdentity | null> {
    const store = await this.loadStore();
    return store.users.find((u) => u.slackUserId === slackUserId) || null;
  }

  async createOrUpdateUser(input: { email: string; slackUserId?: string }): Promise<UserIdentity> {
    const store = await this.loadStore();
    const now = new Date().toISOString();
    const existing = store.users.find(
      (u) => u.email.toLowerCase() === input.email.toLowerCase() || (input.slackUserId && u.slackUserId === input.slackUserId)
    );

    if (existing) {
      existing.email = input.email;
      if (input.slackUserId) {
        existing.slackUserId = input.slackUserId;
      }
      existing.updatedAt = now;
      await this.saveStore(store);
      return existing;
    }

    const created: UserIdentity = {
      id: crypto.randomUUID(),
      email: input.email,
      slackUserId: input.slackUserId,
      connectedServices: [],
      createdAt: now,
      updatedAt: now,
    };
    store.users.push(created);
    await this.saveStore(store);
    return created;
  }

  async connectService(
    userId: string,
    provider: ConnectedProvider,
    tokens: { refreshToken: string; accessToken?: string; scopes: string[] }
  ): Promise<UserIdentity> {
    const store = await this.loadStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const now = new Date().toISOString();
    const next: ConnectedService = {
      provider,
      encryptedRefreshToken: this.encryptToken(tokens.refreshToken),
      encryptedAccessToken: tokens.accessToken ? this.encryptToken(tokens.accessToken) : undefined,
      scopes: tokens.scopes,
      connectedAt: now,
    };

    user.connectedServices = user.connectedServices.filter((s) => s.provider !== provider);
    user.connectedServices.push(next);
    user.updatedAt = now;
    await this.saveStore(store);

    this.logger.info('Connected service for user', { userId, provider, scopeCount: tokens.scopes.length });
    return user;
  }
}
