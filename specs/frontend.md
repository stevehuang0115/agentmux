AgentMux: Frontend Design Document
Version 1.0
Last Updated: August 27, 2025

1. Overview
   The AgentMux frontend will be a responsive, modern single-page application (SPA) designed to provide a seamless and interactive user experience for managing tmux sessions. The primary goal is to create an interface that is both powerful for experienced users and intuitive for those less familiar with tmux's command-line interface.

2. Technology Stack
   Framework: Next.js (React 18+) with TypeScript. We will use functional components and Hooks for all UI logic.

Styling: Tailwind CSS. A utility-first CSS framework will allow for rapid and consistent styling. We will use a tailwind.config.js file for custom theme definitions (colors, spacing, fonts).

State Management: Zustand. For its simplicity and minimal boilerplate, Zustand will be used for managing global state, such as the list of sessions and the currently active pane.

Real-time Communication: Native WebSocket API. We will create a dedicated service to manage the WebSocket connection, handle message serialization/deserialization, and manage connection state (connecting, open, closed).

Terminal Emulation: Xterm.js. This library will be used to render a fully functional, high-performance terminal in the browser. We will use its addons for fit (to resize the terminal to its container) and search functionality.

3. Architecture & Component Structure
   The application will follow a modular, component-based architecture.

/src
├── /components
│ ├── /layout
│ │ ├── Sidebar.tsx
│ │ └── MainView.tsx
│ ├── /ui
│ │ ├── Button.tsx
│ │ ├── Modal.tsx
│ │ └── TreeView.tsx
│ ├── Terminal.tsx
│ └── SessionManager.tsx
├── /hooks
│ └── useWebSocket.ts
├── /services
│ └── tmuxService.ts
├── /store
│ └── useStore.ts (Zustand store)
├── /styles
│ └── main.css
└── App.tsx

App.tsx: The root component, responsible for the main layout and routing (if needed in the future).

Sidebar.tsx: Renders the TreeView of sessions, windows, and panes. It will also contain action buttons like "New Session".

MainView.tsx: The main content area that houses the Terminal component for the currently selected pane.

Terminal.tsx: A wrapper around Xterm.js. It will handle terminal initialization and WebSocket data binding. Crucially, it will capture keyboard and clipboard events directly within the terminal view, sending input to the backend in real-time. This approach eliminates the need for a separate <textarea> and "Send" button, providing a seamless, native terminal experience.

SessionManager.tsx: A top-level component that orchestrates the data flow, fetching the initial session list and handling WebSocket events to update the state.

useWebSocket.ts: A custom hook to encapsulate WebSocket connection logic.

tmuxService.ts: A service layer that abstracts the communication with the backend. It will provide methods like getSessions(), createSession(name), sendMessage(paneId, message).

useStore.ts: The central Zustand store for global state, including sessions, activePaneId, and connectionStatus.

4. UI/UX Design
   Layout: A classic two-column dashboard layout.

Left Sidebar (25% width): A collapsible sidebar containing the session TreeView. At the top, a header with the "AgentMux" logo and a "New Session" button.

Main Content (75% width): The MainView which displays the terminal for the active pane. A clear header will show the path of the active pane (e.g., session-name:window-index.pane-index). The terminal view itself must be scrollable to allow users to review previous output.

Interactivity:

TreeView: Sessions, windows, and panes will be clickable. Clicking a pane will make it the active terminal in the MainView.

Context Menus: Right-clicking on a session or window in the TreeView will open a context menu with actions like "Rename Window," "New Window," and "Kill Session."

Modals: Actions like "New Session" will open a clean, centered modal to gather user input (e.g., session name).

Responsiveness: The layout will be fully responsive. On smaller screens (< 768px), the sidebar will be collapsed by default and can be toggled with a hamburger menu icon. The terminal font size will adjust appropriately.

5. State Management (Zustand)
   The global store will manage the following state:

interface AppState {
sessions: TmuxSession[]; // Hierarchical data structure for sessions
activePaneId: string | null;
connectionStatus: 'connecting' | 'open' | 'closed';
actions: {
setSessions: (sessions: TmuxSession[]) => void;
setActivePane: (paneId: string) => void;
// ... other actions to update state based on WebSocket events
}
}

Components will subscribe to this store to get the data they need and use the actions to update the state.

6. Error Handling
   WebSocket Disconnection: A notification (e.g., a toast or a banner) will appear if the WebSocket connection to the backend is lost. The UI will attempt to reconnect automatically with an exponential backoff strategy.

API Errors: Errors from the backend (e.g., failing to create a session) will be displayed to the user in a non-intrusive way, such as a toast notification.

Accessibility (a11y):

The application will adhere to WCAG 2.1 AA standards. This includes:

Semantic HTML: Using appropriate HTML tags (e.g., <nav>, <main>, <button>) to ensure proper document structure.

Keyboard Navigation: All interactive elements will be reachable and operable via the keyboard.

ARIA Roles: Appropriate ARIA roles and attributes will be used where necessary to enhance screen reader compatibility, especially for custom components like the TreeView.

Color Contrast: All text will meet the minimum color contrast ratios.
