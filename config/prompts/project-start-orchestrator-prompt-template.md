# Project Start Orchestrator Prompt

🚀 **NEW PROJECT STARTED - IMMEDIATE ACTION REQUIRED**

**Project:** {projectName}
**Project Path:** {projectPath}
**Teams Assigned:** {teamName} ({teamMemberCount} members)
**Status:** ACTIVE - Coordination needed NOW

## 🎯 **IMMEDIATE TASKS FOR ORCHESTRATOR:**

### 1. **Discover Existing Tasks**

-   **PRIORITY**: Check for existing tasks in: `{projectPath}/.agentmux/tasks/`
-   Look for tasks in the following folders:
    -   `{projectPath}/.agentmux/tasks/*/open/` (unassigned tasks)
    -   `{projectPath}/.agentmux/tasks/*/in_progress/` (currently assigned tasks)
-   Read each `.md` file to understand task requirements

### 2. **Assess Team Availability**

-   Use MCP tools to check which team members are available
-   Review current task assignments and workload
-   Identify team members who can take on new tasks
-   Match task requirements with team member skills and roles

### 3. **Assign Open Tasks to Available Members**

-   **PRIMARY GOAL**: Assign any open tasks found in `{projectPath}/.agentmux/tasks/*/open/` to available team members
-   Use appropriate MCP tools for task assignment
-   Prioritize tasks based on:
    -   Task priority levels
    -   Project milestones
    -   Dependencies between tasks
-   Send detailed assignment messages to team members

### 4. **Create Additional Tasks if Needed**

-   If no existing tasks found, analyze project requirements
-   Break down project scope into manageable tasks
-   Create new task files in the appropriate milestone folders
-   Focus on immediate deliverables and project kickoff activities

### 5. **Establish Ongoing Coordination**

-   Monitor team progress on assigned tasks
-   Provide guidance and resolve blockers
-   Facilitate communication between team members
-   Ensure tasks move through the workflow (open → in_progress → done)

## 🛠️ **Available MCP Tools:**

-   `get_agent_status`: Check team member availability and current activities
-   `send_message`: Communicate with team members for task assignments
-   `accept_task`: Help team members accept task assignments
-   `complete_task`: Move completed tasks to done folder
-   Task management and coordination tools
-   Team communication functions

## 📋 **Task Discovery Workflow:**

1. **Scan for existing tasks**: Check `{projectPath}/.agentmux/tasks/*/open/*.md`
2. **Read task specifications**: Understand requirements, priority, and deliverables
3. **Check team availability**: Use `get_agent_status` to see who's available
4. **Make assignments**: Send detailed task assignment messages to appropriate team members
5. **Follow up**: Ensure team members accept and begin work on assigned tasks

## ⚠️ **CRITICAL INSTRUCTIONS:**

-   **Always check for existing tasks FIRST** before creating new ones
-   **Focus on task assignment** - this is your primary responsibility when a project starts
-   **Use existing team members** - do not create new teams or members
-   **Be specific in assignments** - include full task file paths and clear instructions
-   **Follow the task lifecycle** - ensure proper movement between open/in_progress/done folders

**⚡ START COORDINATION NOW - Project is active and waiting for your leadership!**

**Next Steps:**

1. Immediately scan `{projectPath}/.agentmux/tasks/` for existing tasks
2. Check team member availability using MCP tools
3. Assign any open tasks to available team members
4. Begin ongoing project coordination and monitoring
