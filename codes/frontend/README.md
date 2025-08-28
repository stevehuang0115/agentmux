# AgentMux Frontend

Modern React/Next.js frontend for the AgentMux tmux session manager, built with TypeScript and Tailwind CSS.

## Features

- **Modern UI**: Clean, responsive dashboard interface inspired by the UI references
- **Real-time Communication**: Socket.IO integration for live tmux session management
- **TypeScript**: Full type safety throughout the application
- **Tailwind CSS**: Utility-first styling with custom components
- **Component Architecture**: Modular, reusable React components

## Architecture

- **Next.js 15**: App Router with TypeScript and Turbopack
- **Socket.IO Client**: Real-time communication with Express backend
- **Tailwind CSS**: Responsive styling system
- **Lucide React**: Modern icon system

## Development Setup

### Prerequisites

- Node.js 18+ 
- The AgentMux backend server running on port 3001

### Installation

```bash
# Install dependencies
npm install

# Start development server (frontend only)
npm run dev

# Start both backend and frontend together
npm run dev:full
```

### Development URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001 (proxied through Next.js)

## Project Structure

```
frontend/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── page.tsx        # Main dashboard page
│   │   └── ...
│   ├── components/         # React components
│   │   ├── Header.tsx      # App header with connection status
│   │   ├── SessionPanel.tsx # Tmux sessions sidebar
│   │   └── ControlPanel.tsx # Command interface & output
│   └── lib/
│       └── socket.ts       # Socket.IO client manager
├── next.config.ts          # Next.js configuration with proxy setup
└── tailwind.config.ts      # Tailwind CSS configuration
```

## Socket.IO Integration

The frontend communicates with the backend via Socket.IO for:

- **Session Management**: List and monitor tmux sessions
- **Command Execution**: Send commands to specific tmux windows/panes
- **Output Capture**: Retrieve pane content in real-time
- **Window Management**: Create and manage tmux windows

## UI Components

### Header
- Connection status indicator
- Session count display
- Real-time connection monitoring

### SessionPanel  
- Hierarchical session/window display
- Interactive session selection
- Visual status indicators

### ControlPanel
- Terminal output display with monospace font
- Command input with keyboard shortcuts
- Refresh and clear functionality

## API Integration

The frontend uses the following Socket.IO events:

- `list-sessions`: Get all tmux sessions
- `send-message`: Send command to tmux target
- `capture-pane`: Get pane output
- `create-window`: Create new tmux window
- `kill-window`: Close tmux window

## Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

## Proxy Configuration

Development proxy configuration in `next.config.ts` automatically forwards:
- `/socket.io/*` → `http://localhost:3001/socket.io/*`  
- `/api/*` → `http://localhost:3001/*`

This allows seamless development without CORS issues.

## Styling

The UI implements a modern dashboard aesthetic with:
- Clean, minimalist design
- Gradient backgrounds and subtle shadows
- Responsive layout for different screen sizes
- Dark terminal theme for output areas
- Interactive hover states and animations