/**
 * Project Tools Tests
 *
 * Unit tests for the project management MCP tool handlers.
 *
 * @module tools/project-tools.test
 */

import * as path from 'path';
import {
  handleCreateProjectFolder,
  handleSetupProjectStructure,
  handleCreateTeamForProject,
} from './project-tools.js';

// Mock fs/promises
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock child_process spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    on: jest.fn((event: string, callback: (code?: number) => void) => {
      if (event === 'close') {
        // Simulate successful git init
        callback(0);
      }
    }),
  })),
  execSync: jest.fn(),
}));

// Mock global fetch for team creation
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('Project Tools', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCreateProjectFolder', () => {
    it('should create an empty project folder', async () => {
      const result = await handleCreateProjectFolder({
        name: 'my-project',
        path: '/home/user/projects',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('my-project');
      expect(result.projectPath).toBe(path.join('/home/user/projects', 'my-project'));
      expect(result.template).toBe('empty');
      expect(result.gitInitialized).toBe(false);
    });

    it('should create project with TypeScript template', async () => {
      const result = await handleCreateProjectFolder({
        name: 'ts-project',
        path: '/home/user/projects',
        template: 'typescript',
      });

      expect(result.success).toBe(true);
      expect(result.template).toBe('typescript');
    });

    it('should create project with React template', async () => {
      const result = await handleCreateProjectFolder({
        name: 'react-project',
        path: '/home/user/projects',
        template: 'react',
      });

      expect(result.success).toBe(true);
      expect(result.template).toBe('react');
    });

    it('should create project with Node template', async () => {
      const result = await handleCreateProjectFolder({
        name: 'node-project',
        path: '/home/user/projects',
        template: 'node',
      });

      expect(result.success).toBe(true);
      expect(result.template).toBe('node');
    });

    it('should create project with Python template', async () => {
      const result = await handleCreateProjectFolder({
        name: 'python-project',
        path: '/home/user/projects',
        template: 'python',
      });

      expect(result.success).toBe(true);
      expect(result.template).toBe('python');
    });

    it('should initialize git repository when requested', async () => {
      const result = await handleCreateProjectFolder({
        name: 'git-project',
        path: '/home/user/projects',
        initGit: true,
      });

      expect(result.success).toBe(true);
      expect(result.gitInitialized).toBe(true);
    });

    it('should handle errors during creation', async () => {
      const fs = require('fs');
      (fs.promises.mkdir as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));

      const result = await handleCreateProjectFolder({
        name: 'failed-project',
        path: '/root/projects',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('handleSetupProjectStructure', () => {
    it('should create folders successfully', async () => {
      const result = await handleSetupProjectStructure({
        projectPath: '/home/user/projects/my-project',
        structure: {
          folders: ['src', 'tests', 'docs'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.foldersCreated).toBe(3);
      expect(result.filesCreated).toBe(0);
    });

    it('should create files successfully', async () => {
      const result = await handleSetupProjectStructure({
        projectPath: '/home/user/projects/my-project',
        structure: {
          files: [
            { path: 'README.md', content: '# My Project' },
            { path: 'src/index.ts', content: 'console.log("Hello");' },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.foldersCreated).toBe(0);
      expect(result.filesCreated).toBe(2);
    });

    it('should create both folders and files', async () => {
      const result = await handleSetupProjectStructure({
        projectPath: '/home/user/projects/my-project',
        structure: {
          folders: ['src', 'tests'],
          files: [
            { path: 'README.md', content: '# My Project' },
            { path: 'src/index.ts', content: 'console.log("Hello");' },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.foldersCreated).toBe(2);
      expect(result.filesCreated).toBe(2);
    });

    it('should handle non-existent project path', async () => {
      const fs = require('fs');
      (fs.promises.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

      const result = await handleSetupProjectStructure({
        projectPath: '/home/user/projects/nonexistent',
        structure: {
          folders: ['src'],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should handle empty structure', async () => {
      const result = await handleSetupProjectStructure({
        projectPath: '/home/user/projects/my-project',
        structure: {},
      });

      expect(result.success).toBe(true);
      expect(result.foldersCreated).toBe(0);
      expect(result.filesCreated).toBe(0);
    });
  });

  describe('handleCreateTeamForProject', () => {
    it('should create a team for a project', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'team-123',
              name: 'My Project Team',
              members: [{ id: 'member-1' }, { id: 'member-2' }],
            },
          }),
      });

      const result = await handleCreateTeamForProject({
        projectId: 'project-123',
        teamName: 'My Project Team',
        roles: ['developer', 'qa'],
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('My Project Team');
      expect(result.team).toBeDefined();
      expect((result.team as Record<string, unknown>).memberCount).toBe(2);
    });

    it('should pass agent count configuration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              id: 'team-123',
              name: 'Large Team',
              members: [],
            },
          }),
      });

      await handleCreateTeamForProject({
        projectId: 'project-123',
        teamName: 'Large Team',
        roles: ['developer', 'qa', 'designer'],
        agentCount: { developer: 3, qa: 2, designer: 1 },
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.agentCount).toEqual({ developer: 3, qa: 2, designer: 1 });
    });

    it('should handle team creation failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: () =>
          Promise.resolve({
            error: 'Invalid project ID',
          }),
      });

      const result = await handleCreateTeamForProject({
        projectId: 'invalid-project',
        teamName: 'Failed Team',
        roles: ['developer'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid project');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await handleCreateTeamForProject({
        projectId: 'project-123',
        teamName: 'Network Error Team',
        roles: ['developer'],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });
});
