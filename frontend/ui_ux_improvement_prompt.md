# Stitch AI Prompt: Recreate and Enhance the AgentMux Dashboard

## 1. High-Level Goal

Your task is to generate a set of high-fidelity, modern, and clean UI mockups for a web application called **AgentMux**. This application is a dashboard for managing AI agent teams that work on software projects.

The goal is not just to recreate the existing UI, but to **enhance it**. The final design should feel like a polished, production-ready application. Draw inspiration from the clean, spacious, and professional aesthetic of platforms like **Vercel, Linear, and GitHub**.

**Keywords:** Professional, Clean, Modern, Spacious, Minimalist, Tech-focused, User-friendly.

---

## 2. Core Design System & Aesthetic

-   **Color Palette:** Use a professional and clean color scheme.
    -   **Primary:** A strong, trustworthy blue (e.g., `#2563eb`).
    -   **Background:** A very light gray or off-white (e.g., `#fafafa` or `#f8fafc`) to create a soft, spacious feel.
    -   **Surface:** Pure white (`#ffffff`) for cards and modals to make them pop.
    -   **Text:** Dark slate gray for primary text (`#0f172a`), a lighter gray for secondary text (`#64748b`).
    -   **Accent Colors:** Use green for success/active states, yellow/orange for warnings, and red for errors/danger actions.
-   **Typography:**
    -   Use a clean, sans-serif font like **Inter** or the system default UI font.
    -   Establish a clear type scale for headings, body text, and labels to ensure strong visual hierarchy.
-   **Component Style:**
    -   **Cards:** Use rounded corners (`--radius-lg: 1rem`), subtle borders (`--color-border: #e2e8f0`), and a slight box shadow on hover to create a sense of depth.
    -   **Buttons:** Clean, with clear primary, secondary, and ghost variants. Use icons to supplement text where appropriate.
    -   **Forms:** Inputs and dropdowns should be clean, with clear focus states.

---

## 3. Screen-by-Screen Mockup Generation

Please generate mockups for the following screens and components, based on the detailed descriptions below.

### 3.1. Main Application Layout

-   **Sidebar:** A left-hand vertical navigation bar with icons and labels (e.g., Dashboard, Projects, Teams). It should be collapsible to an icon-only view. The active page link should be clearly highlighted.
-   **Main Content Area:** A spacious area with a light gray background.
-   **Terminal Toggle:** A floating action button (FAB) in the bottom-right corner with a terminal icon.
-   **Slide-out Terminal:** When the FAB is clicked, a dark-themed terminal panel should slide in from the right. It needs a header with a dropdown to switch between different agent sessions (e.g., 'Orchestrator', 'frontend-dev-1').

### 3.2. Dashboard Page

-   **Layout:** A multi-section layout.
-   **Top Section:** A grid of 4 `ScoreCard` components displaying key stats: "Projects", "Teams", "Active", "Running".
-   **Projects Section:** A grid of `ProjectCard` components. Each card should prominently display the project name, its file path, and status (e.g., 'active', 'paused'). Include a "Create New Project" card that looks visually distinct (e.g., dashed border, plus icon).
-   **Teams Section:** Similar to the projects section, but with `TeamCard` components. Each card should show the team name, number of members, and the project it's assigned to. Include a "Create New Team" card.

### 3.3. Projects Page

-   **Layout:** A list/grid view.
-   **Header:** A prominent "New Project" button.
-   **Controls:** A search bar and a dropdown to filter by status.
-   **Content:** A grid of all `ProjectCard` components. If the list is empty, show an "Empty State" illustration with a message like "No projects found."

### 3.4. Project Detail Page (Tabbed Interface)

This is a key screen. The header should display the project name, path, and primary action buttons ("Assign Team", "Start Project").

-   **Detail Tab:**
    -   Show key project metrics in `ScoreCard` components.
    -   Have a "Specification Management" section with list items for "Project Goal" and "User Journey". Each item should have an "Edit" or "Add" button.
    -   Include a section for "Generate Project Tasks" with distinct buttons for creating different types of tasks (e.g., "Create Specs Tasks", "Create Dev Tasks").
-   **Tasks Tab:**
    -   Display a Kanban board with columns: **Open**, **In Progress**, **Done**, **Blocked**.
    -   Each task should be a draggable card within the columns, showing its title, priority, and assignee.
    -   Above the board, show a horizontal scrolling list of "Milestones" which act as filters for the board.
-   **Teams Tab:**
    -   Display a list of `TeamCard` components for all teams assigned to this project. Each card should list the team members and their status.

### 3.5. Teams Page

-   **Layout:** Similar to the Projects page, with a header, search/filter controls, and a grid of `TeamCard` components.
-   **Team Cards:** Each card should clearly display the team name, member count, and assigned project. Clicking a member should feel interactive (hinting at the modal).

### 3.6. Team Detail Page

-   **Header:** Show the team name and primary actions ("Start Team", "Stop Team").
-   **Stats:** A row of `ScoreCard` components showing "Team Status", "Active Members", and "Assigned Project".
-   **Members List:** This is the main focus. Display a list of `TeamMemberCard` components. Each card should show:
    -   Member's name and role.
    -   A clear status indicator (e.g., 'ACTIVE', 'INACTIVE', 'RUNNING').
    -   Action buttons to **Start**, **Stop**, **Edit**, and **Delete** the member agent.
    -   The card should be clickable to open the terminal for that member.

### 3.7. Scheduled Messages Page

-   **Layout:** A two-tab interface for "Active" and "Completed" messages.
-   **Content:** A grid of `ScheduledMessageCard` components. Each card should display the message name, target team/project, and the schedule (e.g., "Every 30 minutes").
-   **Logs:** Below the grid, include a table showing "Message Delivery Logs" with columns for Time, Message, Target, and Status.
