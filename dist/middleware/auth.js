"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuthInput = exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
class AuthService {
    constructor(userStore) {
        this.userStore = userStore;
    }
    generateToken(user) {
        const payload = {
            userId: user.id,
            username: user.username,
            email: user.email
        };
        const options = { expiresIn: '24h' };
        return jsonwebtoken_1.default.sign(payload, JWT_SECRET, options);
    }
    verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    // Express middleware for HTTP routes
    authenticate() {
        return async (req, res, next) => {
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
            }
            catch (error) {
                if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                    return res.status(401).json({ error: 'Invalid token' });
                }
                if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                    return res.status(401).json({ error: 'Token expired' });
                }
                return res.status(500).json({ error: 'Authentication error' });
            }
        };
    }
    // Socket.IO middleware
    authenticateSocket() {
        return async (socket, next) => {
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
            }
            catch (error) {
                if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                    return next(new Error('Invalid token'));
                }
                if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                    return next(new Error('Token expired'));
                }
                return next(new Error('Authentication error'));
            }
        };
    }
    // Rate limiting per user
    createUserRateLimit() {
        const userRequests = new Map();
        const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
        const MAX_REQUESTS = 200; // Per user limit
        return (req, res, next) => {
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
exports.AuthService = AuthService;
// Validation middleware
exports.validateAuthInput = {
    register: (req, res, next) => {
        const { username, email, password } = req.body;
        const errors = [];
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
    login: (req, res, next) => {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        next();
    }
};
//# sourceMappingURL=auth.js.map