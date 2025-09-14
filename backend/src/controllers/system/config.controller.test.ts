import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as configHandlers from './config.controller.js';
import type { ApiContext } from '../types.js';
import { StorageService, TmuxService, SchedulerService } from '../../services/index.js';
import { ActiveProjectsService } from '../../services/index.js';
import { PromptTemplateService } from '../../services/index.js';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../../services/index.js');
jest.mock('../../services/index.js');
jest.mock('../../services/index.js');
jest.mock('fs/promises');

describe('Config Handlers', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseMock: {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create response mock
    responseMock = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    // Setup API context
    mockApiContext = {
      storageService: new StorageService() as jest.Mocked<StorageService>,
      tmuxService: new TmuxService() as jest.Mocked<TmuxService>,
      schedulerService: new SchedulerService() as jest.Mocked<SchedulerService>,
      activeProjectsService: new ActiveProjectsService() as jest.Mocked<ActiveProjectsService>,
      promptTemplateService: new PromptTemplateService() as jest.Mocked<PromptTemplateService>,
    };

    mockRequest = {};
    mockResponse = responseMock as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getConfigFile', () => {
    it('should return config file content successfully', async () => {
      const mockConfigContent = {
        version: '1.0.0',
        apiPort: 3000,
        mcpPort: 3001,
        features: {
          gitIntegration: true,
          autoCommit: false
        }
      };

      mockRequest.params = { filename: 'config.json' };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfigContent, null, 2));

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(fs.readFile).toHaveBeenCalledWith('config.json', 'utf-8');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          filename: 'config.json',
          content: JSON.stringify(mockConfigContent, null, 2)
        }
      });
    });

    it('should handle JSON config files', async () => {
      const jsonConfig = { env: 'development', debug: true };
      mockRequest.params = { filename: 'app.json' };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(jsonConfig));

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          filename: 'app.json',
          content: JSON.stringify(jsonConfig)
        }
      });
    });

    it('should handle YAML config files', async () => {
      const yamlContent = 'version: 1.0.0\nname: test-app\nport: 3000\n';
      mockRequest.params = { filename: 'app.yml' };
      (fs.readFile as jest.Mock).mockResolvedValue(yamlContent);

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          filename: 'app.yml',
          content: yamlContent
        }
      });
    });

    it('should handle environment files', async () => {
      const envContent = 'NODE_ENV=development\nAPI_PORT=3000\nDATABASE_URL=sqlite://db.sqlite\n';
      mockRequest.params = { filename: '.env' };
      (fs.readFile as jest.Mock).mockResolvedValue(envContent);

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          filename: '.env',
          content: envContent
        }
      });
    });

    it('should return 404 when config file not found', async () => {
      mockRequest.params = { filename: 'nonexistent.json' };
      const error = new Error('File not found') as any;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Config file not found'
      });
    });

    it('should handle file read permission errors', async () => {
      mockRequest.params = { filename: 'secure.json' };
      const error = new Error('Permission denied') as any;
      error.code = 'EACCES';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error reading config file:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to read config file'
      });

      consoleSpy.mockRestore();
    });

    it('should handle empty config files', async () => {
      mockRequest.params = { filename: 'empty.json' };
      (fs.readFile as jest.Mock).mockResolvedValue('');

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          filename: 'empty.json',
          content: ''
        }
      });
    });

    it('should handle binary files gracefully', async () => {
      mockRequest.params = { filename: 'binary.dat' };
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
      (fs.readFile as jest.Mock).mockResolvedValue(binaryContent);

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          filename: 'binary.dat',
          content: binaryContent.toString('utf-8')
        }
      });
    });

    it('should validate filename parameter', async () => {
      mockRequest.params = {};

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(fs.readFile).toHaveBeenCalledWith(undefined, 'utf-8');
      // The fs.readFile call will likely fail, which will trigger error handling
    });

    it('should handle various config file extensions', async () => {
      const testFiles = [
        { name: 'package.json', content: '{"name": "test"}' },
        { name: 'tsconfig.json', content: '{"compilerOptions": {}}' },
        { name: 'docker-compose.yml', content: 'version: "3"' },
        { name: '.gitignore', content: 'node_modules/\n*.log' },
        { name: 'Dockerfile', content: 'FROM node:18' },
        { name: 'README.md', content: '# Test Project' }
      ];

      for (const testFile of testFiles) {
        mockRequest.params = { filename: testFile.name };
        (fs.readFile as jest.Mock).mockResolvedValue(testFile.content);

        await configHandlers.getConfigFile.call(
          mockApiContext,
          mockRequest as Request,
          mockResponse as Response
        );

        expect(fs.readFile).toHaveBeenCalledWith(testFile.name, 'utf-8');
        expect(responseMock.json).toHaveBeenCalledWith({
          success: true,
          data: {
            filename: testFile.name,
            content: testFile.content
          }
        });
      }
    });

    it('should handle file system errors other than ENOENT', async () => {
      mockRequest.params = { filename: 'corrupted.json' };
      const error = new Error('I/O error') as any;
      error.code = 'EIO';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error reading config file:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to read config file'
      });

      consoleSpy.mockRestore();
    });

    it('should handle malformed JSON gracefully', async () => {
      mockRequest.params = { filename: 'malformed.json' };
      const malformedJson = '{"name": "test", invalid}';
      (fs.readFile as jest.Mock).mockResolvedValue(malformedJson);

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // The handler should still return the raw content, not try to parse it
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          filename: 'malformed.json',
          content: malformedJson
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle async errors properly', async () => {
      mockRequest.params = { filename: 'test.json' };
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Async error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(500);

      consoleSpy.mockRestore();
    });

    it('should handle null filename parameter', async () => {
      mockRequest.params = { filename: null };

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(fs.readFile).toHaveBeenCalledWith(null, 'utf-8');
    });
  });

  describe('Integration', () => {
    it('should properly use file system operations', async () => {
      mockRequest.params = { filename: 'integration-test.json' };
      (fs.readFile as jest.Mock).mockResolvedValue('{"test": true}');

      await configHandlers.getConfigFile.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(fs.readFile).toHaveBeenCalledWith('integration-test.json', 'utf-8');
    });
  });
});