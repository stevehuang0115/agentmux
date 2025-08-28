"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStore = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
// In-memory user store (production would use database)
class UserStore {
    constructor() {
        this.users = new Map();
        this.usersByUsername = new Map();
        this.usersByEmail = new Map();
    }
    async createUser(input) {
        const { username, email, password } = input;
        // Check if user exists
        if (this.usersByUsername.has(username)) {
            throw new Error('Username already exists');
        }
        if (this.usersByEmail.has(email)) {
            throw new Error('Email already exists');
        }
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcryptjs_1.default.hash(password, saltRounds);
        // Create user
        const user = {
            id: this.generateId(),
            username,
            email,
            passwordHash,
            createdAt: new Date(),
            isActive: true
        };
        // Store user
        this.users.set(user.id, user);
        this.usersByUsername.set(username, user);
        this.usersByEmail.set(email, user);
        return user;
    }
    async authenticateUser(input) {
        const user = this.usersByUsername.get(input.username);
        if (!user || !user.isActive) {
            return null;
        }
        const isValidPassword = await bcryptjs_1.default.compare(input.password, user.passwordHash);
        return isValidPassword ? user : null;
    }
    async findUserById(id) {
        return this.users.get(id) || null;
    }
    async findUserByUsername(username) {
        return this.usersByUsername.get(username) || null;
    }
    async deactivateUser(id) {
        const user = this.users.get(id);
        if (!user)
            return false;
        user.isActive = false;
        return true;
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    // Development helper - create default admin user
    async createDefaultAdmin() {
        try {
            await this.createUser({
                username: 'admin',
                email: 'admin@agentmux.local',
                password: 'admin123'
            });
            console.log('✅ Default admin user created: admin/admin123');
        }
        catch (error) {
            // User already exists, ignore
        }
    }
}
exports.UserStore = UserStore;
//# sourceMappingURL=user.js.map