/**
 * Template Marketplace Service
 *
 * Full CRUD lifecycle for team configuration templates.
 * Templates are stored as JSON files under ~/.crewly/marketplace/templates/.
 * Each template has a store entry and a versions subdirectory containing
 * version history with config JSON and changelogs.
 *
 * Supports content-type templates (e.g. e-commerce UGC video team)
 * through the metadata field and category system.
 *
 * @module services/marketplace/template-marketplace.service
 */

import path from 'path';
import { homedir } from 'os';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { randomUUID } from 'crypto';
import type {
	MarketplaceTemplate,
	TemplateVersion,
	TemplateStore,
	TemplateVersionStore,
	TemplateFilter,
	TemplateOperationResult,
	PublishStatus,
	TemplateCategory,
	TemplatePricing,
} from '../../types/marketplace.types.js';
import { MARKETPLACE_CONSTANTS, TEMPLATE_MARKETPLACE_CONSTANTS } from '../../constants.js';

const CREWLY_HOME = path.join(homedir(), '.crewly');
const MARKETPLACE_DIR = path.join(CREWLY_HOME, MARKETPLACE_CONSTANTS.DIR_NAME);
const TEMPLATES_DIR = path.join(MARKETPLACE_DIR, TEMPLATE_MARKETPLACE_CONSTANTS.TEMPLATES_DIR);
const STORE_PATH = path.join(TEMPLATES_DIR, TEMPLATE_MARKETPLACE_CONSTANTS.STORE_FILE);

/** Semver pattern (major.minor.patch) */
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** Valid template categories */
const VALID_CATEGORIES: TemplateCategory[] = [
	'content-creation', 'development', 'marketing', 'operations',
	'research', 'support', 'design', 'sales', 'custom',
];

/** Valid publish statuses */
const VALID_STATUSES: PublishStatus[] = ['draft', 'review', 'published', 'archived'];

// ========================= STORE I/O =========================

/**
 * Loads the template store from disk.
 *
 * Returns an empty store if the file does not exist or cannot be parsed.
 *
 * @returns The template store
 */
export async function loadTemplateStore(): Promise<TemplateStore> {
	try {
		const data = await readFile(STORE_PATH, 'utf-8');
		return JSON.parse(data) as TemplateStore;
	} catch {
		return { schemaVersion: TEMPLATE_MARKETPLACE_CONSTANTS.SCHEMA_VERSION, templates: [] };
	}
}

/**
 * Saves the template store to disk.
 *
 * Creates the templates directory if it does not exist.
 *
 * @param store - The store to persist
 */
export async function saveTemplateStore(store: TemplateStore): Promise<void> {
	await mkdir(TEMPLATES_DIR, { recursive: true });
	await writeFile(STORE_PATH, JSON.stringify(store, null, 2) + '\n');
}

/**
 * Returns the path to a template's version store file.
 *
 * @param templateId - The template ID
 * @returns Absolute path to the version store JSON file
 */
function getVersionStorePath(templateId: string): string {
	return path.join(
		TEMPLATES_DIR,
		templateId,
		TEMPLATE_MARKETPLACE_CONSTANTS.VERSIONS_DIR,
		TEMPLATE_MARKETPLACE_CONSTANTS.VERSIONS_FILE,
	);
}

/**
 * Loads the version store for a specific template.
 *
 * Returns an empty store if the file does not exist or cannot be parsed.
 *
 * @param templateId - The template ID
 * @returns The version store for the template
 */
export async function loadVersionStore(templateId: string): Promise<TemplateVersionStore> {
	try {
		const data = await readFile(getVersionStorePath(templateId), 'utf-8');
		return JSON.parse(data) as TemplateVersionStore;
	} catch {
		return { schemaVersion: TEMPLATE_MARKETPLACE_CONSTANTS.SCHEMA_VERSION, versions: [] };
	}
}

/**
 * Saves the version store for a specific template.
 *
 * Creates the template versions directory if it does not exist.
 *
 * @param templateId - The template ID
 * @param store - The version store to persist
 */
export async function saveVersionStore(templateId: string, store: TemplateVersionStore): Promise<void> {
	const versionDir = path.join(
		TEMPLATES_DIR,
		templateId,
		TEMPLATE_MARKETPLACE_CONSTANTS.VERSIONS_DIR,
	);
	await mkdir(versionDir, { recursive: true });
	await writeFile(getVersionStorePath(templateId), JSON.stringify(store, null, 2) + '\n');
}

// ========================= VALIDATION =========================

/**
 * Validates a template name.
 *
 * @param name - The name to validate
 * @returns Error message or null if valid
 */
function validateName(name: string): string | null {
	if (!name || typeof name !== 'string') return 'name is required';
	if (name.trim().length === 0) return 'name cannot be empty';
	if (name.length > TEMPLATE_MARKETPLACE_CONSTANTS.MAX_NAME_LENGTH) {
		return `name exceeds maximum length of ${TEMPLATE_MARKETPLACE_CONSTANTS.MAX_NAME_LENGTH}`;
	}
	return null;
}

/**
 * Validates template creation input.
 *
 * @param input - The input to validate
 * @returns Array of validation error messages (empty if valid)
 */
function validateCreateInput(input: {
	name?: string;
	description?: string;
	author?: string;
	category?: string;
	tags?: string[];
}): string[] {
	const errors: string[] = [];

	const nameErr = validateName(input.name || '');
	if (nameErr) errors.push(nameErr);

	if (!input.description || typeof input.description !== 'string' || input.description.trim().length === 0) {
		errors.push('description is required');
	} else if (input.description.length > TEMPLATE_MARKETPLACE_CONSTANTS.MAX_DESCRIPTION_LENGTH) {
		errors.push(`description exceeds maximum length of ${TEMPLATE_MARKETPLACE_CONSTANTS.MAX_DESCRIPTION_LENGTH}`);
	}

	if (!input.author || typeof input.author !== 'string' || input.author.trim().length === 0) {
		errors.push('author is required');
	}

	if (!input.category || !VALID_CATEGORIES.includes(input.category as TemplateCategory)) {
		errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
	}

	if (input.tags) {
		if (!Array.isArray(input.tags)) {
			errors.push('tags must be an array');
		} else {
			if (input.tags.length > TEMPLATE_MARKETPLACE_CONSTANTS.MAX_TAGS) {
				errors.push(`tags cannot exceed ${TEMPLATE_MARKETPLACE_CONSTANTS.MAX_TAGS}`);
			}
			for (const tag of input.tags) {
				if (typeof tag !== 'string' || tag.length > TEMPLATE_MARKETPLACE_CONSTANTS.MAX_TAG_LENGTH) {
					errors.push(`each tag must be a string of at most ${TEMPLATE_MARKETPLACE_CONSTANTS.MAX_TAG_LENGTH} characters`);
					break;
				}
			}
		}
	}

	return errors;
}

// ========================= CRUD OPERATIONS =========================

/**
 * Creates a new marketplace template in draft status.
 *
 * Generates a unique ID, sets initial metadata, and creates
 * the first version (1.0.0) with the provided config.
 *
 * @param input - Template creation input
 * @returns Operation result with the created template
 */
export async function createTemplate(input: {
	name: string;
	description: string;
	author: string;
	category: TemplateCategory;
	tags?: string[];
	pricing?: TemplatePricing;
	config?: Record<string, unknown>;
	icon?: string;
	metadata?: Record<string, unknown>;
}): Promise<TemplateOperationResult> {
	const errors = validateCreateInput(input);
	if (errors.length > 0) {
		return { success: false, message: `Validation failed: ${errors.join('; ')}` };
	}

	const now = new Date().toISOString();
	const templateId = randomUUID();

	const template: MarketplaceTemplate = {
		id: templateId,
		name: input.name,
		description: input.description,
		author: input.author,
		category: input.category,
		tags: input.tags || [],
		pricing: input.pricing || { isFree: true, priceUsdCents: 0, requiredTier: 'free' },
		status: 'draft',
		currentVersion: '1.0.0',
		downloads: 0,
		rating: 0,
		createdAt: now,
		updatedAt: now,
		icon: input.icon,
		metadata: input.metadata,
	};

	// Save to store
	const store = await loadTemplateStore();
	store.templates.push(template);
	await saveTemplateStore(store);

	// Create initial version
	const version: TemplateVersion = {
		versionId: randomUUID(),
		templateId,
		semver: '1.0.0',
		config: input.config || {},
		changelog: 'Initial version',
		createdAt: now,
	};

	const versionStore: TemplateVersionStore = {
		schemaVersion: TEMPLATE_MARKETPLACE_CONSTANTS.SCHEMA_VERSION,
		versions: [version],
	};
	await saveVersionStore(templateId, versionStore);

	return {
		success: true,
		message: `Template "${template.name}" created`,
		template,
		version,
	};
}

/**
 * Lists templates with optional filtering and sorting.
 *
 * Supports filtering by category, status, author, and free-text search.
 * Results are sorted by the specified sort option (default: newest).
 *
 * @param filter - Optional filter criteria
 * @returns Filtered and sorted templates
 */
export async function listTemplates(filter?: TemplateFilter): Promise<MarketplaceTemplate[]> {
	const store = await loadTemplateStore();
	let templates = [...store.templates];

	if (filter?.category) {
		templates = templates.filter((t) => t.category === filter.category);
	}
	if (filter?.status) {
		templates = templates.filter((t) => t.status === filter.status);
	}
	if (filter?.author) {
		templates = templates.filter((t) => t.author === filter.author);
	}
	if (filter?.search) {
		const q = filter.search.toLowerCase();
		templates = templates.filter(
			(t) =>
				t.name.toLowerCase().includes(q) ||
				t.description.toLowerCase().includes(q) ||
				t.tags.some((tag) => tag.toLowerCase().includes(q)),
		);
	}

	switch (filter?.sortBy) {
		case 'popular':
			templates.sort((a, b) => b.downloads - a.downloads);
			break;
		case 'rating':
			templates.sort((a, b) => b.rating - a.rating);
			break;
		case 'newest':
		default:
			templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
			break;
	}

	return templates;
}

/**
 * Gets a single template by ID.
 *
 * @param id - The template ID
 * @returns The template, or null if not found
 */
export async function getTemplate(id: string): Promise<MarketplaceTemplate | null> {
	const store = await loadTemplateStore();
	return store.templates.find((t) => t.id === id) || null;
}

/**
 * Updates a template's metadata (name, description, tags, etc.).
 *
 * Cannot update archived templates. Only mutable fields are updated;
 * immutable fields (id, createdAt, downloads, rating) are preserved.
 *
 * @param id - The template ID to update
 * @param updates - Partial template updates
 * @returns Operation result with the updated template
 */
export async function updateTemplate(
	id: string,
	updates: Partial<Pick<MarketplaceTemplate, 'name' | 'description' | 'category' | 'tags' | 'pricing' | 'icon' | 'metadata'>>,
): Promise<TemplateOperationResult> {
	const store = await loadTemplateStore();
	const template = store.templates.find((t) => t.id === id);

	if (!template) {
		return { success: false, message: `Template not found: ${id}` };
	}

	if (template.status === 'archived') {
		return { success: false, message: 'Cannot update an archived template' };
	}

	// Validate mutable fields if provided
	if (updates.name !== undefined) {
		const nameErr = validateName(updates.name);
		if (nameErr) return { success: false, message: nameErr };
	}
	if (updates.description !== undefined) {
		if (typeof updates.description !== 'string' || updates.description.trim().length === 0) {
			return { success: false, message: 'description cannot be empty' };
		}
		if (updates.description.length > TEMPLATE_MARKETPLACE_CONSTANTS.MAX_DESCRIPTION_LENGTH) {
			return { success: false, message: `description exceeds maximum length of ${TEMPLATE_MARKETPLACE_CONSTANTS.MAX_DESCRIPTION_LENGTH}` };
		}
	}
	if (updates.category !== undefined && !VALID_CATEGORIES.includes(updates.category)) {
		return { success: false, message: `category must be one of: ${VALID_CATEGORIES.join(', ')}` };
	}

	// Apply updates
	if (updates.name !== undefined) template.name = updates.name;
	if (updates.description !== undefined) template.description = updates.description;
	if (updates.category !== undefined) template.category = updates.category;
	if (updates.tags !== undefined) template.tags = updates.tags;
	if (updates.pricing !== undefined) template.pricing = updates.pricing;
	if (updates.icon !== undefined) template.icon = updates.icon;
	if (updates.metadata !== undefined) template.metadata = updates.metadata;
	template.updatedAt = new Date().toISOString();

	await saveTemplateStore(store);

	return {
		success: true,
		message: `Template "${template.name}" updated`,
		template,
	};
}

/**
 * Archives a template (soft delete).
 *
 * Sets status to 'archived'. Already archived templates return an error.
 *
 * @param id - The template ID to archive
 * @returns Operation result with the archived template
 */
export async function archiveTemplate(id: string): Promise<TemplateOperationResult> {
	const store = await loadTemplateStore();
	const template = store.templates.find((t) => t.id === id);

	if (!template) {
		return { success: false, message: `Template not found: ${id}` };
	}

	if (template.status === 'archived') {
		return { success: false, message: 'Template is already archived' };
	}

	template.status = 'archived';
	template.updatedAt = new Date().toISOString();
	await saveTemplateStore(store);

	return {
		success: true,
		message: `Template "${template.name}" archived`,
		template,
	};
}

/**
 * Adds a new version to a template.
 *
 * Validates the semver format and ensures versions are unique.
 * Updates the template's currentVersion to the new semver.
 *
 * @param templateId - The template ID
 * @param input - Version creation input
 * @returns Operation result with the created version
 */
export async function addVersion(
	templateId: string,
	input: {
		semver: string;
		config: Record<string, unknown>;
		changelog: string;
	},
): Promise<TemplateOperationResult> {
	const store = await loadTemplateStore();
	const template = store.templates.find((t) => t.id === templateId);

	if (!template) {
		return { success: false, message: `Template not found: ${templateId}` };
	}

	if (template.status === 'archived') {
		return { success: false, message: 'Cannot add versions to an archived template' };
	}

	if (!input.semver || !SEMVER_RE.test(input.semver)) {
		return { success: false, message: 'semver must be in format x.y.z' };
	}

	if (!input.config || typeof input.config !== 'object') {
		return { success: false, message: 'config is required and must be an object' };
	}

	if (!input.changelog || typeof input.changelog !== 'string') {
		return { success: false, message: 'changelog is required' };
	}

	if (input.changelog.length > TEMPLATE_MARKETPLACE_CONSTANTS.MAX_CHANGELOG_LENGTH) {
		return { success: false, message: `changelog exceeds maximum length of ${TEMPLATE_MARKETPLACE_CONSTANTS.MAX_CHANGELOG_LENGTH}` };
	}

	const versionStore = await loadVersionStore(templateId);

	// Check for duplicate semver
	if (versionStore.versions.some((v) => v.semver === input.semver)) {
		return { success: false, message: `Version ${input.semver} already exists` };
	}

	const now = new Date().toISOString();
	const version: TemplateVersion = {
		versionId: randomUUID(),
		templateId,
		semver: input.semver,
		config: input.config,
		changelog: input.changelog,
		createdAt: now,
	};

	versionStore.versions.push(version);
	await saveVersionStore(templateId, versionStore);

	// Update template's current version and timestamp
	template.currentVersion = input.semver;
	template.updatedAt = now;
	// Adding a version resets status to draft if it was published
	if (template.status === 'published') {
		template.status = 'draft';
	}
	await saveTemplateStore(store);

	return {
		success: true,
		message: `Version ${input.semver} added to "${template.name}"`,
		template,
		version,
	};
}

/**
 * Lists all versions for a template, sorted newest first.
 *
 * @param templateId - The template ID
 * @returns Array of template versions, or null if template not found
 */
export async function listVersions(templateId: string): Promise<TemplateVersion[] | null> {
	const store = await loadTemplateStore();
	const template = store.templates.find((t) => t.id === templateId);

	if (!template) {
		return null;
	}

	const versionStore = await loadVersionStore(templateId);
	// Sort by creation date descending (newest first)
	return [...versionStore.versions].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}

/**
 * Publishes a template by transitioning its status through the
 * publish workflow: draft -> review -> published.
 *
 * A draft template moves to 'review'. A template in 'review' moves
 * to 'published'. Already published or archived templates return an error.
 *
 * @param id - The template ID to publish
 * @returns Operation result with the updated template
 */
export async function publishTemplate(id: string): Promise<TemplateOperationResult> {
	const store = await loadTemplateStore();
	const template = store.templates.find((t) => t.id === id);

	if (!template) {
		return { success: false, message: `Template not found: ${id}` };
	}

	const now = new Date().toISOString();

	switch (template.status) {
		case 'draft':
			template.status = 'review';
			template.updatedAt = now;
			await saveTemplateStore(store);
			return {
				success: true,
				message: `Template "${template.name}" submitted for review`,
				template,
			};

		case 'review':
			template.status = 'published';
			template.updatedAt = now;
			await saveTemplateStore(store);
			return {
				success: true,
				message: `Template "${template.name}" published`,
				template,
			};

		case 'published':
			return { success: false, message: 'Template is already published' };

		case 'archived':
			return { success: false, message: 'Cannot publish an archived template' };

		default:
			return { success: false, message: `Unknown status: ${template.status}` };
	}
}

/**
 * Deletes a template and all its version data from disk.
 *
 * This is a hard delete — removes the template entry from the store
 * and its entire version directory. Use archiveTemplate for soft delete.
 *
 * @param id - The template ID to delete
 * @returns Operation result
 */
export async function deleteTemplate(id: string): Promise<TemplateOperationResult> {
	const store = await loadTemplateStore();
	const templateIdx = store.templates.findIndex((t) => t.id === id);

	if (templateIdx === -1) {
		return { success: false, message: `Template not found: ${id}` };
	}

	const template = store.templates[templateIdx];
	store.templates.splice(templateIdx, 1);
	await saveTemplateStore(store);

	// Remove version directory
	const templateDir = path.join(TEMPLATES_DIR, id);
	await rm(templateDir, { recursive: true, force: true });

	return {
		success: true,
		message: `Template "${template.name}" deleted`,
	};
}
