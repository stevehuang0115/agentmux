# Crewly Frontend UI/UX Description

This document provides a detailed description of the user interface (UI), user experience (UX), and overall user journey of the Crewly application.

## 1. Overall Application Layout

The application uses a consistent and modern layout across all pages, composed of three main parts:

-   **Collapsible Sidebar Navigation:** A persistent vertical navigation bar on the left side. It contains links to all the main sections of the application. It can be collapsed to a smaller icon-only view to maximize content space.
-   **Main Content Area:** The central part of the screen where the primary content of each page is displayed. It is topped by an `OrchestratorStatusBanner` that alerts the user if the main backend process is not running.
-   **Slide-out Terminal Panel:** A floating toggle button at the bottom right of the screen opens a side panel containing a fully interactive terminal. This is a core feature for users to monitor and interact with the AI agents' underlying `tmux` sessions in real-time.

---

## 2. User Journey & Page Descriptions

### 2.1. Dashboard

The Dashboard is the main landing page, providing a high-level overview of the entire system.

-   **UI Components:**
    -   **Header:** Displays the title "Dashboard" and a brief description.
    -   **Stats Section:** A grid of `ScoreCard` components showing key metrics: Total Projects, Total Teams, Active Teams, and Running Projects.
    -   **Projects Section:**
        -   A grid of `ProjectCard` components displaying the most recent projects. Each card shows the project name, path, status, and team count.
        -   A `CreateCard` with a "+" icon allows for the quick creation of a new project.
        -   A "View All" button navigates to the main Projects page.
    -   **Teams Section:**
        -   A grid of `TeamCard` components for the most recent teams. Each card shows the team name, member count, and assigned project.
        -   A `CreateCard` for quick team creation.
        -   A "View All" button navigates to the main Teams page.

-   **User Flow:** The user gets an immediate snapshot of system activity and can navigate directly to specific projects/teams or to the dedicated list pages.

### 2.2. Projects Page

This page provides a comprehensive view of all projects.

-   **UI Components:**
    -   **Header:** Includes a "New Project" button which opens the `ProjectCreator` modal.
    -   **Controls:** A search input and a status filter dropdown (`All`, `Active`, `Paused`, `Completed`) allow users to find specific projects.
    -   **Projects Grid:** Displays all projects that match the current filters as a grid of `ProjectCard` components.
    -   **Empty State:** If no projects exist or match the filters, a message is displayed with a `Folder` icon.

-   **User Flow:** Users can find any project they are looking for. Clicking a `ProjectCard` navigates them to the `ProjectDetail` page. The "New Project" button or the `CreateCard` opens a modal to add a new project by providing a local file system path.

### 2.3. Project Detail Page

This is the central hub for managing a single project. It uses a tabbed interface.

-   **UI Components:**
    -   **Header:** Displays the project name, description, and file path. It contains primary actions like "Assign Team", "Start/Stop Project", and "Delete Project".
    -   **Tabs:** "Detail", "Editor", "Tasks", and "Teams".

-   **Tab Details:**
    -   **Detail Tab:** Shows project metrics (spec files, tasks) and provides controls to manage specification files (`initial_goal.md`, `initial_user_journey.md`) and generate different types of tasks (Specs, Dev, E2E) for the AI agents.
    -   **Editor Tab:** Features a two-panel layout with a file tree of the project directory on the left and a code/content viewer on the right. This allows users to inspect the project's files directly.
    -   **Tasks Tab:** A comprehensive Kanban-style board. It displays milestones at the top and task columns below (Open, In Progress, Done, Blocked). Users can see all tasks, filter by milestone, and view task details in a modal.
    -   **Teams Tab:** Lists all `TeamCard` components for teams currently assigned to this project. Users can unassign teams from here.

-   **User Flow:** A user selects a project and can then navigate through the different facets of that project, from high-level details and specs to the granular tasks and assigned teams.

### 2.4. Teams Page

This page is for managing all AI agent teams.

-   **UI Components:**
    -   **Header:** Includes a "New Team" button that opens the `TeamModal`.
    -   **Controls:** A search bar and a status filter (`All`, `Active`, `Inactive`).
    -   **Teams Grid:** Displays all teams as `TeamCard` components. Each card shows the team name, description, members, and assigned project.
    -   **Empty State:** Appears if no teams are found.

-   **User Flow:** Users can get an overview of all available teams. Clicking a `TeamCard` navigates to the `TeamDetail` page. Clicking a specific team member on a card opens a `TeamMemberModal` with details about that agent.

### 2.5. Team Detail Page

This page focuses on a single team and its members.

-   **UI Components:**
    -   **Header:** Shows the team name and provides high-level actions like "Start/Stop Team" and "Delete Team".
    -   **Stats Section:** `ScoreCard` components display the team's status, active member count, assigned project, and creation date.
    -   **Members Section:** The core of this page. It lists all members of the team in `TeamMemberCard` components. Each card displays the member's name, role, and status (agent status and working status). It provides controls to edit, delete, start, or stop the agent's session.

-   **User Flow:** Users can manage the composition of a team, edit member details, and control the lifecycle of each AI agent's process. Clicking on a member opens their terminal in the main `TerminalPanel`.

### 2.6. Assignments Page

This page visualizes the connections between projects and teams.

-   **UI Components:**
    -   **View Toggle:** Allows switching between a "Projects View", "Teams View", and an "Enhanced Task View".
    -   **Projects View:** Lists projects and, nested under each, the teams assigned to them.
    -   **Teams View:** Lists teams and, under each, the project they are assigned to.
    -   **Enhanced Task View:** Provides a detailed, project-centric breakdown of what each team member is currently working on, including their active task.

-   **User Flow:** This page is crucial for understanding resource allocation and current work streams at a glance. Users can quickly see which teams are available or which projects are actively being worked on.

### 2.7. Scheduled Messages Page

A utility page for automating communication with agent teams.

-   **UI Components:**
    -   **Header:** A "New Scheduled Message" button opens a creation modal.
    -   **Tabs:** "Active Messages" and "Completed Messages".
    -   **Message Cards:** A grid of `ScheduledMessageCard` components, each representing a scheduled message with its target, schedule, and next run time.
    -   **Delivery Logs:** A table at the bottom shows a history of sent messages and their delivery status.

-   **User Flow:** Users can set up recurring or one-time messages to be sent to specific teams, helping to automate check-ins or commands.

### 2.8. Core Interactive Elements

-   **Terminal Panel:** A key feature, this slide-out panel provides a real-time view into the `tmux` session of any selected agent or the orchestrator. It has a dropdown to switch between active sessions.
-   **Modals:** Used consistently for creation and editing tasks (e.g., `ProjectCreator`, `TeamModal`, `TaskCreateModal`). They overlay the main content and provide focused forms for specific actions.
-   **Cards:** The primary way of displaying summary information for projects, teams, and messages. They are visually consistent and act as entry points to detail pages.
-   **Banners & Alerts:** Used for system-wide notifications (e.g., `OrchestratorStatusBanner`) and for confirming actions or showing errors.
