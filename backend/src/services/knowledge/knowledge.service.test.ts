/**
 * Knowledge Service Tests
 *
 * Tests for the KnowledgeService singleton, which manages CRUD operations
 * on markdown documents with YAML frontmatter stored at global or project scope.
 *
 * @module services/knowledge/knowledge.service.test
 */

import { KnowledgeService } from './knowledge.service.js';

// Mock all dependencies before importing them
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('uuid');
jest.mock('yaml');
jest.mock('../../utils/file-io.utils.js');
jest.mock('../../constants.js', () => ({
  CREWLY_CONSTANTS: {
    PATHS: {
      CREWLY_HOME: '.crewly',
      DOCS_DIR: 'docs',
      DOCS_INDEX_FILE: 'docs-index.json',
    },
  },
}));
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
      }),
    }),
  },
}));

import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';
import { atomicWriteFile, safeReadJson } from '../../utils/file-io.utils.js';

// Typed mocks
const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockUnlink = fs.unlink as jest.MockedFunction<typeof fs.unlink>;
const mockMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockUuid = uuidv4 as jest.MockedFunction<typeof uuidv4>;
const mockParseYAML = parseYAML as jest.MockedFunction<typeof parseYAML>;
const mockStringifyYAML = stringifyYAML as jest.MockedFunction<typeof stringifyYAML>;
const mockAtomicWriteFile = atomicWriteFile as jest.MockedFunction<typeof atomicWriteFile>;
const mockSafeReadJson = safeReadJson as jest.MockedFunction<typeof safeReadJson>;

describe('KnowledgeService', () => {
  beforeEach(() => {
    KnowledgeService.resetInstance();
    jest.clearAllMocks();

    // Default mocks
    mockExistsSync.mockReturnValue(true);
    mockMkdir.mockResolvedValue(undefined);
    mockAtomicWriteFile.mockResolvedValue(undefined);
    mockUuid.mockReturnValue('test-uuid-1234' as unknown as ReturnType<typeof uuidv4>);
    mockStringifyYAML.mockReturnValue('id: test-uuid-1234\ntitle: Test Doc');
    mockSafeReadJson.mockResolvedValue({
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
      entries: [],
    });
  });

  describe('getInstance', () => {
    it('should return the same instance on subsequent calls', () => {
      const instance1 = KnowledgeService.getInstance();
      const instance2 = KnowledgeService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return a KnowledgeService instance', () => {
      const instance = KnowledgeService.getInstance();
      expect(instance).toBeInstanceOf(KnowledgeService);
    });
  });

  describe('resetInstance', () => {
    it('should clear the singleton so a new instance is created', () => {
      const instance1 = KnowledgeService.getInstance();
      KnowledgeService.resetInstance();
      const instance2 = KnowledgeService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('createDocument', () => {
    it('should create a document, write file, update index, and return ID', async () => {
      const service = KnowledgeService.getInstance();

      const id = await service.createDocument({
        title: 'Test Document',
        content: 'Some markdown content here.',
        category: 'SOPs',
        scope: 'global',
        tags: ['testing', 'docs'],
        createdBy: 'test-user',
      });

      expect(id).toBe('test-uuid-1234');

      // Should ensure docs directory exists
      expect(mockExistsSync).toHaveBeenCalled();

      // Should write the document file atomically
      expect(mockAtomicWriteFile).toHaveBeenCalledTimes(2); // doc file + index
      const docWriteCall = mockAtomicWriteFile.mock.calls[0];
      expect(docWriteCall[0]).toContain('test-uuid-1234.md');

      // Should read and update the index
      expect(mockSafeReadJson).toHaveBeenCalled();

      // Should write the updated index
      const indexWriteCall = mockAtomicWriteFile.mock.calls[1];
      expect(indexWriteCall[0]).toContain('docs-index.json');
    });

    it('should throw for missing title', async () => {
      const service = KnowledgeService.getInstance();

      await expect(
        service.createDocument({
          title: '',
          content: 'Content here',
          category: 'General',
          scope: 'global',
          createdBy: 'user',
        }),
      ).rejects.toThrow('Title is required');
    });

    it('should throw for content exceeding max length', async () => {
      const service = KnowledgeService.getInstance();
      const longContent = 'x'.repeat(512001);

      await expect(
        service.createDocument({
          title: 'Valid Title',
          content: longContent,
          category: 'General',
          scope: 'global',
          createdBy: 'user',
        }),
      ).rejects.toThrow('Content must be at most');
    });

    it('should throw for too many tags', async () => {
      const service = KnowledgeService.getInstance();
      const tooManyTags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);

      await expect(
        service.createDocument({
          title: 'Valid Title',
          content: 'Valid content',
          category: 'General',
          scope: 'global',
          tags: tooManyTags,
          createdBy: 'user',
        }),
      ).rejects.toThrow('Maximum');
    });

    it('should throw when project scope is used without projectPath', async () => {
      const service = KnowledgeService.getInstance();

      await expect(
        service.createDocument({
          title: 'Valid Title',
          content: 'Valid content',
          category: 'General',
          scope: 'project',
          createdBy: 'user',
        }),
      ).rejects.toThrow('projectPath is required');
    });

    it('should use default values for optional parameters', async () => {
      const service = KnowledgeService.getInstance();

      const id = await service.createDocument({
        title: 'Minimal Doc',
        content: 'Minimal content',
        category: '',
        scope: 'global',
        createdBy: '',
      });

      expect(id).toBe('test-uuid-1234');

      // Verify the serialized document uses defaults
      const docWriteCall = mockAtomicWriteFile.mock.calls[0];
      const writtenContent = docWriteCall[1] as string;
      // The content should be serialized via stringifyYAML and contain the markdown
      expect(writtenContent).toContain('Minimal content');
    });
  });

  describe('getDocument', () => {
    it('should return parsed document when file exists', async () => {
      const service = KnowledgeService.getInstance();

      const rawFile = '---\nid: doc-1\ntitle: My Doc\n---\nHello world';
      mockReadFile.mockResolvedValue(rawFile as unknown as Buffer);
      mockParseYAML.mockReturnValue({
        id: 'doc-1',
        title: 'My Doc',
        category: 'General',
        tags: [],
        createdBy: 'user',
        updatedBy: 'user',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      const doc = await service.getDocument('doc-1', 'global');

      expect(doc).not.toBeNull();
      expect(doc!.id).toBe('doc-1');
      expect(doc!.title).toBe('My Doc');
      expect(doc!.content).toBe('Hello world');
      expect(doc!.scope).toBe('global');
    });

    it('should return null when file does not exist', async () => {
      const service = KnowledgeService.getInstance();

      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

      const doc = await service.getDocument('nonexistent-id', 'global');

      expect(doc).toBeNull();
    });

    it('should return null when frontmatter is malformed', async () => {
      const service = KnowledgeService.getInstance();

      const rawFile = '---\ninvalid yaml\n---\nContent';
      mockReadFile.mockResolvedValue(rawFile as unknown as Buffer);
      mockParseYAML.mockReturnValue({ invalid: true }); // Missing id and title

      const doc = await service.getDocument('bad-doc', 'global');

      expect(doc).toBeNull();
    });

    it('should return null when file has fewer than 3 frontmatter parts', async () => {
      const service = KnowledgeService.getInstance();

      const rawFile = 'No frontmatter at all';
      mockReadFile.mockResolvedValue(rawFile as unknown as Buffer);

      const doc = await service.getDocument('no-frontmatter', 'global');

      expect(doc).toBeNull();
    });
  });

  describe('listDocuments', () => {
    it('should return entries from index', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'First Doc',
            category: 'SOPs',
            tags: ['sop'],
            preview: 'First document preview',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'doc-2',
            title: 'Second Doc',
            category: 'Runbooks',
            tags: ['runbook'],
            preview: 'Second document preview',
            createdBy: 'admin',
            updatedBy: 'admin',
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
      });

      const documents = await service.listDocuments('global');

      expect(documents).toHaveLength(2);
      expect(documents[0].id).toBe('doc-1');
      expect(documents[0].scope).toBe('global');
      expect(documents[1].id).toBe('doc-2');
      expect(documents[1].scope).toBe('global');
    });

    it('should filter by category', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'SOP Doc',
            category: 'SOPs',
            tags: [],
            preview: 'SOP content',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'doc-2',
            title: 'Runbook Doc',
            category: 'Runbooks',
            tags: [],
            preview: 'Runbook content',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const documents = await service.listDocuments('global', undefined, {
        category: 'SOPs',
      });

      expect(documents).toHaveLength(1);
      expect(documents[0].category).toBe('SOPs');
    });

    it('should filter by search query matching title', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'Deployment Guide',
            category: 'Runbooks',
            tags: ['deploy'],
            preview: 'How to deploy the app',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'doc-2',
            title: 'Onboarding Checklist',
            category: 'Onboarding',
            tags: ['new-hire'],
            preview: 'Steps for onboarding',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const documents = await service.listDocuments('global', undefined, {
        search: 'deployment',
      });

      expect(documents).toHaveLength(1);
      expect(documents[0].title).toBe('Deployment Guide');
    });

    it('should filter by search query matching tags', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'Some Doc',
            category: 'General',
            tags: ['kubernetes', 'infra'],
            preview: 'Infrastructure setup',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'doc-2',
            title: 'Another Doc',
            category: 'General',
            tags: ['frontend'],
            preview: 'UI patterns',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const documents = await service.listDocuments('global', undefined, {
        search: 'kubernetes',
      });

      expect(documents).toHaveLength(1);
      expect(documents[0].id).toBe('doc-1');
    });

    it('should filter by search query matching preview', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'Doc A',
            category: 'General',
            tags: [],
            preview: 'This discusses database migrations and schema changes',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'doc-2',
            title: 'Doc B',
            category: 'General',
            tags: [],
            preview: 'React component patterns',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const documents = await service.listDocuments('global', undefined, {
        search: 'migrations',
      });

      expect(documents).toHaveLength(1);
      expect(documents[0].id).toBe('doc-1');
    });

    it('should return empty array when no documents match filters', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'Test Doc',
            category: 'SOPs',
            tags: [],
            preview: 'SOP preview',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const documents = await service.listDocuments('global', undefined, {
        category: 'Nonexistent',
      });

      expect(documents).toHaveLength(0);
    });
  });

  describe('updateDocument', () => {
    it('should update an existing document', async () => {
      const service = KnowledgeService.getInstance();

      // Mock getDocument to return an existing doc
      const rawFile = '---\nid: doc-1\ntitle: Old Title\n---\nOld content';
      mockReadFile.mockResolvedValue(rawFile as unknown as Buffer);
      mockParseYAML.mockReturnValue({
        id: 'doc-1',
        title: 'Old Title',
        category: 'General',
        tags: [],
        createdBy: 'user',
        updatedBy: 'user',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      // Mock index with existing entry
      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'Old Title',
            category: 'General',
            tags: [],
            preview: 'Old content',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      await service.updateDocument('doc-1', {
        title: 'New Title',
        content: 'New content',
        scope: 'global',
        updatedBy: 'admin',
      });

      // Should write updated doc file
      expect(mockAtomicWriteFile).toHaveBeenCalled();
      const docWriteCall = mockAtomicWriteFile.mock.calls[0];
      expect(docWriteCall[0]).toContain('doc-1.md');
      expect(docWriteCall[1]).toContain('New content');

      // Should write updated index
      const indexWriteCall = mockAtomicWriteFile.mock.calls[1];
      expect(indexWriteCall[0]).toContain('docs-index.json');
    });

    it('should throw when document not found', async () => {
      const service = KnowledgeService.getInstance();

      // Mock getDocument to return null (file not found)
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      await expect(
        service.updateDocument('nonexistent', {
          title: 'Updated',
          scope: 'global',
          updatedBy: 'user',
        }),
      ).rejects.toThrow("Document 'nonexistent' not found");
    });

    it('should throw for title exceeding max length', async () => {
      const service = KnowledgeService.getInstance();

      // Mock getDocument to return an existing doc
      const rawFile = '---\nid: doc-1\ntitle: Existing\n---\nExisting content';
      mockReadFile.mockResolvedValue(rawFile as unknown as Buffer);
      mockParseYAML.mockReturnValue({
        id: 'doc-1',
        title: 'Existing',
        category: 'General',
        tags: [],
        createdBy: 'user',
        updatedBy: 'user',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      const longTitle = 'x'.repeat(201);

      await expect(
        service.updateDocument('doc-1', {
          title: longTitle,
          scope: 'global',
          updatedBy: 'user',
        }),
      ).rejects.toThrow('Title must be at most');
    });
  });

  describe('deleteDocument', () => {
    it('should remove file and update index', async () => {
      const service = KnowledgeService.getInstance();

      mockUnlink.mockResolvedValue(undefined);
      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-to-delete',
            title: 'Delete Me',
            category: 'General',
            tags: [],
            preview: 'Content preview',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'doc-keep',
            title: 'Keep Me',
            category: 'General',
            tags: [],
            preview: 'Keep this one',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      await service.deleteDocument('doc-to-delete', 'global');

      // Should unlink the doc file
      expect(mockUnlink).toHaveBeenCalled();
      const unlinkPath = mockUnlink.mock.calls[0][0] as string;
      expect(unlinkPath).toContain('doc-to-delete.md');

      // Should write updated index without the deleted entry
      expect(mockAtomicWriteFile).toHaveBeenCalled();
      const indexWriteCall = mockAtomicWriteFile.mock.calls[0];
      const writtenIndex = JSON.parse(indexWriteCall[1] as string);
      expect(writtenIndex.entries).toHaveLength(1);
      expect(writtenIndex.entries[0].id).toBe('doc-keep');
    });

    it('should throw when file does not exist', async () => {
      const service = KnowledgeService.getInstance();

      mockUnlink.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(
        service.deleteDocument('nonexistent', 'global'),
      ).rejects.toThrow("Document 'nonexistent' not found");
    });
  });

  describe('listCategories', () => {
    it('should return default categories when no documents exist', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [],
      });

      const categories = await service.listCategories('global');

      expect(categories).toContain('SOPs');
      expect(categories).toContain('Team Norms');
      expect(categories).toContain('Architecture');
      expect(categories).toContain('Onboarding');
      expect(categories).toContain('Runbooks');
      expect(categories).toContain('General');
    });

    it('should return defaults merged with in-use custom categories', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'Custom Category Doc',
            category: 'Custom Category',
            tags: [],
            preview: 'Preview',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const categories = await service.listCategories('global');

      // Should include both defaults and custom
      expect(categories).toContain('Custom Category');
      expect(categories).toContain('SOPs');
      expect(categories).toContain('General');
    });

    it('should return categories sorted alphabetically', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'Doc',
            category: 'Zebra Category',
            tags: [],
            preview: 'Preview',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const categories = await service.listCategories('global');

      // Verify sorted order
      const sorted = [...categories].sort();
      expect(categories).toEqual(sorted);
    });

    it('should not duplicate default categories that are also in use', async () => {
      const service = KnowledgeService.getInstance();

      mockSafeReadJson.mockResolvedValue({
        version: 1,
        updatedAt: '2024-01-01T00:00:00.000Z',
        entries: [
          {
            id: 'doc-1',
            title: 'SOP Doc',
            category: 'SOPs',
            tags: [],
            preview: 'Preview',
            createdBy: 'user',
            updatedBy: 'user',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      });

      const categories = await service.listCategories('global');

      // SOPs should appear only once
      const sopsCount = categories.filter((c) => c === 'SOPs').length;
      expect(sopsCount).toBe(1);
    });
  });
});
