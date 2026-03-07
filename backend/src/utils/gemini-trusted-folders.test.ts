/**
 * Tests for the Gemini CLI trusted folders utility.
 *
 * Uses a real temp directory with the trustedFoldersPath override param.
 *
 * @module utils/gemini-trusted-folders.test
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import * as os from 'os';
import {
	addGeminiTrustedFolders,
	getProjectTrustPaths,
	getDefaultTrustedFoldersPath,
	type TrustedFoldersLogger,
} from './gemini-trusted-folders.js';

const TEST_DIR = path.join(
	os.tmpdir(),
	`crewly-test-gemini-trust-${Date.now()}-${Math.random().toString(36).slice(2)}`
);
const TRUSTED_FILE = path.join(TEST_DIR, '.gemini', 'trustedFolders.json');

/**
 * Helper: create a mock logger for testing.
 */
function makeMockLogger(): TrustedFoldersLogger & { warn: jest.Mock; info: jest.Mock } {
	return {
		warn: jest.fn(),
		info: jest.fn(),
	};
}

/**
 * Helper: read and parse the trustedFolders.json from the temp dir.
 */
async function readTrustedFolders(): Promise<Record<string, string>> {
	const raw = await fs.readFile(TRUSTED_FILE, 'utf8');
	return JSON.parse(raw);
}

beforeAll(() => {
	mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
	// Clean up the .gemini dir between tests
	const geminiDir = path.join(TEST_DIR, '.gemini');
	if (existsSync(geminiDir)) {
		rmSync(geminiDir, { recursive: true, force: true });
	}
});

afterAll(() => {
	rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('getDefaultTrustedFoldersPath', () => {
	it('should return path under home directory', () => {
		const result = getDefaultTrustedFoldersPath();
		expect(result).toBe(path.join(os.homedir(), '.gemini', 'trustedFolders.json'));
	});
});

describe('addGeminiTrustedFolders', () => {
	it('should return false for empty paths array', async () => {
		const result = await addGeminiTrustedFolders([], undefined, TRUSTED_FILE);
		expect(result).toBe(false);
		expect(existsSync(TRUSTED_FILE)).toBe(false);
	});

	it('should create file and add path when file does not exist', async () => {
		const result = await addGeminiTrustedFolders(['/projects/my-app'], undefined, TRUSTED_FILE);

		expect(result).toBe(true);
		expect(existsSync(TRUSTED_FILE)).toBe(true);

		const content = await readTrustedFolders();
		expect(content[path.resolve('/projects/my-app')]).toBe('TRUST_FOLDER');
	});

	it('should create parent directory if it does not exist', async () => {
		const geminiDir = path.join(TEST_DIR, '.gemini');
		expect(existsSync(geminiDir)).toBe(false);

		await addGeminiTrustedFolders(['/some/path'], undefined, TRUSTED_FILE);

		expect(existsSync(geminiDir)).toBe(true);
	});

	it('should merge with existing trusted folders', async () => {
		mkdirSync(path.dirname(TRUSTED_FILE), { recursive: true });
		writeFileSync(TRUSTED_FILE, JSON.stringify({ '/already/trusted': 'TRUST_FOLDER' }));

		const result = await addGeminiTrustedFolders(['/new/project'], undefined, TRUSTED_FILE);

		expect(result).toBe(true);
		const content = await readTrustedFolders();
		expect(content['/already/trusted']).toBe('TRUST_FOLDER');
		expect(content[path.resolve('/new/project')]).toBe('TRUST_FOLDER');
	});

	it('should return false when all paths are already trusted', async () => {
		const resolvedPath = path.resolve('/projects/my-app');
		mkdirSync(path.dirname(TRUSTED_FILE), { recursive: true });
		writeFileSync(TRUSTED_FILE, JSON.stringify({ [resolvedPath]: 'TRUST_FOLDER' }));

		const result = await addGeminiTrustedFolders(['/projects/my-app'], undefined, TRUSTED_FILE);

		expect(result).toBe(false);
	});

	it('should deduplicate input paths', async () => {
		const result = await addGeminiTrustedFolders(
			['/projects/a', '/projects/a', '/projects/a'],
			undefined,
			TRUSTED_FILE
		);

		expect(result).toBe(true);
		const content = await readTrustedFolders();
		const keys = Object.keys(content);
		expect(keys).toHaveLength(1);
	});

	it('should handle multiple new paths', async () => {
		const result = await addGeminiTrustedFolders(
			['/projects/a', '/projects/b'],
			undefined,
			TRUSTED_FILE
		);

		expect(result).toBe(true);
		const content = await readTrustedFolders();
		expect(content[path.resolve('/projects/a')]).toBe('TRUST_FOLDER');
		expect(content[path.resolve('/projects/b')]).toBe('TRUST_FOLDER');
	});

	it('should reset malformed file and log warning', async () => {
		mkdirSync(path.dirname(TRUSTED_FILE), { recursive: true });
		writeFileSync(TRUSTED_FILE, 'not valid json {{{');
		const logger = makeMockLogger();

		const result = await addGeminiTrustedFolders(['/projects/new'], logger, TRUSTED_FILE);

		expect(result).toBe(true);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.stringContaining('Failed to read'),
			expect.any(Object)
		);
		const content = await readTrustedFolders();
		expect(content[path.resolve('/projects/new')]).toBe('TRUST_FOLDER');
	});

	it('should reset when file contains non-object JSON (array)', async () => {
		mkdirSync(path.dirname(TRUSTED_FILE), { recursive: true });
		writeFileSync(TRUSTED_FILE, '["not", "an", "object"]');

		const result = await addGeminiTrustedFolders(['/projects/new'], undefined, TRUSTED_FILE);

		expect(result).toBe(true);
		const content = await readTrustedFolders();
		expect(content[path.resolve('/projects/new')]).toBe('TRUST_FOLDER');
	});

	it('should log info on successful update', async () => {
		const logger = makeMockLogger();

		await addGeminiTrustedFolders(['/projects/x'], logger, TRUSTED_FILE);

		expect(logger.info).toHaveBeenCalledWith(
			'Gemini trusted folders updated',
			expect.objectContaining({ trustedFoldersPath: TRUSTED_FILE })
		);
	});

	it('should work without a logger', async () => {
		const result = await addGeminiTrustedFolders(['/projects/z'], undefined, TRUSTED_FILE);
		expect(result).toBe(true);
		expect(existsSync(TRUSTED_FILE)).toBe(true);
	});

	it('should write well-formatted JSON with trailing newline', async () => {
		await addGeminiTrustedFolders(['/projects/fmt'], undefined, TRUSTED_FILE);

		const raw = await fs.readFile(TRUSTED_FILE, 'utf8');
		expect(raw.endsWith('\n')).toBe(true);
		// Should be indented with 2 spaces (pretty-printed)
		expect(raw).toContain('  ');
	});
});

describe('getProjectTrustPaths', () => {
	it('should return project path and parent directory', () => {
		const paths = getProjectTrustPaths('/home/user/projects/my-app');
		expect(paths).toContain(path.resolve('/home/user/projects/my-app'));
		expect(paths).toContain(path.resolve('/home/user/projects'));
		expect(paths).toHaveLength(2);
	});

	it('should deduplicate when project is at root', () => {
		const paths = getProjectTrustPaths('/');
		expect(paths).toHaveLength(1);
		expect(paths[0]).toBe('/');
	});

	it('should resolve relative paths', () => {
		const paths = getProjectTrustPaths('relative/path');
		for (const p of paths) {
			expect(path.isAbsolute(p)).toBe(true);
		}
	});

	it('should include both project and parent for nested path', () => {
		const paths = getProjectTrustPaths('/a/b/c');
		expect(paths).toContain('/a/b/c');
		expect(paths).toContain('/a/b');
	});
});
