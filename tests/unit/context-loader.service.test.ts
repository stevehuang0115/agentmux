import { ContextLoaderService, ProjectContext, ContextLoadOptions } from '../../backend/src/services/context-loader.service';
import { TeamMember } from '../../backend/src/types/index';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

// Mock fs modules
jest.mock('fs/promises');
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

// Mock child_process
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('ContextLoaderService', () => {
  let contextLoader: ContextLoaderService;
  let testProjectPath: string;

  beforeEach(() => {
    testProjectPath = '/test/project/path';
    contextLoader = new ContextLoaderService(testProjectPath);
    jest.clearAllMocks();
  });

  describe('loadProjectContext', () => {
    test.skip('should load basic project context with all options enabled', async () => {
      // Mock file existence checks
      mockExistsSync
        .mockReturnValueOnce(true) // .agentmux/project.md exists
        .mockReturnValueOnce(true) // README.md exists  
        .mockReturnValueOnce(true) // .agentmux/tickets exists
        .mockReturnValueOnce(true); // package.json exists

      // Mock file reads in the order they'll be called
      mockFs.readFile
        .mockResolvedValueOnce('# Project Specifications\nThis is the project spec') // project.md
        .mockResolvedValueOnce('# Project README\nThis is the readme') // README.md
        .mockResolvedValueOnce('{"name": "test-project", "dependencies": {"express": "^4.18.0"}}') // package.json
        .mockResolvedValueOnce(`id: ticket1\ntitle: Test Ticket\nstatus: open\npriority: high\ndescription: Test description`); // ticket1.yaml

      // Mock directory reads - first for project structure, then for src directory, then for tickets
      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'src', isDirectory: () => true, isFile: () => false },
          { name: 'package.json', isDirectory: () => false, isFile: () => true }
        ] as any) // project directory structure
        .mockResolvedValueOnce([
          { name: 'index.ts', isDirectory: () => false, isFile: () => true }
        ] as any) // src directory structure  
        .mockResolvedValueOnce(['ticket1.yaml'] as any); // tickets directory

      // Mock fs.stat for file info
      mockFs.stat.mockResolvedValue({
        mtime: new Date('2024-01-01T00:00:00.000Z'),
        size: 1000
      } as any);

      const context = await contextLoader.loadProjectContext();

      expect(context).toMatchObject({
        specifications: expect.stringContaining('Project Specifications'),
        readme: expect.stringContaining('Project README'),
        dependencies: { express: '^4.18.0' }
      });
      expect(context.tickets).toHaveLength(1);
    });

    test.skip('should handle missing specification files gracefully', async () => {
      mockExistsSync.mockReturnValue(false);
      mockFs.readdir
        .mockResolvedValueOnce([]) // project directory structure
        .mockResolvedValueOnce([]); // tickets directory
      
      mockFs.readFile.mockResolvedValueOnce('{}'); // empty package.json

      const context = await contextLoader.loadProjectContext();

      expect(context.specifications).toBe('');
      expect(context.readme).toBe('');
      expect(context.structure).toEqual([]);
      expect(context.tickets).toEqual([]);
      expect(context.dependencies).toEqual({});
    });

    test.skip('should filter files by extension when specified', async () => {
      const options: ContextLoadOptions = {
        fileExtensions: ['.ts', '.js']
      };

      mockExistsSync.mockReturnValue(false);
      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'app.ts', isDirectory: () => false, isFile: () => true } as any,
          { name: 'config.json', isDirectory: () => false, isFile: () => true } as any,
          { name: 'styles.css', isDirectory: () => false, isFile: () => true } as any
        ]) // project directory structure
        .mockResolvedValueOnce([]); // tickets directory
      
      mockFs.readFile.mockResolvedValueOnce('{}'); // empty package.json

      mockFs.stat.mockResolvedValue({
        mtime: new Date('2024-01-01T00:00:00.000Z'),
        size: 500
      } as any);

      const context = await contextLoader.loadProjectContext(options);

      expect(context.structure).toHaveLength(1);
      expect(context.structure[0].path).toBe('app.ts');
    });

    test.skip('should skip large files when maxFileSize is specified', async () => {
      const options: ContextLoadOptions = {
        maxFileSize: 1000 // 1KB
      };

      mockExistsSync.mockReturnValue(false);
      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'small.txt', isDirectory: () => false, isFile: () => true } as any,
          { name: 'large.txt', isDirectory: () => false, isFile: () => true } as any
        ]) // project directory structure
        .mockResolvedValueOnce([]); // tickets directory
      
      mockFs.readFile.mockResolvedValueOnce('{}'); // empty package.json

      mockFs.stat
        .mockResolvedValueOnce({
          mtime: new Date('2024-01-01T00:00:00.000Z'),
          size: 500 // Small file
        } as any)
        .mockResolvedValueOnce({
          mtime: new Date('2024-01-01T00:00:00.000Z'),
          size: 2000 // Large file
        } as any);

      const context = await contextLoader.loadProjectContext(options);

      expect(context.structure).toHaveLength(1);
      expect(context.structure[0].path).toBe('small.txt');
    });

    test.skip('should load ticket information correctly', async () => {
      mockExistsSync
        .mockReturnValueOnce(false) // no specs
        .mockReturnValueOnce(false) // no readme
        .mockReturnValueOnce(true); // tickets exist

      mockFs.readdir
        .mockResolvedValueOnce([]) // no project files
        .mockResolvedValueOnce(['ticket1.yaml', 'readme.txt'] as any); // tickets dir

      mockFs.readFile
        .mockResolvedValueOnce('{}') // empty package.json
        .mockResolvedValueOnce(`
id: ticket1
title: Fix authentication bug
status: open
priority: high
assignedTo: developer-1
description: Fix the login issue
`);

      const context = await contextLoader.loadProjectContext();

      expect(context.tickets).toHaveLength(1);
      expect(context.tickets[0]).toContain('Fix authentication bug');
      expect(context.tickets[0]).toContain('**Status:** open');
      expect(context.tickets[0]).toContain('**Priority:** high');
    });
  });

  describe('generateContextPrompt', () => {
    test.skip('should generate a comprehensive context prompt for a team member', async () => {
      const teamMember: TeamMember = {
        id: 'member-1',
        name: 'John Developer',
        role: 'developer',
        sessionName: 'session-dev-1',
        systemPrompt: 'You are a senior developer responsible for backend implementation.',
        status: 'working',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      // Mock context loading
      mockExistsSync.mockReturnValue(true);
      mockFs.readFile
        .mockResolvedValueOnce('# Project Spec\nBuild a web app')
        .mockResolvedValueOnce('# README\nGetting started guide')
        .mockResolvedValueOnce('{"dependencies": {"express": "^4.18.0"}}')
        .mockResolvedValueOnce('id: ticket1\ntitle: Test Ticket\nstatus: todo\ndescription: Test');

      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'src', isDirectory: () => true, isFile: () => false } as any
        ])
        .mockResolvedValueOnce([
          { name: 'index.ts', isDirectory: () => false, isFile: () => true }
        ] as any)
        .mockResolvedValueOnce(['ticket1.yaml'] as any);

      mockFs.stat.mockResolvedValue({
        mtime: new Date('2024-01-01T00:00:00.000Z'),
        size: 1000
      } as any);

      const contextPrompt = await contextLoader.generateContextPrompt(teamMember);

      expect(contextPrompt).toContain('# Project Context for John Developer (developer)');
      expect(contextPrompt).toContain('## Your Role');
      expect(contextPrompt).toContain('You are a senior developer');
      expect(contextPrompt).toContain('## Project Specifications');
      expect(contextPrompt).toContain('## Project README');
      expect(contextPrompt).toContain('## Project Structure');
    });

    test.skip('should filter tickets relevant to the team member', async () => {
      const teamMember: TeamMember = {
        id: 'member-1',
        name: 'John Developer',
        role: 'developer',
        sessionName: 'session-dev-1',
        systemPrompt: 'You are a developer.',
        status: 'working',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      mockExistsSync.mockReturnValue(true);
      mockFs.readFile
        .mockResolvedValueOnce('') // empty specs
        .mockResolvedValueOnce('') // empty readme
        .mockResolvedValueOnce('{}') // empty package.json
        .mockResolvedValueOnce(`
title: Task for John
assignedTo: John Developer
description: This is assigned to John
`) // First ticket read
        .mockResolvedValueOnce(`
title: Unassigned Task
assignedTo: 
description: This needs someone
`); // Second ticket read

      mockFs.readdir
        .mockResolvedValueOnce([]) // no project files
        .mockResolvedValueOnce(['ticket1.yaml', 'ticket2.yaml'] as any);

      const contextPrompt = await contextLoader.generateContextPrompt(teamMember);

      expect(contextPrompt).toContain('## Relevant Tickets');
      expect(contextPrompt).toContain('Task for John');
    });
  });

  describe('injectContextIntoSession', () => {
    test('should inject context into tmux session successfully', async () => {
      const teamMember: TeamMember = {
        id: 'member-1',
        name: 'John Developer',
        role: 'developer',
        sessionName: 'session-dev-1',
        systemPrompt: 'You are a developer.',
        status: 'working',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      // Mock directory creation and file writing
      mockExistsSync.mockReturnValue(false);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      // Mock context loading (simplified)
      mockFs.readFile
        .mockResolvedValueOnce('') // specs
        .mockResolvedValueOnce('') // readme
        .mockResolvedValueOnce('{}'); // package.json

      mockFs.readdir
        .mockResolvedValueOnce([]) // project files
        .mockResolvedValueOnce([]); // tickets

      // Mock tmux command execution
      const mockExec = jest.fn().mockResolvedValue({ stdout: 'success', stderr: '' });
      const mockPromisify = jest.fn().mockReturnValue(mockExec);
      
      jest.doMock('util', () => ({
        promisify: mockPromisify
      }));

      const success = await contextLoader.injectContextIntoSession(teamMember.sessionName, teamMember);

      expect(success).toBe(true);
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('context'),
        { recursive: true }
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${teamMember.id}-context.md`),
        expect.any(String),
        'utf-8'
      );
    });

    test('should handle injection errors gracefully', async () => {
      const teamMember: TeamMember = {
        id: 'member-1',
        name: 'John Developer',
        role: 'developer',
        sessionName: 'session-dev-1',
        systemPrompt: 'You are a developer.',
        status: 'working',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      // Mock file system error
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      const success = await contextLoader.injectContextIntoSession(teamMember.sessionName, teamMember);

      expect(success).toBe(false);
    });
  });

  describe('refreshContext', () => {
    test('should refresh existing context file', async () => {
      const teamMember: TeamMember = {
        id: 'member-1',
        name: 'John Developer',
        role: 'developer',
        sessionName: 'session-dev-1',
        systemPrompt: 'You are a developer.',
        status: 'working',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      // Mock existing context file
      mockExistsSync.mockReturnValue(true);
      mockFs.writeFile.mockResolvedValue();

      // Mock context loading
      mockFs.readFile
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('{}');

      mockFs.readdir
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const contextPath = await contextLoader.refreshContext(teamMember);

      expect(contextPath).toContain(`${teamMember.id}-context.md`);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test.skip('should create new context if file does not exist', async () => {
      const teamMember: TeamMember = {
        id: 'member-1',
        name: 'John Developer',
        role: 'developer',
        sessionName: 'session-dev-1',
        systemPrompt: 'You are a developer.',
        status: 'working',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      // Mock non-existing context file first, then existing after creation
      mockExistsSync
        .mockReturnValueOnce(false) // context file doesn't exist
        .mockReturnValueOnce(false) // context dir doesn't exist
        .mockReturnValueOnce(true); // context file exists after creation

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue();

      // Mock context loading
      mockFs.readFile
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('{}');

      mockFs.readdir
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const contextPath = await contextLoader.refreshContext(teamMember);

      expect(contextPath).toContain(`${teamMember.id}-context.md`);
      expect(mockFs.mkdir).toHaveBeenCalled();
    });
  });

  describe('shouldIgnorePath', () => {
    test('should ignore common patterns', () => {
      const service = new ContextLoaderService('/test');
      
      // Access private method for testing
      const shouldIgnore = (service as any).shouldIgnorePath;

      expect(shouldIgnore('node_modules/express')).toBe(true);
      expect(shouldIgnore('.git/objects')).toBe(true);
      expect(shouldIgnore('dist/main.js')).toBe(true);
      expect(shouldIgnore('.DS_Store')).toBe(true);
      expect(shouldIgnore('logs/app.log')).toBe(true);
      
      expect(shouldIgnore('src/main.ts')).toBe(false);
      expect(shouldIgnore('README.md')).toBe(false);
    });
  });

  describe('file structure traversal', () => {
    test('should limit directory traversal depth', async () => {
      // Mock deep directory structure
      mockExistsSync.mockReturnValue(false);
      
      // Mock readdir to return nested directories
      let callCount = 0;
      mockFs.readdir.mockImplementation(async (dirPath) => {
        callCount++;
        if (callCount > 15) { // Prevent infinite loop in test
          return [];
        }
        return [
          { name: `dir${callCount}`, isDirectory: () => true, isFile: () => false } as any
        ];
      });

      mockFs.stat.mockResolvedValue({
        mtime: new Date('2024-01-01T00:00:00.000Z')
      } as any);

      const context = await contextLoader.loadProjectContext({
        includeFiles: true
      });

      // Should not exceed depth limit
      expect(context.structure.length).toBeLessThan(20);
    });
  });

  describe('error handling', () => {
    test('should handle file read errors gracefully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));
      mockFs.readdir.mockResolvedValue([]);

      const context = await contextLoader.loadProjectContext();

      // Should not throw and return default values
      expect(context.specifications).toBe('');
      expect(context.readme).toBe('');
    });

    test('should handle directory read errors gracefully', async () => {
      mockExistsSync.mockReturnValue(false);
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      const context = await contextLoader.loadProjectContext();

      expect(context.structure).toEqual([]);
    });
  });
});