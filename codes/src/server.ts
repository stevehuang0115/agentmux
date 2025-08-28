import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';
import { TmuxManager, TmuxMessage } from './tmux';
import { WebSocketManager } from './websocketManager';
import { TmuxController } from './tmuxController';
import { Validator } from './validation';
import { UserStore } from './models/user';
import { AuthService, AuthenticatedSocket } from './middleware/auth';
import { createAuthRoutes } from './routes/auth';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Initialize services
const tmuxManager = new TmuxManager();
const tmuxController = new TmuxController();
const userStore = new UserStore();
const authService = new AuthService(userStore);
const wsManager = new WebSocketManager(io, tmuxManager);

// Create default admin user in development
if (process.env.NODE_ENV !== 'production') {
  userStore.createDefaultAdmin();
}

// Security middleware - Allow inline scripts for frontend
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting - Disabled in test environment
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  });
  app.use(limiter);
}

// Serve Next.js static assets first
app.use('/_next', express.static(path.join(__dirname, '../public/react/_next')));

// Static files
app.use(express.static('public'));

// Root route - serve React build
app.get('/', (req, res) => {
  const reactIndexPath = path.join(__dirname, '../public/index.html');
  if (existsSync(reactIndexPath)) {
    // Serve React build
    res.sendFile(reactIndexPath);
  } else {
    // Fallback to old app.html
    res.redirect('/app.html');
  }
});

// Routes
app.use('/auth', createAuthRoutes(userStore, authService));

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
  } catch (error) {
    console.error('❌ API: Session fetch failed:', error);
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
    (socket as AuthenticatedSocket).user = {
      id: 'localhost-user',
      username: 'localhost',
      email: 'localhost@agentmux.local',
      passwordHash: '',
      createdAt: new Date(),
      isActive: true
    };
    (socket as AuthenticatedSocket).userId = 'localhost-user';
    return next();
  }
  
  // Use normal auth for non-localhost
  return authService.authenticateSocket()(socket, next);
});

// WebSocket connection handling
io.on('connection', (socket: AuthenticatedSocket) => {
  console.log(`Client connected: ${socket.id} (User: ${socket.user?.username})`);

  // List all tmux sessions
  socket.on('list-sessions', async (callback) => {
    try {
      const sessions = await tmuxManager.listSessions();
      callback({ success: true, data: sessions });
    } catch (error) {
      callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Send message to tmux target
  socket.on('send-message', async (data: TmuxMessage, callback) => {
    try {
      // Validate input
      const sessionErrors = Validator.validateSessionName(data.session);
      const messageErrors = Validator.validateMessage(data.message);
      
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
      
      const targetErrors = Validator.validateTmuxTarget(target);
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
    } catch (error) {
      callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Capture pane content
  socket.on('capture-pane', async (data: { session: string, window: number | string, pane?: number, lines?: number }, callback) => {
    try {
      const target = data.pane 
        ? `${data.session}:${data.window}.${data.pane}`
        : `${data.session}:${data.window}`;
      
      const content = await tmuxManager.capturePane(target, data.lines);
      callback({ success: true, data: content });
    } catch (error) {
      callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Create new window
  socket.on('create-window', async (data: { session: string, name: string, workingDir?: string }, callback) => {
    try {
      const success = await tmuxManager.createWindow(data.session, data.name, data.workingDir);
      callback({ success });
    } catch (error) {
      callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Kill window
  socket.on('kill-window', async (data: { session: string, window: number | string }, callback) => {
    try {
      const success = await tmuxManager.killWindow(data.session, data.window);
      callback({ success });
    } catch (error) {
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
  
  const reactIndexPath = path.join(__dirname, '../public/index.html');
  if (existsSync(reactIndexPath)) {
    res.sendFile(reactIndexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`AgentMux server running on port ${PORT}`);
});