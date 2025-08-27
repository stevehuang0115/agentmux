"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const tmux_1 = require("./tmux");
const validation_1 = require("./validation");
const user_1 = require("./models/user");
const auth_1 = require("./middleware/auth");
const auth_2 = require("./routes/auth");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3001;
// Initialize services
const tmuxManager = new tmux_1.TmuxManager();
const userStore = new user_1.UserStore();
const authService = new auth_1.AuthService(userStore);
// Create default admin user in development
if (process.env.NODE_ENV !== 'production') {
    userStore.createDefaultAdmin();
}
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);
// Static files
app.use(express_1.default.static('public'));
// Root route
app.get('/', (req, res) => {
    res.json({
        name: 'AgentMux API',
        version: '1.0.0',
        description: 'Secure WebSocket server for tmux session management',
        endpoints: {
            auth: {
                login: 'POST /auth/login',
                register: 'POST /auth/register',
                me: 'GET /auth/me',
                logout: 'POST /auth/logout'
            },
            websocket: 'ws://localhost:3001 (requires JWT token)',
            health: 'GET /health'
        },
        defaultCredentials: {
            username: 'admin',
            password: 'admin123'
        }
    });
});
// Routes
app.use('/auth', (0, auth_2.createAuthRoutes)(userStore, authService));
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// WebSocket authentication middleware
io.use(authService.authenticateSocket());
// WebSocket connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id} (User: ${socket.user?.username})`);
    // List all tmux sessions
    socket.on('list-sessions', async (callback) => {
        try {
            const sessions = await tmuxManager.listSessions();
            callback({ success: true, data: sessions });
        }
        catch (error) {
            callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    // Send message to tmux target
    socket.on('send-message', async (data, callback) => {
        try {
            // Validate input
            const sessionErrors = validation_1.Validator.validateSessionName(data.session);
            const messageErrors = validation_1.Validator.validateMessage(data.message);
            if (sessionErrors.length > 0 || messageErrors.length > 0) {
                callback({
                    success: false,
                    error: 'Validation failed',
                    errors: [...sessionErrors, ...messageErrors]
                });
                return;
            }
            const target = data.pane
                ? `${data.session}:${data.window}.${data.pane}`
                : `${data.session}:${data.window}`;
            const targetErrors = validation_1.Validator.validateTmuxTarget(target);
            if (targetErrors.length > 0) {
                callback({
                    success: false,
                    error: 'Invalid target format',
                    errors: targetErrors
                });
                return;
            }
            const success = await tmuxManager.sendMessage(target, data.message);
            callback({ success });
        }
        catch (error) {
            callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    // Capture pane content
    socket.on('capture-pane', async (data, callback) => {
        try {
            const target = data.pane
                ? `${data.session}:${data.window}.${data.pane}`
                : `${data.session}:${data.window}`;
            const content = await tmuxManager.capturePane(target, data.lines);
            callback({ success: true, data: content });
        }
        catch (error) {
            callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    // Create new window
    socket.on('create-window', async (data, callback) => {
        try {
            const success = await tmuxManager.createWindow(data.session, data.name, data.workingDir);
            callback({ success });
        }
        catch (error) {
            callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    // Kill window
    socket.on('kill-window', async (data, callback) => {
        try {
            const success = await tmuxManager.killWindow(data.session, data.window);
            callback({ success });
        }
        catch (error) {
            callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
server.listen(PORT, () => {
    console.log(`AgentMux server running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map