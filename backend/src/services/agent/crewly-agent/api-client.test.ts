import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CrewlyApiClient } from './api-client.js';

// Mock global fetch
const mockFetch = jest.fn<typeof fetch>();
(globalThis as any).fetch = mockFetch;

describe('CrewlyApiClient', () => {
  let client: CrewlyApiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new CrewlyApiClient('http://localhost:8787', 'test-session');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Helper to create a mock Response object.
   */
  function mockResponse(status: number, body: unknown): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    } as Response;
  }

  describe('constructor', () => {
    it('should strip trailing slash from base URL', () => {
      const c = new CrewlyApiClient('http://localhost:8787/', 'test');
      // Verify by making a request and checking the URL
      mockFetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));
      c.get('/teams');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/teams',
        expect.any(Object),
      );
    });

    it('should use defaults when no arguments provided', () => {
      const c = new CrewlyApiClient();
      expect(c).toBeDefined();
    });
  });

  describe('get', () => {
    it('should make a GET request and return parsed data', async () => {
      mockFetch.mockResolvedValue(mockResponse(200, { data: [{ id: 1 }] }));

      const result = await client.get('/teams');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1 }]);
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/teams',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Agent-Session': 'test-session',
          }),
        }),
      );
    });

    it('should return error for non-2xx status', async () => {
      mockFetch.mockResolvedValue(mockResponse(404, { error: 'Not found' }));

      const result = await client.get('/teams/nonexistent');

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toBe('Not found');
    });

    it('should handle response without data wrapper', async () => {
      mockFetch.mockResolvedValue(mockResponse(200, { teams: ['a'] }));

      const result = await client.get('/teams');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ teams: ['a'] });
    });
  });

  describe('post', () => {
    it('should make a POST request with JSON body', async () => {
      mockFetch.mockResolvedValue(mockResponse(201, { data: { checkId: 'abc' } }));

      const result = await client.post('/schedule', { minutes: 5, message: 'check' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ checkId: 'abc' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/schedule',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ minutes: 5, message: 'check' }),
        }),
      );
    });

    it('should handle POST failure', async () => {
      mockFetch.mockResolvedValue(mockResponse(500, { error: 'Internal error' }));

      const result = await client.post('/terminal/agent/deliver', { message: 'hi' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal error');
    });
  });

  describe('delete', () => {
    it('should make a DELETE request', async () => {
      mockFetch.mockResolvedValue(mockResponse(200, { success: true }));

      const result = await client.delete('/schedule/check-123');

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8787/api/schedule/check-123',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await client.get('/teams');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
      expect(result.status).toBe(0);
    });

    it('should handle abort/timeout errors', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const result = await client.get('/teams');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.status).toBe(0);
    });

    it('should handle non-JSON response body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'plain text response',
      } as Response);

      const result = await client.get('/health');

      expect(result.success).toBe(true);
      expect(result.data).toBe('plain text response');
    });

    it('should handle HTTP error without error field in body', async () => {
      mockFetch.mockResolvedValue(mockResponse(403, { message: 'forbidden' }));

      const result = await client.get('/admin');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 403');
    });
  });
});
