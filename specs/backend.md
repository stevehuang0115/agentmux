AgentMux: Backend Design Document
Version 1.0
Last Updated: August 27, 2025

1. Overview
   The AgentMux backend is a Node.js server that acts as the intermediary between the frontend web application and the host system's tmux server. It will expose a WebSocket endpoint for real-time communication and a minimal set of RESTful API endpoints for initial data fetching. Its core responsibility is to execute tmux commands securely and stream I/O from tmux panes to the connected web client.

2. Technology Stack
   Runtime: Node.js 18+

Web Framework: Express.js. Used to serve the frontend static files and handle initial API requests.

WebSocket Server: ws library. A lightweight, high-performance WebSocket server library.

Pseudo-terminal (Pty) Management: node-pty. This library is crucial for creating and managing pseudo-terminals, which allows us to interact with tmux panes as if they were real terminals, capturing their exact state, including colors and cursor position.

CLI Parsing: yargs or commander for parsing command-line arguments when launching the server (e.g., setting the port).

3. Architecture
   The backend will consist of three main parts: an HTTP server, a WebSocket server, and a Tmux service layer.

HTTP Server (server.ts):

Initializes an Express app.

Serves the static frontend build from a public directory.

Defines a few simple REST endpoints for one-off requests (e.g., getting the initial list of sessions).

Upgrades HTTP connections to WebSocket connections.

WebSocket Manager (websocketManager.ts):

Attached to the HTTP server.

Handles the lifecycle of WebSocket connections (connection, message, close).

Maintains a map of connected clients and the tmux panes they are subscribed to.

Routes incoming messages from the client to the appropriate TmuxService method.

Tmux Service (tmuxController.ts):

The core logic layer that interacts with the system's tmux processes.

Uses child_process.exec to run simple, one-off tmux commands (e.g., tmux ls -F ...).

Uses node-pty to spawn and attach to specific tmux panes for interactive, streaming I/O. It will maintain a pool of active pty processes, one for each active terminal view in the frontend.

4. API & WebSocket Protocol
   REST API
   GET /api/sessions

Description: Fetches a structured list of all current tmux sessions, windows, and panes.

Response Body:

[
{
"id": "0",
"name": "agent-project-1",
"windows": [
{
"id": "0:0",
"name": "claude-agent",
"panes": [{ "id": "0:0.0", "tty": "/dev/ttys002" }]
}
]
}
]

WebSocket Protocol
The communication will be based on JSON messages with a type field to identify the action and a payload.

Client-to-Server Messages:

{ type: 'PANE_SUBSCRIBE', payload: { paneId: '0:0.0' } }

Client requests to start receiving real-time output from a specific pane. The backend will spawn a pty attached to this pane.

{ type: 'PANE_UNSUBSCRIBE', payload: { paneId: '0:0.0' } }

Client is no longer viewing this pane. The backend can kill the corresponding pty process.

{ type: 'PANE_INPUT', payload: { paneId: '0:0.0', data: 'ls -la\n' } }

Client sends user input (keystrokes) to a pane.

{ type: 'TERMINAL_RESIZE', payload: { paneId: '0:0.0', cols: 80, rows: 24 } }

Client informs the backend that the terminal dimensions have changed.

Server-to-Client Messages:

{ type: 'PANE_OUTPUT', payload: { paneId: '0:0.0', data: '...' } }

Server streams output from a pane to the client. The data is the raw output from the pty.

{ type: 'SESSIONS_UPDATE', payload: { sessions: [...] } }

Server notifies the client that the tmux session structure has changed (e.g., a new window was created). The payload contains the full, updated session list.

{ type: 'ERROR', payload: { message: 'Failed to create session.' } }

Server sends a structured error message to the client, which can be displayed as a notification.

5. npx Setup Script (index.js)
   This is the entry point when the user runs npx agentmux.

Dependency Check: Verify that tmux is installed on the user's system. If not, exit with a helpful error message.

Script Generation: Check if send-claude-message.sh and schedule_with_note.sh exist in the current directory. If not, create them from embedded templates within the script. Make them executable (chmod +x).

Server Launch: Start the backend Node.js server. The start script (`npm start`) should be configured to concurrently run both the backend server and the frontend Next.js development server, making the entire application available under a single URL.

Browser Launch: Use a library like open to automatically open the user's default web browser to the correct URL (e.g., http://localhost:3000).

Graceful Shutdown: Listen for SIGINT (Ctrl+C) to shut down the server and any child processes gracefully.

6. Security Considerations
   Localhost Binding: The Express server will be explicitly bound to localhost. This is critical to prevent other machines on the network from accessing the server and controlling the user's terminal.

Command Sanitization: While the primary interaction is via node-pty (which is safer than exec), any helper commands that do use exec must be carefully constructed to avoid command injection vulnerabilities, although the risk is low in this local-only application.

Environment Variable Management: The server will use a library like dotenv to load API keys and other configuration from a .env file. This file should be added to .gitignore and a .env.example file will be provided.
