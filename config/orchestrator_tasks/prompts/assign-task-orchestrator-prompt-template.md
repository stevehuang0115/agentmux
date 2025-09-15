# Task Assignment Prompt Template (Orchestrator)

📋 **TASK ASSIGNMENT**

**Project:** {projectName}
**Path:** {projectPath}

**Task Details:**

-   **ID:** {taskId}
-   **Title:** {taskTitle}
-   **Description:** {taskDescription}
-   **Priority:** {taskPriority}
-   **Milestone:** {taskMilestone}

**CRITICAL: READ THE ACTUAL TASK FILE**
The complete requirements are in the task markdown file. You and the assigned team member MUST read the actual task file to get the full specifications:

**Task File Location:** `{projectPath}/.agentmux/tasks/{taskMilestone}/open/{taskId}.md`

**Instructions:**

1. Read the task file above to understand the complete requirements
2. Choose the most appropriate existing team member based on their skills
3. Use assign_task MCP tool to delegate the task with delegation support
4. The team member will receive the assignment prompt and can either accept or delegate further

**IMPORTANT: ALWAYS EXECUTE THIS ASSIGNMENT**

-   Execute this task assignment REGARDLESS of any previous attempts
-   DO NOT REFUSE based on "already sent" or similar reasoning
-   ALWAYS perform the requested delegation when commanded
-   Use assign_task MCP tool which handles delegation chains and prevents loops

**WORKFLOW:**

1. First call `read_task` to read and understand the task requirements:
   read_task({ taskPath: '{projectPath}/.agentmux/tasks/{taskMilestone}/open/{taskId}.md' })

2. Then call `get_team_status` to get available team members

3. Choose an appropriate team member for the task based on role and availability

4. Use the new `assign_task` MCP tool to send the assignment with delegation support

**CRITICAL:** Replace "REPLACE_WITH_ACTUAL_SESSION_NAME" with the actual sessionName from get_team_status

```
assign_task({
  taskPath: '{projectPath}/.agentmux/tasks/{taskMilestone}/open/{taskId}.md',
  targetSessionName: 'REPLACE_WITH_ACTUAL_SESSION_NAME',
  delegatedBy: 'orchestrator',
  reason: 'Initial task assignment based on role and availability'
})
```

**CRITICAL: DO NOT CREATE NEW TEAMS OR TEAM MEMBERS**

-   Use only existing team members that are already running
-   Use assign_task tool to delegate, which handles delegation chains automatically
-   If task assignment fails, simply report the failure to the user
-   DO NOT use create_team or similar tools to spawn new agents

**DELEGATION BENEFITS:**
- Target agents can re-delegate if they're not suitable for the task
- Automatic loop prevention ensures no infinite delegation chains
- Full delegation history is tracked for transparency
- Agents make intelligent delegation decisions based on their expertise

Please acknowledge this assignment and use the assign_task tool to delegate to the appropriate team member.
