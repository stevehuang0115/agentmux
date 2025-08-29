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
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const tmux_1 = require("./tmux");
const websocketManager_1 = require("./websocketManager");
// import { TmuxController } from './tmuxController'; // DISABLED: node-pty dependency
const validation_1 = require("./validation");
const user_1 = require("./models/user");
const auth_1 = require("./middleware/auth");
const auth_2 = require("./routes/auth");
const FileStorage_1 = require("./services/FileStorage");
const ActivityPoller_1 = require("./services/ActivityPoller");
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
// const tmuxController = new TmuxController(); // DISABLED: node-pty dependency
const fileStorage = new FileStorage_1.FileStorage();
// Basic tmux controller wrapper using tmuxManager for Phase 1
const basicTmuxController = {
    async createSession(sessionName) {
        try {
            const { spawn } = require('child_process');
            const proc = spawn('tmux', ['new-session', '-d', '-s', sessionName]);
            return new Promise((resolve) => {
                proc.on('close', (code) => resolve(code === 0));
                proc.on('error', () => resolve(false));
            });
        }
        catch (error) {
            console.error('Error creating tmux session:', error);
            return false;
        }
    },
    async killSession(sessionName) {
        try {
            const { spawn } = require('child_process');
            const proc = spawn('tmux', ['kill-session', '-t', sessionName]);
            return new Promise((resolve) => {
                proc.on('close', (code) => resolve(code === 0));
                proc.on('error', () => resolve(false));
            });
        }
        catch (error) {
            console.error('Error killing tmux session:', error);
            return false;
        }
    }
};
const activityPoller = new ActivityPoller_1.ActivityPoller(fileStorage);
const userStore = new user_1.UserStore();
const authService = new auth_1.AuthService(userStore);
const wsManager = new websocketManager_1.WebSocketManager(io, tmuxManager);
// Create default admin user in development
if (process.env.NODE_ENV !== 'production') {
    userStore.createDefaultAdmin();
}
// Start activity polling
activityPoller.start();
// Security middleware - Allow inline scripts for frontend
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
        },
    },
}));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '1mb' }));
// Rate limiting - Disabled in test and development environments
if (process.env.NODE_ENV === 'production') {
    const limiter = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Increased from 100 to 1000 requests per window
        skip: (req) => {
            // Skip rate limiting for localhost
            const isLocalhost = req.ip === '127.0.0.1' ||
                req.ip === '::1' ||
                req.ip === '::ffff:127.0.0.1' ||
                req.hostname === 'localhost';
            return isLocalhost;
        }
    });
    app.use(limiter);
}
else {
    console.log('🔓 Rate limiting disabled for development environment');
}
// Serve Next.js static assets first
app.use('/_next', express_1.default.static(path_1.default.join(__dirname, '../public/react/_next')));
// Static files
app.use(express_1.default.static('public'));
// Root route - serve React build
app.get('/', (req, res) => {
    const reactIndexPath = path_1.default.join(__dirname, '../public/index.html');
    if ((0, fs_1.existsSync)(reactIndexPath)) {
        // Serve React build
        res.sendFile(reactIndexPath);
    }
    else {
        // Fallback to old app.html
        res.redirect('/app.html');
    }
});
// Routes
app.use('/auth', (0, auth_2.createAuthRoutes)(userStore, authService));
// REST API Routes
app.get('/api/sessions', async (req, res) => {
    try {
        console.log('🔍 API: Getting sessions...');
        const sessions = await tmuxManager.listSessions();
        console.log('✅ API: Found sessions:', sessions.length);
        res.json({
            success: true,
            data: sessions,
            timestamp: new Date().toISOString(),
            count: sessions.length
        });
    }
    catch (error) {
        console.error('❌ API: Session fetch failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Projects API
app.get('/api/projects', async (req, res) => {
    try {
        console.log('🔍 API: Getting projects...');
        const projects = await fileStorage.getProjects();
        console.log('✅ API: Found projects:', projects.length);
        res.json({
            success: true,
            data: projects,
            timestamp: new Date().toISOString(),
            count: projects.length
        });
    }
    catch (error) {
        console.error('❌ API: Projects fetch failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/projects', async (req, res) => {
    try {
        console.log('📝 API: Creating project:', req.body);
        const project = await fileStorage.createProject(req.body);
        console.log('✅ API: Project created:', project.id);
        res.json({ success: true, data: project });
    }
    catch (error) {
        console.error('❌ API: Project creation failed:', error);
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.put('/api/projects/:id', async (req, res) => {
    try {
        const project = await fileStorage.updateProject(req.params.id, req.body);
        if (!project) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }
        res.json({ success: true, data: project });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.delete('/api/projects/:id', async (req, res) => {
    try {
        const deleted = await fileStorage.deleteProject(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }
        res.json({ success: true, message: 'Project deleted' });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Teams API
app.get('/api/teams', async (req, res) => {
    try {
        console.log('🔍 API: Getting teams...');
        const teams = await fileStorage.getTeams();
        console.log('✅ API: Found teams:', teams.length);
        res.json({
            success: true,
            data: teams,
            timestamp: new Date().toISOString(),
            count: teams.length
        });
    }
    catch (error) {
        console.error('❌ API: Teams fetch failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/teams', async (req, res) => {
    try {
        console.log('📝 API: Creating team:', req.body);
        const team = await fileStorage.createTeam(req.body);
        console.log('✅ API: Team created:', team.id);
        // Create tmux session for the team
        if (team.name && !team.tmuxSessionName) {
            const sessionName = `agentmux-${team.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            const sessionCreated = await basicTmuxController.createSession(sessionName);
            if (sessionCreated) {
                // Update team with session name
                const updatedTeam = await fileStorage.updateTeam(team.id, {
                    tmuxSessionName: sessionName
                });
                res.json({ success: true, data: updatedTeam || team });
            }
            else {
                res.json({ success: true, data: team, warning: 'Team created but tmux session failed' });
            }
        }
        else {
            res.json({ success: true, data: team });
        }
    }
    catch (error) {
        console.error('❌ API: Team creation failed:', error);
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.put('/api/teams/:id', async (req, res) => {
    try {
        const team = await fileStorage.updateTeam(req.params.id, req.body);
        if (!team) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }
        res.json({ success: true, data: team });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.delete('/api/teams/:id', async (req, res) => {
    try {
        // Get team first to clean up tmux session
        const teams = await fileStorage.getTeams();
        const team = teams.find(t => t.id === req.params.id);
        if (team && team.tmuxSessionName) {
            await basicTmuxController.killSession(team.tmuxSessionName);
        }
        const deleted = await fileStorage.deleteTeam(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Team not found' });
        }
        res.json({ success: true, message: 'Team deleted' });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Assignments API
app.get('/api/assignments', async (req, res) => {
    try {
        console.log('🔍 API: Getting assignments...');
        const assignments = await fileStorage.getAssignments();
        console.log('✅ API: Found assignments:', assignments.length);
        res.json({
            success: true,
            data: assignments,
            timestamp: new Date().toISOString(),
            count: assignments.length
        });
    }
    catch (error) {
        console.error('❌ API: Assignments fetch failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/assignments', async (req, res) => {
    try {
        console.log('📝 API: Creating assignment:', req.body);
        const assignment = await fileStorage.createAssignment(req.body);
        // Update project and team with assignment info
        await fileStorage.updateProject(assignment.projectId, {
            assignedTeamId: assignment.teamId
        });
        await fileStorage.updateTeam(assignment.teamId, {
            assignedProjectId: assignment.projectId
        });
        console.log('✅ API: Assignment created:', assignment.id);
        res.json({ success: true, data: assignment });
    }
    catch (error) {
        console.error('❌ API: Assignment creation failed:', error);
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.put('/api/assignments/:id', async (req, res) => {
    try {
        const assignment = await fileStorage.updateAssignment(req.params.id, req.body);
        if (!assignment) {
            return res.status(404).json({ success: false, error: 'Assignment not found' });
        }
        res.json({ success: true, data: assignment });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
app.delete('/api/assignments/:id', async (req, res) => {
    try {
        const assignments = await fileStorage.getAssignments();
        const assignment = assignments.find(a => a.id === req.params.id);
        if (assignment) {
            // Clean up project and team references
            await fileStorage.updateProject(assignment.projectId, {
                assignedTeamId: undefined
            });
            await fileStorage.updateTeam(assignment.teamId, {
                assignedProjectId: undefined
            });
        }
        const deleted = await fileStorage.deleteAssignment(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Assignment not found' });
        }
        res.json({ success: true, message: 'Assignment deleted' });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Activity API
app.get('/api/activity', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
        console.log('🔍 API: Getting activity...', limit ? `(limit: ${limit})` : '(all)');
        const activityLog = await fileStorage.loadActivity();
        const activity = limit ? activityLog.entries.slice(-limit) : activityLog.entries;
        console.log('✅ API: Found activity entries:', activity.length);
        res.json({
            success: true,
            data: activity,
            timestamp: new Date().toISOString(),
            count: activity.length
        });
    }
    catch (error) {
        console.error('❌ API: Activity fetch failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Activity poller status
app.get('/api/activity/status', async (req, res) => {
    try {
        const isRunning = activityPoller.isRunning();
        const currentStatus = await activityPoller.getCurrentStatus();
        res.json({
            success: true,
            data: {
                polling: isRunning,
                panes: currentStatus
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ API: Activity status fetch failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// WebSocket authentication middleware - BYPASS FOR LOCALHOST
io.use((socket, next) => {
    const isLocalhost = socket.request.connection.remoteAddress === '127.0.0.1' ||
        socket.request.connection.remoteAddress === '::1' ||
        socket.handshake.headers.host?.includes('localhost');
    if (isLocalhost) {
        // Auto-create default user for localhost
        socket.user = {
            id: 'localhost-user',
            username: 'localhost',
            email: 'localhost@agentmux.local',
            passwordHash: '',
            createdAt: new Date(),
            isActive: true
        };
        socket.userId = 'localhost-user';
        return next();
    }
    // Use normal auth for non-localhost
    return authService.authenticateSocket()(socket, next);
});
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
// Catch-all route for React Router (SPA routing) - MUST BE LAST
app.get('*', (req, res) => {
    // Skip API routes and static assets that should 404
    if (req.path.startsWith('/api') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/socket.io') ||
        req.path.startsWith('/_next') ||
        req.path.includes('.')) {
        return res.status(404).send('Not Found');
    }
    const reactIndexPath = path_1.default.join(__dirname, '../public/index.html');
    if ((0, fs_1.existsSync)(reactIndexPath)) {
        res.sendFile(reactIndexPath);
    }
    else {
        res.status(404).send('Not Found');
    }
});
server.listen(PORT, () => {
    const actualPort = server.address()?.port || PORT;
    console.log(`AgentMux server running on port ${actualPort}`);
});
//# sourceMappingURL=server.js.map