# AgentMux Lightweight: Development Milestones

## ARCHITECTURE PIVOT ALERT 🚨

We are transitioning from the current complex architecture to a **lightweight version** that reduces complexity by ~70% while maintaining core functionality.

## Current State Analysis
- ✅ Existing codebase: Full WebSocket + Auth + Next.js frontend
- ✅ Working but over-engineered for target use case
- ❌ Too complex for single developer local use
- ❌ Database, authentication, real-time WebSockets not needed

## Target Lightweight Architecture
- **Single Node.js Process**: Express server with embedded React frontend
- **File Storage**: Simple JSON files instead of database
- **HTTP Polling**: Replace WebSockets with 30-second polling
- **Local Only**: No authentication, bind to localhost only

---

## Phase 1: Core Foundation (Days 1-2)
**Goal**: Basic working system with essential features

### Backend Tasks
- [ ] **Simplify Express Server** (`src/server.ts`)
  - Remove Socket.IO, authentication middleware
  - Remove rate limiting, CORS complexity
  - Add basic JSON file storage system
  - Create simple REST API structure

- [ ] **Implement FileStorage Class** (`src/services/FileStorage.ts`)
  - `~/.agentmux/data.json` for projects/teams/assignments
  - `~/.agentmux/activity.json` for activity log
  - Simple CRUD operations with file locking

- [ ] **Create Core REST APIs**
  - `GET/POST /api/projects` - Project management
  - `GET/POST /api/teams` - Team management  
  - `GET/POST /api/assignments` - Assignment workflow
  - `GET /api/activity` - Simple activity status

- [ ] **Simplified TmuxController** (`src/tmuxController.ts`)
  - Remove complex session management
  - Basic create/kill/list sessions
  - Simple pane activity detection (byte count)

### Frontend Tasks
- [ ] **Simplify React Frontend** (`frontend/src/`)
  - Remove complex WebSocket logic
  - Replace Zustand with simple React Context
  - Remove authentication components
  - Add simple HTTP polling hook

- [ ] **Create Core Components**
  - ProjectCard, TeamCard, AssignmentBoard
  - Simple status indicators (Active/Idle/Stopped)
  - Basic forms for creating projects/teams

### Deliverable
Working dashboard where you can create projects, teams, and assign them

---

## Phase 2: User Experience (Days 3-4)
**Goal**: Polish the core workflows and add essential UX features

### Activity System
- [ ] **Activity Poller Service** (`src/services/ActivityPoller.ts`)
  - 30-second polling of tmux panes
  - Byte count change detection
  - Status aggregation (pane → team → project)

### UI Polish  
- [ ] **Enhanced Components**
  - Drag & drop for assignment board
  - Activity timeline visualization
  - Loading states and error handling
  - Status badges with clear indicators

### Spec Management
- [ ] **Simple Spec Editor**
  - Basic textarea with syntax highlighting
  - Auto-save to project filesystem
  - Path-jailed file operations for security
  - Support for .md, .txt, .json files

### Deliverable
Polished UI with activity monitoring and spec editing

---

## Phase 3: Reliability & Polish (Days 5-6)
**Goal**: Production-ready reliability and user experience

### Error Handling
- [ ] **Comprehensive Error Boundaries**
  - Graceful degradation for tmux failures
  - User-friendly error messages
  - Clear recovery workflows
  - Logging to `~/.agentmux/logs/agentmux.log`

### CLI & Packaging
- [ ] **NPX Package Structure**
  - Update `index.js` for single-command setup
  - Auto-port detection and browser opening
  - Graceful shutdown handling
  - Check tmux availability on startup

### Performance
- [ ] **Optimizations**
  - Cache tmux session data between polls
  - Debounce API calls
  - Lazy load components
  - Limit activity log size (1000 entries max)

### Deliverable
NPX-installable package ready for users

---

## Critical Changes Required

### Remove from Current Codebase
- ❌ Socket.IO and WebSocket logic
- ❌ Authentication system (JWT, bcrypt, etc.)
- ❌ Database models and migrations
- ❌ Rate limiting middleware
- ❌ Complex state management (Zustand)
- ❌ Real-time terminal streaming

### Simplify to Core Needs
- ✅ Basic REST API with JSON storage
- ✅ Simple React components with Context
- ✅ 30-second HTTP polling instead of real-time
- ✅ Local filesystem integration only
- ✅ Single process architecture

---

## Git Discipline (MANDATORY)
- **30-minute commits**: No exceptions
- **Feature branches**: For each phase milestone  
- **Meaningful messages**: "Add FileStorage JSON operations" not "fixes"
- **Progress tags**: `stable-phase1-$(date +%Y%m%d-%H%M%S)`

## Team Assignments
- **Project Manager**: Coordinate migration, verify simplifications
- **Backend Developer**: Implement FileStorage, REST APIs, remove complexity
- **Frontend Developer**: Simplify components, add polling, remove WebSocket logic
- **QA Engineer**: Test core workflows, verify performance targets

## Success Metrics
- [ ] Startup time < 10 seconds
- [ ] Memory usage < 100MB  
- [ ] CPU usage < 5% when idle
- [ ] Time to first assignment < 5 minutes
- [ ] Works on fresh macOS/Ubuntu systems

The lighthouse approach eliminates ~70% of complexity while maintaining the core AgentMux value proposition.