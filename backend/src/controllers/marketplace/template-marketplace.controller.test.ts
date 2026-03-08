/**
 * Tests for Template Marketplace Controller
 *
 * Validates REST handlers for template CRUD endpoints including
 * create, list, get, update, archive, version management, and publish.
 *
 * @module controllers/marketplace/template-marketplace.controller.test
 */

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

// Mock template marketplace service
const mockCreateTemplate = jest.fn();
const mockListTemplates = jest.fn();
const mockGetTemplate = jest.fn();
const mockUpdateTemplate = jest.fn();
const mockArchiveTemplate = jest.fn();
const mockAddVersion = jest.fn();
const mockListVersions = jest.fn();
const mockPublishTemplate = jest.fn();

jest.mock('../../services/marketplace/index.js', () => ({
	createTemplate: (...args: unknown[]) => mockCreateTemplate(...args),
	listTemplates: (...args: unknown[]) => mockListTemplates(...args),
	getTemplate: (...args: unknown[]) => mockGetTemplate(...args),
	updateTemplate: (...args: unknown[]) => mockUpdateTemplate(...args),
	archiveTemplate: (...args: unknown[]) => mockArchiveTemplate(...args),
	addVersion: (...args: unknown[]) => mockAddVersion(...args),
	listVersions: (...args: unknown[]) => mockListVersions(...args),
	publishTemplate: (...args: unknown[]) => mockPublishTemplate(...args),
}));

describe('TemplateMarketplaceController', () => {
	let mockRes: { json: jest.Mock; status: jest.Mock };

	beforeEach(() => {
		mockRes = {
			json: jest.fn().mockReturnThis(),
			status: jest.fn().mockReturnThis(),
		};

		jest.clearAllMocks();
	});

	// ========================= handleCreateTemplate =========================

	describe('handleCreateTemplate', () => {
		it('should create a template and return 201', async () => {
			const template = { id: 't1', name: 'Test' };
			mockCreateTemplate.mockResolvedValue({ success: true, message: 'Created', template });

			await handleCreateTemplate(
				{ body: { name: 'Test', description: 'Desc', author: 'A', category: 'development' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
		});

		it('should return 400 on validation failure', async () => {
			mockCreateTemplate.mockResolvedValue({ success: false, message: 'name is required' });

			await handleCreateTemplate(
				{ body: {} } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});

		it('should return 500 on unexpected error', async () => {
			mockCreateTemplate.mockRejectedValue(new Error('disk full'));

			await handleCreateTemplate(
				{ body: { name: 'X', description: 'X', author: 'X', category: 'custom' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(500);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'disk full' }));
		});
	});

	// ========================= handleListTemplates =========================

	describe('handleListTemplates', () => {
		it('should return templates with success envelope', async () => {
			const templates = [{ id: 't1' }, { id: 't2' }];
			mockListTemplates.mockResolvedValue(templates);

			await handleListTemplates(
				{ query: {} } as any,
				mockRes as any,
			);

			expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: templates });
		});

		it('should pass filter params to service', async () => {
			mockListTemplates.mockResolvedValue([]);

			await handleListTemplates(
				{ query: { category: 'development', status: 'published', search: 'test', sort: 'popular' } } as any,
				mockRes as any,
			);

			expect(mockListTemplates).toHaveBeenCalledWith({
				category: 'development',
				status: 'published',
				search: 'test',
				author: undefined,
				sortBy: 'popular',
			});
		});

		it('should return 400 for invalid category', async () => {
			await handleListTemplates(
				{ query: { category: 'invalid' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(400);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Invalid category') }));
		});

		it('should return 400 for invalid status', async () => {
			await handleListTemplates(
				{ query: { status: 'invalid' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});

		it('should return 400 for invalid sort', async () => {
			await handleListTemplates(
				{ query: { sort: 'invalid' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});
	});

	// ========================= handleGetTemplate =========================

	describe('handleGetTemplate', () => {
		it('should return template details', async () => {
			const template = { id: 't1', name: 'Test' };
			mockGetTemplate.mockResolvedValue(template);

			await handleGetTemplate(
				{ params: { id: 't1' } } as any,
				mockRes as any,
			);

			expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: template });
		});

		it('should return 404 when template not found', async () => {
			mockGetTemplate.mockResolvedValue(null);

			await handleGetTemplate(
				{ params: { id: 'missing' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(404);
		});
	});

	// ========================= handleUpdateTemplate =========================

	describe('handleUpdateTemplate', () => {
		it('should update template and return result', async () => {
			const template = { id: 't1', name: 'Updated' };
			mockUpdateTemplate.mockResolvedValue({ success: true, message: 'Updated', template });

			await handleUpdateTemplate(
				{ params: { id: 't1' }, body: { name: 'Updated' } } as any,
				mockRes as any,
			);

			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
		});

		it('should return 404 when template not found', async () => {
			mockUpdateTemplate.mockResolvedValue({ success: false, message: 'Template not found: missing' });

			await handleUpdateTemplate(
				{ params: { id: 'missing' }, body: { name: 'x' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(404);
		});

		it('should return 400 for validation errors', async () => {
			mockUpdateTemplate.mockResolvedValue({ success: false, message: 'Cannot update an archived template' });

			await handleUpdateTemplate(
				{ params: { id: 't1' }, body: { name: 'x' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});
	});

	// ========================= handleArchiveTemplate =========================

	describe('handleArchiveTemplate', () => {
		it('should archive template', async () => {
			mockArchiveTemplate.mockResolvedValue({ success: true, message: 'Archived' });

			await handleArchiveTemplate(
				{ params: { id: 't1' } } as any,
				mockRes as any,
			);

			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
		});

		it('should return 404 when not found', async () => {
			mockArchiveTemplate.mockResolvedValue({ success: false, message: 'Template not found: missing' });

			await handleArchiveTemplate(
				{ params: { id: 'missing' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(404);
		});
	});

	// ========================= handleAddVersion =========================

	describe('handleAddVersion', () => {
		it('should add version and return 201', async () => {
			const version = { versionId: 'v1', semver: '1.1.0' };
			mockAddVersion.mockResolvedValue({ success: true, message: 'Added', version });

			await handleAddVersion(
				{ params: { id: 't1' }, body: { semver: '1.1.0', config: {}, changelog: 'New' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
		});

		it('should return 400 on validation failure', async () => {
			mockAddVersion.mockResolvedValue({ success: false, message: 'semver must be in format x.y.z' });

			await handleAddVersion(
				{ params: { id: 't1' }, body: { semver: 'bad', config: {}, changelog: 'x' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});

		it('should return 404 when template not found', async () => {
			mockAddVersion.mockResolvedValue({ success: false, message: 'Template not found: missing' });

			await handleAddVersion(
				{ params: { id: 'missing' }, body: { semver: '1.0.0', config: {}, changelog: 'x' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(404);
		});
	});

	// ========================= handleListVersions =========================

	describe('handleListVersions', () => {
		it('should return versions list', async () => {
			const versions = [{ versionId: 'v1', semver: '1.0.0' }];
			mockListVersions.mockResolvedValue(versions);

			await handleListVersions(
				{ params: { id: 't1' } } as any,
				mockRes as any,
			);

			expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: versions });
		});

		it('should return 404 when template not found', async () => {
			mockListVersions.mockResolvedValue(null);

			await handleListVersions(
				{ params: { id: 'missing' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(404);
		});
	});

	// ========================= handlePublishTemplate =========================

	describe('handlePublishTemplate', () => {
		it('should publish template', async () => {
			mockPublishTemplate.mockResolvedValue({ success: true, message: 'Published', template: { status: 'published' } });

			await handlePublishTemplate(
				{ params: { id: 't1' } } as any,
				mockRes as any,
			);

			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
		});

		it('should return 400 when already published', async () => {
			mockPublishTemplate.mockResolvedValue({ success: false, message: 'Template is already published' });

			await handlePublishTemplate(
				{ params: { id: 't1' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(400);
		});

		it('should return 404 when not found', async () => {
			mockPublishTemplate.mockResolvedValue({ success: false, message: 'Template not found: missing' });

			await handlePublishTemplate(
				{ params: { id: 'missing' } } as any,
				mockRes as any,
			);

			expect(mockRes.status).toHaveBeenCalledWith(404);
		});
	});
});
