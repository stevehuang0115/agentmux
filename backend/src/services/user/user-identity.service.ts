import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
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

export class UserIdentityService {
  private static instance: UserIdentityService | null = null;
  private readonly logger: ComponentLogger;
  private readonly storePath: string;

  private constructor() {
    this.logger = LoggerService.getInstance().createComponentLogger('UserIdentityService');
    this.storePath = path.join(os.homedir(), '.crewly', 'users.json');
  }

  static getInstance(): UserIdentityService {
    if (!UserIdentityService.instance) {
      UserIdentityService.instance = new UserIdentityService();
    }
    return UserIdentityService.instance;
  }

  private async ensureStoreDir(): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
  }

  private async loadStore(): Promise<UserStore> {
    try {
      const raw = await fs.readFile(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as UserStore;
      if (!Array.isArray(parsed.users)) {
        return { schemaVersion: STORE_SCHEMA_VERSION, users: [] };
      }
      return parsed;
    } catch {
      return { schemaVersion: STORE_SCHEMA_VERSION, users: [] };
    }
  }

  private async saveStore(store: UserStore): Promise<void> {
    await this.ensureStoreDir();
    await fs.writeFile(this.storePath, JSON.stringify(store, null, 2) + '\n', 'utf8');
  }

  private getKey(): Buffer {
    const source = process.env.CREWLY_TOKEN_ENCRYPTION_KEY || process.env.CREWLY_SECRET || 'crewly-local-dev-key';
    return crypto.createHash('sha256').update(source).digest();
  }

  encryptToken(value: string): string {
    const iv = crypto.randomBytes(12);
    const key = this.getKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  decryptToken(value: string): string {
    const [ivB64, tagB64, bodyB64] = value.split('.');
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
