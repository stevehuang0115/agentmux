# AgentMux Lightweight: User Flows

## 1. Getting Started Flow

### First Time Setup

```
User runs: npx agentmux
↓
System checks for tmux (>= 3.2)
↓
Creates ~/.agentmux/ directory
↓
Starts server on localhost:3000
↓
Opens browser automatically
↓
Shows welcome screen with quick tour
```

**Time to value**: < 60 seconds

### Welcome Screen

-   Brief explanation of Projects and Teams concept
-   "Create Your First Project" CTA button
-   Link to simple documentation
-   System status indicator (tmux version, etc.)

## 2. Core Workflow: Project → Team → Assignment

### Step 1: Create Project

```
Dashboard → Projects Tab → "New Project" button
↓
Modal opens with form:
- Project Name (required)
- Filesystem Path (required, with file picker)
- Description (optional)
↓
Click "Create Project"
↓
Project appears in Projects list with "Unassigned" status
```

**User sees**: New project card with green "Unassigned" badge

### Step 2: Create Team

```
Dashboard → Teams Tab → "New Team" button
↓
Modal opens with form:
- Team Name (required)
- Roles section:
  - Orchestrator (required, count = 1)
  - PM (optional, default count = 1)
  - Dev (optional, default count = 1)
  - QA (optional, default count = 1)
  - Custom roles (add more)
↓
Click "Create Team"
↓
Team appears in Teams list with "Idle" status
```

**User sees**: New team card with yellow "Idle" badge

### Step 3: Assign Team to Project

```
Option A - Drag & Drop:
Drag team card onto project card
↓
Assignment created automatically

Option B - Assignment Board:
Dashboard → Assignment Board
↓
See visual grid of Projects (rows) and Teams (columns)
↓
Click intersection cell to create assignment
↓
Confirmation dialog: "Assign Team X to Project Y?"

Option C - From Project:
Project card → "Assign Team" button
↓
Dropdown list of available teams
↓
Select team and confirm
```

**User sees**:

-   Project status changes to "Active (Team: X)"
-   Team status changes to "Active (Project: Y)"
-   Assignment appears in Assignment Board
-   tmux session created in background

## 3. Daily Monitoring Flow

### Dashboard Overview

```
User opens AgentMux dashboard
↓
Sees at-a-glance status:
- Projects: 3 Active, 1 Idle, 2 Archived
- Teams: 2 Active, 1 Idle, 1 Stopped
- Recent Activity timeline (last 24h)
↓
Status refreshes every 30 seconds automatically
```

### Activity Indicators

-   **Green dot**: Active (changes detected in last 5 minutes)
-   **Yellow dot**: Idle (no changes in 5-30 minutes)
-   **Red dot**: Stopped (no changes > 30 minutes or manually stopped)
-   **Gray dot**: Archived/Dismissed

### Quick Actions

From any project/team card:

-   **"Check Now"**: Manual status refresh
-   **"View Activity"**: Show 24-hour activity timeline
-   **"Open Terminal"**: Jump to tmux session (advanced users)

## 4. Spec Management Flow

### Writing Specs

```
Project card → "Edit Specs" button
↓
Spec editor opens with file tree:
- CLAUDE.md (auto-created)
- specs.json (optional)
- README.md (optional)
- Custom files
↓
Select file to edit
↓
Monaco editor with syntax highlighting
↓
Auto-save every 2 seconds
↓
Files written to project filesystem
```

**User sees**: Live file tree, syntax highlighting, auto-save indicator

### Spec Templates

Pre-filled CLAUDE.md template:

```markdown
# Project: {{projectName}}

## Overview

Brief description of what this project does.

## Goals

-   Primary objective
-   Secondary objectives

## Technical Requirements

-   Language/framework preferences
-   Architecture constraints
-   Performance requirements

## Team Structure

-   Orchestrator: Project coordination and planning
-   PM: Requirements and timeline management
-   Dev: Implementation and coding
-   QA: Testing and quality assurance

## Getting Started

Steps for the team to begin work on this project.
```

## 5. Team Management Flow

### Team Controls

From team card or detail view:

**Start/Resume**

```
Team in "Idle" or "Paused" state
↓
Click "Start" button
↓
tmux session created/resumed
↓
Team status → "Active"
```

**Pause**

```
Team in "Active" state
↓
Click "Pause" button
↓
tmux session preserved but marked paused
↓
Team status → "Paused"
```

**Dismiss**

```
Team in any state
↓
Click "Dismiss" button
↓
Confirmation dialog: "This will end the assignment and kill the tmux session"
↓
tmux session terminated
↓
Team status → "Stopped"
↓
Assignment ended
```

**Duplicate**

```
Team card → "Duplicate" button
↓
Modal with pre-filled team configuration
↓
User can modify name and roles
↓
New team created with same structure
```

## 6. Assignment Management Flow

### Assignment Board View

```
Dashboard → Assignment Board tab
↓
Grid layout:
- Rows: Projects
- Columns: Teams
- Cells: Assignment status or empty
↓
Visual indicators:
- Green: Active assignment
- Yellow: Paused assignment
- Empty: Available for assignment
```

### Assignment Actions

From assignment cell:

-   **Pause**: Temporarily stop without ending assignment
-   **Resume**: Restart paused assignment
-   **End**: Terminate assignment and free up team
-   **Switch**: Move team to different project

### Conflict Handling

```
User tries to assign already-assigned team
↓
Warning dialog: "Team X is currently assigned to Project Y"
↓
Options:
- Cancel
- End current assignment and create new one
↓
If confirmed, old assignment ended, new one created
```

## 7. Activity Timeline Flow

### Viewing Activity

```
Project/Team card → "Activity" button
↓
Timeline view opens:
- Horizontal timeline (last 24 hours)
- Colored dots for each 30-minute window
- Hover for details
↓
Dot colors:
- Green: Active periods
- Yellow: Idle periods
- Red: No activity/errors
- Gray: Paused/stopped
```

### Activity Details

```
Hover over timeline dot
↓
Tooltip shows:
- Time period (e.g., "2:30 PM - 3:00 PM")
- Status ("Active", "Idle", "Stopped")
- Activity count (e.g., "5 changes detected")
- Pane details (for teams)
```

## 8. Error Recovery Flows

### tmux Session Lost

```
Team shows "Degraded" status
↓
User clicks "Diagnose" button
↓
System checks tmux sessions
↓
Options presented:
- "Recreate Session": Start fresh tmux session
- "Find Session": Try to locate existing session
- "Dismiss Team": Clean up and start over
```

### Project Path Missing

```
Project shows "Broken" status
↓
User clicks "Fix Path" button
↓
File picker dialog opens
↓
User selects new project directory
↓
System updates project path
↓
Status returns to normal
```

### Port Conflicts

```
Server fails to start (port in use)
↓
CLI automatically tries next available port
↓
Success: Opens browser with new port
↓
Failure: Shows error with manual port option
```

## 9. Shutdown Flow

### Graceful Shutdown

```
User presses Ctrl+C in terminal
↓
System shows "Shutting down AgentMux..."
↓
Saves all data to JSON files
↓
Preserves tmux sessions (doesn't kill them)
↓
Closes server
↓
Shows "AgentMux stopped. tmux sessions preserved."
```

### Browser Behavior

```
Server shuts down
↓
Browser shows "Connection Lost" message
↓
Offers "Retry Connection" button
↓
Graceful degradation - no data loss
```

## 10. Power User Shortcuts

### Keyboard Shortcuts (when implemented)

-   `Ctrl+N`: New Project
-   `Ctrl+T`: New Team
-   `Ctrl+A`: Open Assignment Board
-   `Ctrl+R`: Refresh all data
-   `Ctrl+S`: Save current spec (in editor)

### URL Navigation

-   `/projects` - Projects tab
-   `/teams` - Teams tab
-   `/assignments` - Assignment board
-   `/projects/:id` - Project detail
-   `/teams/:id` - Team detail

This simplified flow removes complex scheduling, real-time updates, and advanced features while maintaining the core value proposition of easy agent team management.
