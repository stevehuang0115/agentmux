import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { TmuxManager, TmuxMessage } from './tmux';
import { Validator } from './validation';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const tmuxManager = new TmuxManager();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

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

server.listen(PORT, () => {
  console.log(`AgentMux server running on port ${PORT}`);
});