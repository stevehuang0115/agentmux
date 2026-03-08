/**
 * Template Marketplace REST Controller
 *
 * Exposes CRUD endpoints for marketplace template lifecycle management.
 * Handles creation, listing, detail view, updating, archiving,
 * version management, and publishing of team configuration templates.
 *
 * @module controllers/marketplace/template-marketplace.controller
 */

import type { Request, Response } from 'express';
import {
	createTemplate,
	listTemplates,
	getTemplate,
	updateTemplate,
	archiveTemplate,
	addVersion,
	listVersions,
	publishTemplate,
} from '../../services/marketplace/index.js';
import type { TemplateCategory, PublishStatus } from '../../types/marketplace.types.js';

const VALID_CATEGORIES: TemplateCategory[] = [
	'content-creation', 'development', 'marketing', 'operations',
	'research', 'support', 'design', 'sales', 'custom',
];

const VALID_STATUSES: PublishStatus[] = ['draft', 'review', 'published', 'archived'];

const VALID_SORT_OPTIONS = ['popular', 'rating', 'newest'] as const;

/**
 * Wraps an async route handler with a standard try/catch that returns
 * a consistent JSON error response on unhandled exceptions.
 *
 * @param fn - The async handler function to wrap
 * @returns A wrapped handler that catches errors and responds with 500
 */
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
	return async (req: Request, res: Response): Promise<void> => {
		try {
			await fn(req, res);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			res.status(500).json({ success: false, error: msg });
		}
	};
}

/**
 * POST /api/marketplace/templates - Create a new template.
 *
 * Creates a template in draft status with an initial 1.0.0 version.
 *
 * @param req - Express request with body: { name, description, author, category, tags?, pricing?, config?, icon?, metadata? }
 * @param res - Express response returning TemplateOperationResult
 *
 * @example
 * ```
 * POST /api/marketplace/templates
 * { "name": "E-commerce UGC Video Team", "description": "...", "author": "Crewly", "category": "content-creation" }
 * ```
 */
export const handleCreateTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const { name, description, author, category, tags, pricing, config, icon, metadata } = req.body as {
		name?: string;
		description?: string;
		author?: string;
		category?: string;
		tags?: string[];
		pricing?: { isFree: boolean; priceUsdCents: number; requiredTier: string };
		config?: Record<string, unknown>;
		icon?: string;
		metadata?: Record<string, unknown>;
	};

	const result = await createTemplate({
		name: name || '',
		description: description || '',
		author: author || '',
		category: (category || '') as TemplateCategory,
		tags,
		pricing: pricing as Parameters<typeof createTemplate>[0]['pricing'],
		config,
		icon,
		metadata,
	});

	if (!result.success) {
		res.status(400).json(result);
		return;
	}

	res.status(201).json(result);
});

/**
 * GET /api/marketplace/templates - List/search templates.
 *
 * Supports query parameters for filtering and sorting:
 * - category: Filter by template category
 * - status: Filter by publish status
 * - search: Free-text search
 * - author: Filter by author
 * - sort: Sort order (popular, rating, newest)
 *
 * @param req - Express request with optional query params
 * @param res - Express response returning { success, data: MarketplaceTemplate[] }
 *
 * @example
 * ```
 * GET /api/marketplace/templates?category=content-creation&sort=popular
 * ```
 */
export const handleListTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const categoryParam = req.query.category as string | undefined;
	if (categoryParam && !VALID_CATEGORIES.includes(categoryParam as TemplateCategory)) {
		res.status(400).json({ success: false, error: `Invalid category "${categoryParam}". Must be one of: ${VALID_CATEGORIES.join(', ')}` });
		return;
	}

	const statusParam = req.query.status as string | undefined;
	if (statusParam && !VALID_STATUSES.includes(statusParam as PublishStatus)) {
		res.status(400).json({ success: false, error: `Invalid status "${statusParam}". Must be one of: ${VALID_STATUSES.join(', ')}` });
		return;
	}

	const sortParam = req.query.sort as string | undefined;
	if (sortParam && !(VALID_SORT_OPTIONS as readonly string[]).includes(sortParam)) {
		res.status(400).json({ success: false, error: `Invalid sort "${sortParam}". Must be one of: ${VALID_SORT_OPTIONS.join(', ')}` });
		return;
	}

	const templates = await listTemplates({
		category: categoryParam as TemplateCategory | undefined,
		status: statusParam as PublishStatus | undefined,
		search: req.query.search as string | undefined,
		author: req.query.author as string | undefined,
		sortBy: sortParam as 'popular' | 'rating' | 'newest' | undefined,
	});

	res.json({ success: true, data: templates });
});

/**
 * GET /api/marketplace/templates/:id - Get template details.
 *
 * Returns full template detail including metadata and pricing.
 * Returns 404 if the template does not exist.
 *
 * @param req - Express request with params.id
 * @param res - Express response returning { success, data: MarketplaceTemplate } or 404
 */
export const handleGetTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const template = await getTemplate(req.params.id);
	if (!template) {
		res.status(404).json({ success: false, error: 'Template not found' });
		return;
	}
	res.json({ success: true, data: template });
});

/**
 * PUT /api/marketplace/templates/:id - Update template metadata.
 *
 * Updates mutable fields: name, description, category, tags, pricing, icon, metadata.
 * Cannot update archived templates.
 *
 * @param req - Express request with params.id and body with update fields
 * @param res - Express response returning TemplateOperationResult
 */
export const handleUpdateTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const { name, description, category, tags, pricing, icon, metadata } = req.body as {
		name?: string;
		description?: string;
		category?: string;
		tags?: string[];
		pricing?: { isFree: boolean; priceUsdCents: number; requiredTier: string };
		icon?: string;
		metadata?: Record<string, unknown>;
	};

	const result = await updateTemplate(req.params.id, {
		name,
		description,
		category: category as TemplateCategory | undefined,
		tags,
		pricing: pricing as Parameters<typeof updateTemplate>[1]['pricing'],
		icon,
		metadata,
	});

	if (!result.success) {
		const status = result.message.includes('not found') ? 404 : 400;
		res.status(status).json(result);
		return;
	}

	res.json(result);
});

/**
 * DELETE /api/marketplace/templates/:id - Archive a template (soft delete).
 *
 * Sets the template status to 'archived'. Already archived templates
 * return an error.
 *
 * @param req - Express request with params.id
 * @param res - Express response returning TemplateOperationResult
 */
export const handleArchiveTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const result = await archiveTemplate(req.params.id);
	if (!result.success) {
		const status = result.message.includes('not found') ? 404 : 400;
		res.status(status).json(result);
		return;
	}
	res.json(result);
});

/**
 * POST /api/marketplace/templates/:id/versions - Add a new version.
 *
 * Creates a new version entry for the template with config and changelog.
 * The template's currentVersion is updated to the new semver.
 *
 * @param req - Express request with params.id and body: { semver, config, changelog }
 * @param res - Express response returning TemplateOperationResult
 *
 * @example
 * ```
 * POST /api/marketplace/templates/:id/versions
 * { "semver": "1.1.0", "config": {...}, "changelog": "Added new role" }
 * ```
 */
export const handleAddVersion = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const { semver, config, changelog } = req.body as {
		semver?: string;
		config?: Record<string, unknown>;
		changelog?: string;
	};

	const result = await addVersion(req.params.id, {
		semver: semver || '',
		config: config || {},
		changelog: changelog || '',
	});

	if (!result.success) {
		const status = result.message.includes('not found') ? 404 : 400;
		res.status(status).json(result);
		return;
	}

	res.status(201).json(result);
});

/**
 * GET /api/marketplace/templates/:id/versions - List template versions.
 *
 * Returns all versions for a template, sorted newest first.
 * Returns 404 if the template does not exist.
 *
 * @param req - Express request with params.id
 * @param res - Express response returning { success, data: TemplateVersion[] }
 */
export const handleListVersions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const versions = await listVersions(req.params.id);
	if (versions === null) {
		res.status(404).json({ success: false, error: 'Template not found' });
		return;
	}
	res.json({ success: true, data: versions });
});

/**
 * POST /api/marketplace/templates/:id/publish - Publish a template.
 *
 * Advances the template through the publish workflow:
 * draft -> review -> published.
 *
 * @param req - Express request with params.id
 * @param res - Express response returning TemplateOperationResult
 */
export const handlePublishTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
	const result = await publishTemplate(req.params.id);
	if (!result.success) {
		const status = result.message.includes('not found') ? 404 : 400;
		res.status(status).json(result);
		return;
	}
	res.json(result);
});
