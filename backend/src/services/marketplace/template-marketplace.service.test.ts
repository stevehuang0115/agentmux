/**
 * Tests for Template Marketplace Service
 *
 * Covers full CRUD lifecycle: create, list, get, update, archive,
 * version management, publish workflow, and validation.
 *
 * @module services/marketplace/template-marketplace.service.test
 */

import {
	createTemplate,
	listTemplates,
	getTemplate,
	updateTemplate,
	archiveTemplate,
	addVersion,
	listVersions,
	publishTemplate,
	deleteTemplate,
	loadTemplateStore,
	saveTemplateStore,
	loadVersionStore,
	saveVersionStore,
} from './template-marketplace.service.js';
import type { TemplateStore, TemplateVersionStore } from '../../types/marketplace.types.js';

// Mock fs/promises
jest.mock('fs/promises', () => ({
	readFile: jest.fn(),
	writeFile: jest.fn().mockResolvedValue(undefined),
	mkdir: jest.fn().mockResolvedValue(undefined),
	rm: jest.fn().mockResolvedValue(undefined),
}));

const { readFile, writeFile, mkdir, rm } = require('fs/promises') as {
	readFile: jest.Mock;
	writeFile: jest.Mock;
	mkdir: jest.Mock;
	rm: jest.Mock;
};

// Mock crypto.randomUUID for deterministic tests
let uuidCounter = 0;
jest.mock('crypto', () => ({
	randomUUID: () => `test-uuid-${++uuidCounter}`,
}));

// --- Helpers ---

function mockEmptyStores(): void {
	readFile.mockRejectedValue(new Error('ENOENT'));
}

function mockStoreWithTemplates(templates: TemplateStore['templates']): void {
	const store: TemplateStore = { schemaVersion: 1, templates };
	readFile.mockImplementation((filePath: string) => {
		if (filePath.endsWith('templates.json')) {
			return Promise.resolve(JSON.stringify(store));
		}
		return Promise.reject(new Error('ENOENT'));
	});
}

function mockStoreAndVersions(
	templates: TemplateStore['templates'],
	versions: TemplateVersionStore['versions'],
): void {
	const store: TemplateStore = { schemaVersion: 1, templates };
	const vStore: TemplateVersionStore = { schemaVersion: 1, versions };
	readFile.mockImplementation((filePath: string) => {
		if (filePath.endsWith('templates.json')) {
			return Promise.resolve(JSON.stringify(store));
		}
		if (filePath.endsWith('versions.json')) {
			return Promise.resolve(JSON.stringify(vStore));
		}
		return Promise.reject(new Error('ENOENT'));
	});
}

const validInput = {
	name: 'E-Commerce UGC Video Team',
	description: 'A team template for e-commerce UGC content creation',
	author: 'Crewly',
	category: 'content-creation' as const,
	tags: ['ugc', 'video', 'ecommerce'],
	config: { roles: ['director', 'editor'], workflows: [] },
};

// --- Setup ---

beforeEach(() => {
	jest.clearAllMocks();
	uuidCounter = 0;
});

// ========================= loadTemplateStore =========================

describe('loadTemplateStore', () => {
	it('should return empty store when file does not exist', async () => {
		readFile.mockRejectedValue(new Error('ENOENT'));
		const store = await loadTemplateStore();
		expect(store.schemaVersion).toBe(1);
		expect(store.templates).toEqual([]);
	});

	it('should return parsed store from disk', async () => {
		const mockStore: TemplateStore = {
			schemaVersion: 1,
			templates: [{ id: 'test', name: 'Test' } as TemplateStore['templates'][0]],
		};
		readFile.mockResolvedValue(JSON.stringify(mockStore));
		const store = await loadTemplateStore();
		expect(store.templates).toHaveLength(1);
		expect(store.templates[0].id).toBe('test');
	});
});

// ========================= saveTemplateStore =========================

describe('saveTemplateStore', () => {
	it('should create directory and write file', async () => {
		const store: TemplateStore = { schemaVersion: 1, templates: [] };
		await saveTemplateStore(store);
		expect(mkdir).toHaveBeenCalledWith(expect.stringContaining('templates'), { recursive: true });
		expect(writeFile).toHaveBeenCalledWith(
			expect.stringContaining('templates.json'),
			expect.stringContaining('"schemaVersion": 1'),
		);
	});
});

// ========================= loadVersionStore =========================

describe('loadVersionStore', () => {
	it('should return empty store when file does not exist', async () => {
		readFile.mockRejectedValue(new Error('ENOENT'));
		const store = await loadVersionStore('test-id');
		expect(store.schemaVersion).toBe(1);
		expect(store.versions).toEqual([]);
	});
});

// ========================= createTemplate =========================

describe('createTemplate', () => {
	beforeEach(() => {
		mockEmptyStores();
	});

	it('should create a template with valid input', async () => {
		const result = await createTemplate(validInput);
		expect(result.success).toBe(true);
		expect(result.template).toBeDefined();
		expect(result.template!.name).toBe(validInput.name);
		expect(result.template!.status).toBe('draft');
		expect(result.template!.currentVersion).toBe('1.0.0');
		expect(result.version).toBeDefined();
		expect(result.version!.semver).toBe('1.0.0');
	});

	it('should set default pricing as free', async () => {
		const result = await createTemplate(validInput);
		expect(result.template!.pricing.isFree).toBe(true);
		expect(result.template!.pricing.priceUsdCents).toBe(0);
	});

	it('should accept custom pricing', async () => {
		const result = await createTemplate({
			...validInput,
			pricing: { isFree: false, priceUsdCents: 999, requiredTier: 'pro' },
		});
		expect(result.template!.pricing.isFree).toBe(false);
		expect(result.template!.pricing.priceUsdCents).toBe(999);
	});

	it('should reject missing name', async () => {
		const result = await createTemplate({ ...validInput, name: '' });
		expect(result.success).toBe(false);
		expect(result.message).toContain('name');
	});

	it('should reject missing description', async () => {
		const result = await createTemplate({ ...validInput, description: '' });
		expect(result.success).toBe(false);
		expect(result.message).toContain('description');
	});

	it('should reject missing author', async () => {
		const result = await createTemplate({ ...validInput, author: '' });
		expect(result.success).toBe(false);
		expect(result.message).toContain('author');
	});

	it('should reject invalid category', async () => {
		const result = await createTemplate({ ...validInput, category: 'invalid' as 'custom' });
		expect(result.success).toBe(false);
		expect(result.message).toContain('category');
	});

	it('should reject name exceeding max length', async () => {
		const result = await createTemplate({ ...validInput, name: 'x'.repeat(101) });
		expect(result.success).toBe(false);
		expect(result.message).toContain('maximum length');
	});

	it('should create initial version with provided config', async () => {
		const config = { roles: ['dev'], skills: ['code-review'] };
		const result = await createTemplate({ ...validInput, config });
		expect(result.version!.config).toEqual(config);
	});

	it('should accept metadata for content-type templates', async () => {
		const result = await createTemplate({
			...validInput,
			metadata: { contentType: 'ugc-video', platform: 'tiktok' },
		});
		expect(result.template!.metadata).toEqual({ contentType: 'ugc-video', platform: 'tiktok' });
	});
});

// ========================= listTemplates =========================

describe('listTemplates', () => {
	const templates = [
		{ id: 't1', name: 'Alpha', description: 'Dev template', category: 'development', status: 'published', author: 'Alice', tags: ['dev'], pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' }, currentVersion: '1.0.0', downloads: 100, rating: 4.5, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
		{ id: 't2', name: 'Beta UGC', description: 'UGC content template', category: 'content-creation', status: 'draft', author: 'Bob', tags: ['ugc'], pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' }, currentVersion: '1.0.0', downloads: 50, rating: 4.8, createdAt: '2026-02-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z' },
		{ id: 't3', name: 'Gamma', description: 'Marketing template', category: 'marketing', status: 'published', author: 'Alice', tags: ['ads'], pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' }, currentVersion: '1.0.0', downloads: 200, rating: 3.0, createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
	] as TemplateStore['templates'];

	beforeEach(() => {
		mockStoreWithTemplates(templates);
	});

	it('should return all templates when no filter', async () => {
		const result = await listTemplates();
		expect(result).toHaveLength(3);
	});

	it('should filter by category', async () => {
		const result = await listTemplates({ category: 'development' });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('t1');
	});

	it('should filter by status', async () => {
		const result = await listTemplates({ status: 'published' });
		expect(result).toHaveLength(2);
	});

	it('should filter by author', async () => {
		const result = await listTemplates({ author: 'Alice' });
		expect(result).toHaveLength(2);
	});

	it('should search by name', async () => {
		const result = await listTemplates({ search: 'UGC' });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('t2');
	});

	it('should search by tags', async () => {
		const result = await listTemplates({ search: 'ads' });
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('t3');
	});

	it('should sort by popular', async () => {
		const result = await listTemplates({ sortBy: 'popular' });
		expect(result[0].id).toBe('t3');
		expect(result[2].id).toBe('t2');
	});

	it('should sort by rating', async () => {
		const result = await listTemplates({ sortBy: 'rating' });
		expect(result[0].id).toBe('t2');
	});

	it('should sort by newest (default)', async () => {
		const result = await listTemplates();
		expect(result[0].id).toBe('t3');
	});
});

// ========================= getTemplate =========================

describe('getTemplate', () => {
	it('should return template by ID', async () => {
		mockStoreWithTemplates([{ id: 'test-1', name: 'Test' } as TemplateStore['templates'][0]]);
		const result = await getTemplate('test-1');
		expect(result).not.toBeNull();
		expect(result!.name).toBe('Test');
	});

	it('should return null for missing template', async () => {
		mockStoreWithTemplates([]);
		const result = await getTemplate('missing');
		expect(result).toBeNull();
	});
});

// ========================= updateTemplate =========================

describe('updateTemplate', () => {
	const existingTemplate = {
		id: 'tpl-1',
		name: 'Original',
		description: 'Original desc',
		author: 'Test',
		category: 'development' as const,
		tags: ['test'],
		pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' as const },
		status: 'draft' as const,
		currentVersion: '1.0.0',
		downloads: 0,
		rating: 0,
		createdAt: '2026-01-01T00:00:00Z',
		updatedAt: '2026-01-01T00:00:00Z',
	};

	it('should update template name', async () => {
		mockStoreWithTemplates([existingTemplate]);
		const result = await updateTemplate('tpl-1', { name: 'Updated Name' });
		expect(result.success).toBe(true);
		expect(result.template!.name).toBe('Updated Name');
	});

	it('should update template description', async () => {
		mockStoreWithTemplates([existingTemplate]);
		const result = await updateTemplate('tpl-1', { description: 'New desc' });
		expect(result.success).toBe(true);
		expect(result.template!.description).toBe('New desc');
	});

	it('should return error for missing template', async () => {
		mockStoreWithTemplates([]);
		const result = await updateTemplate('missing', { name: 'x' });
		expect(result.success).toBe(false);
		expect(result.message).toContain('not found');
	});

	it('should not update archived template', async () => {
		mockStoreWithTemplates([{ ...existingTemplate, status: 'archived' as const }]);
		const result = await updateTemplate('tpl-1', { name: 'x' });
		expect(result.success).toBe(false);
		expect(result.message).toContain('archived');
	});

	it('should reject invalid category', async () => {
		mockStoreWithTemplates([existingTemplate]);
		const result = await updateTemplate('tpl-1', { category: 'invalid' as 'custom' });
		expect(result.success).toBe(false);
		expect(result.message).toContain('category');
	});

	it('should reject empty name', async () => {
		mockStoreWithTemplates([existingTemplate]);
		const result = await updateTemplate('tpl-1', { name: '' });
		expect(result.success).toBe(false);
	});
});

// ========================= archiveTemplate =========================

describe('archiveTemplate', () => {
	it('should archive a template', async () => {
		mockStoreWithTemplates([{
			id: 'tpl-1', name: 'Test', status: 'draft' as const,
			description: '', author: '', category: 'custom' as const, tags: [],
			pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' as const },
			currentVersion: '1.0.0', downloads: 0, rating: 0,
			createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
		}]);
		const result = await archiveTemplate('tpl-1');
		expect(result.success).toBe(true);
		expect(result.template!.status).toBe('archived');
	});

	it('should fail if template not found', async () => {
		mockStoreWithTemplates([]);
		const result = await archiveTemplate('missing');
		expect(result.success).toBe(false);
		expect(result.message).toContain('not found');
	});

	it('should fail if already archived', async () => {
		mockStoreWithTemplates([{
			id: 'tpl-1', name: 'Test', status: 'archived' as const,
			description: '', author: '', category: 'custom' as const, tags: [],
			pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' as const },
			currentVersion: '1.0.0', downloads: 0, rating: 0,
			createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
		}]);
		const result = await archiveTemplate('tpl-1');
		expect(result.success).toBe(false);
		expect(result.message).toContain('already archived');
	});
});

// ========================= addVersion =========================

describe('addVersion', () => {
	const template = {
		id: 'tpl-1', name: 'Test', status: 'draft' as const,
		description: '', author: '', category: 'custom' as const, tags: [],
		pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' as const },
		currentVersion: '1.0.0', downloads: 0, rating: 0,
		createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
	};

	it('should add a version successfully', async () => {
		mockStoreAndVersions([template], []);
		const result = await addVersion('tpl-1', {
			semver: '1.1.0',
			config: { roles: ['dev'] },
			changelog: 'Added dev role',
		});
		expect(result.success).toBe(true);
		expect(result.version!.semver).toBe('1.1.0');
		expect(result.template!.currentVersion).toBe('1.1.0');
	});

	it('should fail with invalid semver', async () => {
		mockStoreAndVersions([template], []);
		const result = await addVersion('tpl-1', {
			semver: 'invalid',
			config: {},
			changelog: 'test',
		});
		expect(result.success).toBe(false);
		expect(result.message).toContain('semver');
	});

	it('should fail with duplicate semver', async () => {
		mockStoreAndVersions([template], [{
			versionId: 'v1', templateId: 'tpl-1', semver: '1.1.0',
			config: {}, changelog: 'first', createdAt: '2026-01-01T00:00:00Z',
		}]);
		const result = await addVersion('tpl-1', {
			semver: '1.1.0',
			config: {},
			changelog: 'duplicate',
		});
		expect(result.success).toBe(false);
		expect(result.message).toContain('already exists');
	});

	it('should fail for missing template', async () => {
		mockStoreAndVersions([], []);
		const result = await addVersion('missing', {
			semver: '1.0.0',
			config: {},
			changelog: 'test',
		});
		expect(result.success).toBe(false);
		expect(result.message).toContain('not found');
	});

	it('should fail for archived template', async () => {
		mockStoreAndVersions([{ ...template, status: 'archived' as const }], []);
		const result = await addVersion('tpl-1', {
			semver: '2.0.0',
			config: {},
			changelog: 'test',
		});
		expect(result.success).toBe(false);
		expect(result.message).toContain('archived');
	});

	it('should reset published status to draft when adding version', async () => {
		mockStoreAndVersions([{ ...template, status: 'published' as const }], []);
		const result = await addVersion('tpl-1', {
			semver: '2.0.0',
			config: { roles: ['new'] },
			changelog: 'Major update',
		});
		expect(result.success).toBe(true);
		expect(result.template!.status).toBe('draft');
	});

	it('should reject missing changelog', async () => {
		mockStoreAndVersions([template], []);
		const result = await addVersion('tpl-1', {
			semver: '1.1.0',
			config: {},
			changelog: '',
		});
		expect(result.success).toBe(false);
		expect(result.message).toContain('changelog');
	});
});

// ========================= listVersions =========================

describe('listVersions', () => {
	it('should return null for missing template', async () => {
		mockStoreAndVersions([], []);
		const result = await listVersions('missing');
		expect(result).toBeNull();
	});

	it('should return sorted versions (newest first)', async () => {
		const template = {
			id: 'tpl-1', name: 'Test', status: 'draft' as const,
			description: '', author: '', category: 'custom' as const, tags: [],
			pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' as const },
			currentVersion: '1.1.0', downloads: 0, rating: 0,
			createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
		};
		mockStoreAndVersions([template], [
			{ versionId: 'v1', templateId: 'tpl-1', semver: '1.0.0', config: {}, changelog: 'Init', createdAt: '2026-01-01T00:00:00Z' },
			{ versionId: 'v2', templateId: 'tpl-1', semver: '1.1.0', config: {}, changelog: 'Update', createdAt: '2026-02-01T00:00:00Z' },
		]);
		const result = await listVersions('tpl-1');
		expect(result).toHaveLength(2);
		expect(result![0].semver).toBe('1.1.0');
		expect(result![1].semver).toBe('1.0.0');
	});
});

// ========================= publishTemplate =========================

describe('publishTemplate', () => {
	function makeTemplate(status: 'draft' | 'review' | 'published' | 'archived') {
		return {
			id: 'tpl-1', name: 'Test', status,
			description: '', author: '', category: 'custom' as const, tags: [],
			pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' as const },
			currentVersion: '1.0.0', downloads: 0, rating: 0,
			createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
		};
	}

	it('should move draft to review', async () => {
		mockStoreWithTemplates([makeTemplate('draft')]);
		const result = await publishTemplate('tpl-1');
		expect(result.success).toBe(true);
		expect(result.template!.status).toBe('review');
	});

	it('should move review to published', async () => {
		mockStoreWithTemplates([makeTemplate('review')]);
		const result = await publishTemplate('tpl-1');
		expect(result.success).toBe(true);
		expect(result.template!.status).toBe('published');
	});

	it('should fail for already published', async () => {
		mockStoreWithTemplates([makeTemplate('published')]);
		const result = await publishTemplate('tpl-1');
		expect(result.success).toBe(false);
		expect(result.message).toContain('already published');
	});

	it('should fail for archived', async () => {
		mockStoreWithTemplates([makeTemplate('archived')]);
		const result = await publishTemplate('tpl-1');
		expect(result.success).toBe(false);
		expect(result.message).toContain('archived');
	});

	it('should fail for missing template', async () => {
		mockStoreWithTemplates([]);
		const result = await publishTemplate('missing');
		expect(result.success).toBe(false);
		expect(result.message).toContain('not found');
	});
});

// ========================= deleteTemplate =========================

describe('deleteTemplate', () => {
	it('should delete template and remove directory', async () => {
		mockStoreWithTemplates([{
			id: 'tpl-1', name: 'Test', status: 'draft' as const,
			description: '', author: '', category: 'custom' as const, tags: [],
			pricing: { isFree: true, priceUsdCents: 0, requiredTier: 'free' as const },
			currentVersion: '1.0.0', downloads: 0, rating: 0,
			createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
		}]);
		const result = await deleteTemplate('tpl-1');
		expect(result.success).toBe(true);
		expect(rm).toHaveBeenCalledWith(
			expect.stringContaining('tpl-1'),
			{ recursive: true, force: true },
		);
	});

	it('should fail for missing template', async () => {
		mockStoreWithTemplates([]);
		const result = await deleteTemplate('missing');
		expect(result.success).toBe(false);
		expect(result.message).toContain('not found');
	});
});
