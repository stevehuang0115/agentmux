# **AgentMux: Product Requirements Document (PRD)**

Version 1.0  
Last Updated: August 27, 2025

### **1\. Introduction & Vision**

**AgentMux** is a web-based graphical user interface (GUI) for the tmux terminal multiplexer, designed specifically for orchestrating and managing teams of AI coding agents. The vision is to transform the complex, command-line-driven workflow of managing multiple AI agents in tmux into a simple, visual, and intuitive experience. By providing a real-time dashboard, AgentMux will empower users to deploy, monitor, and interact with their agent teams with greater efficiency and control, directly from their web browser.

### **2\. Goals & Objectives**

-   **Primary Goal:** To provide a seamless and intuitive web interface for managing tmux sessions that are running AI agent teams.
-   **Key Objectives:**
    -   **Simplify Session Management:** Eliminate the need for complex tmux commands by providing a point-and-click interface for all core functionalities.
    -   **Enhance Visibility:** Offer a real-time, consolidated view of all sessions, windows, and panes, including live terminal output.
    -   **Streamline Agent Orchestration:** Automate the creation of complex project setups and agent team deployments with a single action.
    -   **Improve Interaction:** Enable direct, real-time interaction with any agent in any pane through an integrated web terminal.
    -   **Ensure Ease of Use:** Deliver a "just works" experience with a simple npx agentmux command for setup and launch.

### **3\. Target Audience & User Personas**

-   **Primary Persona: The AI Orchestrator (Developer)**
    -   **Description:** A developer or AI enthusiast who uses multiple AI agents (like Claude) to automate software development tasks. They are comfortable with the command line but find managing numerous tmux sessions for different projects cumbersome.
    -   **Needs:** A way to quickly see the status of all their agent teams, easily switch between projects, and interact with agents without constantly typing tmux commands. They need to debug issues, provide instructions, and monitor progress efficiently.
    -   **Pain Points:** Losing track of which agent is in which session, difficulty in copying logs, and the repetitive nature of setting up new project environments.

### **4\. Features & Functionality**

#### **P1: Must-Have (Core Functionality)**

| Feature ID | Feature Name                    | Description                                                                                                                                           | User Story                                                                                            |
| :--------- | :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| F1.1       | **Session Dashboard**           | A real-time, read-only view of all active tmux sessions, windows, and panes. The UI should display a hierarchical tree structure.                     | As an orchestrator, I want to see all my active sessions at a glance so I can monitor my agent teams. |
| F1.2       | **Live Terminal View**          | Clicking on a pane in the dashboard will display its live, streaming output in a main view. This view should be scrollable.                           | As a developer, I want to view the real-time log output of a specific agent to debug issues.          |
| F1.3       | **Interactive Web Terminal**    | The terminal view will be fully interactive, allowing the user to type and send commands directly to the underlying tmux pane.                        | As an orchestrator, I want to send a command to a specific agent to give it new instructions.         |
| F1.4       | **Session Creation**            | A "New Session" button that allows the user to create a new tmux session. The user can provide a session name and a starting directory.               | As a developer, I want to quickly start a new project session directly from the web app.              |
| F1.5       | **One-Command Setup**           | The entire application (backend, frontend, and necessary scripts) should be runnable with a single command: npx agentmux.                             | As a user, I want a frictionless setup process so I can get started immediately.                      |
| F1.6       | **Automated Script Generation** | The npx command will automatically create the necessary bash scripts (send-claude-message.sh, schedule_with_note.sh) in the user's project directory. | As a user, I want the required helper scripts to be available without manual setup.                   |

#### **P2: Should-Have (High-Value Features)**

| Feature ID | Feature Name                     | Description                                                                                                                           | User Story                                                                                   |
| :--------- | :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- |
| F2.1       | **Window & Pane Management**     | Ability to create new windows/panes and kill existing ones through the UI (e.g., right-click context menu).                           | As an orchestrator, I want to add a new QA agent (a new window) to an existing project.      |
| F2.2       | **Automated Orchestrator Setup** | A dedicated "Create Orchestrator" button that creates a new session, starts claude, and briefs it with the orchestrator instructions. | As a user, I want to set up my main orchestrator agent with a single click.                  |
| F2.3       | **Scheduling Integration**       | A UI element to trigger the schedule_with_note.sh script, allowing the user to schedule checks from the web app.                      | As an orchestrator, I want to schedule a progress check for a developer agent in 30 minutes. |
| F2.4       | **Log Capture**                  | A button to capture the entire scrollback buffer of a pane and download it as a text file.                                            | As a developer, I want to save the full conversation log with an agent for later review.     |
| F2.5       | **API Key Management**           | A secure way for the application to access necessary API keys (e.g., for Claude) via environment variables (`.env` file).             | As a user, I need to securely provide my API keys so the agents can function correctly.      |

#### **P3: Could-Have (Future Enhancements)**

| Feature ID | Feature Name             | Description                                                                                                                               | User Story                                                                                                    |
| :--------- | :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| F3.1       | **Project Templates**    | Allow users to define and save project templates (e.g., "Node.js Backend Team") that specify the window/pane layout and startup commands. | As an orchestrator, I want to spin up my standard "Frontend Team" for a new project without repetitive setup. |
| F3.2       | **Customizable Themes**  | Allow users to change the theme (colors, fonts) of the terminal view.                                                                     | As a user, I want to customize the look and feel of my workspace.                                             |
| F3.3       | **Search Functionality** | A search bar to quickly find sessions, windows, or panes by name.                                                                         | As an orchestrator with many projects, I want to quickly jump to the "glacier-backend" session.               |

### **5\. Success Metrics**

-   **Adoption**: At least 10 active users (internal or external) within the first month of release.
-   **Task Completion Rate**: 95% of users should be able to create a new session and send a command without consulting documentation.
-   **Performance**: The UI must remain responsive (<200ms interaction latency) even with 15+ active sessions.
-   **Reliability**: The application should have a 99.9% uptime during active use, with no more than 1 critical crash per 100 hours of operation.

### **6\. Technical Requirements**

-   **Backend:** Must be a Node.js application. It will be responsible for all interactions with the system's tmux server.
-   **Frontend:** Must be a single-page application (SPA), preferably built with React.
-   **Communication:** Real-time, bidirectional communication between the frontend and backend must be achieved using WebSockets.
-   **Security:** The application will run locally on the user's machine. The server must only be accessible from `localhost`. All shell commands executed must be static or sanitized to prevent injection attacks.
-   **Dependencies:** The user must have `tmux` installed on their system. The `npx` script should check for this dependency and provide a clear error message if it's missing.

### **7\. Assumptions & Constraints**

-   **Operating System:** The initial version will be designed for macOS and Linux environments where `tmux` is natively supported.
-   **Local-Only:** The application is intended for local use only and is not designed to be deployed to a remote server.
-   **Single User:** The architecture assumes a single user is interacting with the application at any given time.

### **8\. Non-Goals (Out of Scope for v1.0)**

-   **Remote Tmux Management:** The application will not support connecting to or managing `tmux` sessions on remote machines.
-   **Full Terminal Replacement:** AgentMux is a `tmux` GUI, not a general-purpose terminal emulator replacement like iTerm2 or Windows Terminal.
-   **Multi-User Collaboration:** All features are designed for a single operator. Real-time collaboration features are not in scope.
-   **Windows Support:** An official Windows version is not in scope for v1.0 due to the lack of native `tmux` support.
