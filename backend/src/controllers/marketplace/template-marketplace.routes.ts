/**
 * Template Marketplace REST Routes
 *
 * Router configuration for template marketplace endpoints. Provides
 * full CRUD access for team configuration templates with version
 * management and publish workflow.
 *
 * Read endpoints (list, get, versions) are public — anyone can browse.
 * Write endpoints (create, update, archive, add version, publish)
 * require Supabase authentication.
 *
 * @module controllers/marketplace/template-marketplace.routes
 */

import { Router } from 'express';
import {
	handleCreateTemplate,
	handleListTemplates,
	handleGetTemplate,
	handleUpdateTemplate,
	handleArchiveTemplate,
	handleAddVersion,
	handleListVersions,
	handlePublishTemplate,
} from './template-marketplace.controller.js';
import { requireCloudConnection } from '../../services/cloud/cloud-auth.middleware.js';

/**
 * Creates the template marketplace router with all template endpoints.
 *
 * Public endpoints (browse marketplace):
 * - GET  /              - List/search templates
 * - GET  /:id           - Get template details
 * - GET  /:id/versions  - List template versions
 *
 * Protected endpoints (require Supabase auth):
 * - POST /              - Create a new template
 * - PUT  /:id           - Update template metadata
 * - DELETE /:id         - Archive template (soft delete)
 * - POST /:id/versions  - Add a new version
 * - POST /:id/publish   - Publish a template
 *
 * @returns Express router configured with template marketplace routes
 */
export function createTemplateMarketplaceRouter(): Router {
	const router = Router();

	// Public collection routes (browse marketplace)
	router.get('/', handleListTemplates);

	// Protected collection routes (require auth to create)
	router.post('/', requireCloudConnection, handleCreateTemplate);

	// Public item routes (browse details)
	router.get('/:id', handleGetTemplate);
	router.get('/:id/versions', handleListVersions);

	// Protected item routes (require auth to modify)
	router.put('/:id', requireCloudConnection, handleUpdateTemplate);
	router.delete('/:id', requireCloudConnection, handleArchiveTemplate);
	router.post('/:id/versions', requireCloudConnection, handleAddVersion);
	router.post('/:id/publish', requireCloudConnection, handlePublishTemplate);

	return router;
}
