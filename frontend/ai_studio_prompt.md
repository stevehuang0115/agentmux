# AgentMux Frontend AI Studio Prompt

This document describes the interactive user journey and the relationships between the UI components of the AgentMux application. It is intended to guide an AI in understanding how to navigate and operate the frontend.

---

## 1. Core Application Interaction Model

The application is built around three persistent UI structures that work together:

1.  **Collapsible Sidebar:** This is the primary navigation tool. Clicking an item in the sidebar (e.g., "Dashboard", "Projects", "Teams") loads the corresponding page into the `Main Content Area`. It can be collapsed to show only icons, providing more space for the main content.
2.  **Main Content Area:** This is where the primary user workflow for each section occurs. It displays the content for the selected page and is topped by a conditional `OrchestratorStatusBanner` that is only visible when the backend orchestrator process is inactive.
3.  **Slide-out Terminal Panel:** This is a global, interactive component. A floating toggle button at the bottom right opens it. Its primary function is to provide a direct, real-time view into the `tmux` session of any AI agent or the main orchestrator. A dropdown within the panel allows the user to switch between different active sessions. This panel can be opened from anywhere in the application.

---

## 2. Common Interaction Patterns

Several UI patterns are used consistently throughout the application:

-   **List-to-Detail Navigation:** Users typically navigate from a list page (like the Projects or Teams grid) to a detailed view by clicking on a summary component (`ProjectCard`, `TeamCard`).
-   **Modal-based Creation/Editing:** Creating new items (Projects, Teams, Scheduled Messages) is always initiated by a "New..." button or a `CreateCard` with a "+" icon. This action opens a modal form (`ProjectCreator`, `TeamModal`) that overlays the current view, allowing the user to input data without losing context.
-   **Card-based Summaries:** `ProjectCard`, `TeamCard`, and `TeamMemberCard` act as interactive summaries. They display key information at a glance and serve as clickable entry points to more detailed pages or modals. For instance, clicking a team member's icon on a `TeamCard` opens a `TeamMemberModal` with their specific details.

---

## 3. Page-Specific Interaction Flows

### 3.1. Dashboard

The Dashboard is the central hub. The user journey starts here with an overview of the system's status.
-   **Interaction:** Clicking a `ProjectCard` or `TeamCard` navigates the user to that item's `ProjectDetail` or `TeamDetail` page, respectively. Clicking a `CreateCard` opens the corresponding creation modal. Clicking "View All" navigates to the full list page for either Projects or Teams.

### 3.2. Projects & Teams Pages

These pages are for managing lists of projects or teams.
-   **Interaction:** The user can filter the displayed grid of cards using the search input and status dropdowns. The grid updates in real-time based on the filter criteria. Clicking the "New Project" or "New Team" button triggers the `ProjectCreator` or `TeamModal`.

### 3.3. Project Detail Page

This is a multi-faceted view for managing a single project, organized by tabs.
-   **Interaction:**
    -   The user switches between different management contexts by clicking the "Detail", "Editor", "Tasks", and "Teams" tabs.
    -   **Detail Tab:** The user can manage spec files and click buttons to trigger the generation of different task types for the AI agents. These newly created tasks will then appear on the "Tasks" tab.
    -   **Editor Tab:** The user interacts with a file tree on the left. Clicking a file or folder populates the viewer on the right with its content or expands the directory.
    -   **Tasks Tab:** The user interacts with a Kanban board, dragging and dropping tasks between columns (Open, In Progress, etc.) or clicking a task to open a modal with its full details.
    -   **Teams Tab:** The user can see all assigned teams and click a button on a `TeamCard` to unassign that team from the project.

### 3.4. Team Detail Page

This page is for managing a single team and its AI agents.
-   **Interaction:** The primary interaction is with the list of `TeamMemberCard` components.
    -   Each card has controls to **start, stop, edit, or delete** an individual AI agent's process.
    -   A crucial flow is **clicking on a team member's name or status**, which directly opens the `TerminalPanel` and automatically switches it to that specific agent's `tmux` session, allowing for immediate monitoring and interaction.

### 3.5. Assignments Page

This page provides a high-level view of resource allocation.
-   **Interaction:** The main interaction is the **View Toggle**. The user can switch between "Projects View" and "Teams View" to pivot the data, changing the layout to show teams nested under projects, or vice-versa. The "Enhanced Task View" provides an even more granular breakdown of current agent tasks.

### 3.6. Scheduled Messages Page

This page is for automating agent communication.
-   **Interaction:** The user clicks the "New Scheduled Message" button to open a creation modal. They can switch between viewing "Active" and "Completed" messages using the tabs. The delivery logs at the bottom provide a history of message dispatch.

---

## 4. Frontend Source Code File Structure

```
frontend/src/
├── App.css
├── App.tsx
├── main.tsx
├── components/
│   ├── Assignments/
│   │   ├── __tests__/
│   │   │   ├── AssignmentFilters.test.tsx
│   │   │   ├── EmptyState.test.tsx
│   │   │   └── ViewToggle.test.tsx
│   │   ├── AssignmentFilters.tsx
│   │   ├── AssignmentsList.tsx
│   │   ├── EmptyState.tsx
│   │   ├── EnhancedAssignmentsList.test.tsx
│   │   ├── EnhancedAssignmentsList.tsx
│   │   ├── index.ts
│   │   ├── ProjectCard.tsx
│   │   ├── TeamCard.tsx
│   │   ├── types.ts
│   │   └── ViewToggle.tsx
│   ├── Cards/
│   │   ├── CreateCard.tsx
│   │   ├── ProjectCard.tsx
│   │   └── TeamCard.tsx
│   ├── Dashboard/
│   │   ├── __tests__/
│   │   │   ├── DashboardHeader.test.tsx
│   │   │   ├── DashboardNavigation.test.tsx
│   │   │   ├── EmptyTerminalState.test.tsx
│   │   │   └── LoadingSpinner.test.tsx
│   │   ├── DashboardHeader.tsx
│   │   ├── DashboardNavigation.tsx
│   │   ├── EmptyTerminalState.tsx
│   │   ├── index.ts
│   │   ├── LoadingSpinner.tsx
│   │   ├── ProjectInfoPanel.tsx
│   │   ├── QuickActionsPanel.tsx
│   │   ├── RecentActivityPanel.tsx
│   │   ├── TerminalPanel.tsx
│   │   └── types.ts
│   ├── Dashboard.tsx
│   ├── Editor/
│   │   ├── CodeEditor.tsx
│   │   ├── FileTree.tsx
│   │   ├── index.ts
│   │   └── MarkdownEditor.tsx
│   ├── ErrorBoundary.test.tsx
│   ├── ErrorBoundary.tsx
│   ├── ErrorDashboard/
│   │   └── ErrorDashboard.tsx
│   ├── Kanban/
│   │   ├── index.ts
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanCard.tsx
│   │   ├── KanbanColumn.tsx
│   │   └── TaskModal.tsx
│   ├── Layout/
│   │   ├── AppLayout.test.tsx
│   │   ├── AppLayout.tsx
│   │   ├── Navigation.test.tsx
│   │   └── Navigation.tsx
│   ├── LoadingStates.tsx
│   ├── MarkdownEditor/
│   │   ├── MarkdownEditor.css
│   │   └── MarkdownEditor.tsx
│   ├── Modals/
│   │   ├── ProjectCreator.tsx
│   │   ├── TeamAssignmentModal.tsx
│   │   ├── TeamMemberModal.tsx
│   │   ├── TeamModal.test.tsx
│   │   └── TeamModal.tsx
│   ├── OrchestratorStatusBanner.tsx
│   ├── ProjectDetail/
│   │   ├── DetailView.test.tsx
│   │   ├── DetailView.tsx
│   │   ├── EditorView.test.tsx
│   │   ├── EditorView.tsx
│   │   ├── TaskCreateModal.test.tsx
│   │   ├── TaskCreateModal.tsx
│   │   ├── TasksView.test.tsx
│   │   ├── TasksView.tsx
│   │   ├── TeamsView.test.tsx
│   │   ├── TeamsView.tsx
│   │   └── types.ts
│   ├── ProjectSelector.tsx
│   ├── ScheduledCheckins/
│   │   ├── __tests__/
│   │   │   ├── EmptyState.test.tsx
│   │   │   ├── ScheduledMessageCard.test.tsx
│   │   │   └── TabNavigation.test.tsx
│   │   ├── DeliveryLogsTable.tsx
│   │   ├── EmptyState.tsx
│   │   ├── hooks/
│   │   │   └── useScheduledMessages.ts
│   │   ├── index.ts
│   │   ├── MessageForm.tsx
│   │   ├── ScheduledMessageCard.test.tsx
│   │   ├── ScheduledMessageCard.tsx
│   │   ├── TabNavigation.tsx
│   │   └── types.ts
│   ├── StartTeamModal.test.tsx
│   ├── StartTeamModal.tsx
│   ├── TeamCreator.tsx
│   ├── TeamDetail/
│   │   ├── AddMemberForm.test.tsx
│   │   ├── AddMemberForm.tsx
│   │   ├── index.ts
│   │   ├── MembersList.tsx
│   │   ├── TeamDescription.tsx
│   │   ├── TeamHeader.test.tsx
│   │   ├── TeamHeader.tsx
│   │   ├── TeamOverview.tsx
│   │   ├── TeamStats.test.tsx
│   │   ├── TeamStats.tsx
│   │   └── types.ts
│   ├── TeamList.tsx
│   ├── TeamMemberCard.tsx
│   ├── TerminalEmulator.tsx
│   ├── TerminalPanel/
│   │   ├── TerminalPanel.test.tsx
│   │   └── TerminalPanel.tsx
│   └── UI/
│       ├── Button.css
│       ├── Button.test.tsx
│       ├── Button.tsx
│       ├── Dialog.tsx
│       ├── Dropdown.css
│       ├── Dropdown.tsx
│       ├── Form.css
│       ├── Form.test.tsx
│       ├── Form.tsx
│       ├── index.ts
│       ├── Modal.css
│       ├── Modal.test.tsx
│       ├── Modal.tsx
│       ├── Popup.css
│       ├── Popup.tsx
│       ├── ScoreCard.css
│       ├── ScoreCard.tsx
│       ├── Toggle.css
│       └── Toggle.tsx
├── contexts/
│   ├── SidebarContext.test.tsx
│   ├── SidebarContext.tsx
│   ├── TerminalContext.test.tsx
│   └── TerminalContext.tsx
├── hooks/
│   ├── useOptimizedData.test.tsx
│   ├── useOptimizedData.ts
│   ├── useResponsive.ts
│   └── useWebSocket.ts
├── pages/
│   ├── Assignments.tsx
│   ├── Dashboard.tsx
│   ├── ProjectDetail.test.tsx
│   ├── ProjectDetail.tsx
│   ├── Projects.test.tsx
│   ├── Projects.tsx
│   ├── ScheduledCheckins.tsx
│   ├── TeamDetail.test.tsx
│   ├── TeamDetail.tsx
│   ├── Teams.test.tsx
│   └── Teams.tsx
├── services/
│   ├── api.service.ts
│   ├── in-progress-tasks.service.test.ts
│   ├── in-progress-tasks.service.ts
│   ├── websocket.service.test.ts
│   └── websocket.service.ts
├── styles/
│   └── components.css
├── test/
│   └── setup.ts
├── types/
│   └── index.ts
└── utils/
    └── api.ts
```