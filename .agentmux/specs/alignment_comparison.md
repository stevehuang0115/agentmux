# CODEBASE ALIGNMENT ANALYSIS

## PROJECT_GOAL
This project allows user to "vibe-coding" their Google AppScript projects. 

The core of this app will have two agents, all powered by Gemini:
- The first one is an planner agent (we will build into this app). Its goal is to translate user prompt into specs and then guide the coding agent (gemini-cli) to generate codes, do testing, and using bash scripts to compile and deploy the AppScript

- The second one is the coding agent (which is gemini-cli command line tool). The app should help set up basic environment setup (e.g. API KEY), and run the bash to call gemini-cli to generate codes based on the specs.

For coding:
We will provide some boilerplate templates for gemini-cli to follow to boost the success rate, e.g. how to set frontend (e.g. react components + bundle + build), how to build backend on AppScript stack (e.g. how to integrate with Google workspace API)

The planner agent will also interact in the frontend with the user, trying to understand user's follow-up prompts/intents and then instruct coding agent to change the vibe-coding app.

Finally this project will help user to deploy the generated AppScripts to their own script.google.com (using clasp command line tool). There will be some instructions of how to enable the AppScript API, what is the URL or ScriptId etc. The Planner Agent will help passing these information to user to follow

For testing, since we are generating React components, this project will also create some dummy data to power the React components so that user can view the UI before they ship. So the App should help with all the lifecycle from a user prompt to generate codes to deploy to AppScript as a web app.

## USER_JOURNEY
For login:
- User loads the app, type in any username and password (for now, in the future we will use Google OAuth), and then the typed-in username will be stored in database

For project management:
- Once user signed in, then they can load the projects page to see all the project they created
- They can click into project detail page and view the "vibe-coding" activity in the chat panel, the right side is the area that they can preview the codes (the react frontend codes) or view the raw codes (by toggling the editor)
- They can continue to chat in the chat panel to interact with our planner agent, to modify the vibe-coding project
- They can also click "Deploy" button in this project detail page to deploy to their AppScript account (via clasp command in the backend)

Home page:
- For user that loads the home page directly, they will see a big textarea, and they can type in what they want to build. 
- Once they hit Enter (or Build button), then:
  - If they didn't sign in, we will ask them to sign in, all the prompt are preserved within the same session. Once they signed in, then we will 1) create a project 2) send the prompt they typed earlier to the chat panel
  - If they have signed in, then we will directly create a new project, send the prompt to the chat panel, then the planner agent will start working

Vibe-coding:
- We will have planning stage and coding stage.
- When user's prompt is submitted, the planner agent will use a predefined prompt to generate PRD, Tech Specs, Testing plan, Todo List to let user to review
- Once got user's confirmation, the planner agent will then run gemini-cli to generate codes based on the specs it created
- The planner agent will also notify the user progress and where it is at. Once all the todo items are completed, then the app will render the frontend codes in the preview for user to interact
- Now user can decide to continue improve the codes or deploy

For deploy:
- The app will run clasp command-line tool to deploy. There will be login, create scriptId, create google sheet for storing data etc, and then the Planner Agent will help guide the user to complete this
- Once all the clasp commands are done, then the app will help deploy the codes to user's AppScript, deploy as a web app, and send the appscript url back (stored to the project)
- Now user can click "View App" to load the appscript url to see the web app

## EXISTING_CODEBASE_ANALYSIS

### What the Current Codebase Actually Is:
**AgentMux** - A multi-agent orchestration platform for Claude Code instances via tmux sessions

#### Core Architecture:
- **Backend**: Express.js API server with WebSocket support
- **Frontend**: React dashboard with terminal streaming (xterm.js)
- **MCP Server**: Model Context Protocol server for agent communication
- **CLI Tool**: Command-line interface for system management
- **Agent Management**: Orchestrates multiple Claude Code instances in tmux sessions

#### Key Features Found:
1. **Multi-Agent Team Management**: Creates and manages different types of agents (orchestrator, PM, developer, QA)
2. **Terminal Streaming**: Real-time terminal output monitoring via WebSocket
3. **Ticket System**: YAML-based task tracking in filesystem
4. **Project Management**: Filesystem-based project organization
5. **Scheduled Check-ins**: Automated agent check-in system
6. **Web Dashboard**: Real-time monitoring and control interface

#### Technology Stack:
- **Backend**: Node.js, Express.js, TypeScript, tmux, node-pty
- **Frontend**: React, Vite, TypeScript, xterm.js, TailwindCSS
- **Storage**: File system (JSON configs, YAML tickets, Markdown specs)
- **Communication**: WebSocket, MCP Protocol, tmux messaging

## ALIGNMENT_ISSUES

### **CRITICAL MISALIGNMENT**: Completely Different Applications

1. **Primary Purpose**:
   - **Goal**: Google Apps Script "vibe-coding" tool with Gemini AI agents
   - **Existing**: Multi-agent orchestration platform for Claude Code instances

2. **AI Technology**:
   - **Goal**: Gemini-powered agents (planner + gemini-cli)
   - **Existing**: Claude Code instances managed via tmux

3. **Core Functionality**:
   - **Goal**: Generate, preview, and deploy Google Apps Script projects
   - **Existing**: Orchestrate multiple development agents for general software projects

4. **User Experience**:
   - **Goal**: Chat-based interface with code preview and deploy buttons
   - **Existing**: Terminal monitoring dashboard with team management

5. **Target Platform**:
   - **Goal**: Google Apps Script (script.google.com) deployment via clasp
   - **Existing**: General software development with git-based workflows

6. **Agent Architecture**:
   - **Goal**: Two specific agents (planner + coding via gemini-cli)
   - **Existing**: Multiple role-based agents (orchestrator, PM, dev, QA)

7. **Project Structure**:
   - **Goal**: Single user projects focused on Apps Script generation
   - **Existing**: Team-based collaborative development environment

8. **Authentication**:
   - **Goal**: Simple username/password with future Google OAuth
   - **Existing**: No authentication system mentioned

9. **Code Generation**:
   - **Goal**: React components + Apps Script backend with templates
   - **Existing**: General purpose development with tmux session management

10. **Deployment Pipeline**:
    - **Goal**: clasp-based deployment to script.google.com
    - **Existing**: General git-based development workflows

## RECOMMENDATIONS

### Option 1: Restart Project (RECOMMENDED)
- **Action**: Start fresh with a new codebase aligned to the gas-vibe-coder goals
- **Rationale**: The existing AgentMux system serves a completely different purpose
- **Benefits**: Clean implementation focused on Google Apps Script workflow
- **Timeline**: Fastest path to correct implementation

### Option 2: Massive Refactoring
- **Action**: Completely rewrite AgentMux to match gas-vibe-coder requirements
- **Challenges**: 
  - Remove tmux/terminal management
  - Replace Claude Code with Gemini integration  
  - Rebuild UI for chat-based coding interface
  - Implement clasp deployment pipeline
  - Add authentication system
- **Rationale**: Would essentially be building a new application
- **Risk**: High complexity, potential for confusion

### Option 3: Update Goals to Match Existing Code
- **Action**: Change the project goals to match AgentMux capabilities
- **Challenges**: Would completely abandon the gas-vibe-coder vision
- **Use Case**: If AgentMux itself is the desired outcome

## CONCLUSION

**The existing codebase (AgentMux) has 0% alignment with the stated PROJECT GOAL and USER JOURNEY for gas-vibe-coder.**

This is not a minor feature gap but a fundamental architectural mismatch. The current codebase is a sophisticated multi-agent orchestration platform, while the goal is a Google Apps Script code generation tool with a chat interface.

**Recommendation: Start fresh with a new implementation aligned to the gas-vibe-coder specifications.**