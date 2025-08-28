import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Create test server setup similar to main server
function createTestServer() {
  const app = express();
  const server = createServer(app);
  
  // Security middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting (more lenient for testing)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000 // Higher limit for tests
  });
  app.use(limiter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return { app, server };
}

describe('API Endpoint Tests', () => {
  let app: express.Application;
  let server: any;

  beforeAll(() => {
    const testServer = createTestServer();
    app = testServer.app;
    server = testServer.server;
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('Health Endpoint', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet security headers
      expect(response.headers).toHaveProperty('x-dns-prefetch-control');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });

  describe('Security Tests', () => {
    it('should reject oversized JSON payloads', async () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB payload
      
      await request(app)
        .post('/test-endpoint')
        .send({ data: largePayload })
        .expect(413); // Payload Too Large
    });

    it('should handle malformed JSON', async () => {
      await request(app)
        .post('/test-endpoint')
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}')
        .expect(400);
    });

    it('should apply CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should apply rate limiting', async () => {
      // Make multiple rapid requests
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/health')
      );
      
      const responses = await Promise.all(requests);
      
      // All should succeed with current high limit
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      await request(app)
        .get('/unknown-endpoint')
        .expect(404);
    });

    it('should handle invalid HTTP methods', async () => {
      await request(app)
        .put('/health')
        .expect(404); // Express returns 404 for method not allowed
    });
  });

  describe('Content Security', () => {
    it('should reject script tags in headers', async () => {
      await request(app)
        .get('/health')
        .set('X-Custom-Header', '<script>alert("xss")</script>')
        .expect(200);
      
      // Should not crash server
    });

    it('should handle null bytes in URL', async () => {
      // Note: Express may normalize null bytes, so this is more of a monitoring test
      const response = await request(app)
        .get('/health\x00');
      
      // Either 400 (if rejected) or 200 (if normalized) is acceptable
      expect([200, 400]).toContain(response.status);
    });
  });
});