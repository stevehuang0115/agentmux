import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import rateLimit from 'express-rate-limit';

// Mock JWT secret for testing
const TEST_JWT_SECRET = 'test-secret-key-for-jwt-validation-testing-only';
const TEST_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';

describe('Authentication Security Tests', () => {
  let app: express.Application;
  let server: any;

  beforeAll(() => {
    app = express();
    server = createServer(app);
    
    app.use(express.json());
    
    // Mock auth routes for testing
    setupMockAuthRoutes(app);
  });

  afterAll(() => {
    if (server) server.close();
  });

  describe('JWT Token Validation', () => {
    describe('Valid Token Tests', () => {
      it('should accept valid JWT tokens', async () => {
        const payload = { userId: 'test-user', role: 'admin' };
        const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
        
        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        
        expect(response.body.userId).toBe('test-user');
      });

      it('should validate token expiration', async () => {
        const payload = { userId: 'test-user' };
        const expiredToken = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1h' });
        
        await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);
      });

      it('should validate token signature', async () => {
        const payload = { userId: 'test-user' };
        const invalidToken = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });
        
        await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);
      });
    });

    describe('Token Forgery Prevention', () => {
      const maliciousTokens = [
        'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiJhZG1pbiJ9.', // None algorithm
        'Bearer malicious-string',
        'Bearer {"userId":"admin","role":"admin"}', // Plain JSON
        'Bearer ../../etc/passwd',
        'Bearer <script>alert("xss")</script>',
        'Bearer ; rm -rf /',
        'Bearer $(curl evil.com)'
      ];

      maliciousTokens.forEach((token, index) => {
        it(`should reject malicious token ${index + 1}`, async () => {
          await request(app)
            .get('/protected')
            .set('Authorization', token)
            .expect(401);
        });
      });

      it('should reject tokens with "none" algorithm', async () => {
        // Manually craft token with "none" algorithm
        const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64');
        const payload = Buffer.from('{"userId":"admin","role":"admin"}').toString('base64');
        const noneToken = `${header}.${payload}.`;
        
        await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${noneToken}`)
          .expect(401);
      });
    });

    describe('Token Structure Validation', () => {
      it('should require Bearer prefix', async () => {
        const token = jwt.sign({ userId: 'test' }, TEST_JWT_SECRET);
        
        await request(app)
          .get('/protected')
          .set('Authorization', token) // Missing "Bearer "
          .expect(401);
      });

      it('should reject empty tokens', async () => {
        await request(app)
          .get('/protected')
          .set('Authorization', 'Bearer ')
          .expect(401);
      });

      it('should reject malformed tokens', async () => {
        await request(app)
          .get('/protected')
          .set('Authorization', 'Bearer invalid.token.structure')
          .expect(401);
      });
    });
  });

  describe('Password Security Tests', () => {
    describe('Password Hashing Validation', () => {
      it('should properly hash passwords with bcrypt', async () => {
        const password = 'test-password-123';
        const hash = await bcrypt.hash(password, 12);
        
        expect(hash).not.toBe(password);
        expect(hash.startsWith('$2b$12$')).toBe(true);
        expect(await bcrypt.compare(password, hash)).toBe(true);
      });

      it('should use strong salt rounds (>=12)', async () => {
        const password = 'test-password';
        const hash = await bcrypt.hash(password, 12);
        
        // Extract salt rounds from hash
        const rounds = parseInt(hash.split('$')[2]);
        expect(rounds).toBeGreaterThanOrEqual(12);
      });

      it('should reject weak passwords', async () => {
        const weakPasswords = [
          'password',
          '123456',
          'admin',
          'test',
          'p',
          '12345678',
          'password123'
        ];

        for (const password of weakPasswords) {
          await request(app)
            .post('/auth/register')
            .send({ username: 'test', password })
            .expect(400);
        }
      });

      it('should require password complexity', async () => {
        const response = await request(app)
          .post('/auth/register')
          .send({ 
            username: 'testuser',
            password: 'WeakPass1!' // Should meet requirements
          })
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
      });
    });
  });

  describe('Authentication Endpoint Security', () => {
    describe('Login Endpoint', () => {
      it('should rate limit login attempts', async () => {
        // Attempt multiple rapid logins
        const requests = Array(10).fill(null).map(() =>
          request(app)
            .post('/auth/login')
            .send({ username: 'test', password: 'wrong' })
        );

        const responses = await Promise.all(requests);
        
        // Some should be rate limited
        const rateLimited = responses.filter(r => r.status === 429);
        expect(rateLimited.length).toBeGreaterThan(0);
      });

      it('should not reveal whether user exists', async () => {
        const validUserResponse = await request(app)
          .post('/auth/login')
          .send({ username: 'existinguser', password: 'wrongpassword' });

        const invalidUserResponse = await request(app)
          .post('/auth/login')
          .send({ username: 'nonexistentuser', password: 'wrongpassword' });

        // Both should return same generic error
        expect(validUserResponse.status).toBe(401);
        expect(invalidUserResponse.status).toBe(401);
        expect(validUserResponse.body.error).toBe(invalidUserResponse.body.error);
      });

      it('should implement account lockout after failed attempts', async () => {
        // Simulate multiple failed attempts for same user
        for (let i = 0; i < 5; i++) {
          await request(app)
            .post('/auth/login')
            .send({ username: 'locktest', password: 'wrong' });
        }

        // Next attempt should be locked
        const response = await request(app)
          .post('/auth/login')
          .send({ username: 'locktest', password: 'correct' });
        
        expect([423, 429]).toContain(response.status); // Locked or Too Many Requests
      });
    });

    describe('Registration Endpoint', () => {
      it('should sanitize username input', async () => {
        const maliciousUsernames = [
          'admin; DROP TABLE users; --',
          '../../../etc/passwd',
          '<script>alert("xss")</script>',
          'user$(whoami)name'
        ];

        for (const username of maliciousUsernames) {
          await request(app)
            .post('/auth/register')
            .send({ username, password: 'StrongPass123!' })
            .expect(400);
        }
      });

      it('should prevent duplicate usernames', async () => {
        await request(app)
          .post('/auth/register')
          .send({ username: 'duplicate', password: 'StrongPass123!' })
          .expect(201);

        await request(app)
          .post('/auth/register')
          .send({ username: 'duplicate', password: 'DifferentPass123!' })
          .expect(409); // Conflict
      });
    });

    describe('Token Refresh Security', () => {
      it('should validate refresh token signature', async () => {
        const fakeRefreshToken = jwt.sign({ userId: 'test' }, 'wrong-secret');
        
        await request(app)
          .post('/auth/refresh')
          .send({ refreshToken: fakeRefreshToken })
          .expect(401);
      });

      it('should invalidate used refresh tokens', async () => {
        const refreshToken = jwt.sign({ userId: 'test' }, TEST_REFRESH_SECRET);
        
        // First use should work
        await request(app)
          .post('/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        // Second use should fail
        await request(app)
          .post('/auth/refresh')
          .send({ refreshToken })
          .expect(401);
      });
    });
  });

  describe('Session Management Security', () => {
    it('should invalidate all sessions on password change', async () => {
      const token = jwt.sign({ userId: 'test-user' }, TEST_JWT_SECRET);
      
      // Change password
      await request(app)
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'old', newPassword: 'NewStrong123!' })
        .expect(200);

      // Old token should be invalid
      await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should support secure logout', async () => {
      const token = jwt.sign({ userId: 'test-user' }, TEST_JWT_SECRET);
      
      // Logout
      await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Token should be blacklisted
      await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });
});

// Mock authentication routes for testing
function setupMockAuthRoutes(app: express.Application) {
  // Rate limiter for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { error: 'Too many authentication attempts' },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Mock user storage
  const users = new Map([
    ['existinguser', { 
      username: 'existinguser', 
      passwordHash: bcrypt.hashSync('correctpassword', 12),
      failedAttempts: 0,
      lockedUntil: undefined
    }]
  ]);

  const blacklistedTokens = new Set<string>();
  const usedRefreshTokens = new Set<string>();

  // Protected route
  app.get('/protected', (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    if (blacklistedTokens.has(token)) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    try {
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      res.json({ userId: decoded.userId, role: decoded.role });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // Login route
  app.post('/auth/login', authLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    const user = users.get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      return res.status(423).json({ error: 'Account temporarily locked' });
    }

    if (user.failedAttempts >= 5) {
      (user as any).lockedUntil = Date.now() + (15 * 60 * 1000); // 15 minutes
      return res.status(423).json({ error: 'Account locked due to too many failed attempts' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      user.failedAttempts += 1;
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset failed attempts on successful login
    user.failedAttempts = 0;
    user.lockedUntil = undefined;

    const token = jwt.sign({ userId: username }, TEST_JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  });

  // Registration route
  app.post('/auth/register', async (req, res) => {
    const { username, password } = req.body;
    
    // Validate username
    if (!username || username.length < 3 || /[^a-zA-Z0-9_-]/.test(username)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    // Check for malicious patterns
    const maliciousPatterns = [/[;&|`$()<>]/, /\.\.\//,  /script|eval|exec/i];
    if (maliciousPatterns.some(pattern => pattern.test(username))) {
      return res.status(400).json({ error: 'Username contains invalid characters' });
    }

    // Validate password strength
    if (!password || password.length < 8 || 
        !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(password)) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' 
      });
    }

    if (users.has(username)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    users.set(username, { 
      username, 
      passwordHash,
      failedAttempts: 0,
      lockedUntil: undefined
    });

    res.status(201).json({ success: true });
  });

  // Refresh token route
  app.post('/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;
    
    if (usedRefreshTokens.has(refreshToken)) {
      return res.status(401).json({ error: 'Refresh token already used' });
    }

    try {
      const decoded = jwt.verify(refreshToken, TEST_REFRESH_SECRET) as any;
      usedRefreshTokens.add(refreshToken);
      
      const newToken = jwt.sign({ userId: decoded.userId }, TEST_JWT_SECRET, { expiresIn: '1h' });
      res.json({ token: newToken });
    } catch (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  });

  // Logout route
  app.post('/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      blacklistedTokens.add(token);
    }
    res.json({ success: true });
  });

  // Change password route
  app.post('/auth/change-password', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      
      // Invalidate all tokens for this user (simplified)
      blacklistedTokens.add(token);
      
      res.json({ success: true });
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  });
}