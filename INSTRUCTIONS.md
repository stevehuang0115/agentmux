# 🚀 AgentMux - Complete Setup & Usage Guide

**AgentMux** is a WebSocket server for tmux session management and AI agent orchestration. Get up and running in seconds with NPX!

## 🚀 Quick Start (NPX)

The fastest way to get started:

```bash
npx agent-mux
```

This single command will:
1. ✅ Auto-generate required scripts
2. ✅ Build the server 
3. ✅ Start the tmux dashboard
4. ✅ Auto-open browser to http://localhost:3001
5. ✅ Create helper scripts in your current directory

## 🎯 Dashboard Access

Once started, visit **http://localhost:3001** to access the tmux dashboard. No authentication required for localhost development.

## 📡 Generated Scripts

AgentMux automatically creates these scripts in your directory:

### `send-claude-message.sh`
Send messages to Claude agents in tmux windows:
```bash
./send-claude-message.sh session:0 "Hello Claude!"
./send-claude-message.sh project:2 "What's your status?"
```

### `schedule_with_note.sh` 
Schedule timed reminders to agents:
```bash
./schedule_with_note.sh 15 "Check progress" tmux-orc:0
./schedule_with_note.sh 30 "Deploy update" project:1
```

## 🌐 Available URLs

Once running, these are available at `http://localhost:3001`:

### Dashboard
- `/` - Main tmux dashboard interface
- `/app.html` - Direct dashboard access

### WebSocket
- `ws://localhost:3001` - WebSocket connection for tmux operations

### Health
- `/health` - Server health check

## 🔧 Manual Installation

For development or custom setups:

```bash
# Clone and install
git clone <repository>
cd agent-mux
npm install

# Development mode
npm run dev

# Production build
npm run build
npm start
```

## 🎯 Tmux Integration

AgentMux provides WebSocket access to tmux operations:

- **List Sessions**: Get all available tmux sessions
- **Send Messages**: Send commands to specific windows/panes
- **Capture Output**: Read pane contents
- **Create Windows**: Spawn new tmux windows
- **Kill Windows**: Remove tmux windows

Access is simplified for localhost development - no authentication barriers!

## ⚙️ Configuration

### Environment Variables
```bash
PORT=3001           # Server port (default: 3001)
NODE_ENV=production # Environment mode
```

### Production Setup
```bash
# Set production mode
export NODE_ENV=production

# Start server
npm start
```

## 🔒 Security Features

- ✅ Input validation and sanitization
- ✅ CORS protection
- ✅ Helmet.js security headers
- ✅ No command injection vulnerabilities
- ✅ Localhost development mode (no auth barriers)

## 🛠️ Development

### File Structure
```
agent-mux/
├── src/
│   ├── server.ts          # Main server
│   ├── tmux.ts           # Tmux manager
│   ├── validation.ts     # Input validation
│   ├── middleware/
│   │   └── auth.ts      # JWT authentication
│   ├── models/
│   │   └── user.ts      # User management
│   └── routes/
│       └── auth.ts      # Auth endpoints
├── public/
│   └── index.html       # Landing page
├── index.js             # NPX entry point
└── package.json
```

### Build Commands
```bash
npm run build      # TypeScript compilation
npm run dev        # Development mode
npm start          # Production server  
npm test           # Run tests
```

## 🚨 Troubleshooting

### Port Already in Use
```bash
# Kill existing processes
pkill -f "agent-mux"
# Or change port
export PORT=3002
```

### NPX Issues
```bash
# Clear NPX cache
npx clear-npx-cache
# Or run with latest
npx agent-mux@latest
```

### tmux Not Found
```bash
# Install tmux (macOS)
brew install tmux

# Install tmux (Ubuntu)
sudo apt-get install tmux
```

## 📚 Examples

### Basic Orchestration Workflow
```bash
# 1. Start AgentMux
npx agent-mux

# 2. Visit dashboard at http://localhost:3001

# 3. Send message to tmux session
./send-claude-message.sh my-project:0 "Start working on the login feature"

# 4. Schedule follow-up
./schedule_with_note.sh 30 "Check login feature progress" my-project:0
```

### WebSocket Connection (JavaScript)
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

// List tmux sessions
socket.emit('list-sessions', (response) => {
  console.log('Sessions:', response.data);
});

// Send message to tmux
socket.emit('send-message', {
  session: 'my-project',
  window: 0,
  message: 'Hello from WebSocket!'
}, (response) => {
  console.log('Message sent:', response.success);
});
```

## 🎉 Getting Started Checklist

- [ ] Run `npx agent-mux`
- [ ] Verify server starts on port 3001
- [ ] Visit http://localhost:3001 dashboard
- [ ] View your tmux sessions
- [ ] Test generated scripts
- [ ] Send a message to Claude agent
- [ ] Schedule a reminder

## 🆘 Support

Having issues? Check:

1. **Server Status**: Visit http://localhost:3001
2. **Logs**: Check terminal output for errors
3. **Dependencies**: Ensure Node.js 16+ and tmux installed
4. **Permissions**: Verify scripts are executable

---

**AgentMux v1.0.0** - Secure, Simple, Powerful Tmux Orchestration