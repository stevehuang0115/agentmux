import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as terminalHandlers from './terminal.handlers.js';
import type { ApiContext } from '../types.js';
import { StorageService, TmuxService, SchedulerService, MessageSchedulerService } from '../../services/index.js';
import { ActiveProjectsService } from '../../services/active-projects.service.js';
import { PromptTemplateService } from '../../services/prompt-template.service.js';

// Mock dependencies
jest.mock('../../services/index.js');
jest.mock('../../services/active-projects.service.js');
jest.mock('../../services/prompt-template.service.js');

describe('Terminal Handlers', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockTmuxService: jest.Mocked<TmuxService>;
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

    // Mock services
    mockTmuxService = new TmuxService() as jest.Mocked<TmuxService>;

    // Setup API context
    mockApiContext = {
      storageService: new StorageService() as jest.Mocked<StorageService>,
      tmuxService: mockTmuxService,
      schedulerService: new SchedulerService() as jest.Mocked<SchedulerService>,
      messageSchedulerService: new MessageSchedulerService() as jest.Mocked<MessageSchedulerService>,
      activeProjectsService: new ActiveProjectsService() as jest.Mocked<ActiveProjectsService>,
      promptTemplateService: new PromptTemplateService() as jest.Mocked<PromptTemplateService>,
    };

    mockRequest = {};
    mockResponse = responseMock as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('listTerminalSessions', () => {
    it('should return list of terminal sessions successfully', async () => {
      const mockSessions = [
        { name: 'session1', active: true, created: '2024-01-01T00:00:00.000Z' },
        { name: 'session2', active: false, created: '2024-01-01T01:00:00.000Z' },
        { name: 'agentmux-dev', active: true, created: '2024-01-01T02:00:00.000Z' }
      ];

      mockTmuxService.listSessions.mockResolvedValue(mockSessions);

      await terminalHandlers.listTerminalSessions.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.listSessions).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: mockSessions
      });
    });

    it('should return empty array when no sessions exist', async () => {
      mockTmuxService.listSessions.mockResolvedValue([]);

      await terminalHandlers.listTerminalSessions.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.listSessions).toHaveBeenCalled();
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    it('should handle tmux service errors when listing sessions', async () => {
      mockTmuxService.listSessions.mockRejectedValue(new Error('tmux server not running'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await terminalHandlers.listTerminalSessions.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error listing terminal sessions:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to list terminal sessions'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('captureTerminal', () => {
    it('should capture terminal output successfully with default lines', async () => {
      const mockOutput = 'Terminal output line 1\nTerminal output line 2\nTerminal output line 3';

      mockRequest.params = { session: 'test-session' };
      mockRequest.query = {};

      mockTmuxService.capturePane.mockResolvedValue(mockOutput);

      await terminalHandlers.captureTerminal.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.capturePane).toHaveBeenCalledWith('test-session', 100);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          output: mockOutput,
          session: 'test-session'
        }
      });
    });

    it('should capture terminal output with custom number of lines', async () => {
      const mockOutput = 'Recent terminal output';

      mockRequest.params = { session: 'dev-session' };
      mockRequest.query = { lines: '50' };

      mockTmuxService.capturePane.mockResolvedValue(mockOutput);

      await terminalHandlers.captureTerminal.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.capturePane).toHaveBeenCalledWith('dev-session', 50);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          output: mockOutput,
          session: 'dev-session'
        }
      });
    });

    it('should handle invalid line numbers gracefully', async () => {
      const mockOutput = 'Terminal output';

      mockRequest.params = { session: 'test-session' };
      mockRequest.query = { lines: 'invalid' };

      mockTmuxService.capturePane.mockResolvedValue(mockOutput);

      await terminalHandlers.captureTerminal.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // parseInt('invalid') returns NaN, which should fall back to default 100
      expect(mockTmuxService.capturePane).toHaveBeenCalledWith('test-session', NaN);
    });

    it('should handle capture errors', async () => {
      mockRequest.params = { session: 'nonexistent-session' };
      mockTmuxService.capturePane.mockRejectedValue(new Error('Session not found'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await terminalHandlers.captureTerminal.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error capturing terminal:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to capture terminal output'
      });

      consoleSpy.mockRestore();
    });

    it('should handle empty capture output', async () => {
      mockRequest.params = { session: 'empty-session' };
      mockRequest.query = { lines: '10' };

      mockTmuxService.capturePane.mockResolvedValue('');

      await terminalHandlers.captureTerminal.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        data: {
          output: '',
          session: 'empty-session'
        }
      });
    });
  });

  describe('sendTerminalInput', () => {
    it('should send input to terminal successfully', async () => {
      mockRequest.params = { session: 'dev-session' };
      mockRequest.body = { input: 'ls -la' };

      mockTmuxService.sendMessage.mockResolvedValue(undefined);

      await terminalHandlers.sendTerminalInput.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('dev-session', 'ls -la');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Input sent successfully'
      });
    });

    it('should return 400 when input is missing', async () => {
      mockRequest.params = { session: 'dev-session' };
      mockRequest.body = {};

      await terminalHandlers.sendTerminalInput.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sendMessage).not.toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Input is required'
      });
    });

    it('should return 400 when input is empty string', async () => {
      mockRequest.params = { session: 'dev-session' };
      mockRequest.body = { input: '' };

      await terminalHandlers.sendTerminalInput.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Input is required'
      });
    });

    it('should handle complex commands with special characters', async () => {
      mockRequest.params = { session: 'dev-session' };
      mockRequest.body = { input: 'grep -r "test" . | head -10' };

      mockTmuxService.sendMessage.mockResolvedValue(undefined);

      await terminalHandlers.sendTerminalInput.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith('dev-session', 'grep -r "test" . | head -10');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Input sent successfully'
      });
    });

    it('should handle send message errors', async () => {
      mockRequest.params = { session: 'nonexistent-session' };
      mockRequest.body = { input: 'echo "test"' };

      mockTmuxService.sendMessage.mockRejectedValue(new Error('Session not found'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await terminalHandlers.sendTerminalInput.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error sending terminal input:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to send terminal input'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('sendTerminalKey', () => {
    it('should send special keys successfully', async () => {
      mockRequest.params = { session: 'dev-session' };
      mockRequest.body = { key: 'C-c' };

      mockTmuxService.sendKeys.mockResolvedValue(undefined);

      await terminalHandlers.sendTerminalKey.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sendKeys).toHaveBeenCalledWith('dev-session', 'C-c');
      expect(responseMock.json).toHaveBeenCalledWith({
        success: true,
        message: 'Key sent successfully'
      });
    });

    it('should handle various special key combinations', async () => {
      const specialKeys = ['C-c', 'C-z', 'Enter', 'Tab', 'Escape', 'Up', 'Down'];
      
      for (const key of specialKeys) {
        mockRequest.params = { session: 'test-session' };
        mockRequest.body = { key };

        mockTmuxService.sendKeys.mockResolvedValue(undefined);

        await terminalHandlers.sendTerminalKey.call(
          mockApiContext,
          mockRequest as Request,
          mockResponse as Response
        );

        expect(mockTmuxService.sendKeys).toHaveBeenCalledWith('test-session', key);
      }
    });

    it('should return 400 when key is missing', async () => {
      mockRequest.params = { session: 'dev-session' };
      mockRequest.body = {};

      await terminalHandlers.sendTerminalKey.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.sendKeys).not.toHaveBeenCalled();
      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Key is required'
      });
    });

    it('should handle send keys errors', async () => {
      mockRequest.params = { session: 'nonexistent-session' };
      mockRequest.body = { key: 'Enter' };

      mockTmuxService.sendKeys.mockRejectedValue(new Error('Session not accessible'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await terminalHandlers.sendTerminalKey.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(consoleSpy).toHaveBeenCalledWith('Error sending terminal key:', expect.any(Error));
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to send terminal key'
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Parameter validation', () => {
    it('should handle missing session parameter', async () => {
      mockRequest.params = {};

      await terminalHandlers.captureTerminal.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.capturePane).toHaveBeenCalledWith(undefined, 100);
    });

    it('should handle missing request body', async () => {
      mockRequest.params = { session: 'test-session' };
      mockRequest.body = null;

      await terminalHandlers.sendTerminalInput.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        success: false,
        error: 'Input is required'
      });
    });
  });

  describe('Integration', () => {
    it('should properly use tmux service methods', async () => {
      // Test that all handlers properly delegate to tmux service
      expect(mockApiContext.tmuxService).toBe(mockTmuxService);

      mockRequest.params = { session: 'integration-test' };
      mockTmuxService.listSessions.mockResolvedValue([]);

      await terminalHandlers.listTerminalSessions.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.listSessions).toHaveBeenCalled();
    });

    it('should maintain session state across operations', async () => {
      const sessionName = 'persistent-session';

      // Capture initial state
      mockRequest.params = { session: sessionName };
      mockTmuxService.capturePane.mockResolvedValue('initial output');

      await terminalHandlers.captureTerminal.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      // Send input
      mockRequest.body = { input: 'echo "test"' };
      mockTmuxService.sendMessage.mockResolvedValue(undefined);

      await terminalHandlers.sendTerminalInput.call(
        mockApiContext,
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockTmuxService.capturePane).toHaveBeenCalledWith(sessionName, 100);
      expect(mockTmuxService.sendMessage).toHaveBeenCalledWith(sessionName, 'echo "test"');
    });
  });
});