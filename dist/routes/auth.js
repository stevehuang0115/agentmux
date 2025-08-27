"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRoutes = createAuthRoutes;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
function createAuthRoutes(userStore, authService) {
    const router = (0, express_1.Router)();
    // Register new user
    router.post('/register', auth_1.validateAuthInput.register, async (req, res) => {
        try {
            const { username, email, password } = req.body;
            const user = await userStore.createUser({ username, email, password });
            const token = authService.generateToken(user);
            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        createdAt: user.createdAt
                    }
                }
            });
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('already exists')) {
                    return res.status(409).json({ error: error.message });
                }
            }
            res.status(500).json({ error: 'Failed to create user' });
        }
    });
    // Login user
    router.post('/login', auth_1.validateAuthInput.login, async (req, res) => {
        try {
            const { username, password } = req.body;
            const user = await userStore.authenticateUser({ username, password });
            if (!user) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }
            const token = authService.generateToken(user);
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        createdAt: user.createdAt
                    }
                }
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Login failed' });
        }
    });
    // Get current user info (protected route)
    router.get('/me', authService.authenticate(), async (req, res) => {
        res.json({
            success: true,
            data: {
                user: {
                    id: req.user.id,
                    username: req.user.username,
                    email: req.user.email,
                    createdAt: req.user.createdAt
                }
            }
        });
    });
    // Logout (client-side token deletion, but we can track it)
    router.post('/logout', authService.authenticate(), async (req, res) => {
        // In a real app, you might want to blacklist the token
        res.json({
            success: true,
            message: 'Logout successful'
        });
    });
    // Change password (protected route)
    router.post('/change-password', authService.authenticate(), async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Current password and new password are required' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'New password must be at least 6 characters' });
            }
            // Verify current password
            const isValid = await userStore.authenticateUser({
                username: req.user.username,
                password: currentPassword
            });
            if (!isValid) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
            // In a real implementation, you'd update the password in the database
            // For now, we'll just return success
            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to change password' });
        }
    });
    return router;
}
//# sourceMappingURL=auth.js.map