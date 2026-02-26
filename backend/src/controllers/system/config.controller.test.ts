import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response } from 'express';
import * as configHandlers from './config.controller.js';
import type { ApiContext } from '../types.js';
import * as fs from 'fs';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}));

describe('Config Handlers', () => {
  let mockApiContext: ApiContext;
  let mockRequest: Partial<Request>;
  let responseMock: { status: jest.Mock<any>; json: jest.Mock<any> };

  beforeEach(() => {
    jest.clearAllMocks();

    mockApiContext = {} as ApiContext;
    mockRequest = { params: { fileName: 'config.json' } };
    responseMock = {
      status: jest.fn<any>().mockReturnThis(),
      json: jest.fn<any>().mockReturnThis(),
    };
  });

  it('returns 400 for invalid file names', async () => {
    mockRequest.params = { fileName: '../secrets.json' };

    await configHandlers.getConfigFile.call(mockApiContext, mockRequest as Request, responseMock as unknown as Response);

    expect(responseMock.status).toHaveBeenCalledWith(400);
    expect(responseMock.json).toHaveBeenCalledWith({ success: false, error: 'Invalid file name' });
  });

  it('returns 404 when config file does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    await configHandlers.getConfigFile.call(mockApiContext, mockRequest as Request, responseMock as unknown as Response);

    expect(responseMock.status).toHaveBeenCalledWith(404);
    expect(responseMock.json).toHaveBeenCalledWith({
      success: false,
      error: 'Config file config.json not found',
    });
  });

  it('returns parsed JSON for json files', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('{"foo":"bar"}');

    await configHandlers.getConfigFile.call(mockApiContext, mockRequest as Request, responseMock as unknown as Response);

    expect(fs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('/config/config.json'), 'utf8');
    expect(responseMock.json).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('returns 500 for invalid json content', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('{bad json');

    await configHandlers.getConfigFile.call(mockApiContext, mockRequest as Request, responseMock as unknown as Response);

    expect(responseMock.status).toHaveBeenCalledWith(500);
    expect(responseMock.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid JSON format in config file',
    });
  });

  it('returns plain content for non-json files', async () => {
    mockRequest.params = { fileName: 'notes.txt' };
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('hello world');

    await configHandlers.getConfigFile.call(mockApiContext, mockRequest as Request, responseMock as unknown as Response);

    expect(responseMock.json).toHaveBeenCalledWith({
      success: true,
      data: { content: 'hello world' },
      message: 'Config file notes.txt retrieved successfully',
    });
  });
});
