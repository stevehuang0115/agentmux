import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import { UserStore, User } from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || '24h';

export interface AuthenticatedRequest extends Request {
  user?: User;
  userId?: string;
}

export interface AuthenticatedSocket extends Socket {
  user?: User;
  userId?: string;
}

export class AuthService {
  constructor(private userStore: UserStore) {}

  generateToken(user: User): string {
    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email
    };

    const options: SignOptions = { expiresIn: '24h' };
    return jwt.sign(payload, JWT_SECRET as string, options);
  }

  verifyToken(token: string): any {
    return jwt.verify(token, JWT_SECRET as string);
  }

  // Express middleware for HTTP routes
  authenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.substring(7);
        const decoded = this.verifyToken(token);
        
        const user = await this.userStore.findUserById(decoded.userId);
        if (!user || !user.isActive) {
          return res.status(401).json({ error: 'Invalid user or user deactivated' });
        }

        req.user = user;
        req.userId = user.id;
        next();
      } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
          return res.status(401).json({ error: 'Invalid token' });
        }
        if (error instanceof jwt.TokenExpiredError) {
          return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  // Socket.IO middleware
  authenticateSocket() {
    return async (socket: AuthenticatedSocket, next: (err?: any) => void) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = this.verifyToken(token);
        const user = await this.userStore.findUserById(decoded.userId);
        
        if (!user || !user.isActive) {
          return next(new Error('Invalid user or user deactivated'));
        }

        socket.user = user;
        socket.userId = user.id;
        next();
      } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
          return next(new Error('Invalid token'));
        }
        if (error instanceof jwt.TokenExpiredError) {
          return next(new Error('Token expired'));
        }
        return next(new Error('Authentication error'));
      }
    };
  }

  // Rate limiting per user
  createUserRateLimit() {
    const userRequests = new Map<string, { count: number; resetTime: number }>();
    const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    const MAX_REQUESTS = 200; // Per user limit

    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.userId) {
        return next(); // Let it fail at auth middleware
      }

      const now = Date.now();
      const userStats = userRequests.get(req.userId);

      if (!userStats || now > userStats.resetTime) {
        userRequests.set(req.userId, { count: 1, resetTime: now + WINDOW_MS });
        return next();
      }

      if (userStats.count >= MAX_REQUESTS) {
        return res.status(429).json({ 
          error: 'Too many requests',
          resetTime: new Date(userStats.resetTime).toISOString()
        });
      }

      userStats.count++;
      next();
    };
  }
}

// Validation middleware
export const validateAuthInput = {
  register: (req: Request, res: Response, next: NextFunction) => {
    const { username, email, password } = req.body;

    const errors: string[] = [];

    if (!username || username.length < 3 || username.length > 30) {
      errors.push('Username must be 3-30 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Valid email is required');
    }

    if (!password || password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
  },

  login: (req: Request, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    next();
  }
};