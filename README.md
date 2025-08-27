# AgentMux

A secure WebSocket server for tmux session management and communication.

## Features

- Real-time WebSocket communication with tmux sessions
- List and manage tmux sessions and windows
- Send messages to specific windows/panes
- Capture pane content
- Input validation and security middleware
- Rate limiting and CORS protection

## Quick Start

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build and run production
npm run build
npm start
```

## API

The server provides WebSocket endpoints for:

- `list-sessions` - Get all tmux sessions and windows
- `send-message` - Send messages to tmux targets
- `capture-pane` - Capture output from tmux panes
- `create-window` - Create new tmux windows
- `kill-window` - Remove tmux windows

## Security

- Input validation on all tmux commands
- Rate limiting (100 requests per 15 minutes)
- Helmet.js security headers
- CORS protection
- No shell injection vulnerabilities

## Port

Server runs on port 3001 by default (configurable via PORT env var).