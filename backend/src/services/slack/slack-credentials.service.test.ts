/**
 * Tests for the Slack credentials persistence service.
 *
 * Validates save/load round-trips, deletion, and file permissions.
 *
 * @module services/slack/slack-credentials.service.test
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
	saveSlackCredentials,
	loadSlackCredentials,
	deleteSlackCredentials,
	hasSavedCredentials,
} from './slack-credentials.service.js';

// Use a temp dir to avoid touching the real ~/.crewly
let tempDir: string;
const originalHome = process.env.HOME;

beforeEach(async () => {
	tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-slack-creds-test-'));
	process.env.HOME = tempDir;
	// Create .crewly directory
	await fs.mkdir(path.join(tempDir, '.crewly'), { recursive: true });
});

afterEach(async () => {
	process.env.HOME = originalHome;
	await fs.rm(tempDir, { recursive: true, force: true });
});

const mockConfig = {
	botToken: 'xoxb-test-bot-token',
	appToken: 'xapp-test-app-token',
	signingSecret: 'test-signing-secret',
	defaultChannelId: 'C12345',
	allowedUserIds: ['U111', 'U222'],
	socketMode: true as const,
};

describe('saveSlackCredentials', () => {
	it('should save credentials to disk', async () => {
		await saveSlackCredentials(mockConfig);

		const filePath = path.join(tempDir, '.crewly', 'slack-credentials.json');
		const raw = await fs.readFile(filePath, 'utf-8');
		const saved = JSON.parse(raw);

		expect(saved.botToken).toBe('xoxb-test-bot-token');
		expect(saved.appToken).toBe('xapp-test-app-token');
		expect(saved.signingSecret).toBe('test-signing-secret');
		expect(saved.defaultChannelId).toBe('C12345');
		expect(saved.allowedUserIds).toEqual(['U111', 'U222']);
	});

	it('should not persist socketMode field', async () => {
		await saveSlackCredentials(mockConfig);

		const filePath = path.join(tempDir, '.crewly', 'slack-credentials.json');
		const raw = await fs.readFile(filePath, 'utf-8');
		const saved = JSON.parse(raw);

		expect(saved).not.toHaveProperty('socketMode');
	});

	it('should set file permissions to 0600', async () => {
		await saveSlackCredentials(mockConfig);

		const filePath = path.join(tempDir, '.crewly', 'slack-credentials.json');
		const stats = await fs.stat(filePath);
		// Check owner-only read/write (0600 = 0o600 = 384 decimal)
		const mode = stats.mode & 0o777;
		expect(mode).toBe(0o600);
	});
});

describe('loadSlackCredentials', () => {
	it('should load saved credentials', async () => {
		await saveSlackCredentials(mockConfig);
		const loaded = await loadSlackCredentials();

		expect(loaded).not.toBeNull();
		expect(loaded!.botToken).toBe('xoxb-test-bot-token');
		expect(loaded!.appToken).toBe('xapp-test-app-token');
		expect(loaded!.signingSecret).toBe('test-signing-secret');
		expect(loaded!.socketMode).toBe(true);
	});

	it('should return null when no credentials file exists', async () => {
		const loaded = await loadSlackCredentials();
		expect(loaded).toBeNull();
	});

	it('should return null for incomplete credentials', async () => {
		const filePath = path.join(tempDir, '.crewly', 'slack-credentials.json');
		await fs.writeFile(filePath, JSON.stringify({ botToken: 'xoxb-only' }));

		const loaded = await loadSlackCredentials();
		expect(loaded).toBeNull();
	});

	it('should return null for corrupt JSON', async () => {
		const filePath = path.join(tempDir, '.crewly', 'slack-credentials.json');
		await fs.writeFile(filePath, 'not valid json {{{');

		const loaded = await loadSlackCredentials();
		expect(loaded).toBeNull();
	});
});

describe('deleteSlackCredentials', () => {
	it('should delete the credentials file', async () => {
		await saveSlackCredentials(mockConfig);
		expect(await hasSavedCredentials()).toBe(true);

		await deleteSlackCredentials();
		expect(await hasSavedCredentials()).toBe(false);
	});

	it('should not throw when no file exists', async () => {
		await expect(deleteSlackCredentials()).resolves.not.toThrow();
	});
});

describe('hasSavedCredentials', () => {
	it('should return false when no file exists', async () => {
		expect(await hasSavedCredentials()).toBe(false);
	});

	it('should return true when file exists', async () => {
		await saveSlackCredentials(mockConfig);
		expect(await hasSavedCredentials()).toBe(true);
	});
});
