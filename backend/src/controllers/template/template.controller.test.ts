/**
 * Tests for Template Controller
 *
 * Validates the REST handlers for template endpoints including
 * list, get, create-team, filtering, and error handling.
 *
 * @module controllers/template/template.controller.test
 */

import {
  handleListTemplates,
  handleGetTemplate,
  handleCreateTeamFromTemplate,
} from './template.controller.js';

// Mock TemplateService
const mockListAllTemplates = jest.fn();
const mockGetTemplate = jest.fn();
const mockCreateTeamFromTemplate = jest.fn();

jest.mock('../../services/template/template.service.js', () => ({
  TemplateService: {
    getInstance: () => ({
      listAllTemplates: mockListAllTemplates,
      getTemplate: mockGetTemplate,
      createTeamFromTemplate: mockCreateTeamFromTemplate,
    }),
  },
}));

// =============================================================================
// Helpers
// =============================================================================

function createMockRes() {
  const res: Record<string, jest.Mock> = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res;
}

function createMockReq(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

const sampleSummary = {
  id: 'dev-fullstack',
  name: 'Fullstack Dev Team',
  description: 'TL + 2 developers',
  category: 'development',
  hierarchical: true,
  roleCount: 2,
  version: '1.0.0',
};

const sampleTemplate = {
  id: 'dev-fullstack',
  name: 'Fullstack Dev Team',
  description: 'TL + 2 developers',
  category: 'development',
  version: '1.0.0',
  hierarchical: true,
  roles: [
    { role: 'team-leader', label: 'TL', defaultName: 'Lead', count: 1, hierarchyLevel: 1, canDelegate: true, defaultSkills: [] },
    { role: 'developer', label: 'Dev', defaultName: 'Dev', count: 2, hierarchyLevel: 2, canDelegate: false, defaultSkills: [] },
  ],
  defaultRuntime: 'claude-code',
  verificationPipeline: { name: 'Dev Pipeline', steps: [], passPolicy: 'all', maxRetries: 2 },
};

const sampleCreateResult = {
  team: { id: 'team-1', name: 'My Team', members: [], hierarchical: true },
  templateId: 'dev-fullstack',
  memberCount: 3,
};

// =============================================================================
// Tests
// =============================================================================

describe('TemplateController', () => {
  let mockRes: ReturnType<typeof createMockRes>;

  beforeEach(() => {
    mockRes = createMockRes();
    mockListAllTemplates.mockReset();
    mockGetTemplate.mockReset();
    mockCreateTeamFromTemplate.mockReset();
  });

  // ========================= handleListTemplates =========================

  describe('handleListTemplates', () => {
    it('should return all templates with success envelope', async () => {
      mockListAllTemplates.mockReturnValue([sampleSummary]);

      const req = createMockReq();
      await handleListTemplates(req as any, mockRes as any);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [sampleSummary],
      });
    });

    it('should return empty array when no templates exist', async () => {
      mockListAllTemplates.mockReturnValue([]);

      const req = createMockReq();
      await handleListTemplates(req as any, mockRes as any);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should filter by category when provided', async () => {
      const devTemplate = { ...sampleSummary, category: 'development' };
      const contentTemplate = { ...sampleSummary, id: 'blog-team', category: 'content' };
      mockListAllTemplates.mockReturnValue([devTemplate, contentTemplate]);

      const req = createMockReq({ query: { category: 'development' } });
      await handleListTemplates(req as any, mockRes as any);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [devTemplate],
      });
    });

    it('should return empty array when category filter matches nothing', async () => {
      mockListAllTemplates.mockReturnValue([sampleSummary]);

      const req = createMockReq({ query: { category: 'research' } });
      await handleListTemplates(req as any, mockRes as any);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [],
      });
    });

    it('should return 500 when service throws', async () => {
      mockListAllTemplates.mockImplementation(() => { throw new Error('Load failed'); });

      const req = createMockReq();
      await handleListTemplates(req as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Load failed',
      });
    });
  });

  // ========================= handleGetTemplate =========================

  describe('handleGetTemplate', () => {
    it('should return template by ID', async () => {
      mockGetTemplate.mockReturnValue(sampleTemplate);

      const req = createMockReq({ params: { id: 'dev-fullstack' } });
      await handleGetTemplate(req as any, mockRes as any);

      expect(mockGetTemplate).toHaveBeenCalledWith('dev-fullstack');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: sampleTemplate,
      });
    });

    it('should return 404 when template not found', async () => {
      mockGetTemplate.mockReturnValue(null);

      const req = createMockReq({ params: { id: 'nonexistent' } });
      await handleGetTemplate(req as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template "nonexistent" not found',
      });
    });

    it('should return 500 when service throws', async () => {
      mockGetTemplate.mockImplementation(() => { throw new Error('Read failed'); });

      const req = createMockReq({ params: { id: 'dev-fullstack' } });
      await handleGetTemplate(req as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Read failed',
      });
    });
  });

  // ========================= handleCreateTeamFromTemplate =========================

  describe('handleCreateTeamFromTemplate', () => {
    it('should create team from template', async () => {
      mockCreateTeamFromTemplate.mockReturnValue(sampleCreateResult);

      const req = createMockReq({
        params: { id: 'dev-fullstack' },
        body: { teamName: 'My Team' },
      });
      await handleCreateTeamFromTemplate(req as any, mockRes as any);

      expect(mockCreateTeamFromTemplate).toHaveBeenCalledWith('dev-fullstack', 'My Team', undefined);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: sampleCreateResult,
      });
    });

    it('should pass name overrides when provided', async () => {
      mockCreateTeamFromTemplate.mockReturnValue(sampleCreateResult);

      const req = createMockReq({
        params: { id: 'dev-fullstack' },
        body: { teamName: 'My Team', nameOverrides: { 'team-leader': 'Alice' } },
      });
      await handleCreateTeamFromTemplate(req as any, mockRes as any);

      expect(mockCreateTeamFromTemplate).toHaveBeenCalledWith(
        'dev-fullstack',
        'My Team',
        { 'team-leader': 'Alice' },
      );
    });

    it('should trim teamName', async () => {
      mockCreateTeamFromTemplate.mockReturnValue(sampleCreateResult);

      const req = createMockReq({
        params: { id: 'dev-fullstack' },
        body: { teamName: '  My Team  ' },
      });
      await handleCreateTeamFromTemplate(req as any, mockRes as any);

      expect(mockCreateTeamFromTemplate).toHaveBeenCalledWith('dev-fullstack', 'My Team', undefined);
    });

    it('should return 400 when teamName is missing', async () => {
      const req = createMockReq({
        params: { id: 'dev-fullstack' },
        body: {},
      });
      await handleCreateTeamFromTemplate(req as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'teamName is required and must be a non-empty string',
      });
    });

    it('should return 400 when teamName is empty string', async () => {
      const req = createMockReq({
        params: { id: 'dev-fullstack' },
        body: { teamName: '   ' },
      });
      await handleCreateTeamFromTemplate(req as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when teamName is not a string', async () => {
      const req = createMockReq({
        params: { id: 'dev-fullstack' },
        body: { teamName: 123 },
      });
      await handleCreateTeamFromTemplate(req as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when template not found', async () => {
      mockCreateTeamFromTemplate.mockReturnValue(null);

      const req = createMockReq({
        params: { id: 'nonexistent' },
        body: { teamName: 'My Team' },
      });
      await handleCreateTeamFromTemplate(req as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template "nonexistent" not found',
      });
    });

    it('should return 500 when service throws', async () => {
      mockCreateTeamFromTemplate.mockImplementation(() => { throw new Error('Create failed'); });

      const req = createMockReq({
        params: { id: 'dev-fullstack' },
        body: { teamName: 'My Team' },
      });
      await handleCreateTeamFromTemplate(req as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Create failed',
      });
    });
  });
});
